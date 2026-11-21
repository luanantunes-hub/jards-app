-- A meia-entrada como desconto de 50% (migration ticketeria_meia_e_desconto): a meia é ligada à inteira (ticketeria_ingressos.meia_de) e os lotes dela
-- espelham os da inteira (ticketeria_lotes.espelho_de), com metade do preço.
--
-- Os espelhos nascem com a meia, acompanham o preço, a quantidade, o nome e a janela da inteira, e somem com o lote; o preço da meia na venda; o setor, o
-- "aparece ao público" e o limite por pedido seguem os da inteira; a meia arquiva com a inteira e some com ela; e o que não combina (outro evento, meia de
-- meia, meia de gratuito, duas meias da mesma inteira). Ids 0d7f0000-0000-4000-8000-0000000000XX, ou tm.id('XX'), esquema `tm`. Desfeito no fim.
--   Organização a0 com a ticketeria; loja 61; local 51 com os setores 41 e 43 (10 lugares cada); eventos 71 (publicado, sessão 81 daqui a 10 dias) e 72.
--   Ingressos: 31 Inteira do 71 no setor 41 (lote 21: R$ 50, 10 lugares; lote 22: R$ 80, 5), 33 Gratuito (lote 23), 35 Inteira do 72, e 34 Meia ligada ao 31.
-- Rodar: supabase/tests/README.md, com as migrations da T2, da T3, ticketeria_pagamentos, ticketeria_custo_do_meio e ticketeria_meia_e_desconto na frente
-- se não estiverem aplicadas (pela CLI, `supabase db query --linked -f bloco.sql`). A seção final usa DELETE (desfeito).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

create schema tm;
grant usage on schema tm to authenticated, anon;

create function tm.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7f0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

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

create function tm.lotes(ingresso text) returns text language sql as $$
  select coalesce(string_agg(l.nome || ':' || l.preco_centavos || 'x' || l.quantidade || '#' || l.ordem, ',' order by l.ordem), '') from public.ticketeria_lotes l where l.ingresso_id = tm.id(ingresso)
$$;

do $dados$
begin
  insert into public.organizations (id, nome) values (tm.id('a0'), 'TM A');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tm.id('a0'), 'ticketeria', 'cortesia', 20);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tm.id('61'), tm.id('a0'), 'Loja A');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tm.id('51'), tm.id('a0'), tm.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values
    (tm.id('41'), tm.id('a0'), tm.id('51'), 'Plateia', 10), (tm.id('43'), tm.id('a0'), tm.id('51'), 'Camarote', 10);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values
    (tm.id('71'), tm.id('a0'), tm.id('61'), 'Hamlet', 'publicado'), (tm.id('72'), tm.id('a0'), tm.id('61'), 'Outro', 'rascunho');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (tm.id('81'), tm.id('a0'), tm.id('71'), tm.id('51'), now() + interval '10 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria, publico) values
    (tm.id('31'), tm.id('a0'), tm.id('71'), tm.id('41'), 'Inteira', 'inteira', true),
    (tm.id('33'), tm.id('a0'), tm.id('71'), tm.id('41'), 'Gratuito', 'gratuito', true),
    (tm.id('35'), tm.id('a0'), tm.id('72'), tm.id('41'), 'Inteira do outro', 'inteira', true);
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values
    (tm.id('21'), tm.id('a0'), tm.id('31'), '1º lote', 0, 5000, 10),
    (tm.id('22'), tm.id('a0'), tm.id('31'), '2º lote', 1, 8000, 5),
    (tm.id('23'), tm.id('a0'), tm.id('33'), 'Retirada', 0, 0, 5);
  -- A meia, ligada à inteira: os lotes dela nascem espelhados.
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria, publico, meia_de) values
    (tm.id('34'), tm.id('a0'), tm.id('71'), tm.id('41'), 'Meia-entrada', 'meia', true, tm.id('31'));
end
$dados$;

-- ─── Os espelhos nascem com a meia ──────────────────────────────────────────

select is(tm.lotes('34'), '1º lote:2500x10#0,2º lote:4000x5#1', 'a meia nasce com um lote para cada lote da inteira, pela metade do preço, com a mesma quantidade e ordem');
select is((select count(*)::int from public.ticketeria_lotes where ingresso_id = tm.id('34') and espelho_de in (tm.id('21'), tm.id('22'))), 2, 'cada lote da meia aponta para o lote da inteira que ele espelha');

-- ─── Acompanham a inteira ───────────────────────────────────────────────────

update public.ticketeria_lotes set preco_centavos = 7001, quantidade = 8, nome = 'Promo', vendas_fim = now() + interval '5 days' where id = tm.id('21');
select is((select row(m.preco_centavos, m.quantidade, m.nome, m.vendas_fim = i.vendas_fim)::text from public.ticketeria_lotes m join public.ticketeria_lotes i on i.id = m.espelho_de where i.id = tm.id('21')),
          '(3501,8,Promo,t)', 'mudou o preço da inteira (R$ 70,01), a meia mudou junto (R$ 35,01), com o nome, a quantidade e a janela');
insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values (tm.id('24'), tm.id('a0'), tm.id('31'), '3º lote', 2, 9000, 3);
select is(tm.lotes('34'), 'Promo:3501x8#0,2º lote:4000x5#1,3º lote:4500x3#2', 'lote novo na inteira cria o espelho na meia');
delete from public.ticketeria_lotes where id = tm.id('24');
select is(tm.lotes('34'), 'Promo:3501x8#0,2º lote:4000x5#1', 'lote apagado na inteira leva o espelho da meia');
update public.ticketeria_lotes set preco_centavos = 5000, quantidade = 10, nome = '1º lote', vendas_fim = null where id = tm.id('21');

-- ─── O preço na venda ───────────────────────────────────────────────────────

select is((select (public.fn_ticketeria_reservar(tm.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tm.id('34'), 'quantidade', 2)), 'Rita Teste', 'rita@teste.invalid', 15) ->> 'pedido_id') is not null),
          true, 'a meia vende pelo lote espelhado');
select is((select string_agg(it.preco_centavos || 'x' || it.quantidade, ',') from public.ticketeria_pedido_itens it where it.ingresso_id = tm.id('34')), '2500x2', 'o item do pedido saiu a R$ 25,00 (metade de R$ 50,00)');
select is((select public.fn_ticketeria_livres(tm.id('81'), tm.id('31'))), 8::bigint, 'as 2 meias saíram do mesmo balde da inteira: sobram 8 dos 10 lugares');

-- ─── O que não combina ──────────────────────────────────────────────────────

select is(array[
            tm.tenta(format('insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, meia_de) values (%L, %L, %L, %L, %L, %L)', tm.id('a0'), tm.id('71'), tm.id('41'), 'Meia 2', 'meia', tm.id('31'))),
            tm.tenta(format('insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, meia_de) values (%L, %L, %L, %L, %L, %L)', tm.id('a0'), tm.id('71'), tm.id('41'), 'Meia de outro evento', 'meia', tm.id('35'))),
            tm.tenta(format('insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, meia_de) values (%L, %L, %L, %L, %L, %L)', tm.id('a0'), tm.id('71'), tm.id('41'), 'Meia de meia', 'meia', tm.id('34'))),
            tm.tenta(format('insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, meia_de) values (%L, %L, %L, %L, %L, %L)', tm.id('a0'), tm.id('71'), tm.id('41'), 'Meia do gratuito', 'meia', tm.id('33'))),
            tm.tenta(format('insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, meia_de) values (%L, %L, %L, %L, %L, %L)', tm.id('a0'), tm.id('71'), tm.id('43'), 'Meia no outro setor', 'meia', tm.id('31'))),
            tm.tenta(format('insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, meia_de) values (%L, %L, %L, %L, %L, %L)', tm.id('a0'), tm.id('71'), tm.id('41'), 'Não é meia', 'outra', tm.id('31'))),
            tm.tenta(format('update public.ticketeria_ingressos set meia_de = id where id = %L', tm.id('34')))],
          array['23505 ticketeria_ingressos_meia_de_key', '23514 meia_incoerente', '23514 meia_incoerente', '23514 meia_incoerente', '23514 meia_incoerente', '23514 ticketeria_ingressos_meia_de_check', '23514 meia_incoerente'],
          'uma meia só por inteira; do mesmo evento e setor; não é meia de meia nem de gratuito; só a categoria meia tem meia_de; e não é meia de si mesma');

-- ─── A meia segue a inteira ─────────────────────────────────────────────────

update public.ticketeria_ingressos set publico = false, limite_por_pedido = 4 where id = tm.id('31');
select is((select row(publico, limite_por_pedido)::text from public.ticketeria_ingressos where id = tm.id('34')), '(f,4)', 'o limite por pedido e o "aparece ao público" da inteira valem para a meia');
update public.ticketeria_ingressos set publico = true, limite_por_pedido = 10 where id = tm.id('31');
select is((select row(publico, limite_por_pedido)::text from public.ticketeria_ingressos where id = tm.id('34')), '(t,10)', 'e voltam juntos');

select is(tm.tenta(format('update public.ticketeria_ingressos set setor_id = %L where id = %L', tm.id('43'), tm.id('31'))), 'aceito', 'a inteira muda de setor');
update public.ticketeria_ingressos set setor_id = tm.id('43') where id = tm.id('31');
select is((select setor_id = tm.id('43') from public.ticketeria_ingressos where id = tm.id('34')), true, 'a meia foi junto para o outro setor');

update public.ticketeria_ingressos set arquivado = true where id = tm.id('31');
select is((select arquivado from public.ticketeria_ingressos where id = tm.id('34')), true, 'inteira arquivada arquiva a meia');
update public.ticketeria_ingressos set arquivado = false where id = tm.id('31');
select is((select arquivado from public.ticketeria_ingressos where id = tm.id('34')), true, 'tirar a inteira do arquivo não tira a meia: quem decide é o produtor');
update public.ticketeria_ingressos set arquivado = false where id = tm.id('34');
select is(tm.tenta(format('update public.ticketeria_ingressos set arquivado = true where id = %L', tm.id('34'))), 'aceito', 'o produtor arquiva só a meia, sem mexer na inteira (desligar a meia-entrada)');
select is((select arquivado from public.ticketeria_ingressos where id = tm.id('31')), false, 'e a inteira segue à venda');

-- ─── A meia some com a inteira ──────────────────────────────────────────────

select is(tm.tenta(format('delete from public.ticketeria_ingressos where id = %L', tm.id('33'))), 'aceito', 'o ingresso sem meia se apaga como antes');
delete from public.ticketeria_pedido_itens where ingresso_id in (tm.id('31'), tm.id('34'));
delete from public.ticketeria_pedidos where sessao_id = tm.id('81');
delete from public.ticketeria_ingressos where id = tm.id('31');
select is((select count(*)::int from public.ticketeria_ingressos where id in (tm.id('31'), tm.id('34'))), 0, 'apagar a inteira leva a meia');
select is((select count(*)::int from public.ticketeria_lotes where ingresso_id in (tm.id('31'), tm.id('34'))), 0, 'e os lotes dos dois');

-- ─── Quem pode chamar as funções dos gatilhos ───────────────────────────────

select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_espelhar_lote()', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_meia_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_meia_acompanha()', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_meia_nova()', 'execute')
          and not has_function_privilege('anon', 'public.fn_ticketeria_espelhar_lote()', 'execute'), 'as funções dos gatilhos são internas');

select * from finish();
rollback;
