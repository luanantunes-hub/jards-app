-- Ticketeria: pedir o reembolso pela página do pedido (ticketeria_reembolso_links; ticketeria_reembolsos.origem; fn_ticketeria_reembolso_link_pedir, _link_ver e _link_consumir):
-- a elegibilidade na hora do pedido, o limite de links, o link de uso único que vale pouco e nunca além dos 7 dias da compra, a resposta igual para qualquer link que não vale, o
-- registro que o link abre na fila (origem 'pagina') para o MESMO motor do e-mail seguir, e quem lê o quê.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61, local 51, evento 71, sessões 81 a 84, ingresso 31 (R$ 60).
-- Rodar: com as migrations da T2, da T3, ticketeria_pagamentos, ticketeria_custo_do_meio, ticketeria_custo_real_do_pagamento, ticketeria_validacao_de_saque,
-- ticketeria_ingressos_emitidos, ticketeria_reembolsos e a ticketeria_reembolso_pela_pagina, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(43);

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





-- Pedidos: p1 (2 ingressos, o fluxo principal), p2 (a compra fica velha), p3 (ingresso usado), p4 (não pago), p5 (já reembolsado), p6 (muitos links).
select tv.reservar('p1', '81', 2);
select tv.reservar('p2', '82', 1);
select tv.reservar('p3', '83', 1);
select tv.reservar('p4', '84', 1);
select tv.reservar('p5', '84', 1);
select tv.reservar('p6', '84', 1);
select public.fn_ticketeria_definir_meio(tv.pedido('p1'), 'pix', null);
select public.fn_ticketeria_confirmar_pagamento_real(tv.pedido('p1'), 'asaas', 'pay_ref_1', 12000, 11800);
select public.fn_ticketeria_definir_meio(tv.pedido('p2'), 'pix', null);
select public.fn_ticketeria_confirmar_pagamento_real(tv.pedido('p2'), 'asaas', 'pay_ref_2', 6000, 5900);
select public.fn_ticketeria_definir_meio(tv.pedido('p3'), 'pix', null);
select public.fn_ticketeria_confirmar_pagamento_real(tv.pedido('p3'), 'asaas', 'pay_ref_3', 6000, 5900);
select public.fn_ticketeria_definir_meio(tv.pedido('p6'), 'pix', null);
select public.fn_ticketeria_confirmar_pagamento_real(tv.pedido('p6'), 'asaas', 'pay_ref_6', 6000, 5900);

-- p5 já foi reembolsado (o pedido volta a cancelado).
select public.fn_ticketeria_definir_meio(tv.pedido('p5'), 'pix', null);
select public.fn_ticketeria_confirmar_pagamento_real(tv.pedido('p5'), 'asaas', 'pay_ref_5', 6000, 5900);
update public.ticketeria_pedidos set situacao = 'cancelado', pago_em = null, reembolsado_em = now() where id = tv.pedido('p5');

create table tv.cod as select (select codigo from public.ticketeria_pedidos where id = tv.pedido('p1')) as pedido;
create function tv.h(c text) returns text language sql immutable as $$ select encode(extensions.digest(c, 'sha256'), 'hex') $$;

-- ─── Pedir o link ───────────────────────────────────────────────────────────

create table tv.r1 as select public.fn_ticketeria_reembolso_link_pedir(tv.pedido('p1'), tv.h('a')) as j;
select is((select j ->> 'ok' from tv.r1), 'true', 'pedido pago, no prazo, sem ingresso usado: o link é gravado');
select is((select (j ->> 'email') || '|' || (j ->> 'codigo') || '|' || (j ->> 'nome') from tv.r1), 'rita@teste.invalid|' || (select pedido from tv.cod) || '|Rita Teste', 'devolve o e-mail da compra, o código e o nome, para o servidor mandar o link');
select is((select count(*)::int from public.ticketeria_reembolso_links where pedido_id = tv.pedido('p1')), 1, 'um link gravado');
select is((select token_hash from public.ticketeria_reembolso_links where pedido_id = tv.pedido('p1')), tv.h('a'), 'só o hash fica no banco');
select is((select expira_em - pedido_em from public.ticketeria_reembolso_links where pedido_id = tv.pedido('p1')), interval '48 hours', 'o link vale 48 horas depois do pedido (a compra é de agora, então cabe nos 7 dias)');
select is(tv.tenta($t$select public.fn_ticketeria_reembolso_link_pedir(gen_random_uuid(), 'nao-e-hash')$t$), '23514 hash_invalido', 'hash fora do formato: recusa');
select is(public.fn_ticketeria_reembolso_link_pedir(tv.pedido('p1'), tv.h('b')) ->> 'motivo', 'aguarde', 'um segundo pedido em seguida: aguarde 10 minutos');
select is((select count(*)::int from public.ticketeria_reembolso_links where pedido_id = tv.pedido('p1')), 1, 'e nada foi gravado');

-- ─── Ver e gastar ───────────────────────────────────────────────────────────

select is(public.fn_ticketeria_reembolso_link_ver(tv.pedido('p1'), tv.h('a')) ->> 'valido', 'true', 'o link vale');
select is((select (j ->> 'codigo') || '|' || (j ->> 'total_centavos') from (select public.fn_ticketeria_reembolso_link_ver(tv.pedido('p1'), tv.h('a')) as j) x), (select pedido from tv.cod) || '|12000', 'a página de confirmação mostra o código e o valor');
select is(public.fn_ticketeria_reembolso_link_ver(tv.pedido('p1'), tv.h('a')) ->> 'valido', 'true', 'ver não gasta o link (um programa que abre o link do e-mail não o estraga)');
select is(array[public.fn_ticketeria_reembolso_link_ver(tv.pedido('p1'), tv.h('zzz'))::text, public.fn_ticketeria_reembolso_link_ver(tv.pedido('p2'), tv.h('a'))::text, public.fn_ticketeria_reembolso_link_ver(gen_random_uuid(), tv.h('a'))::text],
  array['{"valido": false}', '{"valido": false}', '{"valido": false}'], 'link que não existe, link de outro pedido e pedido que não existe: a MESMA resposta, sem dado nenhum');

-- Um link novo (passados 10 minutos) invalida o anterior.
update public.ticketeria_reembolso_links set created_at = now() - interval '11 minutes' where pedido_id = tv.pedido('p1');
select is(public.fn_ticketeria_reembolso_link_pedir(tv.pedido('p1'), tv.h('b')) ->> 'ok', 'true', 'passados 10 minutos, outro link');
select isnt((select invalidado_em from public.ticketeria_reembolso_links where token_hash = tv.h('a')), null, 'o anterior foi invalidado');
select is(public.fn_ticketeria_reembolso_link_ver(tv.pedido('p1'), tv.h('a')) ->> 'valido', 'false', 'e não vale mais');
select is(public.fn_ticketeria_reembolso_link_consumir(tv.pedido('p1'), tv.h('a')), null::jsonb, 'nem se gasta');

-- Link de outro pedido não gasta.
select is(public.fn_ticketeria_reembolso_link_consumir(tv.pedido('p2'), tv.h('b')), null::jsonb, 'o link de um pedido não vale em outro');
select is((select usado_em from public.ticketeria_reembolso_links where token_hash = tv.h('b')), null, 'e o link segue sem uso');

-- Vencido.
update public.ticketeria_reembolso_links set pedido_em = now() - interval '3 days', expira_em = now() - interval '1 day' where token_hash = tv.h('b');
select is(array[public.fn_ticketeria_reembolso_link_ver(tv.pedido('p1'), tv.h('b'))::text, coalesce(public.fn_ticketeria_reembolso_link_consumir(tv.pedido('p1'), tv.h('b'))::text, 'nada')], array['{"valido": false}', 'nada'], 'link vencido: não vale e não se gasta');
update public.ticketeria_reembolso_links set pedido_em = now(), expira_em = now() + interval '48 hours', created_at = now() - interval '11 minutes' where token_hash = tv.h('b');

-- Gastar: uma vez só, e abre o registro na fila.
create table tv.c1 as select public.fn_ticketeria_reembolso_link_consumir(tv.pedido('p1'), tv.h('b')) as j;
select is((select (j ->> 'remetente') || '|' || (j ->> 'assunto') from tv.c1), 'rita@teste.invalid|reembolso - ' || (select pedido from tv.cod), 'gastar o link devolve o "e-mail" que o motor vai tratar: o remetente é o e-mail da compra');
select is((select j ->> 'email_id' from tv.c1), 'pagina:' || (select id::text from public.ticketeria_reembolso_links where token_hash = tv.h('b')), 'com um id que só esse link tem');
select is((select (j ->> 'recebido_em')::timestamptz from tv.c1), (select pedido_em from public.ticketeria_reembolso_links where token_hash = tv.h('b')), 'o prazo conta da hora do pedido na página');
select is((select origem || '|' || situacao || '|' || remetente from public.ticketeria_reembolsos where email_id = (select j ->> 'email_id' from tv.c1)), 'pagina|recebido|rita@teste.invalid', 'o registro da fila nasce com origem "pagina", em "recebido"');
select is(public.fn_ticketeria_reembolso_link_consumir(tv.pedido('p1'), tv.h('b')), null::jsonb, 'o link é de uso único');
select is(public.fn_ticketeria_reembolso_link_ver(tv.pedido('p1'), tv.h('b')) ->> 'valido', 'false', 'e depois de usado a página não o aceita');
select is((select (r ->> 'novo') || '|' || (r ->> 'situacao') from (select public.fn_ticketeria_reembolso_registrar((select j ->> 'email_id' from tv.c1), 'rita@teste.invalid', 'reembolso - ' || (select pedido from tv.cod), (select pedido from tv.cod), now()) as r) x), 'false|recebido', 'o motor do e-mail encontra o registro e o retoma (não cria outro)');
select is(public.fn_ticketeria_reembolso_reivindicar((select id from public.ticketeria_reembolsos where email_id = (select j ->> 'email_id' from tv.c1)), tv.pedido('p1')), true, 'e começa o estorno, uma vez só');
update public.ticketeria_reembolso_links set created_at = now() - interval '11 minutes' where pedido_id = tv.pedido('p1');
select is(public.fn_ticketeria_reembolso_link_pedir(tv.pedido('p1'), tv.h('c')) ->> 'motivo', 'em_andamento', 'com o estorno em andamento, não se pede outro link');

-- ─── O que não é elegível ───────────────────────────────────────────────────

update public.ticketeria_pedidos set pago_em = now() - interval '8 days' where id = tv.pedido('p2');
select is(public.fn_ticketeria_reembolso_link_pedir(tv.pedido('p2'), tv.h('d')) ->> 'motivo', 'fora_do_prazo', 'compra de mais de 7 dias: fora do prazo');
update public.ticketeria_pedidos set pago_em = now() - interval '6 days 23 hours' where id = tv.pedido('p2');
create table tv.r2 as select public.fn_ticketeria_reembolso_link_pedir(tv.pedido('p2'), tv.h('e')) as j;
select is((select (j ->> 'ok') from tv.r2) || '|' || (select (expira_em <= pago_em + interval '7 days' and expira_em > pedido_em)::text from public.ticketeria_reembolso_links l join public.ticketeria_pedidos p on p.id = l.pedido_id where l.token_hash = tv.h('e')), 'true|true',
  'no último dia do prazo ainda se pede, e o link vence no fim dos 7 dias da compra: confirmar não estende o direito');
update public.ticketeria_ingressos_emitidos set usado_em = now() where pedido_id = tv.pedido('p3');
select is(public.fn_ticketeria_reembolso_link_pedir(tv.pedido('p3'), tv.h('f')) ->> 'motivo', 'ingresso_usado', 'ingresso já usado na entrada: não');
select is(public.fn_ticketeria_reembolso_link_pedir(tv.pedido('p4'), tv.h('g')) ->> 'motivo', 'nao_elegivel', 'pedido que não está pago: não');
select is(public.fn_ticketeria_reembolso_link_pedir(tv.pedido('p5'), tv.h('h')) ->> 'motivo', 'ja_reembolsado', 'pedido já reembolsado: não');
select is(public.fn_ticketeria_reembolso_link_pedir(gen_random_uuid(), tv.h('i')) ->> 'motivo', 'nao_encontrado', 'pedido que não existe: não');
insert into public.ticketeria_reembolso_links (pedido_id, token_hash, pedido_em, expira_em, created_at, invalidado_em)
select tv.pedido('p6'), tv.h('x' || n), now() - interval '2 hours', now() + interval '40 hours', now() - interval '1 hour', now() from generate_series(1, 5) n;
select is(public.fn_ticketeria_reembolso_link_pedir(tv.pedido('p6'), tv.h('j')) ->> 'motivo', 'muitos_pedidos', 'no máximo 5 links por dia por pedido');
select is((select count(*)::int from public.ticketeria_reembolso_links where token_hash in (tv.h('d'), tv.h('f'), tv.h('g'), tv.h('h'), tv.h('i'), tv.h('j'))), 0, 'nenhuma recusa gravou link');

-- ─── As regras do banco ─────────────────────────────────────────────────────

select is(tv.tenta(format($t$insert into public.ticketeria_reembolso_links (pedido_id, token_hash, expira_em) values (%L, %L, now() + interval '1 day')$t$, tv.pedido('p1'), tv.h('a'))), '23505 ticketeria_reembolso_links_hash_key', 'o hash é único');
select is(tv.tenta(format($t$insert into public.ticketeria_reembolso_links (pedido_id, token_hash, expira_em) values (%L, 'abc', now() + interval '1 day')$t$, tv.pedido('p1'))), '23514 ticketeria_reembolso_links_hash_check', 'o hash tem de ser sha256 em hexa');
select is(tv.tenta(format($t$insert into public.ticketeria_reembolsos (email_id, remetente, assunto, recebido_em, origem) values ('x', 'a@b.c', 'reembolso', now(), 'whatsapp')$t$)), '23514 ticketeria_reembolsos_origem_check', 'a origem é "email" ou "pagina"');

select is(array[has_function_privilege('anon', 'public.fn_ticketeria_reembolso_link_pedir(uuid, text)', 'execute'), has_function_privilege('authenticated', 'public.fn_ticketeria_reembolso_link_ver(uuid, text)', 'execute'), has_function_privilege('authenticated', 'public.fn_ticketeria_reembolso_link_consumir(uuid, text)', 'execute'), has_function_privilege('service_role', 'public.fn_ticketeria_reembolso_link_consumir(uuid, text)', 'execute')],
  array[false, false, false, true], 'as funções são só do servidor');
select is(array[has_table_privilege('anon', 'public.ticketeria_reembolso_links', 'select'), has_table_privilege('authenticated', 'public.ticketeria_reembolso_links', 'select')], array[false, false], 'ninguém logado lê os links');

select tv.como('a1');
select is((select count(*)::int from public.ticketeria_reembolsos where origem = 'pagina'), 1, 'quem edita a Ticketeria da organização vê o pedido pela página na fila');
select tv.volta();
select tv.como('b1');
select is((select count(*)::int from public.ticketeria_reembolsos where origem = 'pagina'), 0, 'outra organização não vê');
select tv.volta();

select * from finish();
rollback;
