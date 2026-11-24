-- Ticketeria: a venda dos lugares reservados de acessibilidade (ticketeria_pedidos.declarou_acessibilidade, fn_ticketeria_reserva_do_setor, fn_ticketeria_reservar_com_declaracao).
-- Quem declara precisar do lugar compra o reservado a qualquer momento; quem não declara só depois do prazo (24 horas antes; 72 se o espaço passa de 10.000 lugares) e com os demais lugares do
-- setor esgotados nesta sessão (a própria venda não conta como "esgotou"); só o servidor executa; a função de reservar de sempre não mudou.
-- Ids 0d820000-0000-4000-8000-0000000000XX, ou tr.id('XX'). A (a0): administrador a1, loja 61, local 51, evento 71 (publicado), setor 41 (Plateia, numerado: A1 cadeira de rodas, A2 pessoa obesa,
-- A3 e A4 comuns), ingresso 31 (Inteira, 4 vagas por sessão), sessões 81 (daqui a 10 dias), 82 (daqui a 48 horas), 83 e 84 (daqui a 10 horas).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_lugares_reservados, se ainda não estiverem aplicadas. Tudo roda numa transação que termina em rollback.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

create schema tr;
grant usage on schema tr to authenticated, anon;

create function tr.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d820000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tr.id(s), 'tr-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1']) as s;
  insert into public.organizations (id, nome) values (tr.id('a0'), 'TR A');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tr.id('a0'), 'ticketeria', 'cortesia', 20);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values (tr.id('a0'), tr.id('a1'), 'admin', '{ticketeria}'::text[]);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tr.id('61'), tr.id('a0'), 'Loja A');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tr.id('51'), tr.id('a0'), tr.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares, arquivado) values (tr.id('41'), tr.id('a0'), tr.id('51'), 'Plateia', 100, false);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tr.id('71'), tr.id('a0'), tr.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values
    (tr.id('81'), tr.id('a0'), tr.id('71'), tr.id('51'), now() + interval '10 days'),
    (tr.id('82'), tr.id('a0'), tr.id('71'), tr.id('51'), now() + interval '48 hours'),
    (tr.id('83'), tr.id('a0'), tr.id('71'), tr.id('51'), now() + interval '10 hours'),
    (tr.id('84'), tr.id('a0'), tr.id('71'), tr.id('51'), now() + interval '10 hours');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values (tr.id('31'), tr.id('a0'), tr.id('71'), tr.id('41'), 'Inteira', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values (tr.id('21'), tr.id('a0'), tr.id('31'), '1º lote', 0, 6000, 4);
  delete from public.ticketeria_taxas;
end
$dados$;

create function tr.tenta(comando text) returns text language plpgsql as $$
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

create function tr.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', tr.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function tr.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- Uma compra pela função nova: os lugares da fileira A (pelos números), com ou sem a declaração.
create function tr.compra(p_sessao uuid, p_numeros int[], p_declarou boolean) returns jsonb language sql as $$
  select public.fn_ticketeria_reservar_com_declaracao(
    p_sessao,
    jsonb_build_array(jsonb_build_object('ingresso_id', tr.id('31'), 'quantidade', cardinality(p_numeros))),
    'Fulano', 'fulano@teste.invalid', 15, null,
    jsonb_build_array(jsonb_build_object('ingresso_id', tr.id('31'), 'assentos', (select jsonb_agg(jsonb_build_object('fileira', 'A', 'numero', n)) from unnest(p_numeros) n))),
    p_declarou);
$$;

create function tr.reserva(p_sessao uuid) returns jsonb language sql as $$
  select public.fn_ticketeria_reserva_do_setor(p_sessao, tr.id('41'));
$$;

-- O mapa do setor: A1 cadeira de rodas, A2 pessoa obesa, A3 e A4 comuns.
select tr.como('a1');
select public.fn_ticketeria_salvar_mapa(tr.id('41'),
  '[{"nome": "A", "assentos": [{"numero": 1, "tipo": "cadeira_rodas"}, {"numero": 2, "tipo": "obeso"}, {"numero": 3}, {"numero": 4}]}]'::jsonb, true);
select tr.volta();

-- ─── Sessão 81, daqui a 10 dias: a reserva vale ───────────────────────────────
select is((tr.reserva(tr.id('81')) ->> 'outros_livres')::int, 2, 'dois lugares comuns livres (A3 e A4)');
select is((tr.reserva(tr.id('81')) ->> 'liberada')::boolean, false, 'a reserva está de pé');
select ok((tr.reserva(tr.id('81')) ->> 'termina_em')::timestamptz between now() + interval '8 days 23 hours' and now() + interval '9 days 1 hour', 'e termina 24 horas antes da sessão (um espaço pequeno)');

select is(tr.tenta(format($t$select tr.compra(%L, array[1], false)$t$, tr.id('81'))), '23514 lugar_reservado', 'sem declarar, o lugar de cadeira de rodas é recusado');
select is(tr.tenta(format($t$select tr.compra(%L, array[2], false)$t$, tr.id('81'))), '23514 lugar_reservado', 'e o de pessoa obesa também');
select is(tr.tenta(format($t$select tr.compra(%L, array[3, 1], false)$t$, tr.id('81'))), '23514 lugar_reservado', 'um pedido com um lugar comum e um reservado é recusado inteiro');
select is(tr.tenta(format($t$select tr.compra(%L, array[3], false)$t$, tr.id('81'))), 'aceito', 'sem declarar, o lugar comum é vendido');
select is(tr.tenta(format($t$select tr.compra(%L, array[1], true)$t$, tr.id('81'))), 'aceito', 'declarando, o lugar de cadeira de rodas é vendido');
select is(tr.tenta(format($t$select tr.compra(%L, array[2, 3], true)$t$, tr.id('81'))), 'aceito', 'declarando, vale também um pedido com reservado e comum');

select is((tr.compra(tr.id('81'), array[3], false) ->> 'declarou_acessibilidade')::boolean, false, 'a resposta diz que não declarou');
select is((select declarou_acessibilidade from public.ticketeria_pedidos p join public.ticketeria_pedido_assentos pa on pa.pedido_id = p.id where pa.sessao_id = tr.id('81') and pa.numero = 3 and p.situacao <> 'cancelado' limit 1), false, 'o pedido do lugar comum não guarda declaração');
select is((tr.compra(tr.id('81'), array[1], true) ->> 'declarou_acessibilidade')::boolean, true, 'declarando, a resposta diz que declarou');
select is((select declarou_acessibilidade from public.ticketeria_pedidos p join public.ticketeria_pedido_assentos pa on pa.pedido_id = p.id where pa.sessao_id = tr.id('81') and pa.numero = 1 limit 1), true, 'e o pedido guarda a declaração');

select tr.compra(tr.id('81'), array[4], false);
select is((tr.reserva(tr.id('81')) ->> 'outros_livres')::int, 0, 'com A3 e A4 vendidos, não sobra lugar comum');
select is((tr.reserva(tr.id('81')) ->> 'liberada')::boolean, false, 'mas com a sessão longe, a reserva segue de pé');
select is(tr.tenta(format($t$select tr.compra(%L, array[2], false)$t$, tr.id('81'))), '23514 lugar_reservado', 'e o lugar de pessoa obesa continua recusado a quem não declara');

-- ─── Sessão 83, daqui a 10 horas (dentro das 24): só depois de esgotar os demais ───
select is((tr.reserva(tr.id('83')) ->> 'liberada')::boolean, false, 'perto da sessão, com lugares comuns livres, a reserva segue');
select is(tr.tenta(format($t$select tr.compra(%L, array[1], false)$t$, tr.id('83'))), '23514 lugar_reservado', 'perto da sessão, sem declarar, ainda é recusado enquanto há lugar comum');
select tr.compra(tr.id('83'), array[3, 4], false);
select is((tr.reserva(tr.id('83')) ->> 'liberada')::boolean, true, 'esgotados os comuns e passado o prazo, a reserva é liberada');
select is(tr.tenta(format($t$select tr.compra(%L, array[1], false)$t$, tr.id('83'))), 'aceito', 'e quem não declarou compra o reservado');

-- A própria venda não conta como "esgotou": quem pega os últimos comuns junto com o reservado, sem declarar, é recusado.
select is(tr.tenta(format($t$select tr.compra(%L, array[3, 4, 1], false)$t$, tr.id('84'))), '23514 lugar_reservado', 'levar os últimos comuns e o reservado no mesmo pedido, sem declarar, é recusado');

-- ─── Sessão 82, daqui a 48 horas: o prazo de 72 horas de um espaço grande ───────
select tr.compra(tr.id('82'), array[3, 4], false);
select is((tr.reserva(tr.id('82')) ->> 'liberada')::boolean, false, 'a 48 horas, num espaço pequeno, a reserva (24 horas) ainda vale, mesmo com os comuns esgotados');
insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares, arquivado) values (tr.id('42'), tr.id('a0'), tr.id('51'), 'Pista', 10001, false);
select is((tr.reserva(tr.id('82')) ->> 'liberada')::boolean, true, 'num espaço com mais de 10.000 lugares o prazo é de 72 horas: a 48 horas ela já terminou');

-- ─── Quem executa ───────────────────────────────────────────────────────────
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_reservar_com_declaracao(uuid, jsonb, text, text, integer, text, jsonb, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.fn_ticketeria_reservar_com_declaracao(uuid, jsonb, text, text, integer, text, jsonb, boolean)', 'execute')
  and has_function_privilege('service_role', 'public.fn_ticketeria_reservar_com_declaracao(uuid, jsonb, text, text, integer, text, jsonb, boolean)', 'execute'), 'a venda com declaração é só do servidor');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_reserva_do_setor(uuid, uuid, uuid)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_reserva_do_setor(uuid, uuid, uuid)', 'execute'), 'e a conta da reserva também');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'fn_ticketeria_reservar_com_lugares'), 1, 'a função de reservar de sempre segue uma só (sem sobrecarga)');

select * from finish();
rollback;
