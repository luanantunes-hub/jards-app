-- Ticketeria: o reembolso por e-mail (ticketeria_reembolsos; fn_ticketeria_reembolso_registrar, _reivindicar, _marcar, _autorizar_estorno e _concluir;
-- fn_ticketeria_pedido_para_reembolso; ticketeria_pedidos.reembolsado_em): um registro por e-mail, achar o pedido pelo código do pedido ou do ingresso, o estorno que
-- começa uma vez só, a ordem do cadeado, o fechamento (pedido cancelado, ingressos cancelados, devolução no razão em zero) e quem lê o quê.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61, local 51, evento 71, sessões 81 e 82 (daqui a 10 dias), ingresso 31 (R$ 60).
-- Rodar: com as migrations da T2, da T3, ticketeria_pagamentos, ticketeria_custo_do_meio, ticketeria_custo_real_do_pagamento, ticketeria_validacao_de_saque,
-- ticketeria_ingressos_emitidos e a ticketeria_reembolsos, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(42);

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
select public.fn_ticketeria_definir_meio(tv.pedido('p1'), 'pix', null);
select public.fn_ticketeria_confirmar_pagamento_real(tv.pedido('p1'), 'asaas', 'pay_ref_1', 12000, 11800);
select public.fn_ticketeria_definir_meio(tv.pedido('p2'), 'pix', null);

create table tv.cod as select (select codigo from public.ticketeria_pedidos where id = tv.pedido('p1')) as pedido, (select min(codigo) from public.ticketeria_ingressos_emitidos where pedido_id = tv.pedido('p1')) as ingresso;
create table tv.rb (nome text primary key, id uuid);
create function tv.reg(nome text, email_id text, rem text, assunto text, codigo text) returns uuid language plpgsql as $$
declare r jsonb;
begin
  r := public.fn_ticketeria_reembolso_registrar(email_id, rem, assunto, codigo, now());
  insert into tv.rb values (nome, (r ->> 'id')::uuid) on conflict do nothing;
  return (r ->> 'id')::uuid;
end;
$$;
create function tv.rbid(nome text) returns uuid language sql as $$ select id from tv.rb where rb.nome = rbid.nome $$;

select is((select public.fn_ticketeria_reembolso_registrar('email-1', ' Rita@Teste.invalid ', 'reembolso - ' || (select pedido from tv.cod), (select pedido from tv.cod), now()) ->> 'novo'), 'true', 'o primeiro registro de um e-mail é novo');
select is((select public.fn_ticketeria_reembolso_registrar('email-1', 'rita@teste.invalid', 'de novo', 'ZZZZ2222', now()) ->> 'novo'), 'false', 'o mesmo e-mail de novo não cria outro registro (o Resend reenvia)');
select is((select count(*)::int from public.ticketeria_reembolsos where email_id = 'email-1'), 1, 'um registro só por e-mail');
select is((select remetente || '|' || situacao || '|' || codigo_lido from public.ticketeria_reembolsos where email_id = 'email-1'), 'rita@teste.invalid|recebido|' || (select pedido from tv.cod), 'o remetente vai em minúsculas e sem espaços, e o código lido fica guardado');
select tv.reg('r1', 'email-1', 'x', 'x', 'x');

select is((public.fn_ticketeria_pedido_para_reembolso((select pedido from tv.cod)) ->> 'id')::uuid, tv.pedido('p1'), 'acha o pedido pelo código do pedido');
select is((public.fn_ticketeria_pedido_para_reembolso((select lower(ingresso) from tv.cod)) ->> 'id')::uuid, tv.pedido('p1'), 'acha o pedido pelo código de um ingresso, em minúsculas também');
select is(public.fn_ticketeria_pedido_para_reembolso('ZZZZ2222'), null::jsonb, 'código que não existe: nada');
select is(array[public.fn_ticketeria_pedido_para_reembolso('abc')::text, public.fn_ticketeria_pedido_para_reembolso('')::text, public.fn_ticketeria_pedido_para_reembolso(null)::text], array[null, null, null]::text[], 'código com formato errado: nada');
select is((select (j ->> 'situacao') || '|' || (j ->> 'total_centavos') || '|' || (j ->> 'provedor') || '|' || (j ->> 'provedor_ref') || '|' || (j ->> 'ingresso_usado') from (select public.fn_ticketeria_pedido_para_reembolso((select pedido from tv.cod)) as j) x), 'pago|12000|asaas|pay_ref_1|false', 'o que a decisão precisa: situação, valor, provedor, referência e se algum ingresso foi usado');
select is(public.fn_ticketeria_pedido_para_reembolso((select pedido from tv.cod)) ? 'comprador_email', true, 'e o e-mail do comprador, para conferir o remetente');

select is(public.fn_ticketeria_reembolso_reivindicar(tv.rbid('r1'), tv.pedido('p1')), true, 'o primeiro e-mail reivindica o estorno');
select is(public.fn_ticketeria_reembolso_reivindicar(tv.rbid('r1'), tv.pedido('p1')), false, 'o mesmo registro não reivindica duas vezes');
select tv.reg('r2', 'email-2', 'rita@teste.invalid', 'reembolso - de novo', (select pedido from tv.cod));
select is(public.fn_ticketeria_reembolso_reivindicar(tv.rbid('r2'), tv.pedido('p1')), false, 'outro e-mail do mesmo pedido, com o primeiro estornando: não reivindica (nunca estorna duas vezes)');
select is((select organization_id from public.ticketeria_reembolsos where id = tv.rbid('r1')), tv.id('a0'), 'a reivindicação liga o registro ao pedido e à organização');

select is((select count(*)::int from public.ticketeria_transferencias_autorizadas where tipo = 'PIX_REFUND'), 0, 'antes: nenhuma ordem de estorno');
create table tv.ordem as select public.fn_ticketeria_reembolso_autorizar_estorno(tv.rbid('r1')) as id;
select is((select valor_centavos from public.ticketeria_transferencias_autorizadas where id = (select id from tv.ordem)), 12000::bigint, 'a ordem do cadeado é pelo valor total do pedido');
select is(public.fn_ticketeria_validar_saque('PIX_REFUND', 'rf1', 'outro', '52998224725', 12000, '{}'::jsonb) ->> 'status', 'APPROVED', 'com a ordem, o cadeado aprova o estorno do Pix pelo valor total (e a ordem é gasta)');
select is(public.fn_ticketeria_validar_saque('PIX_REFUND', 'rf2', 'outro', '52998224725', 12000, '{}'::jsonb) ->> 'status', 'REFUSED', 'a ordem vale uma vez só');
select is(tv.tenta(format($t$select public.fn_ticketeria_reembolso_autorizar_estorno(%L)$t$, tv.rbid('r2'))), '23514 reembolso_nao_pendente', 'sem reivindicar, não há ordem');

select is(tv.tenta(format($t$select public.fn_ticketeria_reembolso_concluir(%L, '[{"conta":"psp_a_receber","valor_centavos":-12000},{"conta":"produtor","valor_centavos":100}]'::jsonb, 'x')$t$, tv.rbid('r1'))), '23514 razao_desequilibrado', 'devolução que não fecha em zero: recusa');
select is(tv.tenta(format($t$select public.fn_ticketeria_reembolso_concluir(%L, '[{"conta":"produtor","valor_centavos":0}]'::jsonb, 'x')$t$, tv.rbid('r1'))), '23514 partidas_invalidas', 'menos de duas partidas: recusa');
select is((select pedido_situacao from (select situacao as pedido_situacao from public.ticketeria_pedidos where id = tv.pedido('p1')) x), 'pago', 'as recusas não mexeram no pedido');

create table tv.partidas as select jsonb_build_array(
  jsonb_build_object('conta', 'psp_a_receber', 'valor_centavos', -p.total_centavos),
  jsonb_build_object('conta', 'produtor', 'valor_centavos', p.produtor_centavos),
  jsonb_build_object('conta', 'plataforma', 'valor_centavos', p.taxa_centavos)) as p from public.ticketeria_pedidos p where p.id = tv.pedido('p1');
select is(public.fn_ticketeria_reembolso_concluir(tv.rbid('r1'), (select p from tv.partidas), 'refund_ref_1') ->> 'valor_centavos', '12000', 'concluir devolve o valor total');
select is((select situacao || '|' || (reembolsado_em is not null)::text || '|' || (pago_em is null)::text from public.ticketeria_pedidos where id = tv.pedido('p1')), 'cancelado|true|true', 'o pedido volta a cancelado, com a data do reembolso (a restrição exige pago_em nulo)');
select is((select count(*)::int from public.ticketeria_ingressos_emitidos where pedido_id = tv.pedido('p1') and cancelado_em is not null), 2, 'os dois ingressos emitidos foram cancelados');
select is((select situacao || '|' || valor_centavos || '|' || estorno_ref || '|' || (pago_em is not null)::text from public.ticketeria_reembolsos where id = tv.rbid('r1')), 'estornado|12000|refund_ref_1|true', 'o registro guarda o valor, a referência do estorno e a data do pagamento');
set constraints all immediate;
select is((select sum(valor_centavos)::int from public.ticketeria_partidas pa join public.ticketeria_transacoes t on t.id = pa.transacao_id where t.pedido_id = tv.pedido('p1')), 0, 'pagamento e devolução juntos fecham em zero no razão');
select is((select count(*)::int from public.ticketeria_transacoes where pedido_id = tv.pedido('p1') and tipo = 'estorno'), 1, 'uma transação de estorno');
select is(public.fn_ticketeria_ocupados(tv.id('81'), tv.id('21')), 0::bigint, 'os lugares voltam à venda');
select is(tv.tenta(format($t$select public.fn_ticketeria_reembolso_concluir(%L, (select p from tv.partidas), 'x')$t$, tv.rbid('r1'))), '23514 reembolso_nao_pendente', 'concluir de novo não faz nada (uma vez só)');
select is(public.fn_ticketeria_pedido_para_reembolso((select pedido from tv.cod)) ->> 'situacao', 'cancelado', 'depois do reembolso, o pedido aparece como cancelado e com data de reembolso');
select is(public.fn_ticketeria_pedido_para_reembolso((select pedido from tv.cod)) ->> 'reembolsado_em' is not null, true, 'e a data do reembolso aparece (o próximo e-mail vira "já reembolsado")');

select lives_ok(format($t$select public.fn_ticketeria_reembolso_marcar(%L, 'fora_do_prazo', 'compra de 9 dias atrás', %L)$t$, tv.rbid('r2'), tv.pedido('p1')), 'marca um e-mail que não vira estorno, com o motivo');
select is((select situacao || '|' || motivo from public.ticketeria_reembolsos where id = tv.rbid('r2')), 'fora_do_prazo|compra de 9 dias atrás', 'o motivo fica na fila');
select is(tv.tenta(format($t$select public.fn_ticketeria_reembolso_marcar(%L, 'estornado', 'x')$t$, tv.rbid('r2'))), '23514 situacao_invalida', 'não se marca estornado à mão');
select is(tv.tenta(format($t$select public.fn_ticketeria_reembolso_marcar(%L, 'falhou', 'x')$t$, tv.rbid('r2'))), '23514 reembolso_nao_pendente', 'o que já foi marcado não muda');
select tv.reg('r3', 'email-3', 'rita@teste.invalid', 'reembolso - ZZZZ2222', 'ZZZZ2222');
select lives_ok(format($t$select public.fn_ticketeria_reembolso_marcar(%L, 'nao_encontrado', 'sem pedido com esse código')$t$, tv.rbid('r3')), 'e-mail sem pedido também fica na fila, sem organização');

select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_reembolso_registrar(text, text, text, text, timestamptz)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_reembolso_registrar(text, text, text, text, timestamptz)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_reembolso_concluir(uuid, jsonb, text)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_reembolso_autorizar_estorno(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_pedido_para_reembolso(text)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_reembolso_reivindicar(uuid, uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_reembolso_marcar(uuid, text, text, uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_reembolso_concluir(uuid, jsonb, text)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_reembolso_registrar(text, text, text, text, timestamptz)', 'execute'),
          'só o servidor executa as funções do reembolso');

select tv.como('a1');
select is((select count(*)::int from public.ticketeria_reembolsos), 2, 'quem edita a Ticketeria vê os reembolsos da própria organização (os dois ligados ao pedido; o sem pedido não)');
select is(tv.efeito($e$insert into public.ticketeria_reembolsos (email_id, remetente, assunto, recebido_em) values ('x', 'x', 'x', now())$e$), '', 'quem está logado não grava');
select tv.volta();
select tv.como('a3');
select is((select count(*)::int from public.ticketeria_reembolsos), 0, 'o leitor não vê');
select tv.volta();
select tv.como('b1');
select is((select count(*)::int from public.ticketeria_reembolsos), 0, 'outra organização não vê');
select tv.volta();

select * from finish();
rollback;
