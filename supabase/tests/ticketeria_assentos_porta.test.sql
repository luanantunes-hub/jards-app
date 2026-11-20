-- Ticketeria: o lugar na Porta (fn_ticketeria_conferir_ingresso e fn_ticketeria_porta_resumo): a conferência devolve o lugar do ingresso de setor numerado ao deixar entrar
-- e ao avisar que já foi usado; ingresso de setor comum devolve o lugar nulo; as últimas entradas trazem o lugar; o resto da conferência segue igual.
-- Ids 0d7b0000-0000-4000-8000-0000000000XX, ou tp.id('XX'). A (a0): loja 61, local 51, evento 71, sessão 81; Plateia (41, numerada: A1 a A3) com a Inteira (31); Pista (42) com o ingresso 33.
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_assentos_porta, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

create schema tp;
grant usage on schema tp to authenticated, anon;

create function tp.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7b0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into public.organizations (id, nome) values (tp.id('a0'), 'TP A'), (tp.id('b0'), 'TP B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tp.id('a0'), 'ticketeria', 'cortesia', 20), (tp.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tp.id('61'), tp.id('a0'), 'Loja A'), (tp.id('6b'), tp.id('b0'), 'Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tp.id('51'), tp.id('a0'), tp.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (tp.id('41'), tp.id('a0'), tp.id('51'), 'Plateia', 100), (tp.id('42'), tp.id('a0'), tp.id('51'), 'Pista', 100);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tp.id('71'), tp.id('a0'), tp.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (tp.id('81'), tp.id('a0'), tp.id('71'), tp.id('51'), now() + interval '10 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values
    (tp.id('31'), tp.id('a0'), tp.id('71'), tp.id('41'), 'Inteira', 'inteira'), (tp.id('33'), tp.id('a0'), tp.id('71'), tp.id('42'), 'Pista', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values
    (tp.id('21'), tp.id('a0'), tp.id('31'), '1º lote', 0, 6000, 3), (tp.id('23'), tp.id('a0'), tp.id('33'), '1º lote', 0, 2000, 20);
  delete from public.ticketeria_taxas;
  insert into public.ticketeria_cupons (organization_id, evento_id, codigo, tipo, valor) values (tp.id('a0'), tp.id('71'), 'GRATIS', 'percentual', 100);
  perform public.fn_ticketeria_salvar_mapa(tp.id('41'), '[{"nome": "A", "assentos": [{"numero": 1}, {"numero": 2}, {"numero": 3}]}]'::jsonb, true);
end
$dados$;

-- Dois pedidos gratuitos (cupom de 100%): a Inteira com os lugares A1 e A2, e um da Pista (sem lugar).
create table tp.pedidos (nome text primary key, id uuid);
insert into tp.pedidos select 'sentado', (public.fn_ticketeria_reservar_com_lugares(tp.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tp.id('31'), 'quantidade', 2)), 'Rita Teste', 'rita@teste.invalid', 15, 'GRATIS',
  jsonb_build_array(jsonb_build_object('ingresso_id', tp.id('31'), 'assentos', jsonb_build_array(jsonb_build_object('fileira', 'A', 'numero', 1), jsonb_build_object('fileira', 'A', 'numero', 2))))) ->> 'pedido_id')::uuid;
insert into tp.pedidos select 'pista', (public.fn_ticketeria_reservar_com_lugares(tp.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tp.id('33'), 'quantidade', 1)), 'Bia Teste', 'bia@teste.invalid', 15, 'GRATIS', '[]'::jsonb) ->> 'pedido_id')::uuid;

create function tp.erro_loja_errada() returns text language plpgsql as $$
begin
  perform public.fn_ticketeria_conferir_ingresso(tp.id('6b'), tp.id('81'), 'X', null);
  return 'aceito';
exception when others then return sqlerrm;
end;
$$;

create function tp.codigo(pedido text, n int) returns text language sql stable as $$
  select codigo from (select codigo, row_number() over (order by created_at, id) rn from public.ticketeria_ingressos_emitidos where pedido_id = (select id from tp.pedidos where nome = pedido)) x where rn = n
$$;

select is((select string_agg(assento_rotulo, ' | ' order by created_at, id) from public.ticketeria_ingressos_emitidos where pedido_id = (select id from tp.pedidos where nome = 'sentado')), 'Plateia · Fileira A · lugar 1 | Plateia · Fileira A · lugar 2', 'os ingressos da Plateia têm o lugar');
select is((select assento_rotulo from public.ticketeria_ingressos_emitidos where pedido_id = (select id from tp.pedidos where nome = 'pista')), null, 'o da Pista não tem');

-- A conferência: pode entrar (com o lugar), já usado (com o lugar) e o ingresso sem lugar.
create table tp.c1 as select public.fn_ticketeria_conferir_ingresso(tp.id('61'), tp.id('81'), tp.codigo('sentado', 1), null) as r;
select is((select r ->> 'tipo' from tp.c1) || '|' || (select r ->> 'assento' from tp.c1) || '|' || (select r ->> 'ingresso' from tp.c1) || '|' || (select r ->> 'comprador' from tp.c1) || '|' || (select r ->> 'restantes' from tp.c1), 'pode_entrar|Plateia · Fileira A · lugar 1|Inteira|Rita Teste|2', 'pode entrar: vem o lugar, o ingresso, o comprador e quantos faltam');
create table tp.c2 as select public.fn_ticketeria_conferir_ingresso(tp.id('61'), tp.id('81'), tp.codigo('sentado', 1), null) as r;
select is((select r ->> 'tipo' from tp.c2) || '|' || (select r ->> 'assento' from tp.c2), 'ja_usado|Plateia · Fileira A · lugar 1', 'o segundo uso: já usado, com o lugar');
create table tp.c3 as select public.fn_ticketeria_conferir_ingresso(tp.id('61'), tp.id('81'), tp.codigo('pista', 1), null) as r;
select is((select r ->> 'tipo' from tp.c3) || '|' || coalesce((select r ->> 'assento' from tp.c3), 'nulo') || '|' || (select (r ? 'assento')::text from tp.c3), 'pode_entrar|nulo|true', 'ingresso de setor comum: pode entrar, com o lugar nulo (a chave existe)');
select is(public.fn_ticketeria_conferir_ingresso(tp.id('61'), tp.id('81'), lower(tp.codigo('sentado', 2)) || ' ', null) ->> 'assento', 'Plateia · Fileira A · lugar 2', 'o código digitado em minúsculas e com espaço acha o ingresso e o lugar');

-- O resto da conferência segue igual.
select is(public.fn_ticketeria_conferir_ingresso(tp.id('61'), tp.id('81'), 'ZZZZZZZZZZ', null) ->> 'tipo', 'nao_encontrado', 'código que não existe: não encontrado');
select is(tp.erro_loja_errada(), 'sessao_inexistente', 'sessão de outra loja: erro');
update public.ticketeria_ingressos_emitidos set cancelado_em = now() where pedido_id = (select id from tp.pedidos where nome = 'sentado') and assento_rotulo like '%lugar 2';
select is(public.fn_ticketeria_conferir_ingresso(tp.id('61'), tp.id('81'), tp.codigo('sentado', 2), null) ->> 'tipo', 'cancelado', 'compra reembolsada: cancelado');

-- As últimas entradas trazem o lugar.
select is((select string_agg(coalesce(x ->> 'assento', 'sem') || ':' || (x ->> 'ingresso'), ' | ' order by x ->> 'ingresso') from jsonb_array_elements(public.fn_ticketeria_porta_resumo(tp.id('61'), tp.id('81')) -> 'recentes') x), 'Plateia · Fileira A · lugar 1:Inteira | sem:Pista', 'as últimas entradas: o lugar de cada uma (a da Pista sem lugar)');
select is((public.fn_ticketeria_porta_resumo(tp.id('61'), tp.id('81')) ->> 'validos') || '/' || (public.fn_ticketeria_porta_resumo(tp.id('61'), tp.id('81')) ->> 'entraram'), '2/2', 'ingressos válidos e entradas: 2 e 2 (o cancelado não conta)');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_conferir_ingresso(uuid, uuid, text, uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_porta_resumo(uuid, uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_conferir_ingresso(uuid, uuid, text, uuid)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_porta_resumo(uuid, uuid)', 'execute'), 'só o servidor executa');

select * from finish();
rollback;
