-- PD7.2 (segundo corte): pedidos de convidados por link, com horário de corte (producao_convidados_links, producao_convidados.solicitante,
-- fn_producao_convidados_gerar_link e fn_producao_convidado_pedir).
--
-- Quem lê e quem gera o link (colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção só para
-- leitura), o hash que nunca sai para o navegador, a validade do corte e do limite, o pedido pelo link (só o servidor executa; link
-- inexistente, desativado, encerrado ou lotado; cota cheia; tipo arquivado ou de outra organização) e a forma dos dados.
-- Ids 0d380000-0000-4000-8000-0000000000XX, ou cl.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: sessões 91 (link gerado no teste), 92 (link encerrado), 93 (link desativado), 94 (link com limite 1 e um pedido);
--   tipos t1 (cota 2), t2 (sem cota), t3 (arquivado); a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.
--   B (b0), cortesia: sessão 9b, tipo tb, b1 admin.  C (c0), produção só para leitura: sessão 9c, c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_convidados_links na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

create schema cl;
grant usage on schema cl to authenticated, anon;

create function cl.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d380000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

create function cl.hash(texto text) returns text language sql immutable as $$
  select encode(extensions.digest(texto, 'sha256'), 'hex');
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select cl.id(s), 'cl-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (cl.id('a0'), 'CL A'), (cl.id('b0'), 'CL B'), (cl.id('c0'), 'CL C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (cl.id('a0'), 'producao', 'cortesia', 20), (cl.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (cl.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = cl.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select cl.id(o), cl.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (cl.id('a0'), cl.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (cl.id('31'), cl.id('a0'), 'CL E1', 'Teatro'), (cl.id('3b'), cl.id('b0'), 'CL EB', 'Teatro'), (cl.id('3c'), cl.id('c0'), 'CL EC', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values
    (cl.id('71'), cl.id('a0'), cl.id('31'), 'S1'), (cl.id('7b'), cl.id('b0'), cl.id('3b'), 'SB'), (cl.id('7c'), cl.id('c0'), cl.id('3c'), 'SC');
  insert into public.producao_pautas (id, organization_id, sala_id, titulo, inicio, fim, situacao) values
    (cl.id('81'), cl.id('a0'), cl.id('71'), 'Festival', date '2026-12-05', date '2026-12-09', 'confirmada'),
    (cl.id('8b'), cl.id('b0'), cl.id('7b'), 'Pauta B', date '2026-12-05', date '2026-12-07', 'consulta'),
    (cl.id('8c'), cl.id('c0'), cl.id('7c'), 'Pauta C', date '2026-12-05', date '2026-12-07', 'consulta');
  insert into public.producao_sessoes (id, organization_id, pauta_id, dia, inicio, fim) values
    (cl.id('91'), cl.id('a0'), cl.id('81'), date '2026-12-05', time '18:00', time '20:00'),
    (cl.id('92'), cl.id('a0'), cl.id('81'), date '2026-12-06', time '18:00', time '20:00'),
    (cl.id('93'), cl.id('a0'), cl.id('81'), date '2026-12-07', time '18:00', time '20:00'),
    (cl.id('94'), cl.id('a0'), cl.id('81'), date '2026-12-08', time '18:00', time '20:00'),
    (cl.id('9b'), cl.id('b0'), cl.id('8b'), date '2026-12-05', time '18:00', time '20:00'),
    (cl.id('9c'), cl.id('c0'), cl.id('8c'), date '2026-12-05', time '18:00', time '20:00');
  insert into public.producao_credencial_tipos (id, organization_id, nome, cota_por_sessao, arquivado) values
    (cl.id('c1'), cl.id('a0'), 'Imprensa', 2, false), (cl.id('c2'), cl.id('a0'), 'Elenco', null, false), (cl.id('c3'), cl.id('a0'), 'Antigo', 5, true),
    (cl.id('cb'), cl.id('b0'), 'Imprensa', 2, false);
  insert into public.producao_convidados_links (id, organization_id, sessao_id, token_hash, corte_em, revogado_em, limite) values
    (cl.id('e2'), cl.id('a0'), cl.id('92'), cl.hash('l2'), now() - interval '1 hour', null, 100),
    (cl.id('e3'), cl.id('a0'), cl.id('93'), cl.hash('l3'), now() + interval '2 days', now(), 100),
    (cl.id('e4'), cl.id('a0'), cl.id('94'), cl.hash('l4'), now() + interval '2 days', null, 1),
    (cl.id('eb'), cl.id('b0'), cl.id('9b'), cl.hash('lb'), now() + interval '2 days', null, 100),
    (cl.id('ec'), cl.id('c0'), cl.id('9c'), cl.hash('lc'), now() + interval '2 days', null, 100);
  insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome, quantidade, situacao, solicitante) values
    (cl.id('a0'), cl.id('94'), cl.id('c2'), 'CL Já pedido', 1, 'pedido', 'CL Alguém');
end
$dados$;

create function cl.tenta(comando text) returns text language plpgsql as $$
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

create function cl.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using cl.id(o || '0');
  return n::text;
end;
$$;

create function cl.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', cl.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function cl.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_convidados_links' and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_convidados_links'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_convidados_links'::regclass and confrelid <> 'auth.users'::regclass),
          'producao_convidados_links_organization_id_fkey=c, producao_convidados_links_sessao_id_fkey=c', 'o link sai com a sessão');
select ok(not has_column_privilege('authenticated', 'public.producao_convidados_links', 'token_hash', 'select')
          and has_column_privilege('authenticated', 'public.producao_convidados_links', 'corte_em', 'select')
          and not has_table_privilege('anon', 'public.producao_convidados_links', 'select')
          and has_function_privilege('authenticated', 'public.fn_producao_convidados_gerar_link(uuid, timestamptz, text, integer)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_convidado_pedir(text, text, text, text, uuid, integer)', 'execute')
          and has_function_privilege('service_role', 'public.fn_producao_convidado_pedir(text, text, text, text, uuid, integer)', 'execute')
          and not has_function_privilege('anon', 'public.fn_producao_convidado_pedir(text, text, text, text, uuid, integer)', 'execute'),
          'o hash não sai para o navegador; gerar é da produção logada; pedir é só do servidor');

-- ─── Quem gera ──────────────────────────────────────────────────────────────

select cl.como('a3');
select ok(cl.tenta(format('select public.fn_producao_convidados_gerar_link(%L, now() + interval ''1 day'', null, 0)', cl.id('91'))) like '42501%', 'leitor não gera o link');
select cl.como('a5');
select is(cl.tenta(format('select public.fn_producao_convidados_gerar_link(%L, now() + interval ''1 day'', null, 0)', cl.id('91'))), 'P0002 sessao_nao_encontrada', 'o recorte "vinculado" sem vínculo não vê a sessão');
select cl.como('b1');
select is(cl.tenta(format('select public.fn_producao_convidados_gerar_link(%L, now() + interval ''1 day'', null, 0)', cl.id('91'))), 'P0002 sessao_nao_encontrada', 'outra organização não vê a sessão');
select cl.como('c1');
select ok(cl.tenta(format('select public.fn_producao_convidados_gerar_link(%L, now() + interval ''1 day'', null, 0)', cl.id('9c'))) like '42501%', 'produção só para leitura não gera o link');
select cl.como('a2');
select is(array[
            cl.tenta(format('select public.fn_producao_convidados_gerar_link(%L, now() - interval ''1 hour'', null, 0)', cl.id('91'))),
            cl.tenta(format('select public.fn_producao_convidados_gerar_link(%L, now() + interval ''366 days'', null, 0)', cl.id('91'))),
            cl.tenta(format('select public.fn_producao_convidados_gerar_link(%L, null, null, 0)', cl.id('91'))),
            cl.tenta(format('select public.fn_producao_convidados_gerar_link(%L, now() + interval ''1 day'', null, 501)', cl.id('91')))],
          array['P0001 corte_invalido', 'P0001 corte_invalido', 'P0001 corte_invalido', 'P0001 limite_invalido'], 'corte no passado, a mais de um ano ou vazio, e limite acima de 500 são recusados');
select set_config('cl.codigo', public.fn_producao_convidados_gerar_link(cl.id('91'), now() + interval '2 days', '  Pedidos da imprensa  ', 0), true);
select cl.volta();
select ok(current_setting('cl.codigo') ~ '^[A-Za-z0-9_-]{43}$'
          and (select token_hash from public.producao_convidados_links where sessao_id = cl.id('91')) = cl.hash(current_setting('cl.codigo'))
          and (select titulo || '|' || limite from public.producao_convidados_links where sessao_id = cl.id('91')) = 'Pedidos da imprensa|100'
          and (select count(*) from public.producao_convidados_links where sessao_id = cl.id('91')) = 1,
          'o código tem 43 letras, só o hash fica, o título é aparado, limite 0 vira 100 e gerar de novo renova o mesmo link');
select cl.como('a2');
select ok(cl.tenta('select token_hash from public.producao_convidados_links') like '42501%', 'o navegador não lê o hash');
select is(cl.ve('producao_convidados_links', 'a'), '4', 'colaborador lê os links da organização');
select cl.como('a5');
select is(cl.ve('producao_convidados_links', 'a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select cl.como('b1');
select is(cl.ve('producao_convidados_links', 'a') || '|' || cl.ve('producao_convidados_links', 'b'), '0|1', 'outra organização só lê o que é dela');
select cl.como('a2');
select ok(cl.tenta(format('select public.fn_producao_convidado_pedir(%L, %L, %L, null, %L, 1)', cl.hash(current_setting('cl.codigo')), 'x', 'y', cl.id('c2'))) like '42501%', 'o navegador logado não pede pelo link');
select cl.volta();

-- ─── O pedido pelo link (só o servidor) ─────────────────────────────────────

select is(public.fn_producao_convidado_pedir(cl.hash(current_setting('cl.codigo')), 'Marta da Assessoria', 'Rita Souza', '  ', cl.id('c1'), 2), 'ok', 'o pedido pelo link vale');
select is((select nome || '|' || coalesce(afiliacao, '-') || '|' || quantidade || '|' || situacao || '|' || solicitante from public.producao_convidados where sessao_id = cl.id('91') and nome like 'Rita%'),
          'Rita Souza|-|2|pedido|Marta da Assessoria', 'nasce em situação "pedido", com o nome de quem pediu, e a afiliação vazia vira nula');
select is(public.fn_producao_convidado_pedir(cl.hash(current_setting('cl.codigo')), 'Marta', 'Paulo', null, cl.id('c1'), 1), 'cota_cheia', 'a cota do tipo vale: 2 de 2, o próximo é recusado');
select is(public.fn_producao_convidado_pedir(cl.hash(current_setting('cl.codigo')), 'Marta', 'Paulo', null, cl.id('c2'), 20), 'ok', 'o tipo sem cota aceita');
select is(array[
            public.fn_producao_convidado_pedir(cl.hash(current_setting('cl.codigo')), 'Marta', 'x', null, cl.id('c3'), 1),
            public.fn_producao_convidado_pedir(cl.hash(current_setting('cl.codigo')), 'Marta', 'x', null, cl.id('cb'), 1),
            public.fn_producao_convidado_pedir(cl.hash('nao-existe'), 'Marta', 'x', null, cl.id('c2'), 1),
            public.fn_producao_convidado_pedir(cl.hash('l3'), 'Marta', 'x', null, cl.id('c2'), 1),
            public.fn_producao_convidado_pedir(cl.hash('l2'), 'Marta', 'x', null, cl.id('c2'), 1),
            public.fn_producao_convidado_pedir(cl.hash('l4'), 'Marta', 'x', null, cl.id('c2'), 1)],
          array['tipo_invalido', 'tipo_invalido', 'inexistente', 'revogado', 'encerrado', 'lotado'],
          'tipo arquivado ou de outra organização, link inexistente, desativado, encerrado (depois do corte) ou lotado não gravam');
select is(cl.tenta(format('select public.fn_producao_convidado_pedir(%L, %L, %L, null, %L, 1)', cl.hash(current_setting('cl.codigo')), ' ', 'Fulano', cl.id('c2'))),
          '23514 producao_convidados_solicitante_check', 'sem o nome de quem pede o banco recusa');

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            cl.tenta(format('insert into public.producao_convidados_links (organization_id, sessao_id, token_hash, corte_em, limite) values (%L, %L, %L, now(), 0)', cl.id('a0'), cl.id('93'), repeat('a', 64))),
            cl.tenta(format('insert into public.producao_convidados_links (organization_id, sessao_id, token_hash, corte_em) values (%L, %L, %L, now())', cl.id('a0'), cl.id('91'), repeat('b', 64))),
            cl.tenta(format('update public.producao_convidados_links set token_hash = %L where id = %L', 'curto', cl.id('e2'))),
            cl.tenta(format('update public.producao_convidados_links set titulo = %L where id = %L', ' ', cl.id('e2'))),
            cl.tenta(format('update public.producao_convidados_links set organization_id = %L where id = %L', cl.id('b0'), cl.id('e2'))),
            cl.tenta(format('update public.producao_convidados_links set sessao_id = %L where id = %L', cl.id('93'), cl.id('e2'))),
            cl.tenta(format('insert into public.producao_convidados_links (organization_id, sessao_id, token_hash, corte_em) values (%L, %L, %L, now())', cl.id('a0'), cl.id('9b'), repeat('c', 64)))],
          array['23514 producao_convidados_links_limite_check', '23505 producao_convidados_links_sessao_key', '23514 producao_convidados_links_hash_check', '23514 producao_convidados_links_titulo_check',
                '23514 organizacao_nao_muda', '23514 sessao_nao_muda', '23514 sessao_de_outra_organizacao'],
          'limite, um link por sessão, formato do hash, título, o que não muda e a sessão da organização');

select * from finish();
rollback;
