-- Ticketeria: a porta (ticketeria_ingressos_emitidos.usado_por; fn_ticketeria_conferir_ingresso e fn_ticketeria_porta_resumo): a conferência marca o ingresso como usado uma
-- vez só, responde os cinco resultados (pode entrar, já usado, outra sessão, cancelado, não encontrado), não mostra nada de outra loja e o resumo da sessão.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61, local 51, evento 71, sessões 81 e 82, ingresso 31 (R$ 60). B (b0): loja 6b.
-- Rodar: com as migrations da T2, da T3, ticketeria_pagamentos, ticketeria_custo_do_meio, ticketeria_custo_real_do_pagamento, ticketeria_ingressos_emitidos e a
-- ticketeria_porta, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

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




select tv.reservar('p1', '81', 2);
select tv.reservar('p2', '82', 1);
select public.fn_ticketeria_definir_meio(tv.pedido(n), 'pix', null) from unnest(array['p1', 'p2']) as n;
select public.fn_ticketeria_confirmar_pagamento_real(tv.pedido(n), 'asaas', 'ref-' || n, case n when 'p1' then 12000 else 6000 end, case n when 'p1' then 11800 else 5900 end) from unnest(array['p1', 'p2']) as n;
create table tv.c as select
  (select min(codigo) from public.ticketeria_ingressos_emitidos where pedido_id = tv.pedido('p1')) as a,
  (select max(codigo) from public.ticketeria_ingressos_emitidos where pedido_id = tv.pedido('p1')) as b,
  (select codigo from public.ticketeria_ingressos_emitidos where pedido_id = tv.pedido('p2')) as outra;

select is(public.fn_ticketeria_conferir_ingresso(tv.id('61'), tv.id('81'), (select a from tv.c), tv.id('a1')) ->> 'tipo', 'pode_entrar', 'ingresso válido da sessão: pode entrar');
select is((select usado_em is not null and usado_por = tv.id('a1') from public.ticketeria_ingressos_emitidos where codigo = (select a from tv.c)), true, 'e fica marcado como usado, com quem leu');
select is(public.fn_ticketeria_conferir_ingresso(tv.id('61'), tv.id('81'), (select a from tv.c), tv.id('a1')) ->> 'tipo', 'ja_usado', 'o mesmo ingresso de novo: já foi usado');
select is(public.fn_ticketeria_conferir_ingresso(tv.id('61'), tv.id('81'), (select a from tv.c), tv.id('a1')) ? 'usado_em', true, 'e a resposta traz a hora em que entrou');
select is((select count(*)::int from public.ticketeria_ingressos_emitidos where codigo = (select a from tv.c) and usado_em is not null), 1, 'e não marca duas vezes');
select is((public.fn_ticketeria_conferir_ingresso(tv.id('61'), tv.id('81'), lower((select b from tv.c)), tv.id('a1')) ->> 'restantes'), '0', 'o código em minúsculas vale; entrou o último, restam 0');
select is(public.fn_ticketeria_conferir_ingresso(tv.id('61'), tv.id('81'), '  ' || substr((select outra from tv.c), 1, 5) || '-' || substr((select outra from tv.c), 6) || ' ', tv.id('a1')) ->> 'tipo', 'outra_sessao', 'o código com espaço e traço é lido; ingresso de outra sessão: não vale nesta');
select is(public.fn_ticketeria_conferir_ingresso(tv.id('61'), tv.id('81'), (select outra from tv.c), tv.id('a1')) ?& array['evento', 'sessao_inicio', 'sessao_fuso'], true, 'a resposta de outra sessão diz de qual (evento, dia e fuso)');
select is((select usado_em is null from public.ticketeria_ingressos_emitidos where codigo = (select outra from tv.c)), true, 'e não marca o ingresso da outra sessão');
select is(public.fn_ticketeria_conferir_ingresso(tv.id('61'), tv.id('81'), 'ZZZZ222233', tv.id('a1')) ->> 'tipo', 'nao_encontrado', 'código que não existe');
select is(array[public.fn_ticketeria_conferir_ingresso(tv.id('61'), tv.id('81'), '', tv.id('a1')) ->> 'tipo', public.fn_ticketeria_conferir_ingresso(tv.id('61'), tv.id('81'), null, tv.id('a1')) ->> 'tipo'], array['nao_encontrado', 'nao_encontrado'], 'código vazio ou nulo: não encontrado');
update public.ticketeria_ingressos_emitidos set cancelado_em = now() where codigo = (select outra from tv.c);
select is(public.fn_ticketeria_conferir_ingresso(tv.id('61'), tv.id('82'), (select outra from tv.c), tv.id('a1')) ->> 'tipo', 'cancelado', 'ingresso cancelado (reembolso): não vale, e não é marcado');
select is((select usado_em is null from public.ticketeria_ingressos_emitidos where codigo = (select outra from tv.c)), true, 'o cancelado segue sem uso');
select is(tv.tenta($t$select public.fn_ticketeria_conferir_ingresso('0d760000-0000-4000-8000-00000000006b', '0d760000-0000-4000-8000-000000000081', 'ABCDEFGHJK', null)$t$), '23514 sessao_inexistente', 'sessão que não é da loja: erro');
select is(tv.tenta($t$select public.fn_ticketeria_conferir_ingresso('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000ff', 'ABCDEFGHJK', null)$t$), '23514 sessao_inexistente', 'sessão que não existe: erro');

-- Outra loja: o ingresso da loja A, lido na sessão da loja B, não aparece (nem nome nem sessão).
insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tv.id('b0'), 'ticketeria', 'cortesia', 5) on conflict do nothing;
insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tv.id('5b'), tv.id('b0'), tv.id('6b'), 'Teatro B');
insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tv.id('7b'), tv.id('b0'), tv.id('6b'), 'Outro evento', 'publicado');
insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (tv.id('8b'), tv.id('b0'), tv.id('7b'), tv.id('5b'), now() + interval '10 days');
select is(public.fn_ticketeria_conferir_ingresso(tv.id('6b'), tv.id('8b'), (select b from tv.c), tv.id('b1')), jsonb_build_object('tipo', 'nao_encontrado', 'codigo', (select b from tv.c)), 'ingresso de outra loja: nao_encontrado, sem nada dele na resposta');

select is((public.fn_ticketeria_porta_resumo(tv.id('61'), tv.id('81')) ->> 'validos'), '2', 'o resumo: dois ingressos válidos na sessão');
select is((public.fn_ticketeria_porta_resumo(tv.id('61'), tv.id('81')) ->> 'entraram'), '2', 'os dois já entraram');
select is((public.fn_ticketeria_porta_resumo(tv.id('61'), tv.id('81')) -> 'recentes' -> 0 ->> 'comprador'), 'Rita Teste', 'as últimas entradas trazem o comprador');
select is(jsonb_array_length(public.fn_ticketeria_porta_resumo(tv.id('61'), tv.id('81')) -> 'recentes'), 2, 'e são as que entraram');
select is((public.fn_ticketeria_porta_resumo(tv.id('61'), tv.id('82')) ->> 'validos') || '|' || (public.fn_ticketeria_porta_resumo(tv.id('61'), tv.id('82')) ->> 'entraram'), '0|0', 'o cancelado não conta como válido');
select is(tv.tenta($t$select public.fn_ticketeria_porta_resumo('0d760000-0000-4000-8000-00000000006b', '0d760000-0000-4000-8000-000000000081')$t$), '23514 sessao_inexistente', 'resumo de sessão que não é da loja: erro');

select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_conferir_ingresso(uuid, uuid, text, uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_conferir_ingresso(uuid, uuid, text, uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_porta_resumo(uuid, uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_porta_resumo(uuid, uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_conferir_ingresso(uuid, uuid, text, uuid)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_porta_resumo(uuid, uuid)', 'execute'),
          'só o servidor executa as funções da porta');

select * from finish();
rollback;
