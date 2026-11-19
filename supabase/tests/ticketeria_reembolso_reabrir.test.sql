-- Ticketeria: tentar de novo um reembolso que falhou (fn_ticketeria_reembolso_reabrir): só reabre o que está `falhou`, de um pedido da loja, devolve o e-mail original e deixa o
-- registro em `recebido` para a lógica decidir de novo; o que já foi estornado ou está na fila por outro motivo não reabre.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61, local 51, evento 71, sessões 81 e 82, ingresso 31 (R$ 60). B (b0): loja 6b.
-- Rodar: com as migrations anteriores da Ticketeria na frente (inclusive ticketeria_reembolsos) e a ticketeria_reembolso_reabrir, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(11);

create schema tv;
grant usage on schema tv to authenticated, anon;

create function tv.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d760000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tv.id(s), 'tv-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a3', 'b1']) as s;
  insert into public.organizations (id, nome) values (tv.id('a0'), 'TV A'), (tv.id('b0'), 'TV B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tv.id('a0'), 'ticketeria', 'cortesia', 20), (tv.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tv.id(o), tv.id(p), papel, '{ticketeria}'::text[] from (values ('a0', 'a1', 'admin'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tv.id('61'), tv.id('a0'), 'Loja A'), (tv.id('6b'), tv.id('b0'), 'Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tv.id('51'), tv.id('a0'), tv.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (tv.id('41'), tv.id('a0'), tv.id('51'), 'Plateia', 100);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tv.id('71'), tv.id('a0'), tv.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values
    (tv.id('81'), tv.id('a0'), tv.id('71'), tv.id('51'), now() + interval '10 days'),
    (tv.id('82'), tv.id('a0'), tv.id('71'), tv.id('51'), now() + interval '10 days'),
    (tv.id('83'), tv.id('a0'), tv.id('71'), tv.id('51'), now() + interval '10 days'),
    (tv.id('84'), tv.id('a0'), tv.id('71'), tv.id('51'), now() + interval '30 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values (tv.id('31'), tv.id('a0'), tv.id('71'), tv.id('41'), 'Inteira', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values (tv.id('21'), tv.id('a0'), tv.id('31'), '1º lote', 0, 6000, 10);
  -- A subconta da Loja A: o titular tem este CPF.
  insert into public.ticketeria_contas_asaas (organization_id, loja_id, asaas_account_id, wallet_id, cpf_cnpj, situacao, banco_codigo, agencia, conta, conta_digito)
  values (tv.id('a0'), tv.id('61'), 'conta-asaas-a', 'carteira-a', '12345678909', 'aprovada', '001', '0001', '123456', '7');
end
$dados$;

create table tv.pedidos (nome text primary key, resposta jsonb);
grant select on tv.pedidos to authenticated, anon;
create function tv.reservar(nome text, sessao text, qtd int) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  r := public.fn_ticketeria_reservar(tv.id(sessao), jsonb_build_array(jsonb_build_object('ingresso_id', tv.id('31'), 'quantidade', qtd)), 'Rita Teste', 'rita@teste.invalid', 15);
  insert into tv.pedidos values (nome, r);
  return r;
end;
$$;
create function tv.pedido(nome text) returns uuid language sql as $$ select (resposta ->> 'pedido_id')::uuid from tv.pedidos where pedidos.nome = pedido.nome $$;

-- O aviso de saque do Asaas, no formato que vimos no teste de verdade: o CPF vem MASCARADO; o que vem inteiro é a conta de destino.
create function tv.p(banco text, agencia text, conta text, digito text) returns jsonb language sql immutable as $$
  select jsonb_build_object('type', 'TRANSFER', 'transfer', jsonb_build_object('type', 'BANK_ACCOUNT', 'bankAccount',
    jsonb_build_object('bank', jsonb_build_object('code', banco), 'agency', agencia, 'account', conta, 'accountDigit', digito, 'cpfCnpj', '***.456.789-**')));
$$;

create function tv.tenta(comando text) returns text language plpgsql as $$
declare nome text;
begin
  begin
    execute comando;
    set constraints all immediate;
    raise exception using errcode = 'CD000', message = 'aceito';
  exception
    when sqlstate 'CD000' then return 'aceito';
    when others then
      get stacked diagnostics nome = constraint_name;
      return sqlstate || ' ' || coalesce(nullif(nome, ''), sqlerrm);
  end;
end;
$$;

create function tv.efeito(comando text) returns text language plpgsql as $$
declare linhas bigint;
begin
  begin
    execute comando;
    get diagnostics linhas = row_count;
    raise exception using errcode = 'CD000', message = linhas::text;
  exception
    when sqlstate 'CD000' then return case when sqlerrm::bigint > 0 then 'sim' else '' end;
    when insufficient_privilege then return '';
    when others then return 'erro ' || sqlstate || ': ' || sqlerrm;
  end;
end;
$$;

create function tv.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using tv.id(o || '0');
  return n::text;
end;
$$;

create function tv.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tv.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tv.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;





select tv.reservar('p1', '81', 1);
select public.fn_ticketeria_definir_meio(tv.pedido('p1'), 'pix', null);
select public.fn_ticketeria_confirmar_pagamento_real(tv.pedido('p1'), 'asaas', 'pay_ref_1', 6000, 5900);
create table tv.cod as select (select codigo from public.ticketeria_pedidos where id = tv.pedido('p1')) as pedido;
create table tv.rb (nome text primary key, id uuid);
create function tv.reg(nome text, email_id text, assunto text) returns uuid language plpgsql as $$
declare r jsonb;
begin
  r := public.fn_ticketeria_reembolso_registrar(email_id, 'rita@teste.invalid', assunto, (select pedido from tv.cod), now());
  insert into tv.rb values (nome, (r ->> 'id')::uuid);
  return (r ->> 'id')::uuid;
end;
$$;
create function tv.rbid(nome text) returns uuid language sql as $$ select id from tv.rb where rb.nome = rbid.nome $$;

select tv.reg('f', 'email-f', 'reembolso - falhou');
select public.fn_ticketeria_reembolso_reivindicar(tv.rbid('f'), tv.pedido('p1'));
select public.fn_ticketeria_reembolso_marcar(tv.rbid('f'), 'falhou', 'o Asaas não estornou: insufficient_balance', tv.pedido('p1'));

select is(tv.tenta(format($t$select public.fn_ticketeria_reembolso_reabrir(%L, '0d760000-0000-4000-8000-00000000006b')$t$, tv.rbid('f'))), '23514 reembolso_nao_reabrivel', 'reembolso de pedido de OUTRA loja não reabre');
select is(public.fn_ticketeria_reembolso_reabrir(tv.rbid('f'), tv.id('61')) ->> 'email_id', 'email-f', 'reabre o que falhou e devolve o e-mail original');
select is((select situacao || '|' || coalesce(motivo, 'sem motivo') from public.ticketeria_reembolsos where id = tv.rbid('f')), 'recebido|sem motivo', 'o registro volta a recebido, sem o motivo da falha');
select is((public.fn_ticketeria_reembolso_registrar('email-f', 'x', 'x', null, now()) ->> 'novo') || '|' || (public.fn_ticketeria_reembolso_registrar('email-f', 'x', 'x', null, now()) ->> 'situacao'), 'false|recebido', 'o mesmo e-mail registrado de novo volta o registro existente, em recebido (a lógica retoma dali)');
select is((select recebido_em = (select recebido_em from public.ticketeria_reembolsos where id = tv.rbid('f')) from public.ticketeria_reembolsos where id = tv.rbid('f')), true, 'a hora em que o e-mail chegou não muda (reabrir não estende o prazo)');
select is(tv.tenta(format($t$select public.fn_ticketeria_reembolso_reabrir(%L, '0d760000-0000-4000-8000-000000000061')$t$, tv.rbid('f'))), '23514 reembolso_nao_reabrivel', 'reabrir de novo, já em recebido: não faz nada');
select is(public.fn_ticketeria_reembolso_reivindicar(tv.rbid('f'), tv.pedido('p1')), true, 'depois de reaberto, a lógica pode reivindicar o estorno outra vez');

select tv.reg('e', 'email-e', 'reembolso - fora do prazo');
select public.fn_ticketeria_reembolso_marcar(tv.rbid('e'), 'fora_do_prazo', 'x', tv.pedido('p1'));
select is(tv.tenta(format($t$select public.fn_ticketeria_reembolso_reabrir(%L, '0d760000-0000-4000-8000-000000000061')$t$, tv.rbid('e'))), '23514 reembolso_nao_reabrivel', 'só o que falhou reabre: fora do prazo não');
select tv.reg('n', 'email-n', 'reembolso - sem pedido');
select public.fn_ticketeria_reembolso_marcar(tv.rbid('n'), 'falhou', 'x');
select is(tv.tenta(format($t$select public.fn_ticketeria_reembolso_reabrir(%L, '0d760000-0000-4000-8000-000000000061')$t$, tv.rbid('n'))), '23514 reembolso_nao_reabrivel', 'e-mail sem pedido não reabre');
select is(tv.tenta($t$select public.fn_ticketeria_reembolso_reabrir('0d760000-0000-4000-8000-0000000000ff', '0d760000-0000-4000-8000-000000000061')$t$), '23514 reembolso_nao_reabrivel', 'reembolso que não existe: recusa');

select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_reembolso_reabrir(uuid, uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_reembolso_reabrir(uuid, uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_reembolso_reabrir(uuid, uuid)', 'execute'), 'só o servidor executa');

select * from finish();
rollback;
