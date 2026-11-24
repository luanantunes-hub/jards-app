-- Estoque único da Ticketeria (migration ticketeria_estoque_unico): o setor é um balde de lugares por sessão e todos os tipos de ingresso
-- (inteira, meia, social…) tiram dele. Desenho: docs/acoes-futuras/estudos/ticketeria-estoque-unico.md.
--
-- A gravação (a soma dos lotes deixa de ser exigida; um lote sozinho não passa dos lugares); a venda (inteira e meia dividem o mesmo balde, a meia
-- esgota no teto do lote e a inteira segue vendendo o resto, nenhuma venda passa da lotação, dois tipos no mesmo pedido, reserva vencida devolve o
-- lugar); o que a vitrine e a lista de espera enxergam (fn_ticketeria_livres); o pagamento depois do prazo (o balde também tem de caber); e quem
-- pode chamar a conta nova. Ids 0d7e0000-0000-4000-8000-0000000000XX, ou te.id('XX'), esquema `te`. Desfeito no fim; sem DELETE.
--   Organização a0 com a ticketeria; loja 61; local 51 com o setor 41 (10 lugares); evento 71 publicado com as sessões 81, 82, 83 e 84 (daqui a 10 dias).
--   Ingressos do setor: 31 Inteira (lote 21: 10 a R$ 50), 34 Meia (lote 24: 4 a R$ 25, um lote pequeno de propósito, para provar o teto de um lote), 36 Social (lote 26: 10 a R$ 10).
-- Rodar: supabase/tests/README.md, com as migrations da T2, da T3, ticketeria_pagamentos, ticketeria_custo_do_meio e ticketeria_estoque_unico na frente
-- se não estiverem aplicadas (o bloco tem uns 25 KB: pela CLI, `supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

create schema te;
grant usage on schema te to authenticated, anon;

create function te.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7e0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

create table te.pedidos (nome text primary key, resposta jsonb);

create function te.reservar(nome text, sessao text, itens jsonb) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  r := public.fn_ticketeria_reservar(te.id(sessao), itens, 'Rita Teste', 'rita@teste.invalid', 15);
  insert into te.pedidos values (nome, r);
  return r;
end;
$$;

create function te.pedido(nome text) returns uuid language sql as $$ select (resposta ->> 'pedido_id')::uuid from te.pedidos where pedidos.nome = pedido.nome $$;
create function te.itens(inteira int, meia int, social int) returns jsonb language sql as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select jsonb_build_object('ingresso_id', te.id('31'), 'quantidade', inteira) x where inteira > 0
    union all select jsonb_build_object('ingresso_id', te.id('34'), 'quantidade', meia) where meia > 0
    union all select jsonb_build_object('ingresso_id', te.id('36'), 'quantidade', social) where social > 0) t;
$$;
create function te.livres(sessao text, ingresso text) returns bigint language sql as $$ select public.fn_ticketeria_livres(te.id(sessao), te.id(ingresso)) $$;
create function te.vence(nome text) returns void language sql as $$ update public.ticketeria_pedidos set reservado_ate = now() - interval '1 minute' where id = te.pedido(nome) $$;

do $dados$
begin
  insert into public.organizations (id, nome) values (te.id('a0'), 'TE A');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (te.id('a0'), 'ticketeria', 'cortesia', 20);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (te.id('61'), te.id('a0'), 'Loja A');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (te.id('51'), te.id('a0'), te.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (te.id('41'), te.id('a0'), te.id('51'), 'Plateia', 10);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (te.id('71'), te.id('a0'), te.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values
    (te.id('81'), te.id('a0'), te.id('71'), te.id('51'), now() + interval '10 days'),
    (te.id('82'), te.id('a0'), te.id('71'), te.id('51'), now() + interval '11 days'),
    (te.id('83'), te.id('a0'), te.id('71'), te.id('51'), now() + interval '12 days'),
    (te.id('84'), te.id('a0'), te.id('71'), te.id('51'), now() + interval '13 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria, publico) values
    (te.id('31'), te.id('a0'), te.id('71'), te.id('41'), 'Inteira', 'inteira', true),
    (te.id('34'), te.id('a0'), te.id('71'), te.id('41'), 'Meia', 'meia', true),
    (te.id('36'), te.id('a0'), te.id('71'), te.id('41'), 'Social', 'social', true);
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values
    (te.id('21'), te.id('a0'), te.id('31'), '1º lote', 0, 5000, 10),
    (te.id('24'), te.id('a0'), te.id('34'), '1º lote', 0, 2500, 4),
    (te.id('26'), te.id('a0'), te.id('36'), '1º lote', 0, 1000, 10);
end
$dados$;

create function te.tenta(comando text) returns text language plpgsql as $$
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

create function te.tenta_reservar(sessao text, itens jsonb) returns text language sql as $$
  select te.tenta(format('select public.fn_ticketeria_reservar(%L, %L::jsonb, %L, %L, 15)', te.id(sessao), itens::text, 'Rita Teste', 'rita@teste.invalid'))
$$;

-- ─── A gravação: a soma dos lotes deixou de ser exigida ─────────────────────

select is((select sum(l.quantidade)::int from public.ticketeria_lotes l join public.ticketeria_ingressos i on i.id = l.ingresso_id where i.setor_id = te.id('41')),
          24, 'os três lotes somam 24 num setor de 10 lugares: aceito (a soma não é mais exigida)');
select is(te.tenta(format('insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade) values (%L, %L, %L, 1000, 11)', te.id('a0'), te.id('36'), 'Demais')),
          '23514 lugares_excedidos', 'um lote sozinho de 11 passa dos 10 lugares do setor: recusado');
select is(te.tenta(format('update public.ticketeria_lotes set quantidade = 11 where id = %L', te.id('26'))), '23514 lugares_excedidos', 'aumentar um lote além dos lugares: recusado');
select is(te.tenta(format('update public.ticketeria_lotes set quantidade = 10 where id = %L', te.id('24'))), 'aceito', 'a meia pode ter o lote que o produtor quiser, até os lugares do setor (não há limite de meia)');

-- ─── A vitrine: tudo livre no começo ────────────────────────────────────────

select is(array[te.livres('81', '31'), te.livres('81', '34'), te.livres('81', '36')], array[10, 4, 10]::bigint[], 'sessão vazia: inteira 10, meia 4 (o lote dela) e social 10');

-- ─── Inteira e meia dividem o mesmo balde ───────────────────────────────────

select is((te.reservar('p1', '81', te.itens(7, 0, 0)) ->> 'situacao'), 'aguardando_pagamento', 'sessão 81: 7 inteiras reservadas');
select is(array[te.livres('81', '31'), te.livres('81', '34'), te.livres('81', '36')], array[3, 3, 3]::bigint[], 'sobram 3 lugares para todos os tipos (a meia, de lote 4, mostra 3: o balde manda)');
select is((te.reservar('p2', '81', te.itens(0, 3, 0)) ->> 'situacao'), 'aguardando_pagamento', 'mais 3 meias cabem: 7 + 3 = os 10 lugares');
select is(array[te.livres('81', '31'), te.livres('81', '34'), te.livres('81', '36')], array[0, 0, 0]::bigint[], 'lotou: nenhum tipo tem mais lugar');
select is(array[te.tenta_reservar('81', te.itens(1, 0, 0)), te.tenta_reservar('81', te.itens(0, 0, 1)), te.tenta_reservar('81', te.itens(0, 1, 0))],
          array['23514 esgotado', '23514 esgotado', '23514 esgotado'], 'lotado: inteira, social e meia são recusadas, e nenhum lote passa da lotação');

-- ─── O lote pequeno da meia, e a inteira vende o resto ──────────────────────────────

select is((te.reservar('p3', '82', te.itens(0, 4, 0)) ->> 'situacao'), 'aguardando_pagamento', 'sessão 82: 4 meias, o tamanho do lote');
select is(te.tenta_reservar('82', te.itens(0, 1, 0)), '23514 esgotado', 'a 5ª meia é recusada pelo tamanho do lote, ainda que haja lugar no balde');
select is(array[te.livres('82', '34'), te.livres('82', '31')], array[0, 6]::bigint[], 'a meia esgotou no lote dela, e a inteira ainda tem os 6 lugares que sobram (nada ficou reservado para a meia)');
select is((te.reservar('p4', '82', te.itens(6, 0, 0)) ->> 'situacao'), 'aguardando_pagamento', 'a inteira vende os 6 que sobram: o teatro lota com 4 meias e 6 inteiras');
select is(public.fn_ticketeria_ocupados_do_setor(te.id('82'), te.id('41')), 10::bigint, 'a conta do setor: 10 de 10');

-- ─── Dois tipos no mesmo pedido, e a reserva vencida ────────────────────────

select is(array[te.tenta_reservar('83', te.itens(7, 4, 0)), te.tenta_reservar('83', te.itens(6, 4, 0))], array['23514 esgotado', 'aceito']::text[],
          'no mesmo pedido: 7 inteiras + 4 meias passam dos 10 lugares (recusado); 6 + 4 cabem');
select is((te.reservar('p5', '83', te.itens(10, 0, 0)) ->> 'situacao'), 'aguardando_pagamento', 'sessão 83: 10 inteiras reservadas');
select is(te.livres('83', '34'), 0::bigint, 'enquanto a reserva vale, não sobra nada para a meia');
select te.vence('p5');
select is(array[te.livres('83', '31'), te.livres('83', '34')], array[10, 4]::bigint[], 'a reserva vencida devolve os lugares ao balde');

-- ─── Pago depois do prazo: o balde também tem de caber ──────────────────────

select is((te.reservar('p6', '84', te.itens(0, 4, 0)) ->> 'situacao'), 'aguardando_pagamento', 'sessão 84: 4 meias reservadas');
select public.fn_ticketeria_definir_meio(te.pedido('p6'), 'pix', null);
select te.vence('p6');
select is((te.reservar('p7', '84', te.itens(7, 0, 0)) ->> 'situacao'), 'aguardando_pagamento', 'outra pessoa reserva 7 inteiras nos lugares que o prazo liberou');
select is(te.tenta(format('select public.fn_ticketeria_confirmar_pagamento(%L, %L, %L, %s)', te.pedido('p6'), 'mentira', 'ref-p6', (select (resposta ->> 'total_centavos') from te.pedidos where nome = 'p6'))),
          '23514 reserva_expirada_sem_lugar', 'o pagamento das 4 meias chega depois do prazo e o balde (7 + 4 = 11) não comporta: recusado');
select te.vence('p7');
select is(te.tenta(format('select public.fn_ticketeria_confirmar_pagamento(%L, %L, %L, %s)', te.pedido('p6'), 'mentira', 'ref-p6', (select (resposta ->> 'total_centavos') from te.pedidos where nome = 'p6'))),
          'aceito', 'com os lugares livres de novo, o mesmo pagamento tardio vale');

-- ─── Quem pode chamar a conta nova ──────────────────────────────────────────

select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_ocupados_do_setor(uuid, uuid, uuid)', 'execute')
          and not has_function_privilege('anon', 'public.fn_ticketeria_ocupados_do_setor(uuid, uuid, uuid)', 'execute'),
          'a conta do balde é interna: o navegador não a chama');

select * from finish();
rollback;
