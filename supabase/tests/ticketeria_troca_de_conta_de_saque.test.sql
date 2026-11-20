-- Ticketeria: a troca da conta de saques do produtor (ticketeria_trocas_de_conta; fn_ticketeria_troca_pedir, _confirmar, _cancelar, _estado e
-- fn_ticketeria_aplicar_trocas_vencidas, e a validação de saque que a aplica): código por e-mail (aqui só o hash), 24 horas de espera, cancelamento.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61 (conta 001/0001/123456-7). B (b0): loja 6b (subconta sem conta de saques). C (c0): loja 6c (sem subconta). D (d0): loja 6d (subconta bloqueada).
-- Rodar: com as migrations da T2, da T3, ticketeria_pagamentos, ticketeria_custo_do_meio, ticketeria_custo_real_do_pagamento,
-- ticketeria_validacao_de_saque, ticketeria_chave_da_subconta e ticketeria_saque_por_conta_bancaria na frente, e a ticketeria_troca_de_conta_de_saque,
-- se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

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




create function tv.p(banco text, agencia text, conta text, digito text) returns jsonb language sql immutable as $$
  select jsonb_build_object('type', 'TRANSFER', 'transfer', jsonb_build_object('type', 'BANK_ACCOUNT', 'bankAccount',
    jsonb_build_object('bank', jsonb_build_object('code', banco), 'agencia', agencia, 'agency', agencia, 'account', conta, 'accountDigit', digito, 'cpfCnpj', '***.456.789-**')));
$$;

insert into public.organizations (id, nome) values (tv.id('c0'), 'TV C'), (tv.id('d0'), 'TV D');
insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tv.id('c0'), 'ticketeria', 'cortesia', 5), (tv.id('d0'), 'ticketeria', 'cortesia', 5);
insert into public.ticketeria_lojas (id, organization_id, nome) values (tv.id('6c'), tv.id('c0'), 'Loja sem subconta'), (tv.id('6d'), tv.id('d0'), 'Loja bloqueada');
select public.fn_ticketeria_registrar_conta_asaas(tv.id('61'), 'conta-a', 'carteira-a', '12345678909', 'chave-falsa-da-subconta-0123456789', 'aprovada');
select public.fn_ticketeria_definir_conta_destino(tv.id('61'), '001', '0001', '123456', '7');
select public.fn_ticketeria_registrar_conta_asaas(tv.id('6b'), 'conta-b', 'carteira-b', '98765432100', 'chave-falsa-da-subconta-b-0123456', 'aprovada');
select public.fn_ticketeria_registrar_conta_asaas(tv.id('6d'), 'conta-d', 'carteira-d', '11144477735', 'chave-falsa-da-subconta-d-0123456', 'bloqueada');

select is(public.fn_ticketeria_troca_pedir('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '237', '1234', '98765', '0', 'bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a', now() + interval '15 minutes') is not null, true, 'pede a troca para uma conta nova e devolve o id');
select is((select count(*)::int from public.ticketeria_trocas_de_conta where loja_id = '0d760000-0000-4000-8000-000000000061' and cancelada_em is null and aplicada_em is null), 1, 'fica um pedido aberto');
select is(tv.tenta($t$select public.fn_ticketeria_troca_pedir('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '001', '0001', '123456', '7', '4cc8f4d609b717356701c57a03e737e5ac8fe885da8c7163d3de47e01849c635', now() + interval '15 minutes')$t$), '23514 mesma_conta', 'trocar para a conta que já é a atual: recusa');
select is(public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '91b4d142823f7d20c5f08df69122de43f35f057a988d9619f6d3138485c9a203'), '{"resultado": "codigo_errado", "restantes": 4}'::jsonb, 'código errado: recusa e conta a tentativa');
select is(public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a3', 'bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a') ->> 'resultado', 'sem_pedido', 'só quem pediu confirma: outra pessoa não acha o pedido');
select is(public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', 'bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a') - 'efetiva_em', '{"resultado": "confirmada", "imediata": false}'::jsonb, 'código certo: confirmada, e não vale na hora (já havia conta de saques)');
select is((select efetiva_em - now() from public.ticketeria_trocas_de_conta where loja_id = '0d760000-0000-4000-8000-000000000061' and cancelada_em is null), interval '24 hours', 'vale 24 horas depois da confirmação');
select is((select banco_codigo || ':' || agencia || ':' || conta || ':' || conta_digito from public.ticketeria_contas_asaas where loja_id = '0d760000-0000-4000-8000-000000000061'), '001:0001:123456:7', 'durante a espera a conta de saques continua a antiga');
select is(public.fn_ticketeria_validar_saque('TRANSFER', 'e1', 'conta_bancaria', null, 100, tv.p('237', '1234', '98765', '0')) ->> 'motivo', 'destino_nao_e_de_produtor_cadastrado', 'durante a espera, saque para a conta nova: recusa');
select is(public.fn_ticketeria_validar_saque('TRANSFER', 'e2', 'conta_bancaria', null, 100, tv.p('001', '0001', '123456', '7')) ->> 'motivo', 'retido_ate_depois_do_evento', 'durante a espera, a conta antiga segue reconhecida (aqui sem saldo liberável)');
select is(public.fn_ticketeria_troca_estado('0d760000-0000-4000-8000-000000000061') - 'id' - 'efetiva_em' - 'codigo_expira_em', '{"banco": "237", "agencia": "1234", "conta": "98765", "digito": "0", "confirmada": true, "pedida_por": "0d760000-0000-4000-8000-0000000000a1"}'::jsonb, 'o estado mostra a troca confirmada, sem o hash do código');
select is(public.fn_ticketeria_troca_cancelar('0d760000-0000-4000-8000-000000000061'), 1, 'cancelar durante a espera cancela o pedido');
select is(array[public.fn_ticketeria_troca_estado('0d760000-0000-4000-8000-000000000061')::text, public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', 'bcb15f821479b4d5772bd0ca866c00ad5f926e3580720659cc80d39c9d09802a') ->> 'resultado'], array[null, 'sem_pedido']::text[], 'depois de cancelar não há troca aberta nem o que confirmar');
select public.fn_ticketeria_troca_pedir('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '237', '1234', '98765', '0', '68487dc295052aa79c530e283ce698b8c6bb1b42ff0944252e1910dbecdc5425', now() + interval '15 minutes');
select is(public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '68487dc295052aa79c530e283ce698b8c6bb1b42ff0944252e1910dbecdc5425') ->> 'resultado', 'confirmada', 'novo pedido confirmado');
update public.ticketeria_trocas_de_conta set efetiva_em = now() - interval '1 minute' where loja_id = '0d760000-0000-4000-8000-000000000061' and cancelada_em is null and aplicada_em is null;
select is(public.fn_ticketeria_validar_saque('TRANSFER', 'e3', 'conta_bancaria', null, 100, tv.p('237', '1234', '98765', '0')) ->> 'motivo', 'retido_ate_depois_do_evento', 'passadas as 24 horas, a conta nova é reconhecida pelo saque (aqui sem saldo liberável)');
select is(public.fn_ticketeria_validar_saque('TRANSFER', 'e4', 'conta_bancaria', null, 100, tv.p('001', '0001', '123456', '7')) ->> 'motivo', 'destino_nao_e_de_produtor_cadastrado', 'e a conta antiga deixa de valer');
select is((select banco_codigo || ':' || agencia || ':' || conta || ':' || conta_digito from public.ticketeria_contas_asaas where loja_id = '0d760000-0000-4000-8000-000000000061'), '237:1234:98765:0', 'a conta de saques passou a ser a nova');
select is((select aplicada_em is not null from public.ticketeria_trocas_de_conta where loja_id = '0d760000-0000-4000-8000-000000000061' and confirmada_em is not null and cancelada_em is null), true, 'o pedido ficou marcado como aplicado');
select public.fn_ticketeria_troca_pedir('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '341', '0001', '55555', '1', '69f7f7a7f8bca9970fa6f9c0b8dad06901d3ef23fd599d3213aa5eee5621c3e3', now() + interval '15 minutes');
select public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', 'a1e273abeb37780fd977adf9d0dd20e8e9c9bcc02eede689013c4960921a3439');
select public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', 'edd2d6e268c91767749b700e54f63b009cbed64f93bf5cfcb3c857847a181cda');
select public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '1ec94090e4f76aba28a11ca85f6fd9f5f5d549f854c0411428d7827094b6948a');
select public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '09101f001c5b547cd67c37612ff85552badf5b8f30530de35176e10f209b9cc2');
select is(public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '5063f237b94e999f85b93e5385805103d1fb911ec8c28a6de1f7a29e0dc87258') ->> 'resultado', 'tentativas_esgotadas', 'a quinta tentativa errada mata o pedido');
select is(public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '69f7f7a7f8bca9970fa6f9c0b8dad06901d3ef23fd599d3213aa5eee5621c3e3') ->> 'resultado', 'sem_pedido', 'com o pedido morto nem o código certo confirma');
select public.fn_ticketeria_troca_pedir('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '341', '0001', '55555', '1', 'af41e68e1309fa29a5044cbdc36b90a3821d8807e68c7675a6c495112bc8a55f', now() - interval '1 minute');
select is(public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', 'af41e68e1309fa29a5044cbdc36b90a3821d8807e68c7675a6c495112bc8a55f') ->> 'resultado', 'codigo_expirado', 'código vencido (15 minutos): recusa');
select public.fn_ticketeria_troca_pedir('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '341', '0001', '55555', '1', '94edf28c6d6da38fd35d7ad53e485307f89fbeaf120485c8d17a43f323deee71', now() + interval '15 minutes');
select public.fn_ticketeria_troca_pedir('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '341', '0001', '55555', '2', 'ec4c88ca7f69534f10c0611c1ecd13e7c2cdf73e1b915e9fd0cf27ac10da43fa', now() + interval '15 minutes');
select is(array[(select count(*)::text from public.ticketeria_trocas_de_conta where loja_id = '0d760000-0000-4000-8000-000000000061' and cancelada_em is null and aplicada_em is null), public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '94edf28c6d6da38fd35d7ad53e485307f89fbeaf120485c8d17a43f323deee71') ->> 'resultado'], array['1', 'codigo_errado'], 'um pedido novo cancela o anterior: o código do primeiro não serve mais');
select is(public.fn_ticketeria_troca_cancelar('0d760000-0000-4000-8000-000000000061'), 1, 'limpa o pedido aberto');
select public.fn_ticketeria_troca_pedir('0d760000-0000-4000-8000-00000000006b', '0d760000-0000-4000-8000-0000000000a1', '260', '0001', '777', null, '92925488b28ab12584ac8fcaa8a27a0f497b2c62940c8f4fbc8ef19ebc87c43e', now() + interval '15 minutes');
select is(public.fn_ticketeria_troca_confirmar('0d760000-0000-4000-8000-00000000006b', '0d760000-0000-4000-8000-0000000000a1', '92925488b28ab12584ac8fcaa8a27a0f497b2c62940c8f4fbc8ef19ebc87c43e') - 'efetiva_em', '{"resultado": "confirmada", "imediata": true}'::jsonb, 'sem conta de saques ainda: vale na hora');
select is((select banco_codigo || ':' || agencia || ':' || conta from public.ticketeria_contas_asaas where loja_id = '0d760000-0000-4000-8000-00000000006b'), '260:0001:777', 'e a conta de saques fica definida');
select is(array[tv.tenta($t$select public.fn_ticketeria_troca_pedir('0d760000-0000-4000-8000-00000000006c', '0d760000-0000-4000-8000-0000000000a1', '260', '0001', '777', null, '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b', now() + interval '15 minutes')$t$), tv.tenta($t$select public.fn_ticketeria_troca_pedir('0d760000-0000-4000-8000-00000000006d', '0d760000-0000-4000-8000-0000000000a1', '260', '0001', '777', null, '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b', now() + interval '15 minutes')$t$)], array['23514 conta_inexistente', '23514 conta_bloqueada'], 'loja sem subconta ou com subconta bloqueada: não há o que trocar');
select is(array[tv.tenta($t$select public.fn_ticketeria_troca_pedir('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '1', '0001', '777', null, '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b', now() + interval '15 minutes')$t$), tv.tenta($t$select public.fn_ticketeria_troca_pedir('0d760000-0000-4000-8000-000000000061', '0d760000-0000-4000-8000-0000000000a1', '260', '0001', '777', null, 'nao-e-hash', now() + interval '15 minutes')$t$)], array['23514 ticketeria_trocas_de_conta_destino_check', '23514 ticketeria_trocas_de_conta_hash_check'], 'banco que não tem 3 dígitos e código sem hash de verdade: a tabela recusa');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_aplicar_trocas_vencidas()', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_aplicar_trocas_vencidas()', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_troca_pedir(uuid, uuid, text, text, text, text, text, timestamptz)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_troca_pedir(uuid, uuid, text, text, text, text, text, timestamptz)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_troca_confirmar(uuid, uuid, text)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_troca_confirmar(uuid, uuid, text)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_troca_cancelar(uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_troca_cancelar(uuid)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_troca_estado(uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_troca_estado(uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_aplicar_trocas_vencidas()', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_troca_pedir(uuid, uuid, text, text, text, text, text, timestamptz)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_troca_confirmar(uuid, uuid, text)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_troca_cancelar(uuid)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_troca_estado(uuid)', 'execute'),
          'as funções da troca só o servidor executa');
select tv.como('a1');
select is(tv.efeito('select 1 from public.ticketeria_trocas_de_conta'), '', 'quem está logado, mesmo editando a Ticketeria, não lê os pedidos de troca (guardam o hash do código)');
select tv.volta();
select tv.como(null);
select is(tv.efeito('select 1 from public.ticketeria_trocas_de_conta'), '', 'visitante também não');
select tv.volta();

select * from finish();
rollback;
