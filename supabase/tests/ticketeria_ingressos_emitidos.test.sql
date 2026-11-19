-- Ticketeria: o ingresso emitido (ticketeria_ingressos_emitidos; fn_ticketeria_emitir_ingressos e o gatilho do pedido pago;
-- fn_ticketeria_reivindicar_envio, fn_ticketeria_liberar_envio e fn_ticketeria_ingressos_do_pedido): um ingresso por unidade comprada, com código
-- único, emitido uma vez só quando o pedido vira pago (inclusive o gratuito), o envio do e-mail uma vez só e quem lê o quê.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61, local 51, evento 71, sessões 81 e 82 (daqui a 10 dias), ingresso 31 (R$ 60).
-- Rodar: com as migrations da T2, da T3, ticketeria_pagamentos, ticketeria_custo_do_meio, ticketeria_custo_real_do_pagamento e a
-- ticketeria_ingressos_emitidos, se ainda não estiverem aplicadas.

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



-- Ingresso gratuito de dois lotes (3 ingressos: 2 do primeiro lote e 1 do segundo).
insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values (tv.id('33'), tv.id('a0'), tv.id('71'), tv.id('41'), 'Cortesia', 'cortesia');
insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values
  (tv.id('22'), tv.id('a0'), tv.id('33'), '1º lote', 0, 0, 2), (tv.id('23'), tv.id('a0'), tv.id('33'), '2º lote', 1, 0, 5);

select tv.reservar('p1', '81', 2);
select tv.reservar('p2', '82', 1);
select is((select count(*)::int from public.ticketeria_ingressos_emitidos), 0, 'pedido aguardando pagamento não emite ingresso');
select public.fn_ticketeria_definir_meio(tv.pedido('p1'), 'pix', null);
select public.fn_ticketeria_confirmar_pagamento_real(tv.pedido('p1'), 'asaas', 'ref-p1', 12000, 11800);
select is((select count(*)::int from public.ticketeria_ingressos_emitidos where pedido_id = tv.pedido('p1')), 2, 'ao virar pago, emite um ingresso por unidade comprada (sem ninguém chamar)');
select is((select count(*)::int from public.ticketeria_ingressos_emitidos where pedido_id = tv.pedido('p2')), 0, 'o outro pedido, ainda aguardando, não ganhou nada');
select is((select count(*)::int from public.ticketeria_ingressos_emitidos where codigo ~ '^[A-HJ-NP-Z2-9]{10}$'), 2, 'os códigos têm 10 letras e números sem O, 0, I, 1 e L');
select is((select count(distinct codigo)::int from public.ticketeria_ingressos_emitidos), 2, 'cada ingresso tem o seu código');
select is((select string_agg(distinct nome || ':' || preco_centavos || ':' || (sessao_id = tv.id('81'))::text || ':' || (organization_id = tv.id('a0'))::text, ' ') from public.ticketeria_ingressos_emitidos where pedido_id = tv.pedido('p1')), 'Inteira:6000:true:true', 'guarda o nome e o preço do momento da compra e a sessão');
select is(public.fn_ticketeria_emitir_ingressos(tv.pedido('p1')), 0, 'emitir de novo não faz nada (uma vez só)');
select is((select count(*)::int from public.ticketeria_ingressos_emitidos where pedido_id = tv.pedido('p1')), 2, 'e não duplica');
select is(tv.tenta($t$select public.fn_ticketeria_emitir_ingressos('0d760000-0000-4000-8000-0000000000ff')$t$), '23514 pedido_inexistente', 'pedido que não existe: recusa');
select is(tv.tenta(format($t$select public.fn_ticketeria_emitir_ingressos(%L)$t$, tv.pedido('p2'))), '23514 pedido_nao_pago', 'pedido não pago: recusa');
insert into tv.pedidos values ('g1', public.fn_ticketeria_reservar(tv.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tv.id('33'), 'quantidade', 3)), 'Rita Teste', 'rita@teste.invalid', 15));
select is((select (resposta ->> 'situacao') from tv.pedidos where nome = 'g1'), 'pago', 'o ingresso gratuito já nasce pago');
select is((select count(*)::int from public.ticketeria_ingressos_emitidos where pedido_id = tv.pedido('g1')), 3, 'e emite os 3 (mesmo vindos de dois lotes, dois itens do pedido)');
select is((select count(*)::int from public.ticketeria_pedido_itens where pedido_id = tv.pedido('g1')), 2, 'o pedido gratuito tem dois itens (um por lote)');
select is((select count(distinct item_id)::int from public.ticketeria_ingressos_emitidos where pedido_id = tv.pedido('g1')), 2, 'cada ingresso aponta para o item de onde veio');
select is((select count(*)::int from public.ticketeria_ingressos_emitidos where preco_centavos = 0 and nome = 'Cortesia'), 3, 'o gratuito guarda preço zero');

select is(public.fn_ticketeria_reivindicar_envio(tv.pedido('p1')), true, 'o primeiro a reivindicar o envio do e-mail leva a vaga');
select is(public.fn_ticketeria_reivindicar_envio(tv.pedido('p1')), false, 'o segundo não: o e-mail sai uma vez só');
select is(public.fn_ticketeria_reivindicar_envio(tv.pedido('p2')), false, 'pedido ainda não pago: não há o que enviar');
select lives_ok(format($t$select public.fn_ticketeria_liberar_envio(%L)$t$, tv.pedido('p1')), 'se o envio falha, devolve a vaga');
select is(public.fn_ticketeria_reivindicar_envio(tv.pedido('p1')), true, 'e a próxima tentativa pode mandar');

select is((select (public.fn_ticketeria_ingressos_do_pedido(tv.pedido('p1')) ->> 'evento') || '|' || (public.fn_ticketeria_ingressos_do_pedido(tv.pedido('p1')) ->> 'local') || '|' || jsonb_array_length(public.fn_ticketeria_ingressos_do_pedido(tv.pedido('p1')) -> 'ingressos')::text), 'Hamlet|Teatro A|2', 'o que o e-mail e a página mostram: evento, local e os ingressos');
select is(public.fn_ticketeria_ingressos_do_pedido(tv.pedido('p1')) ? 'comprador_email', false, 'sem o e-mail do comprador');
select is(public.fn_ticketeria_ingressos_do_pedido(tv.pedido('p2')), null::jsonb, 'pedido não pago: nada para mostrar');

select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_emitir_ingressos(uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_emitir_ingressos(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_reivindicar_envio(uuid)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_liberar_envio(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_ingressos_do_pedido(uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_ingressos_do_pedido(uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_emitir_ingressos(uuid)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_ingressos_do_pedido(uuid)', 'execute'),
          'só o servidor executa as funções do ingresso');

select tv.como('a1');
select is(tv.ve('ticketeria_ingressos_emitidos', 'a'), '5', 'quem edita a Ticketeria vê os ingressos emitidos da organização');
select is(tv.efeito($e$insert into public.ticketeria_ingressos_emitidos (organization_id, pedido_id, item_id, ingresso_id, sessao_id, codigo, nome, preco_centavos) select organization_id, pedido_id, item_id, ingresso_id, sessao_id, 'AAAAAAAAAA', nome, 0 from public.ticketeria_ingressos_emitidos limit 1$e$), '', 'quem está logado não grava ingresso');
select tv.volta();
select tv.como('a3');
select is(tv.ve('ticketeria_ingressos_emitidos', 'a'), '0', 'o leitor não vê');
select tv.volta();
select tv.como('b1');
select is(tv.ve('ticketeria_ingressos_emitidos', 'a'), '0', 'outra organização não vê');
select tv.volta();

select * from finish();
rollback;
