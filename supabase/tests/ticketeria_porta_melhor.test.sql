-- Ticketeria: a Porta melhor (fn_ticketeria_porta_buscar, _desfazer, _relatorio, _lista, ticketeria_porta_desfeitas): a busca pelo nome acha todas as palavras, sem diferença de acento e de
-- maiúsculas, sem tratar % e _ como curinga, até 15 de cada vez; desfazer uma entrada tira a marca de usado e deixa registro; o relatório e a lista contam só o que é da sessão da loja.
-- Ids 0d7c0000-0000-4000-8000-0000000000XX, ou tr.id('XX'). A (a0): loja 61, local 51, evento 71, sessão 81; Plateia (41, numerada: A1 a A3) com a Inteira (31); Pista (42) com o ingresso 33 (30 vagas).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_porta_melhor, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

create schema tr;
grant usage on schema tr to authenticated, anon;

create function tr.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7c0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at) values (tr.id('a1'), 'tr-a1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());
  insert into public.organizations (id, nome) values (tr.id('a0'), 'TR A'), (tr.id('b0'), 'TR B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tr.id('a0'), 'ticketeria', 'cortesia', 20), (tr.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values (tr.id('a0'), tr.id('a1'), 'admin', '{ticketeria}'::text[]);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tr.id('61'), tr.id('a0'), 'Loja A'), (tr.id('6b'), tr.id('b0'), 'Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tr.id('51'), tr.id('a0'), tr.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (tr.id('41'), tr.id('a0'), tr.id('51'), 'Plateia', 100), (tr.id('42'), tr.id('a0'), tr.id('51'), 'Pista', 100);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tr.id('71'), tr.id('a0'), tr.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (tr.id('81'), tr.id('a0'), tr.id('71'), tr.id('51'), now() + interval '10 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria, limite_por_pedido) values
    (tr.id('31'), tr.id('a0'), tr.id('71'), tr.id('41'), 'Inteira', 'inteira', 10), (tr.id('33'), tr.id('a0'), tr.id('71'), tr.id('42'), 'Pista', 'inteira', 10);
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values
    (tr.id('21'), tr.id('a0'), tr.id('31'), '1º lote', 0, 6000, 3), (tr.id('23'), tr.id('a0'), tr.id('33'), '1º lote', 0, 2000, 40);
  delete from public.ticketeria_taxas;
  insert into public.ticketeria_cupons (organization_id, evento_id, codigo, tipo, valor) values (tr.id('a0'), tr.id('71'), 'GRATIS', 'percentual', 100);
  perform public.fn_ticketeria_salvar_mapa(tr.id('41'), '[{"nome": "A", "assentos": [{"numero": 1}, {"numero": 2}, {"numero": 3}]}]'::jsonb, true);
end
$dados$;

-- Pedidos gratuitos (cupom de 100%): o nome do comprador e o ingresso.
create table tr.pedidos (nome text primary key, id uuid);
create function tr.comprar(nome text, ingresso text, qtd int, lugares jsonb default '[]'::jsonb) returns void language plpgsql as $$
begin
  insert into tr.pedidos select nome || '#' || (select count(*) from tr.pedidos), (public.fn_ticketeria_reservar_com_lugares(tr.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tr.id(ingresso), 'quantidade', qtd)), nome, 'x' || (select count(*) from tr.pedidos) || '@teste.invalid', 15, 'GRATIS', lugares) ->> 'pedido_id')::uuid;
end;
$$;
select tr.comprar('Marina Prado', '31', 2, jsonb_build_array(jsonb_build_object('ingresso_id', tr.id('31'), 'assentos', jsonb_build_array(jsonb_build_object('fileira', 'A', 'numero', 1), jsonb_build_object('fileira', 'A', 'numero', 2)))));
select tr.comprar('José da Conceição', '33', 1);
select tr.comprar('Mariana Prates', '33', 1);
select tr.comprar('Ana_Lima', '33', 1);
select tr.comprar('AnaXLima', '33', 1);
select tr.comprar('Zeca Muitos', '33', 8);
select tr.comprar('Zeca Muitos', '33', 8);

create function tr.busca(termo text) returns jsonb language sql stable as $$ select public.fn_ticketeria_porta_buscar(tr.id('61'), tr.id('81'), termo) $$;
create function tr.nomes(termo text) returns text language sql stable as $$
  select coalesce(string_agg(a ->> 'comprador' || ':' || (a ->> 'ingresso'), ' | ' order by a ->> 'comprador', a ->> 'ingresso', a ->> 'assento'), '') from jsonb_array_elements(tr.busca(termo) -> 'achados') a
$$;
create function tr.codigo(comprador text, n int default 1) returns text language sql stable as $$
  select codigo from (select i.codigo, row_number() over (order by i.created_at, i.id) rn from public.ticketeria_ingressos_emitidos i join public.ticketeria_pedidos p on p.id = i.pedido_id where p.comprador_nome = comprador) x where rn = n
$$;
create function tr.erro(comando text) returns text language plpgsql as $$
begin
  execute comando;
  return 'aceito';
exception when others then return sqlerrm;
end;
$$;

-- A busca.
select is(tr.nomes('mari'), 'Mariana Prates:Pista | Marina Prado:Inteira | Marina Prado:Inteira', 'busca por "mari": os 3 ingressos de quem tem mari no nome');
select is(tr.nomes('marina prado'), 'Marina Prado:Inteira | Marina Prado:Inteira', 'duas palavras: só quem tem as duas (em qualquer ordem)');
select is(tr.nomes('prado MARINA'), 'Marina Prado:Inteira | Marina Prado:Inteira', 'em qualquer ordem e com maiúsculas');
select is(tr.nomes('jose conceicao'), 'José da Conceição:Pista', 'sem acento acha quem tem acento');
select is(tr.nomes('JOSÉ'), 'José da Conceição:Pista', 'com acento e em maiúsculas também');
select is(tr.nomes('ana_l'), 'Ana_Lima:Pista', 'o sublinhado não é curinga: não acha AnaXLima');
select is(tr.nomes('%%'), '', 'o % também não é curinga');
select is(tr.busca('a') -> 'achados', '[]'::jsonb, 'termo de uma letra não busca');
select is(tr.busca('   ') -> 'achados', '[]'::jsonb, 'termo em branco também não');
select is(tr.nomes('ninguem'), '', 'ninguém com esse nome');
select is(jsonb_array_length(tr.busca('zeca') -> 'achados') || '/' || (tr.busca('zeca') ->> 'mais'), '15/true', 'mais de 15 achados: devolve 15 e avisa que há mais');
select is((tr.busca('marina') ->> 'mais') || '/' || (tr.busca('marina') ->> 'fuso'), 'false/America/Sao_Paulo', 'poucos achados: sem "mais", e o fuso do local vem junto');
select is((select a ->> 'assento' from jsonb_array_elements(tr.busca('marina') -> 'achados') a order by a ->> 'assento' limit 1), 'Plateia · Fileira A · lugar 1', 'o lugar vem na busca');
select is(tr.erro(format($t$select public.fn_ticketeria_porta_buscar(%L, %L, 'mari')$t$, tr.id('6b'), tr.id('81'))), 'sessao_inexistente', 'sessão de outra loja: erro');

-- A situação de cada um e dar entrada pela busca (pelo código).
select public.fn_ticketeria_conferir_ingresso(tr.id('61'), tr.id('81'), tr.codigo('Marina Prado', 1), tr.id('a1'));
update public.ticketeria_ingressos_emitidos set cancelado_em = now() where id = (select i.id from public.ticketeria_ingressos_emitidos i join public.ticketeria_pedidos p on p.id = i.pedido_id where p.comprador_nome = 'Mariana Prates');
select is((select string_agg(a ->> 'situacao', ',' order by a ->> 'comprador', a ->> 'assento') from jsonb_array_elements(tr.busca('mari') -> 'achados') a), 'cancelado,entrou,nao_entrou', 'a situação: cancelado, entrou e ainda não entrou');

-- Desfazer.
create table tr.d1 as select public.fn_ticketeria_porta_desfazer(tr.id('61'), tr.id('81'), tr.codigo('Marina Prado', 1), tr.id('a1')) as r;
select is((select r ->> 'tipo' from tr.d1) || '|' || (select r ->> 'comprador' from tr.d1) || '|' || (select r ->> 'ingresso' from tr.d1), 'desfeita|Marina Prado|Inteira', 'desfaz a entrada marcada');
select is((select (usado_em is null and usado_por is null)::text from public.ticketeria_ingressos_emitidos where codigo = tr.codigo('Marina Prado', 1)), 'true', 'o ingresso volta a não usado');
select is((select count(*)::int || '/' || (desfeito_por = tr.id('a1'))::text || '/' || (usado_por = tr.id('a1'))::text from public.ticketeria_porta_desfeitas group by desfeito_por, usado_por), '1/true/true', 'fica o registro: quem leu, quem desfez');
select is(public.fn_ticketeria_porta_desfazer(tr.id('61'), tr.id('81'), tr.codigo('Marina Prado', 1), tr.id('a1')) ->> 'tipo', 'nao_usado', 'desfazer o que não foi usado: nada a desfazer');
select is(public.fn_ticketeria_porta_desfazer(tr.id('61'), tr.id('81'), tr.codigo('Mariana Prates', 1), tr.id('a1')) ->> 'tipo', 'cancelado', 'ingresso cancelado não se mexe');
select is(public.fn_ticketeria_porta_desfazer(tr.id('61'), tr.id('81'), 'ZZZZZZZZZZ', tr.id('a1')) ->> 'tipo', 'nao_encontrado', 'código que não existe: não encontrado');
select is(public.fn_ticketeria_conferir_ingresso(tr.id('61'), tr.id('81'), tr.codigo('Marina Prado', 1), tr.id('a1')) ->> 'tipo', 'pode_entrar', 'depois de desfeita, a pessoa pode entrar de novo');
select is(tr.erro(format($t$select public.fn_ticketeria_porta_desfazer(%L, %L, 'X', null)$t$, tr.id('6b'), tr.id('81'))), 'sessao_inexistente', 'sessão de outra loja: erro');

-- O relatório e a lista.
select is(public.fn_ticketeria_porta_relatorio(tr.id('61'), tr.id('81')) - 'por_horario' - 'por_ingresso', '{"fuso": "America/Sao_Paulo", "validos": 21, "entraram": 1, "cancelados": 1}'::jsonb, 'válidos, entraram e cancelados (o cancelado não entra na conta)');
select is((select string_agg((x ->> 'nome') || ':' || (x ->> 'entraram') || '/' || (x ->> 'validos'), ' ' order by x ->> 'nome') from jsonb_array_elements(public.fn_ticketeria_porta_relatorio(tr.id('61'), tr.id('81')) -> 'por_ingresso') x), 'Inteira:1/2 Pista:0/19', 'por ingresso');
select is((select jsonb_array_length(public.fn_ticketeria_porta_relatorio(tr.id('61'), tr.id('81')) -> 'por_horario') || '/' || (public.fn_ticketeria_porta_relatorio(tr.id('61'), tr.id('81')) -> 'por_horario' -> 0 ->> 'entradas')), '1/1', 'por horário: uma faixa com a entrada de agora');
select is((public.fn_ticketeria_porta_relatorio(tr.id('61'), tr.id('81')) -> 'por_horario' -> 0 ->> 'faixa'), to_char(date_bin('30 minutes', (select usado_em at time zone 'America/Sao_Paulo' from public.ticketeria_ingressos_emitidos where codigo = tr.codigo('Marina Prado', 1)), timestamp '2000-01-01 00:00'), 'HH24:MI'), 'a faixa é a meia hora no fuso do local');
select is(jsonb_array_length(public.fn_ticketeria_porta_lista(tr.id('61'), tr.id('81')) -> 'ingressos'), 22, 'a lista traz todos os ingressos da sessão (22, com o cancelado)');
select is((public.fn_ticketeria_porta_lista(tr.id('61'), tr.id('81')) -> 'ingressos' -> 0 ->> 'comprador'), 'Ana_Lima', 'e em ordem de nome');
select is(tr.erro(format($t$select public.fn_ticketeria_porta_relatorio(%L, %L)$t$, tr.id('6b'), tr.id('81'))) || '/' || tr.erro(format($t$select public.fn_ticketeria_porta_lista(%L, %L)$t$, tr.id('6b'), tr.id('81'))), 'sessao_inexistente/sessao_inexistente', 'relatório e lista de sessão de outra loja: erro');

select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_porta_buscar(uuid, uuid, text)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_porta_desfazer(uuid, uuid, text, uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_porta_relatorio(uuid, uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_porta_lista(uuid, uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_porta_buscar(uuid, uuid, text)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_porta_desfazer(uuid, uuid, text, uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_porta_relatorio(uuid, uuid)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_porta_lista(uuid, uuid)', 'execute')
          and has_table_privilege('authenticated', 'public.ticketeria_porta_desfeitas', 'select') and not has_table_privilege('authenticated', 'public.ticketeria_porta_desfeitas', 'insert') and not has_table_privilege('anon', 'public.ticketeria_porta_desfeitas', 'select'), 'só o servidor executa e grava; o registro é só leitura para quem edita');

select * from finish();
rollback;
