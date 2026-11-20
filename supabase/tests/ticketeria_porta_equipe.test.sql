-- Ticketeria: o link da equipe da porta (ticketeria_porta_links, fn_ticketeria_porta_link_criar, _listar, _revogar, fn_ticketeria_porta_equipe_resumo, _conferir, _buscar): o link vale só
-- para a sessão dele, até 24 horas depois do começo, enquanto estiver ligado e a sessão não for cancelada; a equipe confere e busca, mas só com o segredo; o produtor cria (até 10), lista e desliga.
-- Ids 0d7d0000-0000-4000-8000-0000000000XX, ou te.id('XX'). A (a0): loja 61, evento 71, sessões 81 (daqui a 10 dias) e 83 (outra, daqui a 11); sessão 82 já encerrada (começou há 3 dias); ingresso 33 (Pista).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_porta_equipe, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

create schema te;
grant usage on schema te to authenticated, anon;

create function te.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7d0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at) values (te.id('a1'), 'te-a1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());
  insert into public.organizations (id, nome) values (te.id('a0'), 'TE A'), (te.id('b0'), 'TE B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (te.id('a0'), 'ticketeria', 'cortesia', 20), (te.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values (te.id('a0'), te.id('a1'), 'admin', '{ticketeria}'::text[]);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (te.id('61'), te.id('a0'), 'Loja A'), (te.id('6b'), te.id('b0'), 'Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (te.id('51'), te.id('a0'), te.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (te.id('42'), te.id('a0'), te.id('51'), 'Pista', 100);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (te.id('71'), te.id('a0'), te.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values
    (te.id('81'), te.id('a0'), te.id('71'), te.id('51'), now() + interval '10 days'),
    (te.id('82'), te.id('a0'), te.id('71'), te.id('51'), now() - interval '3 days'),
    (te.id('83'), te.id('a0'), te.id('71'), te.id('51'), now() + interval '11 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values (te.id('33'), te.id('a0'), te.id('71'), te.id('42'), 'Pista', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values (te.id('23'), te.id('a0'), te.id('33'), '1º lote', 0, 2000, 40);
  delete from public.ticketeria_taxas;
  insert into public.ticketeria_cupons (organization_id, evento_id, codigo, tipo, valor) values (te.id('a0'), te.id('71'), 'GRATIS', 'percentual', 100);
end
$dados$;

-- Ingressos gratuitos (cupom de 100%): um de Marina na sessão 81 e um de Bia na 83.
create function te.comprar(nome text, sessao text) returns void language plpgsql as $$
begin
  perform public.fn_ticketeria_reservar_com_lugares(te.id(sessao), jsonb_build_array(jsonb_build_object('ingresso_id', te.id('33'), 'quantidade', 1)), nome, 'x@teste.invalid', 15, 'GRATIS', '[]'::jsonb);
end;
$$;
select te.comprar('Marina Prado', '81');
select te.comprar('Bia Souza', '83');
create function te.codigo(comprador text) returns text language sql stable as $$
  select i.codigo from public.ticketeria_ingressos_emitidos i join public.ticketeria_pedidos p on p.id = i.pedido_id where p.comprador_nome = comprador
$$;
create function te.erro(comando text) returns text language plpgsql as $$
begin
  execute comando;
  return 'aceito';
exception when others then return sqlerrm;
end;
$$;

-- Criar e listar.
create table te.l1 as select public.fn_ticketeria_porta_link_criar(te.id('61'), te.id('81'), '  Porta principal ', te.id('a1')) as r;
select is((select r ->> 'token' ~ '^[a-f0-9]{64}$' from te.l1), true, 'o link tem um segredo de 64 letras e números');
select is((select r ->> 'rotulo' from te.l1), 'Porta principal', 'o nome é aparado');
select is((select (r ->> 'valido_ate')::timestamptz = (select inicio + interval '24 hours' from public.ticketeria_sessoes where id = te.id('81')) from te.l1), true, 'vale até 24 horas depois do começo da sessão');
select is((select criado_por = te.id('a1') and ativo from public.ticketeria_porta_links where id = (select (r ->> 'id')::uuid from te.l1)), true, 'fica registrado quem criou, e ligado');
select is((public.fn_ticketeria_porta_link_listar(te.id('61'), te.id('81')) -> 'links' -> 0 ->> 'rotulo') || '/' || (public.fn_ticketeria_porta_link_listar(te.id('61'), te.id('81')) -> 'links' -> 0 ->> 'ativo'), 'Porta principal/true', 'a lista mostra o link ligado');
select is(public.fn_ticketeria_porta_link_listar(te.id('61'), te.id('81')) ->> 'fuso', 'America/Sao_Paulo', 'e o fuso do local');

-- A equipe: resumo, conferir, buscar.
create function te.token() returns text language sql stable as $$ select r ->> 'token' from te.l1 $$;
select is((public.fn_ticketeria_porta_equipe_resumo(te.token()) ->> 'evento') || '|' || (public.fn_ticketeria_porta_equipe_resumo(te.token()) ->> 'validos') || '|' || (public.fn_ticketeria_porta_equipe_resumo(te.token()) ->> 'entraram') || '|' || (public.fn_ticketeria_porta_equipe_resumo(te.token()) ->> 'link'), 'Hamlet|1|0|Porta principal', 'o resumo: evento, válidos (só desta sessão), entraram e o nome do link');
select is(public.fn_ticketeria_porta_equipe_buscar(te.token(), 'marina') -> 'achados' -> 0 ->> 'comprador', 'Marina Prado', 'a busca acha quem comprou');
select is(jsonb_array_length(public.fn_ticketeria_porta_equipe_buscar(te.token(), 'bia') -> 'achados'), 0, 'e não acha quem comprou para OUTRA sessão');
select is(public.fn_ticketeria_porta_equipe_conferir(te.token(), te.codigo('Marina Prado')) ->> 'tipo', 'pode_entrar', 'conferir: pode entrar');
select is((select usado_por is null and usado_em is not null from public.ticketeria_ingressos_emitidos where codigo = te.codigo('Marina Prado')), true, 'a entrada fica marcada (sem usuário: foi pelo link)');
select is(public.fn_ticketeria_porta_equipe_conferir(te.token(), te.codigo('Marina Prado')) ->> 'tipo', 'ja_usado', 'conferir de novo: já usado');
select is(public.fn_ticketeria_porta_equipe_conferir(te.token(), te.codigo('Bia Souza')) ->> 'tipo', 'outra_sessao', 'ingresso de outra sessão: não vale aqui');
select is(public.fn_ticketeria_porta_equipe_conferir(te.token(), 'ZZZZZZZZZZ') ->> 'tipo', 'nao_encontrado', 'código que não existe');
select is((public.fn_ticketeria_porta_equipe_resumo(te.token()) ->> 'entraram') || '/' || (public.fn_ticketeria_porta_equipe_resumo(te.token()) -> 'recentes' -> 0 ->> 'comprador'), '1/Marina Prado', 'o resumo já mostra a entrada');

-- Sem link valendo: link_invalido.
select is(array[
  te.erro($t$select public.fn_ticketeria_porta_equipe_resumo('nao-existe')$t$),
  te.erro($t$select public.fn_ticketeria_porta_equipe_conferir('', 'X')$t$),
  te.erro($t$select public.fn_ticketeria_porta_equipe_buscar(null, 'mari')$t$),
  te.erro($t$select public.fn_ticketeria_porta_equipe_resumo(repeat('a', 64))$t$)
], array_fill('link_invalido'::text, array[4]), 'segredo que não existe, vazio, nulo ou errado: link_invalido');

-- Desligar.
create table te.l2 as select public.fn_ticketeria_porta_link_criar(te.id('61'), te.id('81'), 'Camarote', null) as r;
select is(public.fn_ticketeria_porta_link_revogar(te.id('61'), (select (r ->> 'id')::uuid from te.l2)), true, 'desligar o link');
select is(te.erro(format($t$select public.fn_ticketeria_porta_equipe_resumo(%L)$t$, (select r ->> 'token' from te.l2))), 'link_invalido', 'o link desligado não vale mais');
select is(te.erro(format($t$select public.fn_ticketeria_porta_equipe_conferir(%L, 'X')$t$, (select r ->> 'token' from te.l2))), 'link_invalido', 'nem para conferir');
select is((select (x ->> 'ativo') from jsonb_array_elements(public.fn_ticketeria_porta_link_listar(te.id('61'), te.id('81')) -> 'links') x where x ->> 'rotulo' = 'Camarote'), 'false', 'a lista mostra o link desligado');
select is(public.fn_ticketeria_porta_equipe_resumo(te.token()) ->> 'link', 'Porta principal', 'e o outro link segue valendo');
select is(public.fn_ticketeria_porta_link_revogar(te.id('6b'), (select (r ->> 'id')::uuid from te.l1)), false, 'outra loja não desliga o link desta');

-- Validade e sessão cancelada.
update public.ticketeria_porta_links set valido_ate = now() - interval '1 minute' where id = (select (r ->> 'id')::uuid from te.l1);
select is(te.erro(format($t$select public.fn_ticketeria_porta_equipe_resumo(%L)$t$, te.token())), 'link_invalido', 'passou da validade: link_invalido');
select is((public.fn_ticketeria_porta_link_listar(te.id('61'), te.id('81')) -> 'links' -> 1 ->> 'ativo'), 'false', 'e a lista mostra como desligado');
update public.ticketeria_porta_links set valido_ate = now() + interval '1 day' where id = (select (r ->> 'id')::uuid from te.l1);
update public.ticketeria_sessoes set cancelada_em = now() where id = te.id('81');
select is(te.erro(format($t$select public.fn_ticketeria_porta_equipe_resumo(%L)$t$, te.token())), 'link_invalido', 'sessão cancelada derruba o link');
update public.ticketeria_sessoes set cancelada_em = null where id = te.id('81');

-- O que o produtor não pode.
select is(array[
  te.erro(format($t$select public.fn_ticketeria_porta_link_criar(%L, %L, 'X', null)$t$, te.id('6b'), te.id('81'))),
  te.erro(format($t$select public.fn_ticketeria_porta_link_criar(%L, %L, 'X', null)$t$, te.id('61'), te.id('82'))),
  te.erro(format($t$select public.fn_ticketeria_porta_link_criar(%L, %L, '   ', null)$t$, te.id('61'), te.id('81'))),
  te.erro(format($t$select public.fn_ticketeria_porta_link_criar(%L, %L, %L, null)$t$, te.id('61'), te.id('81'), repeat('x', 61))),
  te.erro(format($t$select public.fn_ticketeria_porta_link_listar(%L, %L)$t$, te.id('6b'), te.id('81')))
], array['sessao_inexistente', 'sessao_encerrada', 'rotulo_invalido', 'rotulo_invalido', 'sessao_inexistente'], 'sessão de outra loja, sessão já encerrada, nome vazio e comprido demais: recusa');
select is((select count(*)::int from public.ticketeria_porta_links where sessao_id = te.id('81') and ativo and valido_ate > now()), 1, 'sobrou 1 ligado (o outro está desligado)');
do $limite$
begin
  for i in 1..9 loop perform public.fn_ticketeria_porta_link_criar(te.id('61'), te.id('81'), 'Extra ' || i, null); end loop;
end
$limite$;
select is(te.erro(format($t$select public.fn_ticketeria_porta_link_criar(%L, %L, 'Mais um', null)$t$, te.id('61'), te.id('81'))), 'limite_de_links', 'com 10 ligados: limite_de_links');

select ok(not has_function_privilege('anon', 'public.fn_ticketeria_porta_equipe_conferir(text, text)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_porta_link_criar(uuid, uuid, text, uuid)', 'execute')
          and not has_function_privilege('anon', 'public.fn_ticketeria_porta_equipe_buscar(text, text)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_porta_link_resolver(text)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_porta_equipe_conferir(text, text)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_porta_link_criar(uuid, uuid, text, uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_porta_link_revogar(uuid, uuid)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_porta_equipe_resumo(text)', 'execute'), 'só o servidor executa');
select ok(has_table_privilege('authenticated', 'public.ticketeria_porta_links', 'select') and not has_table_privilege('authenticated', 'public.ticketeria_porta_links', 'insert') and not has_table_privilege('authenticated', 'public.ticketeria_porta_links', 'update') and not has_table_privilege('anon', 'public.ticketeria_porta_links', 'select'), 'os links: só leitura para quem edita; nada para o visitante');
select is((select count(*)::int from pg_policies where tablename = 'ticketeria_porta_links'), 1, 'uma regra de leitura (quem edita a Ticketeria)');

select * from finish();
rollback;
