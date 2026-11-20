-- Ticketeria: as saídas da lista e os envios de divulgação (ticketeria_saidas, ticketeria_envios, ticketeria_envio_destinatarios; fn_ticketeria_novidades_sair): o token do link do e-mail
-- grava a saída da pessoa na loja do envio, uma vez só e para sempre; token que não existe não grava; a mesma pessoa pode sair de uma loja e não da outra; as regras do banco barram
-- e-mail em maiúsculas e ação torta; só quem edita a Ticketeria da organização lê, e ninguém grava pelo navegador; só o servidor executa a função.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61; B (b0): loja 6b. Usuários: a1 (admin A), a3 (leitor A), b1 (admin B).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_saidas_e_envios, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

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






insert into public.ticketeria_envios (id, organization_id, loja_id, assunto, mensagem, segmento) values
  (tv.id('e1'), tv.id('a0'), tv.id('61'), 'Últimas vagas', 'Oi, {nome}!', 'todos_com_aceite'),
  (tv.id('e2'), tv.id('b0'), tv.id('6b'), 'Novidades B', 'Oi!', 'todos_com_aceite');
insert into public.ticketeria_envio_destinatarios (id, organization_id, envio_id, email, nome, token) values
  (tv.id('d1'), tv.id('a0'), tv.id('e1'), 'rita@teste.invalid', 'Rita', tv.id('c1')),
  (tv.id('d3'), tv.id('b0'), tv.id('e2'), 'rita@teste.invalid', 'Rita', tv.id('c3'));

select is(public.fn_ticketeria_novidades_sair(tv.id('c1')), true, 'o token do link grava a saída');
select is((select count(*) from public.ticketeria_saidas where loja_id = tv.id('61') and email = 'rita@teste.invalid'), 1::bigint, 'na loja do envio, com o e-mail em minúsculas');
select is(public.fn_ticketeria_novidades_sair(tv.id('c1')), true, 'clicar de novo não dá erro');
select is((select count(*) from public.ticketeria_saidas where loja_id = tv.id('61')), 1::bigint, 'e continua uma linha só');
select is(public.fn_ticketeria_novidades_sair(tv.id('ff')), false, 'token que não existe: não grava');
select is((select count(*) from public.ticketeria_saidas where loja_id = tv.id('6b')), 0::bigint, 'sair de uma loja não tira da outra');
select is(array[tv.tenta($t$insert into public.ticketeria_saidas (organization_id, loja_id, email) values ('0d760000-0000-4000-8000-0000000000a0', '0d760000-0000-4000-8000-000000000061', 'Rita@Teste.invalid')$t$), tv.tenta($t$update public.ticketeria_envios set acao = 'Ação torta!' where id = '0d760000-0000-4000-8000-0000000000e1'$t$)], array['23514 ticketeria_saidas_email_check', '23514 ticketeria_envios_acao_check'], 'as regras do banco barram e-mail em maiúsculas e ação torta');
insert into public.ticketeria_envio_destinatarios (organization_id, envio_id, email, nome) values (tv.id('a0'), tv.id('e1'), 'x1@teste.invalid', 'X1'), (tv.id('a0'), tv.id('e1'), 'x2@teste.invalid', 'X2');
select is((select count(distinct token) from public.ticketeria_envio_destinatarios where envio_id = tv.id('e1')), 3::bigint, 'cada pessoa de um envio recebe o seu token');
select is(array[tv.como('a1'), tv.ve('ticketeria_envios', 'a'), tv.ve('ticketeria_envio_destinatarios', 'a'), tv.ve('ticketeria_saidas', 'a'), tv.ve('ticketeria_envios', 'b'), tv.volta()], array['como a1', '1', '3', '1', '0', 'volta'], 'quem edita a Ticketeria lê os envios e as saídas da própria organização, e só delas');
select is(array[tv.como('a3'), tv.ve('ticketeria_envios', 'a'), tv.ve('ticketeria_envio_destinatarios', 'a'), tv.ve('ticketeria_saidas', 'a'), tv.volta()], array['como a3', '0', '0', '0', 'volta'], 'o leitor não vê nada (tem e-mail de comprador)');
select is(array[tv.como('b1'), tv.ve('ticketeria_envios', 'a'), tv.ve('ticketeria_saidas', 'a'), tv.volta()], array['como b1', '0', '0', 'volta'], 'a outra organização não vê');
select is(array[tv.como('a1'), tv.efeito($t$insert into public.ticketeria_saidas (organization_id, loja_id, email) values ('0d760000-0000-4000-8000-0000000000a0', '0d760000-0000-4000-8000-000000000061', 'y@teste.invalid')$t$), tv.efeito($t$update public.ticketeria_envios set assunto = 'Outro' where organization_id = '0d760000-0000-4000-8000-0000000000a0'$t$), tv.volta()], array['como a1', '', '', 'volta'], 'ninguém grava pelo navegador');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_novidades_sair(uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_novidades_sair(uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_novidades_sair(uuid)', 'execute'), 'só o servidor executa');

select * from finish();
rollback;
