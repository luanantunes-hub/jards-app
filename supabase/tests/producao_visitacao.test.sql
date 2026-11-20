-- PD7.5 (primeiro corte): visitação e grupos (producao_visitas_horarios, producao_visitas_agendamentos, producao_visitas_links,
-- fn_producao_visitas_gerar_link e fn_producao_visita_agendar).
--
-- Quem lê e quem grava (colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção só para
-- leitura e visitante), o hash que nunca sai para o navegador, gerar o link, o agendamento pelo link (só o servidor executa; link
-- inexistente, desativado ou vencido; horário de outro espaço ou já passado; capacidade), a capacidade conferida pelo gatilho (só quando o
-- consumo aumenta), a forma dos dados e o histórico, que deixa o contato e a observação de fora.
-- Ids 0d3a0000-0000-4000-8000-0000000000XX, ou vi.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: espaços 31 (link gerado no teste), 32 (link desativado) e 33 (link vencido); horários h1 (31, capacidade 30), h2 (31, 10) e
--   h3 (31, no passado); agendamentos g1 (h1, 20 pessoas, confirmado) e g2 (h1, 5, recusado); a2 colaborador, a3 leitor, a5 colaborador com o
--   recorte "vinculado" e sem vínculo.  B (b0): b1 admin, espaço 3b, horário hb.  C (c0), produção só para leitura: c1, espaço 3c, horário hc.
-- Rodar: supabase/tests/README.md, com a migration producao_visitacao na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(34);

create schema vi;
grant usage on schema vi to authenticated, anon;

create function vi.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d3a0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

create function vi.hash(texto text) returns text language sql immutable as $$
  select encode(extensions.digest(texto, 'sha256'), 'hex');
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select vi.id(s), 'vi-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (vi.id('a0'), 'VI A'), (vi.id('b0'), 'VI B'), (vi.id('c0'), 'VI C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (vi.id('a0'), 'producao', 'cortesia', 20), (vi.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (vi.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = vi.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select vi.id(o), vi.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (vi.id('a0'), vi.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (vi.id('31'), vi.id('a0'), 'VI E1', 'Museu'), (vi.id('32'), vi.id('a0'), 'VI E2', 'Museu'), (vi.id('33'), vi.id('a0'), 'VI E3', 'Museu'),
    (vi.id('3b'), vi.id('b0'), 'VI EB', 'Museu'), (vi.id('3c'), vi.id('c0'), 'VI EC', 'Museu');
  insert into public.producao_visitas_horarios (id, organization_id, espaco_id, dia, inicio, fim, capacidade) values
    (vi.id('c1'), vi.id('a0'), vi.id('31'), date '2026-12-10', time '10:00', time '11:00', 30),
    (vi.id('c2'), vi.id('a0'), vi.id('31'), date '2026-12-11', time '10:00', time '11:00', 10),
    (vi.id('c3'), vi.id('a0'), vi.id('31'), date '2020-01-01', time '10:00', time '11:00', 10),
    (vi.id('cb'), vi.id('b0'), vi.id('3b'), date '2026-12-10', time '10:00', time '11:00', 10),
    (vi.id('cc'), vi.id('c0'), vi.id('3c'), date '2026-12-10', time '10:00', time '11:00', 10);
  insert into public.producao_visitas_agendamentos (id, organization_id, horario_id, grupo, responsavel, email, pessoas, situacao) values
    (vi.id('d1'), vi.id('a0'), vi.id('c1'), 'VI Escola Azul', 'VI Profa. Lia', 'lia@escola.exemplo', 20, 'confirmado'),
    (vi.id('d2'), vi.id('a0'), vi.id('c1'), 'VI Escola Verde', 'VI Prof. Davi', 'davi@escola.exemplo', 5, 'recusado'),
    (vi.id('dc'), vi.id('c0'), vi.id('cc'), 'VI Escola C', 'VI Resp. C', 'c@escola.exemplo', 3, 'pedido');
  insert into public.producao_visitas_links (id, organization_id, espaco_id, token_hash, expira_em, revogado_em) values
    (vi.id('e2'), vi.id('a0'), vi.id('32'), vi.hash('l3'), now() + interval '30 days', now()),
    (vi.id('e3'), vi.id('a0'), vi.id('33'), vi.hash('l4'), now() - interval '1 day', null),
    (vi.id('eb'), vi.id('b0'), vi.id('3b'), vi.hash('lb'), now() + interval '30 days', null),
    (vi.id('ec'), vi.id('c0'), vi.id('3c'), vi.hash('lc'), now() + interval '30 days', null);
end
$dados$;

create function vi.tenta(comando text) returns text language plpgsql as $$
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

create function vi.efeito(comando text) returns text language plpgsql as $$
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

-- Quantas linhas a pessoa lê de cada tabela da organização: horários, agendamentos e links.
create function vi.ve(o text) returns text language plpgsql as $$
declare h bigint; a bigint; l bigint;
begin
  select count(*) into h from public.producao_visitas_horarios where organization_id = vi.id(o || '0');
  select count(*) into a from public.producao_visitas_agendamentos where organization_id = vi.id(o || '0');
  select count(*) into l from public.producao_visitas_links where organization_id = vi.id(o || '0');
  return h || '|' || a || '|' || l;
end;
$$;

create function vi.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', vi.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function vi.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_visitas_horarios', 'producao_visitas_agendamentos', 'producao_visitas_links')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 15, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_visitas_horarios'::regclass, 'public.producao_visitas_agendamentos'::regclass, 'public.producao_visitas_links'::regclass) and relrowsecurity), 3, 'segurança por linha ligada nas três');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_visitas_horarios'::regclass, 'public.producao_visitas_agendamentos'::regclass, 'public.producao_visitas_links'::regclass) and confrelid <> 'auth.users'::regclass),
          'producao_visitas_agendamentos.producao_visitas_agendamentos_horario_id_fkey=c, producao_visitas_agendamentos.producao_visitas_agendamentos_organization_id_fkey=c, '
          || 'producao_visitas_horarios.producao_visitas_horarios_espaco_id_fkey=c, producao_visitas_horarios.producao_visitas_horarios_organization_id_fkey=c, '
          || 'producao_visitas_links.producao_visitas_links_espaco_id_fkey=c, producao_visitas_links.producao_visitas_links_organization_id_fkey=c',
          'tudo sai com o espaço; o agendamento sai com o horário');
select ok(not has_column_privilege('authenticated', 'public.producao_visitas_links', 'token_hash', 'select')
          and has_column_privilege('authenticated', 'public.producao_visitas_links', 'expira_em', 'select')
          and not has_table_privilege('anon', 'public.producao_visitas_agendamentos', 'select')
          and has_function_privilege('authenticated', 'public.fn_producao_visitas_gerar_link(uuid, integer, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_visita_agendar(text, uuid, text, text, text, text, integer, text)', 'execute')
          and has_function_privilege('service_role', 'public.fn_producao_visita_agendar(text, uuid, text, text, text, text, integer, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_visitas_espaco_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_visita_agendamento_coerencia()', 'execute'),
          'o hash não sai para o navegador; gerar é da produção logada; agendar é só do servidor; as coerências, de ninguém');
select is((select count(*)::int from pg_trigger where tgrelid in ('public.producao_visitas_horarios'::regclass, 'public.producao_visitas_agendamentos'::regclass, 'public.producao_visitas_links'::regclass) and not tgisinternal), 8,
          'oito gatilhos: coerência e updated_at nas três, histórico nos horários e nos agendamentos');

-- ─── Quem lê ────────────────────────────────────────────────────────────────

select vi.como('a2');
select is(vi.ve('a'), '3|2|2', 'colaborador lê horários, agendamentos e links');
select vi.como('a3');
select is(vi.ve('a'), '3|2|2', 'leitor lê');
select vi.como('a5');
select is(vi.ve('a'), '0|0|0', 'o recorte "vinculado" sem vínculo não lê');
select vi.como('b1');
select is(vi.ve('a') || '/' || vi.ve('b'), '0|0|0/1|0|1', 'outra organização só lê o que é dela');
select vi.como('c1');
select is(vi.ve('c'), '1|1|1', 'produção só para leitura lê');
select vi.como(null);
select is(vi.efeito('select 1 from public.producao_visitas_horarios'), '', 'visitante não lê');
select vi.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select vi.como('a2');
select is(vi.tenta(format('insert into public.producao_visitas_horarios (organization_id, espaco_id, dia, inicio, fim, capacidade) values (%L, %L, %L, %L, %L, 40)', vi.id('a0'), vi.id('31'), '2026-12-12', '14:00', '15:00')), 'aceito', 'colaborador cria o horário');
select vi.como('a3');
select ok(vi.tenta(format('insert into public.producao_visitas_horarios (organization_id, espaco_id, dia, inicio, fim, capacidade) values (%L, %L, %L, %L, %L, 40)', vi.id('a0'), vi.id('31'), '2026-12-12', '14:00', '15:00')) like '42501%', 'leitor não grava');
select vi.como('a5');
select ok(vi.tenta(format('insert into public.producao_visitas_horarios (organization_id, espaco_id, dia, inicio, fim, capacidade) values (%L, %L, %L, %L, %L, 40)', vi.id('a0'), vi.id('31'), '2026-12-12', '14:00', '15:00')) like '42501%', 'o recorte sem vínculo não grava');
select vi.como('c1');
select ok(vi.tenta(format('insert into public.producao_visitas_horarios (organization_id, espaco_id, dia, inicio, fim, capacidade) values (%L, %L, %L, %L, %L, 40)', vi.id('c0'), vi.id('3c'), '2026-12-12', '14:00', '15:00')) like '42501%', 'produção só para leitura não grava');
select vi.como('b1');
select is(vi.efeito(format('update public.producao_visitas_agendamentos set pessoas = 1 where id = %L', vi.id('d1'))), '', 'outra organização não altera');
select vi.volta();

-- ─── Gerar o link ───────────────────────────────────────────────────────────

select vi.como('a3');
select ok(vi.tenta(format('select public.fn_producao_visitas_gerar_link(%L, 30, null)', vi.id('31'))) like '42501%', 'leitor não gera o link');
select vi.como('a5');
select is(vi.tenta(format('select public.fn_producao_visitas_gerar_link(%L, 30, null)', vi.id('31'))), 'P0002 espaco_nao_encontrado', 'o recorte "vinculado" sem vínculo não vê o espaço');
select vi.como('b1');
select is(vi.tenta(format('select public.fn_producao_visitas_gerar_link(%L, 30, null)', vi.id('31'))), 'P0002 espaco_nao_encontrado', 'outra organização não vê o espaço');
select vi.como('c1');
select ok(vi.tenta(format('select public.fn_producao_visitas_gerar_link(%L, 30, null)', vi.id('3c'))) like '42501%', 'produção só para leitura não gera o link');
select vi.como('a2');
select is(array[vi.tenta(format('select public.fn_producao_visitas_gerar_link(%L, 0, null)', vi.id('31'))), vi.tenta(format('select public.fn_producao_visitas_gerar_link(%L, 366, null)', vi.id('31')))],
          array['P0001 prazo_invalido', 'P0001 prazo_invalido'], 'prazo de 0 ou de mais de 365 dias é recusado');
select set_config('vi.codigo', public.fn_producao_visitas_gerar_link(vi.id('31'), 30, '  Visitas escolares  '), true);
select ok(vi.tenta('select token_hash from public.producao_visitas_links') like '42501%', 'o navegador não lê o hash');
select ok(vi.tenta(format('select public.fn_producao_visita_agendar(%L, %L, %L, %L, %L, null, 5, null)', vi.hash(current_setting('vi.codigo')), vi.id('c1'), 'x', 'y', 'a@b.com')) like '42501%', 'o navegador logado não agenda pelo link');
select vi.volta();
select ok(current_setting('vi.codigo') ~ '^[A-Za-z0-9_-]{43}$'
          and (select token_hash from public.producao_visitas_links where espaco_id = vi.id('31')) = vi.hash(current_setting('vi.codigo'))
          and (select titulo from public.producao_visitas_links where espaco_id = vi.id('31')) = 'Visitas escolares'
          and (select count(*) from public.producao_visitas_links where espaco_id = vi.id('31')) = 1,
          'o código tem 43 letras, só o hash fica, o título é aparado e gerar de novo renova o mesmo link');

-- ─── O agendamento pelo link (só o servidor) ────────────────────────────────

select is(public.fn_producao_visita_agendar(vi.hash(current_setting('vi.codigo')), vi.id('c1'), 'Escola Rosa', 'Profa. Ana', '  ANA@Escola.Exemplo ', '', 5, '  '), 'ok', 'o agendamento pelo link vale');
select is((select grupo || '|' || responsavel || '|' || email || '|' || coalesce(telefone, '-') || '|' || pessoas || '|' || situacao || '|' || coalesce(observacao, '-') || '|' || (consentiu_em is not null)::text
           from public.producao_visitas_agendamentos where horario_id = vi.id('c1') and grupo = 'Escola Rosa'),
          'Escola Rosa|Profa. Ana|ana@escola.exemplo|-|5|pedido|-|true', 'nasce como "pedido", com o consentimento carimbado e o e-mail em minúsculas');
select is(public.fn_producao_visita_agendar(vi.hash(current_setting('vi.codigo')), vi.id('c1'), 'Escola Roxa', 'Prof. Caio', 'caio@escola.exemplo', null, 6, null), 'lotado', 'a capacidade vale: 20 + 5 = 25 de 30, mais 6 não cabe (o recusado não conta)');
select is(array[
            public.fn_producao_visita_agendar(vi.hash('nao-existe'), vi.id('c1'), 'x', 'y', 'a@b.com', null, 1, null),
            public.fn_producao_visita_agendar(vi.hash('l3'), vi.id('c1'), 'x', 'y', 'a@b.com', null, 1, null),
            public.fn_producao_visita_agendar(vi.hash('l4'), vi.id('c1'), 'x', 'y', 'a@b.com', null, 1, null),
            public.fn_producao_visita_agendar(vi.hash(current_setting('vi.codigo')), vi.id('c3'), 'x', 'y', 'a@b.com', null, 1, null),
            public.fn_producao_visita_agendar(vi.hash(current_setting('vi.codigo')), vi.id('cb'), 'x', 'y', 'a@b.com', null, 1, null)],
          array['inexistente', 'revogado', 'expirado', 'horario_invalido', 'horario_invalido'],
          'link inexistente, desativado ou vencido; horário que já passou ou de outro espaço: nada é gravado');
select is(vi.tenta(format('select public.fn_producao_visita_agendar(%L, %L, %L, %L, null, null, 1, null)', vi.hash(current_setting('vi.codigo')), vi.id('c1'), 'x', 'y')),
          '23514 producao_visitas_agendamentos_contato_check', 'sem e-mail nem telefone o banco recusa');

-- ─── A capacidade no gatilho ────────────────────────────────────────────────
-- h1 (capacidade 30): d1 com 20 (confirmado), o pedido da Escola Rosa com 5, e d2 com 5 recusado (não conta).

select is(array[
            vi.tenta(format('update public.producao_visitas_agendamentos set pessoas = 26 where id = %L', vi.id('d1'))),
            vi.tenta(format('update public.producao_visitas_agendamentos set situacao = %L where id = %L', 'pedido', vi.id('d2'))),
            vi.tenta(format('update public.producao_visitas_agendamentos set pessoas = 9 where id = %L', vi.id('d2')))],
          array['23514 capacidade_excedida', 'aceito', 'aceito'], 'mais pessoas passando da capacidade é recusado; o recusado que volta cabe (25 + 5 = 30); o recusado pode mudar sem contar');
update public.producao_visitas_horarios set capacidade = 10 where id = vi.id('c1');
select is(array[
            vi.tenta(format('update public.producao_visitas_agendamentos set grupo = %L where id = %L', 'VI Escola Azul (nova)', vi.id('d1'))),
            vi.tenta(format('update public.producao_visitas_agendamentos set situacao = %L where id = %L', 'cancelado', vi.id('d1'))),
            vi.tenta(format('update public.producao_visitas_agendamentos set pessoas = 30 where id = %L', vi.id('d1')))],
          array['aceito', 'aceito', '23514 capacidade_excedida'], 'baixar a capacidade não trava a edição nem o cancelamento, só aumentar de novo');

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            vi.tenta(format('insert into public.producao_visitas_horarios (organization_id, espaco_id, dia, inicio, fim, capacidade) values (%L, %L, %L, %L, %L, 5)', vi.id('a0'), vi.id('31'), '2026-12-20', '11:00', '10:00')),
            vi.tenta(format('insert into public.producao_visitas_horarios (organization_id, espaco_id, dia, inicio, fim, capacidade) values (%L, %L, %L, %L, %L, 0)', vi.id('a0'), vi.id('31'), '2026-12-20', '10:00', '11:00')),
            vi.tenta(format('insert into public.producao_visitas_horarios (organization_id, espaco_id, dia, inicio, fim, capacidade, publico_avulso) values (%L, %L, %L, %L, %L, 5, -1)', vi.id('a0'), vi.id('31'), '2026-12-20', '10:00', '11:00')),
            vi.tenta(format('insert into public.producao_visitas_horarios (organization_id, espaco_id, dia, inicio, fim, capacidade) values (%L, %L, %L, %L, %L, 5)', vi.id('a0'), vi.id('31'), '2026-12-10', '10:00', '11:00')),
            vi.tenta(format('insert into public.producao_visitas_horarios (organization_id, espaco_id, dia, inicio, fim, capacidade) values (%L, %L, %L, %L, %L, 5)', vi.id('a0'), vi.id('3b'), '2026-12-20', '10:00', '11:00')),
            vi.tenta(format('update public.producao_visitas_horarios set organization_id = %L where id = %L', vi.id('b0'), vi.id('c2'))),
            vi.tenta(format('update public.producao_visitas_horarios set espaco_id = %L where id = %L', vi.id('32'), vi.id('c2'))),
            vi.tenta(format('insert into public.producao_visitas_agendamentos (organization_id, horario_id, grupo, responsavel, email, pessoas) values (%L, %L, %L, %L, %L, 0)', vi.id('a0'), vi.id('c2'), 'g', 'r', 'a@b.com')),
            vi.tenta(format('insert into public.producao_visitas_agendamentos (organization_id, horario_id, grupo, responsavel, email, pessoas, situacao) values (%L, %L, %L, %L, %L, 1, %L)', vi.id('a0'), vi.id('c2'), 'g', 'r', 'a@b.com', 'talvez')),
            vi.tenta(format('insert into public.producao_visitas_agendamentos (organization_id, horario_id, grupo, responsavel, email, pessoas) values (%L, %L, %L, %L, %L, 1)', vi.id('a0'), vi.id('c2'), 'g', 'r', 'sem-arroba')),
            vi.tenta(format('insert into public.producao_visitas_agendamentos (organization_id, horario_id, grupo, responsavel, telefone, pessoas) values (%L, %L, %L, %L, %L, 1)', vi.id('a0'), vi.id('c2'), 'g', 'r', '123')),
            vi.tenta(format('insert into public.producao_visitas_agendamentos (organization_id, horario_id, grupo, responsavel, pessoas) values (%L, %L, %L, %L, 1)', vi.id('a0'), vi.id('c2'), 'g', 'r')),
            vi.tenta(format('insert into public.producao_visitas_agendamentos (organization_id, horario_id, grupo, responsavel, email, pessoas, presentes) values (%L, %L, %L, %L, %L, 1, -1)', vi.id('a0'), vi.id('c2'), 'g', 'r', 'a@b.com')),
            vi.tenta(format('insert into public.producao_visitas_agendamentos (organization_id, horario_id, grupo, responsavel, email, pessoas) values (%L, %L, %L, %L, %L, 1)', vi.id('a0'), vi.id('cb'), 'g', 'r', 'a@b.com')),
            vi.tenta(format('update public.producao_visitas_agendamentos set organization_id = %L where id = %L', vi.id('b0'), vi.id('d2'))),
            vi.tenta(format('update public.producao_visitas_agendamentos set horario_id = %L where id = %L', vi.id('c2'), vi.id('d2'))),
            vi.tenta(format('insert into public.producao_visitas_links (organization_id, espaco_id, token_hash, expira_em, titulo) values (%L, %L, %L, now(), %L)', vi.id('a0'), vi.id('33'), repeat('a', 64), ' ')),
            vi.tenta(format('update public.producao_visitas_links set token_hash = %L where id = %L', 'curto', vi.id('e2'))),
            vi.tenta(format('insert into public.producao_visitas_links (organization_id, espaco_id, token_hash, expira_em) values (%L, %L, %L, now())', vi.id('a0'), vi.id('31'), repeat('b', 64)))],
          array['23514 producao_visitas_horarios_horas_check', '23514 producao_visitas_horarios_capacidade_check', '23514 producao_visitas_horarios_avulso_check', '23505 producao_visitas_horarios_unico_key',
                '23514 espaco_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 espaco_nao_muda',
                '23514 producao_visitas_agendamentos_pessoas_check', '23514 producao_visitas_agendamentos_situacao_check', '23514 producao_visitas_agendamentos_email_check',
                '23514 producao_visitas_agendamentos_telefone_check', '23514 producao_visitas_agendamentos_contato_check', '23514 producao_visitas_agendamentos_presentes_check',
                '23514 horario_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 horario_nao_muda',
                '23514 producao_visitas_links_titulo_check', '23514 producao_visitas_links_hash_check', '23505 producao_visitas_links_espaco_key'],
          'horário (horas, capacidade, avulso, único), agendamento (pessoas, situação, e-mail, telefone, contato, presentes), link (título, hash, um por espaço) e o que não muda');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_visitas_agendamentos set situacao = 'cancelado', email = 'novo@escola.exemplo', telefone = '(11) 98888-0000', observacao = 'Mudou o plano' where id = vi.id('d2');
select is((select string_agg(distinct campo, ',' order by campo) from public.producao_historico where entidade_id = vi.id('d2') and acao = 'alterou'),
          'situacao', 'o histórico guarda a situação e deixa o e-mail, o telefone e a observação de fora');
select vi.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_visitas_agendamentos' and entidade_id = vi.id('d2')) > 0, 'quem lê o agendamento lê o histórico dele');
select vi.volta();

select * from finish();
rollback;
