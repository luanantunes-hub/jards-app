-- Ticketeria: a compra com escolha de lugares (ticketeria_pedido_assentos, fn_ticketeria_reservar_com_lugares, fn_ticketeria_mapa_da_sessao, fn_ticketeria_lugares_livres_do_setor,
-- fn_ticketeria_livres, o lugar no ingresso emitido, as travas do mapa e do setor): o lugar é por sessão e os tipos de ingresso do setor dividem o mesmo mapa; quem pega primeiro
-- leva; reserva vencida, cancelada ou reembolsada devolve o lugar; pedido gratuito e pedido pago depois levam o lugar no ingresso; só o servidor executa.
-- Ids 0d7a0000-0000-4000-8000-0000000000XX, ou tc.id('XX'). A (a0): loja 61, local 51, evento 71, sessões 81 e 82, setor 41 (Plateia, numerado: A com 4 lugares e B com 4, o A4 bloqueado),
-- setor 42 (Pista, comum), ingressos 31 (Inteira R$ 60, 4 vagas) e 32 (Meia R$ 30, 3 vagas) na Plateia (a oferta, 7, cabe nos 7 lugares à venda), 33 (Pista R$ 20). Taxa de A: 2,5% pagos pelo produtor.
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_assentos_compra, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(36);

create schema tc;
grant usage on schema tc to authenticated, anon;

create function tc.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7a0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tc.id(s), 'tc-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'b1']) as s;
  insert into public.organizations (id, nome) values (tc.id('a0'), 'TC A'), (tc.id('b0'), 'TC B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tc.id('a0'), 'ticketeria', 'cortesia', 20), (tc.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tc.id(o), tc.id(p), papel, '{ticketeria}'::text[] from (values ('a0', 'a1', 'admin'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tc.id('61'), tc.id('a0'), 'Loja A');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tc.id('51'), tc.id('a0'), tc.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (tc.id('41'), tc.id('a0'), tc.id('51'), 'Plateia', 100), (tc.id('42'), tc.id('a0'), tc.id('51'), 'Pista', 100), (tc.id('43'), tc.id('a0'), tc.id('51'), 'Ordem', 10);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tc.id('71'), tc.id('a0'), tc.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values
    (tc.id('81'), tc.id('a0'), tc.id('71'), tc.id('51'), now() + interval '10 days'), (tc.id('82'), tc.id('a0'), tc.id('71'), tc.id('51'), now() + interval '11 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values
    (tc.id('31'), tc.id('a0'), tc.id('71'), tc.id('41'), 'Inteira', 'inteira'), (tc.id('32'), tc.id('a0'), tc.id('71'), tc.id('41'), 'Meia', 'meia'), (tc.id('33'), tc.id('a0'), tc.id('71'), tc.id('42'), 'Pista', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values
    (tc.id('21'), tc.id('a0'), tc.id('31'), '1º lote', 0, 6000, 4), (tc.id('22'), tc.id('a0'), tc.id('32'), '1º lote', 0, 3000, 3), (tc.id('23'), tc.id('a0'), tc.id('33'), '1º lote', 0, 2000, 20);
  delete from public.ticketeria_taxas;
  insert into public.ticketeria_taxas (loja_id, percentual_bps, fixo_centavos, quem_paga, vigente_desde) values (tc.id('61'), 250, 0, 'produtor', now() - interval '1 day');
  insert into public.ticketeria_cupons (organization_id, evento_id, codigo, tipo, valor) values (tc.id('a0'), tc.id('71'), 'GRATIS', 'percentual', 100);
  -- O mapa da Plateia: A1 a A4 (o A4 bloqueado) e B1 a B4.
  perform public.fn_ticketeria_salvar_mapa(tc.id('41'), '[{"nome": "A", "assentos": [{"numero": 1}, {"numero": 2}, {"numero": 3}, {"numero": 4, "bloqueado": true}]}, {"nome": "B", "assentos": [{"numero": 1}, {"numero": 2}, {"numero": 3}, {"numero": 4}]}]'::jsonb, true);
end
$dados$;

create table tc.pedidos (nome text primary key, resposta jsonb);
-- Compra com lugares: ingresso e lugares ("A1 A2"), na sessão pedida.
create function tc.lugares(ingresso text, lista text) returns jsonb language sql immutable as $$
  select jsonb_build_object('ingresso_id', tc.id(ingresso), 'assentos', (select coalesce(jsonb_agg(jsonb_build_object('fileira', left(x, 1), 'numero', substr(x, 2)::int)), '[]'::jsonb) from unnest(string_to_array(lista, ' ')) x))
$$;
create function tc.comprar(nome text, ingresso text, lista text, sessao text default '81', codigo text default null) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  r := public.fn_ticketeria_reservar_com_lugares(tc.id(sessao),
    jsonb_build_array(jsonb_build_object('ingresso_id', tc.id(ingresso), 'quantidade', cardinality(string_to_array(lista, ' ')))), 'Rita Teste', 'rita@teste.invalid', 15, codigo,
    jsonb_build_array(tc.lugares(ingresso, lista)));
  insert into tc.pedidos values (nome, r);
  return r;
end;
$$;
create function tc.pedido(nome text) returns uuid language sql as $$ select (resposta ->> 'pedido_id')::uuid from tc.pedidos where pedidos.nome = pedido.nome $$;
create function tc.estados(sessao text, ingresso text) returns text language sql stable as $$
  select string_agg(f ->> 'nome' || ':' || (select string_agg(substr(a ->> 'estado', 1, 1), '' order by (a ->> 'numero')::int) from jsonb_array_elements(f -> 'assentos') a), ' ' order by ord)
  from jsonb_array_elements(public.fn_ticketeria_mapa_da_sessao(tc.id(sessao), tc.id(ingresso)) -> 'fileiras') with ordinality as t(f, ord)
$$;

create function tc.mapa_b(n int) returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('nome', 'B', 'assentos', (select jsonb_agg(jsonb_build_object('numero', i)) from generate_series(1, n) i)))
$$;

create function tc.tenta(comando text) returns text language plpgsql as $$
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

-- O mapa e os lugares livres, antes de qualquer compra. (o = ocupado: o A4 bloqueado aparece como ocupado para quem compra)
select is(tc.estados('81', '31'), 'A:lllo B:llll', 'o mapa da sessão: o lugar bloqueado aparece como ocupado, o resto livre');
select is(public.fn_ticketeria_lugares_livres_do_setor(tc.id('81'), tc.id('41'))::text || '/' || public.fn_ticketeria_livres(tc.id('81'), tc.id('31')) || '/' || public.fn_ticketeria_livres(tc.id('81'), tc.id('32')) || '/' || public.fn_ticketeria_livres(tc.id('81'), tc.id('33')), '7/4/3/20', 'lugares livres: 7 no setor numerado, 4 e 3 vagas nos ingressos dele e 20 na pista');
select is(public.fn_ticketeria_mapa_da_sessao(tc.id('81'), tc.id('33')), null, 'ingresso de setor comum: sem mapa');
select is(public.fn_ticketeria_mapa_da_sessao(tc.id('81'), tc.id('ff')), null, 'ingresso que não existe: sem mapa');

-- Comprar A1 e A2 com a Inteira.
select tc.comprar('p1', '31', 'A1 A2');
select is((select count(*)::int || '/' || count(*) filter (where assento_id is not null)::int from public.ticketeria_pedido_assentos where pedido_id = tc.pedido('p1')), '2/2', 'os dois lugares ficam presos ao pedido');
select is((select (resposta ->> 'total_centavos') from tc.pedidos where nome = 'p1'), '12000', 'o preço segue vindo do lote: 2 × R$ 60 = R$ 120 (a taxa sai do produtor)');
select is(tc.estados('81', '32'), 'A:oolo B:llll', 'na Meia (mesmo setor) A1 e A2 aparecem ocupados, A3 livre e A4 bloqueado');
select is(tc.estados('82', '31'), 'A:lllo B:llll', 'em outra sessão os lugares estão livres: o lugar é por sessão');
select is(public.fn_ticketeria_lugares_livres_do_setor(tc.id('81'), tc.id('41'))::text || '/' || public.fn_ticketeria_livres(tc.id('81'), tc.id('32')), '5/3', 'cinco lugares livres no setor e as 3 vagas da Meia');

-- Quem pega primeiro leva.
select is(tc.tenta($t$select tc.comprar('p2', '31', 'A2 B1')$t$), '23514 lugar_ocupado', 'um lugar já reservado por outro pedido: recusa');
select is((select count(*)::int from public.ticketeria_pedido_assentos where sessao_id = tc.id('81')), 2, 'e nada ficou reservado (nem o B1)');
select is(public.fn_ticketeria_ocupados(tc.id('81'), tc.id('21')), 2::bigint, 'nem a vaga do lote (a reserva inteira foi desfeita)');

-- Outro tipo de ingresso no mesmo setor, lugares diferentes.
select tc.comprar('p3', '32', 'B1 B2');
select is(tc.estados('81', '31'), 'A:oolo B:ooll', 'com a Meia em B1 e B2, a Inteira vê A1, A2, B1 e B2 ocupados');

-- O que se recusa.
select is(array[
  tc.tenta($t$select tc.comprar('x', '31', 'A4')$t$),
  tc.tenta($t$select tc.comprar('x', '31', 'Z9')$t$),
  tc.tenta($t$select tc.comprar('x', '31', 'A3 A3')$t$)
], array['23514 lugar_indisponivel', '23514 lugar_indisponivel', '23514 lugares_invalidos'], 'lugar bloqueado e lugar que não existe: indisponível; o mesmo lugar duas vezes: inválido');
select is(array[
  tc.tenta(format($t$select public.fn_ticketeria_reservar_com_lugares(%L, %L::jsonb, 'Rita', 'rita@teste.invalid', 15, null, null)$t$, tc.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tc.id('31'), 'quantidade', 1)))),
  tc.tenta(format($t$select public.fn_ticketeria_reservar_com_lugares(%L, %L::jsonb, 'Rita', 'rita@teste.invalid', 15, null, %L::jsonb)$t$, tc.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tc.id('31'), 'quantidade', 2)), jsonb_build_array(tc.lugares('31', 'B3')))),
  tc.tenta(format($t$select public.fn_ticketeria_reservar_com_lugares(%L, %L::jsonb, 'Rita', 'rita@teste.invalid', 15, null, %L::jsonb)$t$, tc.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tc.id('33'), 'quantidade', 1)), jsonb_build_array(tc.lugares('33', 'B3')))),
  tc.tenta(format($t$select public.fn_ticketeria_reservar_com_lugares(%L, %L::jsonb, 'Rita', 'rita@teste.invalid', 15, null, %L::jsonb)$t$, tc.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tc.id('31'), 'quantidade', 1)), jsonb_build_array(tc.lugares('31', 'B3'), tc.lugares('32', 'B4')))),
  tc.tenta(format($t$select public.fn_ticketeria_reservar_com_lugares(%L, %L::jsonb, 'Rita', 'rita@teste.invalid', 15, null, '{}'::jsonb)$t$, tc.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tc.id('31'), 'quantidade', 1))))
], array['23514 lugares_obrigatorios', '23514 lugares_quantidade', '23514 ingresso_sem_mapa', '23514 lugares_invalidos', '23514 lugares_invalidos'],
  'sem lugares num setor numerado, quantidade que não bate, lugares para setor comum, lugares de ingresso fora do pedido e lugares que não são uma lista: recusa');
select is(tc.tenta(format($t$select public.fn_ticketeria_reservar_com_lugares(%L, %L::jsonb, 'Rita', 'rita@teste.invalid', 15, null, null)$t$, tc.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tc.id('33'), 'quantidade', 1)))), 'aceito', 'ingresso de setor comum sem lugares: compra normal');

-- Reserva vencida devolve os lugares.
update public.ticketeria_pedidos set reservado_ate = now() - interval '1 minute' where id = tc.pedido('p1');
select is(tc.estados('81', '31'), 'A:lllo B:ooll', 'reserva vencida: A1 e A2 voltam para a venda');
select tc.comprar('p4', '31', 'A1');
select is((select count(*)::int from public.ticketeria_pedido_assentos where assento_id = (select id from public.ticketeria_assentos where setor_id = tc.id('41') and fileira = 'A' and numero = 1)), 2, 'o A1 tem a reserva vencida (história) e a nova');

-- Pago: o lugar vai para o ingresso, na ordem.
select public.fn_ticketeria_definir_meio(tc.pedido('p3'), 'pix', null);
select is(public.fn_ticketeria_confirmar_pagamento(tc.pedido('p3'), 'teste', 'ref-3', (select (resposta ->> 'total_centavos')::bigint from tc.pedidos where nome = 'p3')), 'pago', 'o pedido da Meia é pago');
select is((select string_agg(assento_rotulo, ' | ' order by created_at, id) from public.ticketeria_ingressos_emitidos where pedido_id = tc.pedido('p3')), 'Plateia · Fileira B · lugar 1 | Plateia · Fileira B · lugar 2', 'os ingressos emitidos levam o lugar, em ordem');
select is((public.fn_ticketeria_ingressos_do_pedido(tc.pedido('p3')) -> 'ingressos' -> 1 ->> 'assento'), 'Plateia · Fileira B · lugar 2', 'a página do pedido mostra o lugar de cada ingresso');

-- Pedido que nasce pago (cupom de 100%): os ingressos são emitidos antes dos lugares e ganham o lugar logo depois.
select tc.comprar('p5', '31', 'B3 B4', '81', 'GRATIS');
select is((select situacao from public.ticketeria_pedidos where id = tc.pedido('p5')), 'pago', 'cupom de 100% com lugares: pedido pago na hora');
select is((select string_agg(assento_rotulo, ' | ' order by created_at, id) from public.ticketeria_ingressos_emitidos where pedido_id = tc.pedido('p5')), 'Plateia · Fileira B · lugar 3 | Plateia · Fileira B · lugar 4', 'e os ingressos já saem com o lugar');

-- Esgotou tudo: sem lugar, a lista de espera enxerga o ingresso esgotado.
select is(public.fn_ticketeria_lugares_livres_do_setor(tc.id('81'), tc.id('41'))::text, '2', 'sobram A2 e A3 (A1 está na reserva nova, A4 bloqueado)');
select tc.comprar('p6', '32', 'A2');
select tc.comprar('p7', '31', 'A3');
select is(public.fn_ticketeria_livres(tc.id('81'), tc.id('31'))::text || '/' || public.fn_ticketeria_livres(tc.id('81'), tc.id('32')), '0/0', 'sem lugar livre e sem vaga nos lotes, nenhum ingresso do setor tem o que vender');

-- Reembolso (pedido cancelado) devolve os lugares.
update public.ticketeria_pedidos set situacao = 'cancelado', pago_em = null where id = tc.pedido('p3');
select is(public.fn_ticketeria_lugares_livres_do_setor(tc.id('81'), tc.id('41')), 2::bigint, 'pedido cancelado (reembolso): B1 e B2 voltam');

-- As travas do mapa e do setor com lugares vendidos.
select is(tc.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, '[{"nome": "A", "assentos": [{"numero": 2}, {"numero": 3}]}, {"nome": "B", "assentos": [{"numero": 1}, {"numero": 2}, {"numero": 3}, {"numero": 4}]}]'::jsonb)$t$, tc.id('41'))), '23514 lugar_vendido', 'tirar do mapa o A1 (reservado por p4): recusa');
select is(tc.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, '[{"nome": "A", "assentos": [{"numero": 1}, {"numero": 2, "bloqueado": true}, {"numero": 3}, {"numero": 4, "bloqueado": true}]}, {"nome": "B", "assentos": [{"numero": 1}, {"numero": 2}, {"numero": 3}, {"numero": 4}]}]'::jsonb)$t$, tc.id('41'))), '23514 lugar_vendido', 'bloquear o A2 (reservado por p6): recusa');
select is(tc.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, '[{"nome": "A", "assentos": [{"numero": 1}, {"numero": 2}, {"numero": 3}, {"numero": 4, "bloqueado": true}, {"numero": 5}]}, {"nome": "B", "assentos": [{"numero": 1}, {"numero": 2}, {"numero": 3}, {"numero": 4}]}]'::jsonb)$t$, tc.id('41'))), 'aceito', 'acrescentar um lugar não mexe nos vendidos: aceito');
select is(tc.tenta(format($t$update public.ticketeria_setores set numerado = false where id = %L$t$, tc.id('41'))), '23514 setor_com_lugares_vendidos', 'desligar "numerado" com lugares vendidos para sessão por vir: recusa');
-- Lugares de pedido cancelado e de sessão que passou não travam: depois de cancelar tudo o mapa muda à vontade, e a história do pedido fica.
update public.ticketeria_pedidos set situacao = 'cancelado', pago_em = null where id in (tc.pedido('p4'), tc.pedido('p5'), tc.pedido('p6'), tc.pedido('p7'));
select is(tc.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, tc.mapa_b(8))$t$, tc.id('41'))), 'aceito', 'sem lugares vendidos ativos, o mapa pode ser refeito (as fileiras A saem)');
select public.fn_ticketeria_salvar_mapa(tc.id('41'), tc.mapa_b(8));
select is((select count(*)::int || '/' || count(*) filter (where assento_id is null)::int from public.ticketeria_pedido_assentos where pedido_id = tc.pedido('p4')), '1/1', 'os lugares tirados do mapa ficam na história do pedido (fileira e número), sem ligação ao mapa');
select is((select assento_rotulo from public.ticketeria_ingressos_emitidos where pedido_id = tc.pedido('p5') order by created_at, id limit 1), 'Plateia · Fileira B · lugar 3', 'e o lugar impresso no ingresso não muda');

-- Ordem das fileiras no mapa do setor: A..Z antes de AA.
select public.fn_ticketeria_salvar_mapa(tc.id('43'), (select jsonb_agg(jsonb_build_object('nome', n, 'assentos', jsonb_build_array(jsonb_build_object('numero', 1))) order by o) from (values ('AA', 3), ('B', 2), ('A', 1)) v(n, o)));
select is((select string_agg(f ->> 'nome', ' ') from jsonb_array_elements(public.fn_ticketeria_mapa_do_setor(tc.id('43'))) f), 'A B AA', 'as fileiras vêm em ordem: A, B, AA');

-- Quem lê e quem executa.
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_reservar_com_lugares(uuid, jsonb, text, text, integer, text, jsonb)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_mapa_da_sessao(uuid, uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_lugares_livres_do_setor(uuid, uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_lugares_aos_ingressos(uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_reservar_com_lugares(uuid, jsonb, text, text, integer, text, jsonb)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_mapa_da_sessao(uuid, uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_lugares_livres_do_setor(uuid, uuid)', 'execute'), 'só o servidor executa as funções da compra com lugares');
select ok(has_table_privilege('authenticated', 'public.ticketeria_pedido_assentos', 'select') and not has_table_privilege('authenticated', 'public.ticketeria_pedido_assentos', 'insert') and not has_table_privilege('anon', 'public.ticketeria_pedido_assentos', 'select'), 'os lugares dos pedidos: só leitura para quem edita a Ticketeria, nada para o visitante');

select * from finish();
rollback;
