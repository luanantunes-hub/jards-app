-- T3 da Ticketeria: o catálogo do evento (ticketeria_ingressos e ticketeria_lotes).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, quem não tem a ticketeria no vínculo, outra organização e visitante);
-- a forma (categoria, limite, preço, quantidade, janela) e a coerência (pais da mesma organização, setor arquivado e evento
-- cancelado sem ingresso novo, preço que combina com a categoria, o que não muda); os lugares do setor (a oferta do evento no setor
-- não passa deles, e diminuir o setor depois não trava a edição); e o que se apaga. Ids 0d730000-0000-4000-8000-0000000000XX, ou tc.id('XX').
--   A (a0): loja 61, local 51 com os setores 41 (100 lugares) e 42 (arquivado); eventos 71 (rascunho) e 73 (cancelado);
--   ingressos 31 (Inteira, setor 41, lote 21 de 60 a R$ 50), 32 (Cortesia, setor 41, sem lote) e 33 (arquivado, setor 41, lote 23 de 50).
--   a1 admin, a2 colaborador, a3 leitor, a6 colaborador só com a captação.   B (b0): loja 6b, local 5b, setor 4b, evento 7b,
--   ingresso 3b; b1 admin.
-- Rodar: supabase/tests/README.md, com as migrations ticketeria_eventos e ticketeria_catalogo na frente se não estiverem aplicadas.
-- A seção "Apagar" usa DELETE (cada um desfeito): rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

create schema tc;
grant usage on schema tc to authenticated, anon;

create function tc.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d730000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tc.id(s), 'tc-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a6', 'b1']) as s;
  insert into public.organizations (id, nome) values (tc.id('a0'), 'TC A'), (tc.id('b0'), 'TC B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tc.id('a0'), 'ticketeria', 'cortesia', 20), (tc.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tc.id(o), tc.id(p), papel, acesso::text[] from (values
    ('a0', 'a1', 'admin', '{ticketeria}'), ('a0', 'a2', 'colaborador', '{ticketeria}'), ('a0', 'a3', 'leitor', '{ticketeria}'),
    ('a0', 'a6', 'colaborador', '{captacao}'), ('b0', 'b1', 'admin', '{ticketeria}')) as v(o, p, papel, acesso);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tc.id('61'), tc.id('a0'), 'Loja A'), (tc.id('6b'), tc.id('b0'), 'Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tc.id('51'), tc.id('a0'), tc.id('61'), 'Teatro A'), (tc.id('5b'), tc.id('b0'), tc.id('6b'), 'Teatro B');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares, arquivado) values
    (tc.id('41'), tc.id('a0'), tc.id('51'), 'Plateia', 100, false), (tc.id('42'), tc.id('a0'), tc.id('51'), 'Galeria', 50, true),
    (tc.id('4b'), tc.id('b0'), tc.id('5b'), 'Plateia B', 100, false);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo) values
    (tc.id('71'), tc.id('a0'), tc.id('61'), 'Hamlet'), (tc.id('73'), tc.id('a0'), tc.id('61'), 'Cancelado'), (tc.id('7b'), tc.id('b0'), tc.id('6b'), 'Show B');
  update public.ticketeria_eventos set situacao = 'cancelado' where id = tc.id('73');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria, publico, arquivado) values
    (tc.id('31'), tc.id('a0'), tc.id('71'), tc.id('41'), 'Inteira', 'inteira', true, false),
    (tc.id('32'), tc.id('a0'), tc.id('71'), tc.id('41'), 'Cortesia', 'cortesia', false, false),
    (tc.id('33'), tc.id('a0'), tc.id('71'), tc.id('41'), 'Antigo', 'inteira', true, true),
    (tc.id('3b'), tc.id('b0'), tc.id('7b'), tc.id('4b'), 'Inteira B', 'inteira', true, false);
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, preco_centavos, quantidade) values
    (tc.id('21'), tc.id('a0'), tc.id('31'), '1º lote', 5000, 60), (tc.id('23'), tc.id('a0'), tc.id('33'), '1º lote', 4000, 50);
end
$dados$;

create function tc.tenta(comando text) returns text language plpgsql as $$
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

create function tc.efeito(comando text) returns text language plpgsql as $$
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

create function tc.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using tc.id(o || '0');
  return n::text;
end;
$$;

create function tc.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tc.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tc.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select string_agg(tablename || '=' || n, ' ' order by tablename) from (
             select tablename::text, count(*) n from pg_policies where schemaname = 'public' and tablename::text in ('ticketeria_ingressos', 'ticketeria_lotes')
               and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true' group by tablename) x),
          'ticketeria_ingressos=4 ticketeria_lotes=4', 'quatro regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.ticketeria_ingressos'::regclass, 'public.ticketeria_lotes'::regclass) and relrowsecurity), 2, 'segurança por linha ligada nas duas');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.ticketeria_ingressos'::regclass, 'public.ticketeria_lotes'::regclass)),
          'ticketeria_ingressos.ticketeria_ingressos_evento_id_fkey=c, ticketeria_ingressos.ticketeria_ingressos_organization_id_fkey=c, ticketeria_ingressos.ticketeria_ingressos_setor_id_fkey=a, '
          || 'ticketeria_lotes.ticketeria_lotes_ingresso_id_fkey=c, ticketeria_lotes.ticketeria_lotes_organization_id_fkey=c',
          'o ingresso sai com o evento e leva os lotes; o setor com ingresso não sai (no action)');
select ok(not has_table_privilege('anon', 'public.ticketeria_ingressos', 'select') and not has_table_privilege('anon', 'public.ticketeria_lotes', 'select')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_preco_combina(text, integer)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_conferir_lugares(uuid, uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_ingresso_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_ingresso_lugares()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_lote_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_lote_lugares()', 'execute'), 'o visitante não toca em nada; as funções internas não são chamáveis');
select is((select string_agg(tgrelid::regclass::text || '.' || tgname::text, ' ' order by tgrelid::regclass::text collate "C", tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid in ('public.ticketeria_ingressos'::regclass, 'public.ticketeria_lotes'::regclass)),
          'ticketeria_ingressos.ticketeria_ingressos_coerencia ticketeria_ingressos.ticketeria_ingressos_lugares ticketeria_ingressos.ticketeria_ingressos_updated_at '
          || 'ticketeria_lotes.ticketeria_lotes_coerencia ticketeria_lotes.ticketeria_lotes_lugares ticketeria_lotes.ticketeria_lotes_updated_at', 'os gatilhos de cada tabela');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select tc.como('a1');
select is(tc.ve('ticketeria_ingressos', 'a') || tc.ve('ticketeria_lotes', 'a'), '32', 'administrador lê ingressos e lotes');
select tc.como('a6');
select is(tc.ve('ticketeria_ingressos', 'a') || tc.ve('ticketeria_lotes', 'a'), '00', 'quem não tem a ticketeria no vínculo não lê');
select tc.como('b1');
select is(tc.ve('ticketeria_ingressos', 'a') || tc.ve('ticketeria_ingressos', 'b'), '01', 'outra organização não lê; a própria, sim');
select tc.como(null);
select is(tc.efeito('select 1 from public.ticketeria_lotes'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select tc.como('a2');
select is(array[
            tc.tenta(format('insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values (%L, %L, %L, %L, %L, %L)', tc.id('34'), tc.id('a0'), tc.id('71'), tc.id('41'), 'Meia-entrada', 'meia')),
            tc.tenta(format('insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade, vendas_inicio, vendas_fim) values (%L, %L, %L, 2500, 40, now(), now() + interval %L)', tc.id('a0'), tc.id('31'), '2º lote', '10 days'))],
          array['aceito', 'aceito'], 'colaborador cria ingresso e lote (60 + 40 = os 100 lugares)');
select is(tc.tenta(format('insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade) values (%L, %L, %L, 2500, 41)', tc.id('a0'), tc.id('31'), 'Demais')), '23514 lugares_excedidos', 'o colaborador também esbarra nos lugares (60 + 41 passa de 100)');
select tc.como('a3');
select ok(tc.tenta(format('insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade) values (%L, %L, %L, 1000, 1)', tc.id('a0'), tc.id('31'), 'x')) like '42501%', 'leitor não cria lote');
select is(tc.efeito(format('update public.ticketeria_ingressos set nome = %L where id = %L', 'x', tc.id('31'))), '', 'leitor não altera ingresso');
select tc.como('a6');
select is(tc.efeito(format('update public.ticketeria_lotes set nome = %L where id = %L', 'x', tc.id('21'))), '', 'quem não tem a ticketeria no vínculo não altera');
select tc.volta();

-- ─── Forma, coerência e lugares ─────────────────────────────────────────────

select is(array[
            tc.tenta(format('insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria) values (%L, %L, %L, %L, %L)', tc.id('a0'), tc.id('7b'), tc.id('41'), 'x', 'inteira')),
            tc.tenta(format('insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria) values (%L, %L, %L, %L, %L)', tc.id('a0'), tc.id('71'), tc.id('4b'), 'x', 'inteira')),
            tc.tenta(format('insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria) values (%L, %L, %L, %L, %L)', tc.id('a0'), tc.id('71'), tc.id('42'), 'x', 'inteira')),
            tc.tenta(format('insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria) values (%L, %L, %L, %L, %L)', tc.id('a0'), tc.id('73'), tc.id('41'), 'x', 'inteira')),
            tc.tenta(format('insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria) values (%L, %L, %L, %L, %L)', tc.id('a0'), tc.id('71'), tc.id('41'), 'x', 'vip')),
            tc.tenta(format('insert into public.ticketeria_ingressos (organization_id, evento_id, setor_id, nome, categoria, limite_por_pedido) values (%L, %L, %L, %L, %L, 0)', tc.id('a0'), tc.id('71'), tc.id('41'), 'x', 'inteira')),
            tc.tenta(format('insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade) values (%L, %L, %L, 100, 1)', tc.id('a0'), tc.id('32'), 'x')),
            tc.tenta(format('insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade) values (%L, %L, %L, 0, 1)', tc.id('a0'), tc.id('31'), 'x')),
            tc.tenta(format('insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade) values (%L, %L, %L, 100, 0)', tc.id('a0'), tc.id('31'), 'x')),
            tc.tenta(format('insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade, vendas_inicio, vendas_fim) values (%L, %L, %L, 100, 1, now(), now() - interval %L)', tc.id('a0'), tc.id('31'), 'x', '1 day')),
            tc.tenta(format('insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade) values (%L, %L, %L, 100, 1)', tc.id('a0'), tc.id('3b'), 'x')),
            tc.tenta(format('update public.ticketeria_ingressos set categoria = %L where id = %L', 'cortesia', tc.id('31'))),
            tc.tenta(format('update public.ticketeria_lotes set ingresso_id = %L where id = %L', tc.id('32'), tc.id('21'))),
            tc.tenta(format('update public.ticketeria_ingressos set evento_id = %L where id = %L', tc.id('73'), tc.id('31'))),
            tc.tenta(format('update public.ticketeria_lotes set quantidade = 101 where id = %L', tc.id('21'))),
            tc.tenta(format('update public.ticketeria_ingressos set arquivado = false where id = %L', tc.id('33')))],
          array['23514 evento_de_outra_organizacao', '23514 setor_de_outra_organizacao', '23514 setor_arquivado', '23514 evento_cancelado',
                '23514 ticketeria_ingressos_categoria_check', '23514 ticketeria_ingressos_limite_check',
                '23514 preco_incoerente', '23514 preco_incoerente', '23514 ticketeria_lotes_quantidade_check', '23514 ticketeria_lotes_janela_check',
                '23514 ingresso_de_outra_organizacao', '23514 preco_incoerente', '23514 ingresso_nao_muda', '23514 evento_nao_muda',
                '23514 lugares_excedidos', '23514 lugares_excedidos'],
          'pais da organização; setor arquivado e evento cancelado; categoria e limite; preço que combina; quantidade e janela; o que não muda; lote que aumenta e ingresso que sai do arquivo passando dos lugares');
select is(array[
            tc.tenta(format('update public.ticketeria_lotes set quantidade = 10 where id = %L', tc.id('21'))),
            tc.tenta(format('update public.ticketeria_setores set lugares = 10 where id = %L', tc.id('41'))),
            tc.tenta(format('update public.ticketeria_lotes set preco_centavos = 0, nome = %L where id = %L', 'x', tc.id('23'))),
            tc.tenta(format('insert into public.ticketeria_lotes (organization_id, ingresso_id, nome, preco_centavos, quantidade) values (%L, %L, %L, 0, 40)', tc.id('a0'), tc.id('32'), 'Cortesias'))],
          array['aceito', 'aceito', '23514 preco_incoerente', 'aceito'],
          'diminuir o lote e diminuir o setor depois passam; o preço segue conferido; a cortesia de graça cabe (60 + 40)');

-- ─── Apagar (DELETE, cada um desfeito: pela CLI) ────────────────────────────

select is(array[
            tc.tenta(format('delete from public.ticketeria_setores where id = %L', tc.id('41'))),
            tc.tenta(format('delete from public.ticketeria_ingressos where id = %L', tc.id('31'))),
            tc.tenta(format('delete from public.ticketeria_eventos where id = %L', tc.id('71'))),
            tc.tenta(format('delete from public.organizations where id = %L', tc.id('b0')))],
          array['23503 ticketeria_ingressos_setor_id_fkey', 'aceito', 'aceito', 'aceito'],
          'setor com ingresso não se apaga; ingresso (com os lotes), evento em rascunho e a organização inteira, sim');

select * from finish();
rollback;
