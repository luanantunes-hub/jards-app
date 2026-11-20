-- Ticketeria: o mapa do setor (ticketeria_assentos, fn_ticketeria_salvar_mapa, fn_ticketeria_mapa_do_setor, o gatilho do setor numerado): o mapa grava de uma vez e os
-- lugares que continuam mantêm a identidade; `lugares` do setor numerado é a contagem dos não bloqueados (não se digita); formatos inválidos, setor com vendas e oferta
-- que não cabe são recusados; quem lê, quem grava e quem executa.
-- Ids 0d790000-0000-4000-8000-0000000000XX, ou tm.id('XX'). A (a0): loja 61, local 51, evento 71, sessão 81, setores 41 (Plateia, 100 lugares), 42 (Camarote, 10, com oferta de 8), 43 (Vendido) e 44 (arquivado).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_assentos_mapa, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

create schema tm;
grant usage on schema tm to authenticated, anon;

create function tm.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d790000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tm.id(s), 'tm-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a3', 'b1']) as s;
  insert into public.organizations (id, nome) values (tm.id('a0'), 'TM A'), (tm.id('b0'), 'TM B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tm.id('a0'), 'ticketeria', 'cortesia', 20), (tm.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tm.id(o), tm.id(p), papel, '{ticketeria}'::text[] from (values ('a0', 'a1', 'admin'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tm.id('61'), tm.id('a0'), 'Loja A'), (tm.id('6b'), tm.id('b0'), 'Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tm.id('51'), tm.id('a0'), tm.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares, arquivado) values
    (tm.id('41'), tm.id('a0'), tm.id('51'), 'Plateia', 100, false), (tm.id('42'), tm.id('a0'), tm.id('51'), 'Camarote', 10, false),
    (tm.id('43'), tm.id('a0'), tm.id('51'), 'Vendido', 50, false), (tm.id('44'), tm.id('a0'), tm.id('51'), 'Velho', 20, true);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tm.id('71'), tm.id('a0'), tm.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (tm.id('81'), tm.id('a0'), tm.id('71'), tm.id('51'), now() + interval '10 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values
    (tm.id('31'), tm.id('a0'), tm.id('71'), tm.id('42'), 'Camarote', 'inteira'), (tm.id('32'), tm.id('a0'), tm.id('71'), tm.id('43'), 'Vendida', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values
    (tm.id('21'), tm.id('a0'), tm.id('31'), '1º lote', 0, 9000, 8), (tm.id('22'), tm.id('a0'), tm.id('32'), '1º lote', 0, 5000, 10);
  delete from public.ticketeria_taxas;
end
$dados$;

create function tm.tenta(comando text) returns text language plpgsql as $$
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

create function tm.efeito(comando text) returns text language plpgsql as $$
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

create function tm.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tm.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tm.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- Duas fileiras: A com 3 lugares (o 2 bloqueado) e B com 2.
create function tm.mapa(a int, b int, bloqueados text[] default '{}') returns jsonb language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('nome', 'A', 'assentos', (select jsonb_agg(jsonb_build_object('numero', n, 'bloqueado', ('A' || n) = any(bloqueados)) order by n) from generate_series(1, a) n)),
    jsonb_build_object('nome', 'B', 'assentos', (select jsonb_agg(jsonb_build_object('numero', n, 'bloqueado', ('B' || n) = any(bloqueados)) order by n) from generate_series(1, b) n)))
$$;

-- Salvar o mapa pela primeira vez.
select is((public.fn_ticketeria_salvar_mapa(tm.id('41'), tm.mapa(3, 2, array['A2']), true)), '{"lugares": 4, "fileiras": 2, "bloqueados": 1}'::jsonb, 'grava o mapa: 2 fileiras, 5 lugares, 1 bloqueado, 4 à venda');
select is((select count(*)::int || '/' || count(*) filter (where bloqueado)::int from public.ticketeria_assentos where setor_id = tm.id('41')), '5/1', 'cinco lugares gravados, um bloqueado');
select is((select numerado::text || '/' || lugares || '/' || corredor_no_meio::text from public.ticketeria_setores where id = tm.id('41')), 'true/4/true', 'o setor virou numerado e lugares é a contagem dos não bloqueados');
select is(public.fn_ticketeria_mapa_do_setor(tm.id('41')), '[{"nome": "A", "assentos": [{"numero": 1, "bloqueado": false}, {"numero": 2, "bloqueado": true}, {"numero": 3, "bloqueado": false}]}, {"nome": "B", "assentos": [{"numero": 1, "bloqueado": false}, {"numero": 2, "bloqueado": false}]}]'::jsonb, 'o mapa volta em ordem, com os bloqueios');
select is(public.fn_ticketeria_mapa_do_setor(tm.id('43')), '[]'::jsonb, 'setor sem mapa: lista vazia');

-- `lugares` de setor numerado não se digita.
update public.ticketeria_setores set lugares = 999 where id = tm.id('41');
select is((select lugares from public.ticketeria_setores where id = tm.id('41')), 4, 'digitar lugares num setor numerado não vale: o banco refaz pela contagem');

-- Salvar de novo: quem continua mantém a identidade; o que sumiu sai; o que entrou nasce.
create table tm.antes as select id, fileira, numero from public.ticketeria_assentos where setor_id = tm.id('41');
select public.fn_ticketeria_salvar_mapa(tm.id('41'), jsonb_build_array(
  jsonb_build_object('nome', 'a', 'assentos', jsonb_build_array(jsonb_build_object('numero', 1), jsonb_build_object('numero', 2, 'bloqueado', false), jsonb_build_object('numero', 3, 'bloqueado', true), jsonb_build_object('numero', 4))),
  jsonb_build_object('nome', 'B', 'assentos', jsonb_build_array(jsonb_build_object('numero', 1, 'bloqueado', false)))), false);
select is((select count(*)::int from public.ticketeria_assentos where setor_id = tm.id('41')), 5, 'A1-A4 e B1: cinco lugares (B2 saiu, A4 entrou)');
select is((select count(*)::int from public.ticketeria_assentos a join tm.antes b on b.id = a.id and b.fileira = a.fileira and b.numero = a.numero where a.setor_id = tm.id('41')), 4, 'os 4 lugares que continuam mantêm o mesmo id (o nome da fileira em minúsculas vale como maiúsculas)');
select is((select string_agg(fileira || numero || case when bloqueado then 'x' else '' end, ' ' order by fileira, numero) from public.ticketeria_assentos where setor_id = tm.id('41')), 'A1 A2 A3x A4 B1', 'A2 foi liberado, A3 bloqueado');
select is((select lugares::text || '/' || corredor_no_meio::text from public.ticketeria_setores where id = tm.id('41')), '4/false', 'lugares refeito (4 à venda) e o corredor desligado');

-- O que se recusa.
select is(array[
  tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, '[]'::jsonb)$t$, tm.id('41'))),
  tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, null)$t$, tm.id('41'))),
  tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, '{"nome": "A"}'::jsonb)$t$, tm.id('41'))),
  tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, '[{"nome": "A B", "assentos": [{"numero": 1}]}]'::jsonb)$t$, tm.id('41'))),
  tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, '[{"nome": "", "assentos": [{"numero": 1}]}]'::jsonb)$t$, tm.id('41'))),
  tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, '[{"nome": "A", "assentos": [{"numero": 1}]}, {"nome": "a", "assentos": [{"numero": 1}]}]'::jsonb)$t$, tm.id('41'))),
  tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, '[{"nome": "A", "assentos": [{"numero": 1}, {"numero": 1}]}]'::jsonb)$t$, tm.id('41'))),
  tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, '[{"nome": "A", "assentos": [{"numero": 0}]}]'::jsonb)$t$, tm.id('41'))),
  tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, '[{"nome": "A", "assentos": []}]'::jsonb)$t$, tm.id('41'))),
  tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, '[{"nome": "A", "assentos": [{"numero": "x"}]}]'::jsonb)$t$, tm.id('41'))),
  tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, '[{"nome": "A", "assentos": [{"numero": 1, "bloqueado": "sim"}]}]'::jsonb)$t$, tm.id('41')))
], array_fill('23514 mapa_invalido'::text, array[11]), 'formato inválido (vazio, sem lista, nome ruim, fileira repetida, lugar repetido, número fora de 1 a 999, fileira sem lugares, bloqueio que não é verdadeiro ou falso): recusa');
select is(tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, (select jsonb_agg(jsonb_build_object('nome', 'F' || n, 'assentos', jsonb_build_array(jsonb_build_object('numero', 1)))) from generate_series(1, 61) n))$t$, tm.id('41'))), '23514 mapa_invalido', 'mais de 60 fileiras: recusa');
select is(tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, jsonb_build_array(jsonb_build_object('nome', 'A', 'assentos', (select jsonb_agg(jsonb_build_object('numero', n)) from generate_series(1, 81) n))))$t$, tm.id('41'))), '23514 mapa_invalido', 'mais de 80 lugares numa fileira: recusa');
select is(tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, tm.mapa(3, 2, array['A1','A2','A3','B1','B2']))$t$, tm.id('41'))), '23514 mapa_sem_lugares', 'tudo bloqueado: sem lugares à venda');
select is(tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, tm.mapa(3, 2))$t$, tm.id('44'))), '23514 setor_arquivado', 'setor arquivado: recusa');
select is(tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, tm.mapa(3, 2))$t$, tm.id('ff'))), 'P0002 setor_inexistente', 'setor que não existe: recusa');
select is((select count(*)::int from public.ticketeria_assentos where setor_id = tm.id('41')), 5, 'e os recusados não mudaram o mapa');

-- A oferta dos lotes tem de caber: o Camarote tem lotes de 8 e um mapa de 5 lugares não comporta.
select is(tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, tm.mapa(3, 2))$t$, tm.id('42'))), '23514 lugares_excedidos', 'a oferta (8) não cabe nos 5 lugares do mapa: recusa');
select is((public.fn_ticketeria_salvar_mapa(tm.id('42'), tm.mapa(5, 5)) ->> 'lugares'), '10', 'com 10 lugares a oferta de 8 cabe');

-- Setor com vendas para sessão por vir, ainda sem mapa: recusa.
do $venda$
declare
  v_pedido uuid := tm.id('e1');
begin
  insert into public.ticketeria_pedidos (id, organization_id, loja_id, sessao_id, codigo, comprador_nome, comprador_email, situacao, total_centavos, taxa_centavos, produtor_centavos, quem_paga_taxa, reservado_ate, pago_em)
  values (v_pedido, tm.id('a0'), tm.id('61'), tm.id('81'), 'ABCDEFGH', 'Rita', 'rita@teste.invalid', 'pago', 5000, 0, 5000, 'produtor', now() + interval '1 day', now());
  insert into public.ticketeria_pedido_itens (organization_id, pedido_id, ingresso_id, lote_id, quantidade, preco_centavos, taxa_centavos) values (tm.id('a0'), v_pedido, tm.id('32'), tm.id('22'), 1, 5000, 0);
end
$venda$;
select is(tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, tm.mapa(3, 2))$t$, tm.id('43'))), '23514 setor_com_vendas', 'setor com pedido pago para sessão por vir e sem mapa: recusa (os ingressos vendidos não têm lugar)');
update public.ticketeria_pedidos set situacao = 'cancelado', pago_em = null where id = tm.id('e1');
select is((public.fn_ticketeria_salvar_mapa(tm.id('43'), tm.mapa(5, 5)) ->> 'lugares'), '10', 'pedido cancelado não conta: o mapa grava');

-- O gatilho do setor: numerado sem mapa não pode.
select is(array[
  tm.tenta(format($t$update public.ticketeria_setores set numerado = true where id = %L$t$, tm.id('44'))),
  tm.tenta(format($t$insert into public.ticketeria_setores (organization_id, local_id, nome, lugares, numerado) values (%L, %L, 'Novo', 10, true)$t$, tm.id('a0'), tm.id('51')))
], array['23514 mapa_vazio', '23514 mapa_vazio'], 'ligar "numerado" sem mapa (ou criar já numerado): recusa');
update public.ticketeria_setores set numerado = false, lugares = 30 where id = tm.id('41');
select is((select numerado::text || '/' || lugares || '/' || (select count(*) from public.ticketeria_assentos where setor_id = tm.id('41')) from public.ticketeria_setores where id = tm.id('41')), 'false/30/5', 'desligar "numerado" volta a quantidade digitada; o mapa fica guardado');
update public.ticketeria_setores set numerado = true where id = tm.id('41');
select is((select lugares from public.ticketeria_setores where id = tm.id('41')), 4, 'ligar de novo (o mapa existe): lugares volta a ser a contagem do mapa');

-- Quem lê, quem grava e quem executa.
select tm.como('a1');
select is((select count(*)::int from public.ticketeria_assentos), 25, 'quem edita vê os lugares da organização');
select is((public.fn_ticketeria_salvar_mapa(tm.id('41'), tm.mapa(4, 4)) ->> 'lugares'), '8', 'e salva o mapa');
select tm.como('a3');
select is((select count(*)::int from public.ticketeria_assentos), 28, 'o leitor vê o mapa');
select is(left(tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, tm.mapa(2, 2))$t$, tm.id('41'))), 5), '42501', 'mas o leitor não o altera');
select tm.como('b1');
select is((select count(*)::int from public.ticketeria_assentos), 0, 'outra organização não vê os lugares');
select is(tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, tm.mapa(2, 2))$t$, tm.id('41'))), 'P0002 setor_inexistente', 'e não enxerga o setor de quem não é seu');
select tm.como(null);
select is(left(tm.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, tm.mapa(2, 2))$t$, tm.id('41'))), 5), '42501', 'visitante não executa a função');
select tm.volta();

select * from finish();
rollback;
