-- Ticketeria: o aceite de novidades na compra (ticketeria_pedidos.novidades_versao, novidades_aceitas_em e comprador_whatsapp; fn_ticketeria_registrar_novidades): o pedido guarda a versão do
-- texto aceito, a hora e o WhatsApp (só dígitos, com o 55), uma vez só; número fora do formato é ignorado sem recusar o aceite; versão fora do formato e pedido que não existe são
-- recusados; a regra do banco barra número torto; só o servidor executa.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61, local 51, evento 71, sessões 81 e 82, ingresso 31 (R$ 60).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_aceite_de_novidades, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

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
select tv.reservar('p2', '82', 1);
select tv.reservar('p3', '81', 1);
select is((select novidades_versao is null and novidades_aceitas_em is null and comprador_whatsapp is null from public.ticketeria_pedidos where id = tv.pedido('p1')), true, 'o pedido novo não tem aceite de novidades nem WhatsApp');
select lives_ok(format($t$select public.fn_ticketeria_registrar_novidades(%L, '2026-11-20', '5515997124410')$t$, tv.pedido('p1')), 'registra o aceite');
select is((select novidades_versao from public.ticketeria_pedidos where id = tv.pedido('p1')), '2026-11-20', 'guarda a versão do texto aceito');
select is((select comprador_whatsapp from public.ticketeria_pedidos where id = tv.pedido('p1')), '5515997124410', 'e o WhatsApp');
select is((select novidades_aceitas_em is not null from public.ticketeria_pedidos where id = tv.pedido('p1')), true, 'e a hora do aceite');
create table tv.quando as select novidades_aceitas_em as t from public.ticketeria_pedidos where id = tv.pedido('p1');
select lives_ok(format($t$select public.fn_ticketeria_registrar_novidades(%L, '2027-01-01', '5511988887777')$t$, tv.pedido('p1')), 'registrar de novo não dá erro');
select is((select novidades_versao || '|' || comprador_whatsapp || '|' || (novidades_aceitas_em = (select t from tv.quando))::text from public.ticketeria_pedidos where id = tv.pedido('p1')), '2026-11-20|5515997124410|true', 'mas o aceite de um pedido não muda depois (nem a versão, nem o número, nem a hora)');
select lives_ok(format($t$select public.fn_ticketeria_registrar_novidades(%L, '2026-11-20', '123')$t$, tv.pedido('p2')), 'número fora do formato não recusa o aceite');
select is((select novidades_versao || '|' || coalesce(comprador_whatsapp, 'sem número') from public.ticketeria_pedidos where id = tv.pedido('p2')), '2026-11-20|sem número', 'o aceite fica e o número é ignorado');
select is(array[tv.tenta(format($t$select public.fn_ticketeria_registrar_novidades(%L, 'ontem', null)$t$, tv.pedido('p3'))), tv.tenta(format($t$select public.fn_ticketeria_registrar_novidades(%L, null, null)$t$, tv.pedido('p3'))), tv.tenta(format($t$select public.fn_ticketeria_registrar_novidades(%L, '2026-11-20; drop', null)$t$, tv.pedido('p3')))], array['23514 versao_invalida', '23514 versao_invalida', '23514 versao_invalida'], 'versão fora do formato AAAA-MM-DD: recusa');
select is(array[tv.tenta('select public.fn_ticketeria_registrar_novidades(''0d760000-0000-4000-8000-0000000000ff'', ''2026-11-20'', null)'), tv.tenta(format($t$update public.ticketeria_pedidos set comprador_whatsapp = '123' where id = %L$t$, tv.pedido('p3')))], array['23514 pedido_inexistente', '23514 ticketeria_pedidos_comprador_whatsapp_check'], 'pedido que não existe: recusa; e a regra do banco barra número torto');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_registrar_novidades(uuid, text, text)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_registrar_novidades(uuid, text, text)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_registrar_novidades(uuid, text, text)', 'execute'), 'só o servidor executa');

select * from finish();
rollback;
