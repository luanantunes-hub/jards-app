-- Ticketeria: o cadeado do repasse (ticketeria_contas_asaas, ticketeria_validacoes_saque, ticketeria_transferencias_autorizadas;
-- fn_ticketeria_liberado_em, fn_ticketeria_saldo_liberavel e fn_ticketeria_validar_saque).
--
-- A regra de liberação (18h do dia seguinte ao evento no fuso do local; nunca antes de 7 dias da venda), o saldo liberável (parte do produtor
-- com o custo REAL do Asaas; sessão cancelada não libera; saques aprovados descontam), a decisão (saque para a conta do titular dentro do
-- liberável; transferência entre contas e estorno de Pix só com ordem registrada; o resto recusa; idempotente), o registro imutável e quem
-- vê e quem grava. Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX').
--   A (a0): loja 61, local 51, evento 71, sessões 81 (daqui a 10 dias), 82 (já passou), 83 (cancelada), 84 (daqui a 30 dias), ingresso 31 (R$ 60).
-- Rodar: com as migrations da T2, da T3, ticketeria_pagamentos, ticketeria_custo_do_meio e ticketeria_custo_real_do_pagamento na frente, e
-- a ticketeria_validacao_de_saque, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

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
  insert into public.ticketeria_contas_asaas (organization_id, loja_id, asaas_account_id, wallet_id, cpf_cnpj, situacao)
  values (tv.id('a0'), tv.id('61'), 'conta-asaas-a', 'carteira-a', '12345678909', 'aprovada');
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


-- ─── Vendas: A (sessão que já passou), B (sessão daqui a 30 dias), C (sessão cancelada), D (sessão daqui a 10 dias) ───

select tv.reservar('pa', '82', 1); select tv.reservar('pb', '84', 1); select tv.reservar('pc', '83', 1); select tv.reservar('pd', '81', 1);
select public.fn_ticketeria_definir_meio(tv.pedido(n), 'pix', null) from unnest(array['pa', 'pb', 'pc', 'pd']) as n;
select public.fn_ticketeria_confirmar_pagamento_real(tv.pedido(n), 'asaas', 'ref-' || n, 6000, 5901) from unnest(array['pa', 'pb', 'pc', 'pd']) as n;
set constraints all immediate;
update public.ticketeria_pedidos set pago_em = now() - interval '10 days' where id in (tv.pedido('pa'), tv.pedido('pb'), tv.pedido('pc'));
update public.ticketeria_sessoes set inicio = now() - interval '3 days' where id in (tv.id('82'), tv.id('83'));
update public.ticketeria_sessoes set cancelada_em = now() where id = tv.id('83');

-- ─── A regra de liberação ───────────────────────────────────────────────────

select is(public.fn_ticketeria_liberado_em('2026-11-01 12:00-03', '2026-11-20 20:00-03', null, 'America/Sao_Paulo'), '2026-11-21 18:00-03'::timestamptz, 'liberado às 18h do dia seguinte ao evento, no fuso do local');
select is(public.fn_ticketeria_liberado_em('2026-11-19 12:00-03', '2026-11-20 20:00-03', null, 'America/Sao_Paulo'), '2026-11-26 12:00-03'::timestamptz, 'nunca antes de 7 dias da venda: o mínimo do arrependimento vence');
select is(array[public.fn_ticketeria_liberado_em('2026-11-01 12:00-03', '2026-11-21 02:30+00', null, 'America/Sao_Paulo'), public.fn_ticketeria_liberado_em('2026-11-01 12:00-03', '2026-11-21 02:30+00', '2026-11-21 03:30+00', 'America/Manaus')],
          array['2026-11-21 18:00-03'::timestamptz, '2026-11-21 18:00-04'::timestamptz], 'o dia vale no fuso do local (02h30 UTC ainda é dia 20 em São Paulo e no fim da sessão em Manaus é dia 20 às 23h30)');
select is(public.fn_ticketeria_saldo_liberavel('12345678909'), 5751::bigint, 'só a venda da sessão que já passou está liberada: R$ 58,50 − o custo real de R$ 0,99; as outras (sessão futura, sessão cancelada) seguem retidas');
select is(public.fn_ticketeria_saldo_liberavel('99999999999'), 0::bigint, 'quem não tem subconta não tem saldo liberável');

-- ─── A decisão ──────────────────────────────────────────────────────────────

select is(public.fn_ticketeria_validar_saque('TRANSFER', 't1', 'conta_bancaria', '123.456.789-09', 5000, '{"type":"TRANSFER"}'), '{"status": "APPROVED", "motivo": "dentro_do_saldo_liberavel"}'::jsonb, 'saque de R$ 50 para a conta do titular, dentro do liberável: aprova');
select is(public.fn_ticketeria_saldo_liberavel('12345678909'), 751::bigint, 'o que já se aprovou sacar sai do saldo liberável');
select is(array[public.fn_ticketeria_validar_saque('TRANSFER', 't1', 'conta_bancaria', '12345678909', 5000, '{}') ->> 'status', (select count(*)::text from public.ticketeria_validacoes_saque where id_externo = 't1')], array['APPROVED', '1'], 'o mesmo pedido do Asaas recebe a mesma resposta e não grava duas vezes');
select is(public.fn_ticketeria_validar_saque('TRANSFER', 't2', 'conta_bancaria', '12345678909', 752, '{}') ->> 'motivo', 'retido_ate_depois_do_evento', 'um centavo acima do liberável: recusa, retido até depois do evento');
select is(public.fn_ticketeria_validar_saque('TRANSFER', 't3', 'conta_bancaria', '12345678909', 751, '{}') ->> 'status', 'APPROVED', 'exatamente o que sobra: aprova');
select is(public.fn_ticketeria_validar_saque('TRANSFER', 't4', 'conta_bancaria', '12345678909', 1, '{}') ->> 'status', 'REFUSED', 'depois de sacar tudo o liberável, nada mais sai');
select is(public.fn_ticketeria_validar_saque('TRANSFER', 't5', 'conta_bancaria', '00000000000', 100, '{}') ->> 'motivo', 'destino_nao_e_de_produtor_cadastrado', 'saque para um CPF que não é de nenhuma subconta: recusa');
select is(array[public.fn_ticketeria_validar_saque('TRANSFER', 't6', 'conta_bancaria', null, 100, '{}') ->> 'motivo', public.fn_ticketeria_validar_saque('TRANSFER', 't7', 'outro', '12345678909', 100, '{}') ->> 'motivo'],
          array['destino_nao_e_de_produtor_cadastrado', 'operacao_nao_permitida'], 'sem CPF no pedido ou para um destino desconhecido: recusa');
select is(public.fn_ticketeria_validar_saque('TRANSFER', 't8', 'conta_asaas', null, 99, '{}') ->> 'motivo', 'transferencia_sem_ordem_registrada', 'transferência entre contas Asaas sem ordem do Jards: recusa');
insert into public.ticketeria_transferencias_autorizadas (tipo, valor_centavos, motivo) values ('TRANSFER', 99, 'repor a taxa residual para um estorno'), ('PIX_REFUND', 6000, 'reembolso aceito pelo e-mail');
select is(array[public.fn_ticketeria_validar_saque('TRANSFER', 't9', 'conta_asaas', null, 99, '{}') ->> 'status', public.fn_ticketeria_validar_saque('TRANSFER', 't10', 'conta_asaas', null, 99, '{}') ->> 'status'],
          array['APPROVED', 'REFUSED'], 'com a ordem registrada, aprova uma vez; a ordem não vale duas');
select is(array[public.fn_ticketeria_validar_saque('PIX_REFUND', 'r1', 'outro', '11122233344', 6000, '{}') ->> 'status', public.fn_ticketeria_validar_saque('PIX_REFUND', 'r2', 'outro', '11122233344', 6000, '{}') ->> 'status', public.fn_ticketeria_validar_saque('PIX_REFUND', 'r3', 'outro', '11122233344', 5999, '{}') ->> 'status'],
          array['APPROVED', 'REFUSED', 'REFUSED'], 'estorno de Pix: aprova só com a ordem registrada, uma vez, e no valor da ordem');
select is(array[public.fn_ticketeria_validar_saque('BILL', 'b1', 'outro', null, 1000, '{}') ->> 'motivo', public.fn_ticketeria_validar_saque('PIX_QR_CODE', 'q1', 'outro', null, 1000, '{}') ->> 'motivo', public.fn_ticketeria_validar_saque('MOBILE_PHONE_RECHARGE', 'm1', 'outro', null, 1000, '{}') ->> 'motivo', public.fn_ticketeria_validar_saque('PAYMENT_SPLIT', 's1', 'outro', null, 125, '{}') ->> 'motivo'],
          array['operacao_nao_permitida', 'operacao_nao_permitida', 'operacao_nao_permitida', 'operacao_nao_permitida'], 'pagar conta, QR Code, recarga de celular e qualquer outro tipo: recusa');
select is(public.fn_ticketeria_validar_saque('TRANSFER', 'v1', 'conta_bancaria', '12345678909', 0, '{}') ->> 'motivo', 'valor_invalido', 'valor zero ou negativo: recusa');
update public.ticketeria_contas_asaas set situacao = 'bloqueada';
select is(public.fn_ticketeria_validar_saque('TRANSFER', 'bl1', 'conta_bancaria', '12345678909', 1, '{}') ->> 'motivo', 'destino_nao_e_de_produtor_cadastrado', 'subconta bloqueada: nada sai');
update public.ticketeria_contas_asaas set situacao = 'aprovada';

-- ─── O registro e quem pode o quê ───────────────────────────────────────────

select is((select string_agg(id_externo || ':' || decisao || ':' || motivo, ' ' order by created_at, id_externo) from public.ticketeria_validacoes_saque where id_externo in ('t1', 't2', 't5')), 't1:aprovado:dentro_do_saldo_liberavel t2:recusado:retido_ate_depois_do_evento t5:recusado:destino_nao_e_de_produtor_cadastrado', 'cada pedido do Asaas fica registrado com a decisão e o motivo');
select is(array[tv.tenta($t$update public.ticketeria_validacoes_saque set decisao = 'aprovado' where id_externo = 't2'$t$), tv.tenta($t$delete from public.ticketeria_validacoes_saque where id_externo = 't2'$t$)], array['23514 validacao_imutavel', '23514 validacao_imutavel'], 'o registro não se muda nem se apaga');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_validar_saque(text, text, text, text, bigint, jsonb, text)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_validar_saque(text, text, text, text, bigint, jsonb, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_saldo_liberavel(text, timestamptz)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_liberado_em(timestamptz, timestamptz, timestamptz, text)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_validar_saque(text, text, text, text, bigint, jsonb, text)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_saldo_liberavel(text, timestamptz)', 'execute'),
          'as funções só pelo servidor');
select is((select string_agg(tablename || '.' || cmd, ' ' order by tablename) from pg_policies where schemaname = 'public' and tablename in ('ticketeria_contas_asaas', 'ticketeria_validacoes_saque', 'ticketeria_transferencias_autorizadas')),
          'ticketeria_contas_asaas.SELECT ticketeria_transferencias_autorizadas.SELECT ticketeria_validacoes_saque.SELECT', 'só leitura pelo navegador, nas três tabelas');

select tv.como('a1');
select is(array[tv.ve('ticketeria_contas_asaas', 'a'), (select count(*)::text from public.ticketeria_validacoes_saque), (select count(*)::text from public.ticketeria_transferencias_autorizadas)], array['1', '0', '0'], 'quem edita a ticketeria vê a subconta da própria organização, e não o registro dos saques nem as ordens (só o super admin)');
select is(tv.efeito($e$insert into public.ticketeria_contas_asaas (organization_id, loja_id, asaas_account_id, wallet_id, cpf_cnpj) values ('0d760000-0000-4000-8000-0000000000a0', '0d760000-0000-4000-8000-00000000006b', 'x', 'y', '12345678909')$e$), '', 'quem está logado não grava subconta');
select tv.como('a3');
select is(tv.ve('ticketeria_contas_asaas', 'a'), '0', 'o leitor não vê');
select tv.como('b1');
select is(tv.ve('ticketeria_contas_asaas', 'a'), '0', 'outra organização não vê');
select tv.como(null);
select is(tv.efeito('select 1 from public.ticketeria_contas_asaas'), '', 'visitante não vê');
select tv.volta();

select * from finish();
rollback;
