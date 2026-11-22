-- T2 da Ticketeria: locais, setores, eventos e sessões (ticketeria_locais, ticketeria_setores, ticketeria_eventos e
-- ticketeria_sessoes).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, quem não tem a ticketeria no vínculo, outra organização,
-- organização só com a produção e visitante); a forma (nome, UF, fuso, lugares, classificação, situação, imagem, horários) e a
-- coerência (pai da mesma organização, local arquivado, evento cancelado, o que não muda); e o que se apaga (evento e sessão só
-- em rascunho, local com sessão não, a organização inteira sim). Ids 0d720000-0000-4000-8000-0000000000XX, ou te.id('XX').
--   A (a0): loja 61; locais 51 (em uso, setor 41) e 52 (arquivado); eventos 71 (rascunho, sessão 81), 72 (publicado,
--   sessão 82) e 73 (cancelado). a1 admin, a2 colaborador, a3 leitor, a6 colaborador só com a captação no vínculo.
--   B (b0): loja 6b, local 5b, evento 7b publicado com a sessão 8b; b1 admin.   C (c0), só a produção, com a loja 6c: c1.
-- Rodar: supabase/tests/README.md, com a migration ticketeria_eventos na frente se não estiver aplicada. A seção "Apagar"
-- usa DELETE (cada um desfeito): rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

create schema te;
grant usage on schema te to authenticated, anon;

create function te.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d720000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select te.id(s), 'te-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a6', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (te.id('a0'), 'TE A'), (te.id('b0'), 'TE B'), (te.id('c0'), 'TE C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (te.id('a0'), 'ticketeria', 'cortesia', 20), (te.id('b0'), 'ticketeria', 'cortesia', 5), (te.id('c0'), 'producao', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select te.id(o), te.id(p), papel, acesso::text[] from (values
    ('a0', 'a1', 'admin', '{ticketeria}'), ('a0', 'a2', 'colaborador', '{ticketeria}'), ('a0', 'a3', 'leitor', '{ticketeria}'),
    ('a0', 'a6', 'colaborador', '{captacao}'), ('b0', 'b1', 'admin', '{ticketeria}'), ('c0', 'c1', 'colaborador', '{producao}')) as v(o, p, papel, acesso);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (te.id('61'), te.id('a0'), 'Loja A'), (te.id('6b'), te.id('b0'), 'Loja B'), (te.id('6c'), te.id('c0'), 'Loja C (sem o módulo)');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome, cidade, uf, arquivado) values
    (te.id('51'), te.id('a0'), te.id('61'), 'Teatro A', 'Sorocaba', 'SP', false), (te.id('52'), te.id('a0'), te.id('61'), 'Galpão antigo', null, null, true),
    (te.id('5b'), te.id('b0'), te.id('6b'), 'Teatro B', null, null, false);
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (te.id('41'), te.id('a0'), te.id('51'), 'Plateia', 300);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values
    (te.id('71'), te.id('a0'), te.id('61'), 'Hamlet', 'rascunho'), (te.id('72'), te.id('a0'), te.id('61'), 'Concerto', 'publicado'),
    (te.id('73'), te.id('a0'), te.id('61'), 'Cancelado', 'rascunho'), (te.id('7b'), te.id('b0'), te.id('6b'), 'Show B', 'rascunho');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values
    (te.id('81'), te.id('a0'), te.id('71'), te.id('51'), '2026-12-05 20:00-03'), (te.id('82'), te.id('a0'), te.id('72'), te.id('51'), '2026-12-06 20:00-03'),
    (te.id('8b'), te.id('b0'), te.id('7b'), te.id('5b'), '2026-12-07 20:00-03');
  update public.ticketeria_eventos set situacao = 'cancelado' where id = te.id('73');
  update public.ticketeria_eventos set situacao = 'publicado' where id = te.id('7b');
end
$dados$;

create function te.tenta(comando text) returns text language plpgsql as $$
declare nome text;
begin
  begin
    execute comando;
    raise exception using errcode = 'CD000', message = 'aceito';
  exception
    when sqlstate 'CD000' then return 'aceito';
    when others then
      get stacked diagnostics nome = constraint_name;
      return sqlstate || ' ' || coalesce(nullif(nome, ''), sqlerrm);
  end;
end;
$$;

create function te.efeito(comando text) returns text language plpgsql as $$
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

create function te.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using te.id(o || '0');
  return n::text;
end;
$$;

create function te.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', te.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function te.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select string_agg(tablename || '=' || n, ' ' order by tablename) from (
             select tablename::text, count(*) n from pg_policies where schemaname = 'public' and tablename::text in ('ticketeria_locais', 'ticketeria_setores', 'ticketeria_eventos', 'ticketeria_sessoes')
               and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true' group by tablename) x),
          'ticketeria_eventos=4 ticketeria_locais=4 ticketeria_sessoes=4 ticketeria_setores=4', 'quatro regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.ticketeria_locais'::regclass, 'public.ticketeria_setores'::regclass, 'public.ticketeria_eventos'::regclass, 'public.ticketeria_sessoes'::regclass) and relrowsecurity), 4, 'segurança por linha ligada nas quatro');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.ticketeria_locais'::regclass, 'public.ticketeria_setores'::regclass, 'public.ticketeria_eventos'::regclass, 'public.ticketeria_sessoes'::regclass)),
          'ticketeria_eventos.ticketeria_eventos_criado_por_fkey=n, ticketeria_eventos.ticketeria_eventos_loja_id_fkey=c, ticketeria_eventos.ticketeria_eventos_organization_id_fkey=c, '
          || 'ticketeria_locais.ticketeria_locais_criado_por_fkey=n, ticketeria_locais.ticketeria_locais_loja_id_fkey=c, ticketeria_locais.ticketeria_locais_organization_id_fkey=c, '
          || 'ticketeria_sessoes.ticketeria_sessoes_evento_id_fkey=c, ticketeria_sessoes.ticketeria_sessoes_local_id_fkey=a, ticketeria_sessoes.ticketeria_sessoes_organization_id_fkey=c, ticketeria_sessoes.ticketeria_sessoes_sala_id_fkey=a, '
          || 'ticketeria_setores.ticketeria_setores_local_id_fkey=c, ticketeria_setores.ticketeria_setores_organization_id_fkey=c, ticketeria_setores.ticketeria_setores_sala_id_fkey=a',
          'tudo sai com a organização e a loja; o setor com o local; a sessão com o evento; o local com sessão não sai (no action); a sala de setor ou sessão não se apaga (no action)');
select ok(not has_table_privilege('anon', 'public.ticketeria_eventos', 'select') and not has_table_privilege('anon', 'public.ticketeria_sessoes', 'select')
          and not has_table_privilege('anon', 'public.ticketeria_locais', 'select') and not has_table_privilege('anon', 'public.ticketeria_setores', 'select')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_da_loja_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_setor_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_evento_situacao()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_sessao_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_evento_apagar_guarda()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_sessao_apagar_guarda()', 'execute'), 'o visitante não toca em nada; as funções de gatilho não são chamáveis');
select is((select string_agg(tgrelid::regclass::text || '.' || tgname::text, ' ' order by tgrelid::regclass::text collate "C", tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid in ('public.ticketeria_locais'::regclass, 'public.ticketeria_setores'::regclass, 'public.ticketeria_eventos'::regclass, 'public.ticketeria_sessoes'::regclass)),
          'ticketeria_eventos.ticketeria_eventos_apagar ticketeria_eventos.ticketeria_eventos_coerencia ticketeria_eventos.ticketeria_eventos_situacao ticketeria_eventos.ticketeria_eventos_slug ticketeria_eventos.ticketeria_eventos_updated_at '
          || 'ticketeria_locais.ticketeria_locais_coerencia ticketeria_locais.ticketeria_locais_sala_padrao ticketeria_locais.ticketeria_locais_updated_at '
          || 'ticketeria_sessoes.ticketeria_sessoes_apagar ticketeria_sessoes.ticketeria_sessoes_coerencia ticketeria_sessoes.ticketeria_sessoes_sala_coerencia ticketeria_sessoes.ticketeria_sessoes_updated_at ticketeria_sessoes.ticketeria_webhooks_sessao '
          || 'ticketeria_setores.ticketeria_setores_coerencia ticketeria_setores.ticketeria_setores_numerado ticketeria_setores.ticketeria_setores_sala_coerencia ticketeria_setores.ticketeria_setores_updated_at', 'os gatilhos de cada tabela');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select te.como('a1');
select is(te.ve('ticketeria_locais', 'a') || te.ve('ticketeria_setores', 'a') || te.ve('ticketeria_eventos', 'a') || te.ve('ticketeria_sessoes', 'a'), '2132', 'administrador lê locais, setores, eventos e sessões');
select te.como('a3');
select is(te.ve('ticketeria_eventos', 'a') || te.ve('ticketeria_sessoes', 'a'), '32', 'leitor lê');
select te.como('a6');
select is(te.ve('ticketeria_locais', 'a') || te.ve('ticketeria_setores', 'a') || te.ve('ticketeria_eventos', 'a') || te.ve('ticketeria_sessoes', 'a'), '0000', 'quem não tem a ticketeria no vínculo não lê nada');
select te.como('b1');
select is(te.ve('ticketeria_eventos', 'a') || te.ve('ticketeria_eventos', 'b'), '01', 'outra organização não lê; a própria, sim');
select te.como('c1');
select is(te.ve('ticketeria_eventos', 'a') || te.ve('ticketeria_locais', 'a'), '00', 'quem só tem a produção não lê a ticketeria');
select te.como(null);
select is(te.efeito('select 1 from public.ticketeria_eventos'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select te.como('a2');
select is(array[
            te.tenta(format('insert into public.ticketeria_locais (organization_id, loja_id, nome, uf) values (%L, %L, %L, %L)', te.id('a0'), te.id('61'), 'Praça', 'SP')),
            te.tenta(format('insert into public.ticketeria_setores (organization_id, local_id, nome, lugares) values (%L, %L, %L, 80)', te.id('a0'), te.id('51'), 'Balcão')),
            te.tenta(format('insert into public.ticketeria_eventos (organization_id, loja_id, titulo, classificacao) values (%L, %L, %L, %L)', te.id('a0'), te.id('61'), 'Novo', '12')),
            te.tenta(format('insert into public.ticketeria_sessoes (organization_id, evento_id, local_id, inicio, fim, abertura_portas) values (%L, %L, %L, %L, %L, %L)', te.id('a0'), te.id('71'), te.id('51'), '2026-12-10 20:00-03', '2026-12-10 22:00-03', '2026-12-10 19:00-03'))],
          array['aceito', 'aceito', 'aceito', 'aceito'], 'colaborador cria local, setor, evento e sessão');
select is(te.efeito(format('update public.ticketeria_eventos set situacao = %L where id = %L', 'publicado', te.id('71'))), 'sim', 'colaborador publica o evento');
select is(te.efeito(format('update public.ticketeria_sessoes set cancelada_em = now() where id = %L', te.id('82'))), 'sim', 'colaborador cancela a sessão do evento publicado');
select te.como('a3');
select ok(te.tenta(format('insert into public.ticketeria_eventos (organization_id, loja_id, titulo) values (%L, %L, %L)', te.id('a0'), te.id('61'), 'x')) like '42501%', 'leitor não cria evento');
select is(te.efeito(format('update public.ticketeria_eventos set titulo = %L where id = %L', 'x', te.id('71'))), '', 'leitor não altera evento');
select te.como('a6');
select is(te.efeito(format('update public.ticketeria_locais set nome = %L where id = %L', 'x', te.id('51'))), '', 'quem não tem a ticketeria no vínculo não altera');
select te.como('c1');
select ok(te.tenta(format('insert into public.ticketeria_eventos (organization_id, loja_id, titulo) values (%L, %L, %L)', te.id('c0'), te.id('6c'), 'x')) like '42501%', 'organização sem a ticketeria não cria evento (nem com loja)');
select te.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            te.tenta(format('insert into public.ticketeria_locais (organization_id, loja_id, nome) values (%L, %L, %L)', te.id('a0'), te.id('6b'), 'x')),
            te.tenta(format('insert into public.ticketeria_locais (organization_id, loja_id, nome, uf) values (%L, %L, %L, %L)', te.id('a0'), te.id('61'), 'x', 'sp')),
            te.tenta(format('insert into public.ticketeria_locais (organization_id, loja_id, nome, fuso) values (%L, %L, %L, %L)', te.id('a0'), te.id('61'), 'x', 'GMT-3')),
            te.tenta(format('insert into public.ticketeria_locais (organization_id, loja_id, nome) values (%L, %L, %L)', te.id('a0'), te.id('61'), ' ')),
            te.tenta(format('insert into public.ticketeria_setores (organization_id, local_id, nome, lugares) values (%L, %L, %L, 10)', te.id('a0'), te.id('5b'), 'x')),
            te.tenta(format('insert into public.ticketeria_setores (organization_id, local_id, nome, lugares) values (%L, %L, %L, 10)', te.id('a0'), te.id('51'), 'Plateia')),
            te.tenta(format('insert into public.ticketeria_setores (organization_id, local_id, nome, lugares) values (%L, %L, %L, 0)', te.id('a0'), te.id('51'), 'Vazio')),
            te.tenta(format('insert into public.ticketeria_eventos (organization_id, loja_id, titulo, classificacao) values (%L, %L, %L, %L)', te.id('a0'), te.id('61'), 'x', '13')),
            te.tenta(format('insert into public.ticketeria_eventos (organization_id, loja_id, titulo, situacao) values (%L, %L, %L, %L)', te.id('a0'), te.id('61'), 'x', 'talvez')),
            te.tenta(format('insert into public.ticketeria_eventos (organization_id, loja_id, titulo, imagem_url) values (%L, %L, %L, %L)', te.id('a0'), te.id('61'), 'x', 'http://casa.com.br/a.jpg')),
            te.tenta(format('insert into public.ticketeria_sessoes (organization_id, evento_id, local_id, inicio) values (%L, %L, %L, now())', te.id('a0'), te.id('7b'), te.id('51'))),
            te.tenta(format('insert into public.ticketeria_sessoes (organization_id, evento_id, local_id, inicio) values (%L, %L, %L, now())', te.id('a0'), te.id('71'), te.id('5b'))),
            te.tenta(format('insert into public.ticketeria_sessoes (organization_id, evento_id, local_id, inicio) values (%L, %L, %L, now())', te.id('a0'), te.id('71'), te.id('52'))),
            te.tenta(format('insert into public.ticketeria_sessoes (organization_id, evento_id, local_id, inicio) values (%L, %L, %L, now())', te.id('a0'), te.id('73'), te.id('51'))),
            te.tenta(format('insert into public.ticketeria_sessoes (organization_id, evento_id, local_id, inicio, fim) values (%L, %L, %L, %L, %L)', te.id('a0'), te.id('71'), te.id('51'), '2026-12-10 20:00-03', '2026-12-10 19:00-03')),
            te.tenta(format('insert into public.ticketeria_sessoes (organization_id, evento_id, local_id, inicio, abertura_portas) values (%L, %L, %L, %L, %L)', te.id('a0'), te.id('71'), te.id('51'), '2026-12-10 20:00-03', '2026-12-10 21:00-03')),
            te.tenta(format('update public.ticketeria_eventos set situacao = %L where id = %L', 'publicado', te.id('73'))),
            te.tenta(format('update public.ticketeria_sessoes set evento_id = %L where id = %L', te.id('72'), te.id('81'))),
            te.tenta(format('update public.ticketeria_sessoes set local_id = %L where id = %L', te.id('52'), te.id('81'))),
            te.tenta(format('update public.ticketeria_setores set local_id = %L where id = %L', te.id('52'), te.id('41'))),
            te.tenta(format('update public.ticketeria_eventos set loja_id = %L where id = %L', te.id('6b'), te.id('71'))),
            te.tenta(format('update public.ticketeria_locais set organization_id = %L where id = %L', te.id('b0'), te.id('51')))],
          array['23514 loja_de_outra_organizacao', '23514 ticketeria_locais_uf_check', '23514 ticketeria_locais_fuso_check', '23514 ticketeria_locais_nome_check',
                '23514 local_de_outra_organizacao', '23505 ticketeria_setores_nome_key', '23514 ticketeria_setores_lugares_check',
                '23514 ticketeria_eventos_classificacao_check', '23514 ticketeria_eventos_situacao_check', '23514 ticketeria_eventos_imagem_url_check',
                '23514 evento_de_outra_organizacao', '23514 local_de_outra_organizacao', '23514 local_arquivado', '23514 evento_cancelado',
                '23514 ticketeria_sessoes_fim_check', '23514 ticketeria_sessoes_portas_check',
                '23514 evento_cancelado', '23514 evento_nao_muda', '23514 local_arquivado', '23514 local_nao_muda', '23514 loja_nao_muda', '23514 organizacao_nao_muda'],
          'loja, local e evento da organização; UF, fuso, nomes, lugares, classificação, situação, imagem e horários; local arquivado e evento cancelado não recebem sessão; cancelado não volta; o que não muda');
select is(te.tenta(format('update public.ticketeria_sessoes set cancelada_em = now() where id = %L', te.id('81'))), 'aceito', 'a sessão do local que foi arquivado depois segue podendo mudar (só não troca para local arquivado)');

-- ─── Apagar (DELETE, cada um desfeito: pela CLI) ────────────────────────────

select is(array[
            te.tenta(format('delete from public.ticketeria_eventos where id = %L', te.id('72'))),
            te.tenta(format('delete from public.ticketeria_eventos where id = %L', te.id('73'))),
            te.tenta(format('delete from public.ticketeria_sessoes where id = %L', te.id('82'))),
            te.tenta(format('delete from public.ticketeria_locais where id = %L', te.id('51'))),
            te.tenta(format('delete from public.ticketeria_sessoes where id = %L', te.id('81'))),
            te.tenta(format('delete from public.ticketeria_eventos where id = %L', te.id('71'))),
            te.tenta(format('delete from public.ticketeria_locais where id = %L', te.id('52'))),
            te.tenta(format('delete from public.organizations where id = %L', te.id('b0')))],
          array['23514 evento_publicado', '23514 evento_publicado', '23514 sessao_de_evento_publicado', '23503 ticketeria_sessoes_local_id_fkey',
                'aceito', 'aceito', 'aceito', 'aceito'],
          'evento publicado ou cancelado e sessão de evento publicado não se apagam; local com sessão não; rascunho, sessão de rascunho, local sem sessão e a organização inteira (com evento publicado) sim');

select * from finish();
rollback;
