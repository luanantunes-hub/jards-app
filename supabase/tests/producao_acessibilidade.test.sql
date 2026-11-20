-- PD7.6 (primeiro corte): acessibilidade por sessão (producao_acessibilidade).
--
-- Quem lê e quem grava (colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção só para
-- leitura e visitante), a forma dos dados (tipo, situação, lugares só para "lugares reservados", nota), a coerência (organização,
-- sessão e pessoa) e o histórico, que deixa a nota de fora.
-- Ids 0d390000-0000-4000-8000-0000000000XX, ou ac.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: sessões 91 e 92; pessoa pa; recursos r1 (libras, 91, com a pessoa pa) e r2 (lugares reservados, 91, 4 lugares);
--   a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.  B (b0): b1 admin, sessão 9b, pessoa pb.
--   C (c0), produção só para leitura: c1 colaborador, sessão 9c, recurso rc.
-- Rodar: supabase/tests/README.md, com a migration producao_acessibilidade na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

create schema ac;
grant usage on schema ac to authenticated, anon;

create function ac.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d390000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ac.id(s), 'ac-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (ac.id('a0'), 'AC A'), (ac.id('b0'), 'AC B'), (ac.id('c0'), 'AC C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (ac.id('a0'), 'producao', 'cortesia', 20), (ac.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (ac.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = ac.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ac.id(o), ac.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (ac.id('a0'), ac.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (ac.id('31'), ac.id('a0'), 'AC E1', 'Teatro'), (ac.id('3b'), ac.id('b0'), 'AC EB', 'Teatro'), (ac.id('3c'), ac.id('c0'), 'AC EC', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values
    (ac.id('71'), ac.id('a0'), ac.id('31'), 'S1'), (ac.id('7b'), ac.id('b0'), ac.id('3b'), 'SB'), (ac.id('7c'), ac.id('c0'), ac.id('3c'), 'SC');
  insert into public.producao_pautas (id, organization_id, sala_id, titulo, inicio, fim, situacao) values
    (ac.id('81'), ac.id('a0'), ac.id('71'), 'Festival', date '2026-12-05', date '2026-12-07', 'confirmada'),
    (ac.id('8b'), ac.id('b0'), ac.id('7b'), 'Pauta B', date '2026-12-05', date '2026-12-07', 'consulta'),
    (ac.id('8c'), ac.id('c0'), ac.id('7c'), 'Pauta C', date '2026-12-05', date '2026-12-07', 'consulta');
  insert into public.producao_sessoes (id, organization_id, pauta_id, dia, inicio, fim) values
    (ac.id('91'), ac.id('a0'), ac.id('81'), date '2026-12-05', time '18:00', time '20:00'),
    (ac.id('92'), ac.id('a0'), ac.id('81'), date '2026-12-06', time '18:00', time '20:00'),
    (ac.id('9b'), ac.id('b0'), ac.id('8b'), date '2026-12-05', time '18:00', time '20:00'),
    (ac.id('9c'), ac.id('c0'), ac.id('8c'), date '2026-12-05', time '18:00', time '20:00');
  insert into public.producao_pessoas (id, organization_id, nome) values
    (ac.id('5a'), ac.id('a0'), 'AC Intérprete'), (ac.id('5b'), ac.id('b0'), 'AC Pessoa da B');
  insert into public.producao_acessibilidade (id, organization_id, sessao_id, tipo, situacao, pessoa_id, lugares, notas) values
    (ac.id('a1'), ac.id('a0'), ac.id('91'), 'libras', 'confirmado', ac.id('5a'), null, 'Interpretação das 18h'),
    (ac.id('a2'), ac.id('a0'), ac.id('91'), 'lugares_reservados', 'planejado', null, 4, null),
    (ac.id('ab'), ac.id('b0'), ac.id('9b'), 'legendagem', 'planejado', null, null, null),
    (ac.id('ac'), ac.id('c0'), ac.id('9c'), 'audiodescricao', 'planejado', null, null, null);
end
$dados$;

create function ac.tenta(comando text) returns text language plpgsql as $$
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

create function ac.efeito(comando text) returns text language plpgsql as $$
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

create function ac.ve(o text) returns text language plpgsql as $$
declare n bigint;
begin
  select count(*) into n from public.producao_acessibilidade where organization_id = ac.id(o || '0');
  return n::text;
end;
$$;

create function ac.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', ac.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function ac.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_acessibilidade' and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_acessibilidade'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint where contype = 'f' and conrelid = 'public.producao_acessibilidade'::regclass),
          'producao_acessibilidade_organization_id_fkey=c, producao_acessibilidade_pessoa_id_fkey=n, producao_acessibilidade_sessao_id_fkey=c', 'o recurso sai com a sessão; apagar a pessoa só solta a ligação');
select ok(not has_table_privilege('anon', 'public.producao_acessibilidade', 'select') and not has_function_privilege('authenticated', 'public.fn_producao_acessibilidade_coerencia()', 'execute'),
          'o visitante não toca na tabela e ninguém executa a coerência');
select is((select count(*)::int from pg_trigger where tgrelid = 'public.producao_acessibilidade'::regclass and not tgisinternal), 3, 'três gatilhos: coerência, updated_at e histórico');

-- ─── Quem lê ────────────────────────────────────────────────────────────────

select ac.como('a2');
select is(ac.ve('a'), '2', 'colaborador lê');
select ac.como('a3');
select is(ac.ve('a'), '2', 'leitor lê');
select ac.como('a5');
select is(ac.ve('a'), '0', 'o recorte "vinculado" sem vínculo não lê (herda a sessão)');
select ac.como('b1');
select is(ac.ve('a') || '|' || ac.ve('b'), '0|1', 'outra organização só lê o que é dela');
select ac.como('c1');
select is(ac.ve('c'), '1', 'produção só para leitura lê');
select ac.como(null);
select is(ac.efeito('select 1 from public.producao_acessibilidade'), '', 'visitante não lê');
select ac.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ac.como('a2');
select is(ac.tenta(format('insert into public.producao_acessibilidade (organization_id, sessao_id, tipo, pessoa_id) values (%L, %L, %L, %L)', ac.id('a0'), ac.id('92'), 'audiodescricao', ac.id('5a'))), 'aceito', 'colaborador cria o recurso');
select is(ac.efeito(format('update public.producao_acessibilidade set situacao = %L where id = %L', 'confirmado', ac.id('a2'))) || '|' || ac.efeito(format('delete from public.producao_acessibilidade where id = %L', ac.id('a2'))), 'sim|sim', 'colaborador altera e apaga');
select ac.como('a3');
select ok(ac.tenta(format('insert into public.producao_acessibilidade (organization_id, sessao_id, tipo) values (%L, %L, %L)', ac.id('a0'), ac.id('92'), 'libras')) like '42501%', 'leitor não grava');
select ac.como('a5');
select ok(ac.tenta(format('insert into public.producao_acessibilidade (organization_id, sessao_id, tipo) values (%L, %L, %L)', ac.id('a0'), ac.id('92'), 'libras')) like '42501%', 'o recorte sem vínculo não grava');
select ac.como('c1');
select ok(ac.tenta(format('insert into public.producao_acessibilidade (organization_id, sessao_id, tipo) values (%L, %L, %L)', ac.id('c0'), ac.id('9c'), 'libras')) like '42501%', 'produção só para leitura não grava');
select ac.como('b1');
select is(ac.efeito(format('update public.producao_acessibilidade set notas = %L where id = %L', 'invasor', ac.id('a1'))), '', 'outra organização não altera');
select ac.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            ac.tenta(format('insert into public.producao_acessibilidade (organization_id, sessao_id, tipo) values (%L, %L, %L)', ac.id('a0'), ac.id('91'), 'braile')),
            ac.tenta(format('insert into public.producao_acessibilidade (organization_id, sessao_id, tipo, situacao) values (%L, %L, %L, %L)', ac.id('a0'), ac.id('91'), 'libras', 'talvez')),
            ac.tenta(format('insert into public.producao_acessibilidade (organization_id, sessao_id, tipo, lugares) values (%L, %L, %L, 3)', ac.id('a0'), ac.id('91'), 'libras')),
            ac.tenta(format('insert into public.producao_acessibilidade (organization_id, sessao_id, tipo, lugares) values (%L, %L, %L, 0)', ac.id('a0'), ac.id('91'), 'lugares_reservados')),
            ac.tenta(format('insert into public.producao_acessibilidade (organization_id, sessao_id, tipo, notas) values (%L, %L, %L, %L)', ac.id('a0'), ac.id('91'), 'libras', ' ')),
            ac.tenta(format('insert into public.producao_acessibilidade (organization_id, sessao_id, tipo) values (%L, %L, %L)', ac.id('a0'), ac.id('9b'), 'libras')),
            ac.tenta(format('insert into public.producao_acessibilidade (organization_id, sessao_id, tipo, pessoa_id) values (%L, %L, %L, %L)', ac.id('a0'), ac.id('91'), 'libras', ac.id('5b'))),
            ac.tenta(format('update public.producao_acessibilidade set organization_id = %L where id = %L', ac.id('b0'), ac.id('a1'))),
            ac.tenta(format('update public.producao_acessibilidade set sessao_id = %L where id = %L', ac.id('92'), ac.id('a1')))],
          array['23514 producao_acessibilidade_tipo_check', '23514 producao_acessibilidade_situacao_check', '23514 producao_acessibilidade_lugares_check', '23514 producao_acessibilidade_lugares_check',
                '23514 producao_acessibilidade_notas_check', '23514 sessao_de_outra_organizacao', '23514 pessoa_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 sessao_nao_muda'],
          'tipo, situação, lugares só para lugares reservados, nota; sessão e pessoa da organização e o que não muda');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_acessibilidade set situacao = 'cancelado', notas = 'Mudou o plano' where id = ac.id('a1');
select is((select string_agg(distinct campo, ',' order by campo) from public.producao_historico where entidade_id = ac.id('a1') and acao = 'alterou'),
          'situacao', 'o histórico guarda a situação e deixa a nota de fora');
select ac.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_acessibilidade' and entidade_id = ac.id('a1')) > 0, 'quem lê o recurso lê o histórico dele');
select ac.volta();

select * from finish();
rollback;
