-- PD1.5: pauta mínima do espaço (producao_pautas).
--
-- Quem lê e quem grava a pauta (administrador, colaborador, leitor, o recorte "só onde está vinculado", outra
-- organização, produção só para leitura e visitante), a forma (período, situação, fila e validade só na pré-reserva),
-- a coerência (sala e data da mesma organização, organização fixa), que duas confirmadas na mesma sala NÃO são
-- recusadas (o conflito é aviso na tela) e o histórico. Ids 0d240000-0000-4000-8000-0000000000XX, ou pa.id('XX').
--   A (a0), cortesia: espaços E1 (31) e E2 (32); salas S1 (71, de E1) e S2 (72, de E2); data D (41);
--   pautas 81 (S1, confirmada de 5 a 7/12) e 82 (S2); a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o
--   recorte "vinculado" e vínculo só com E1 (pessoa 51).
--   B (b0), cortesia: espaço 3b, sala 7b, data 4b; b1 admin.  C (c0), produção só para leitura: espaço 3c, sala 7c,
--   pauta 8c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_pautas na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

create schema pa;
grant usage on schema pa to authenticated, anon;

create function pa.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d240000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select pa.id(s), 'pa-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (pa.id('a0'), 'PA A'), (pa.id('b0'), 'PA B'), (pa.id('c0'), 'PA C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (pa.id('a0'), 'producao', 'cortesia', 20), (pa.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (pa.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = pa.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select pa.id(o), pa.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (pa.id('a0'), pa.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (pa.id('31'), pa.id('a0'), 'PA E1', 'Teatro'), (pa.id('32'), pa.id('a0'), 'PA E2', 'Teatro'),
    (pa.id('3b'), pa.id('b0'), 'PA EB', 'Teatro'), (pa.id('3c'), pa.id('c0'), 'PA EC', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values
    (pa.id('71'), pa.id('a0'), pa.id('31'), 'S1'), (pa.id('72'), pa.id('a0'), pa.id('32'), 'S2'),
    (pa.id('7b'), pa.id('b0'), pa.id('3b'), 'SB'), (pa.id('7c'), pa.id('c0'), pa.id('3c'), 'SC');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (pa.id('21'), pa.id('a0'), 'circulacao', 'circula', 'teatro', 'PA T'), (pa.id('2b'), pa.id('b0'), 'circulacao', 'circula', 'teatro', 'PA TB');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (pa.id('41'), pa.id('a0'), pa.id('21'), date '2026-12-05'), (pa.id('4b'), pa.id('b0'), pa.id('2b'), date '2026-12-05');
  insert into public.producao_pessoas (id, organization_id, nome, user_id) values (pa.id('51'), pa.id('a0'), 'PA Pessoa', pa.id('a5'));
  insert into public.producao_vinculos (id, organization_id, pessoa_id, espaco_id, funcao, situacao) values
    (pa.id('61'), pa.id('a0'), pa.id('51'), pa.id('31'), 'Bilheteria', 'confirmada');
  insert into public.producao_pautas (id, organization_id, sala_id, titulo, inicio, fim, situacao) values
    (pa.id('81'), pa.id('a0'), pa.id('71'), 'Show da banda', date '2026-12-05', date '2026-12-07', 'confirmada'),
    (pa.id('82'), pa.id('a0'), pa.id('72'), 'Peça infantil', date '2026-12-05', date '2026-12-05', 'consulta'),
    (pa.id('8c'), pa.id('c0'), pa.id('7c'), 'Pauta da C', date '2026-12-05', date '2026-12-05', 'consulta');
end
$dados$;

create function pa.tenta(comando text) returns text language plpgsql as $$
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

create function pa.efeito(comando text) returns text language plpgsql as $$
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

create function pa.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_pautas where organization_id = pa.id(o || '0'))::text;
$$;

create function pa.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', pa.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function pa.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_pautas'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select is((select relrowsecurity from pg_class where oid = 'public.producao_pautas'::regclass), true, 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_pautas'::regclass),
          'producao_pautas_data_id_fkey=n, producao_pautas_organization_id_fkey=c, producao_pautas_sala_id_fkey=c', 'a pauta sai com a sala e a organização; apagar a data só solta a ligação');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_pauta_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_pautas', 'select'), 'a coerência não é chamável e o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_pautas'::regclass),
          'producao_pautas_coerencia producao_pautas_historico producao_pautas_updated_at', 'os três gatilhos');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select pa.como('a1');
select is(pa.ve('a'), '2', 'administrador lê as duas');
select pa.como('a2');
select is(pa.ve('a'), '2', 'colaborador lê as duas');
select pa.como('a3');
select is(pa.ve('a'), '2', 'leitor lê as duas');
select pa.como('a5');
select is(pa.ve('a'), '1', 'o recorte "vinculado" vê só a pauta da sala do espaço em que tem vínculo');
select pa.como('b1');
select is(pa.ve('a'), '0', 'outra organização não lê');
select pa.como('c1');
select is(pa.ve('c'), '1', 'produção só para leitura lê');
select pa.como(null);
select is(pa.efeito('select 1 from public.producao_pautas'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select pa.como('a2');
select is(pa.tenta(format('insert into public.producao_pautas (organization_id, sala_id, titulo, inicio, fim) values (%L, %L, %L, %L, %L)',
                          pa.id('a0'), pa.id('71'), 'Ensaio aberto', '2026-12-10', '2026-12-10')), 'aceito', 'colaborador cria a pauta');
select is(pa.efeito(format('update public.producao_pautas set situacao = %L where id = %L', 'cancelada', pa.id('81'))), 'sim', 'colaborador altera');
select pa.como('a3');
select ok(pa.tenta(format('insert into public.producao_pautas (organization_id, sala_id, titulo, inicio, fim) values (%L, %L, %L, %L, %L)',
                          pa.id('a0'), pa.id('71'), 'x', '2026-12-10', '2026-12-10')) like '42501%', 'leitor não cria');
select pa.como('c1');
select ok(pa.tenta(format('insert into public.producao_pautas (organization_id, sala_id, titulo, inicio, fim) values (%L, %L, %L, %L, %L)',
                          pa.id('c0'), pa.id('7c'), 'x', '2026-12-10', '2026-12-10')) like '42501%', 'produção só para leitura não grava');
select pa.como('a5');
select ok(pa.tenta(format('insert into public.producao_pautas (organization_id, sala_id, titulo, inicio, fim) values (%L, %L, %L, %L, %L)',
                          pa.id('a0'), pa.id('72'), 'x', '2026-12-10', '2026-12-10')) like '42501%', 'o recorte não grava na sala de um espaço que não vê');
select pa.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            pa.tenta(format('insert into public.producao_pautas (organization_id, sala_id, titulo, inicio, fim) values (%L, %L, %L, %L, %L)', pa.id('a0'), pa.id('71'), 'x', '2026-12-10', '2026-12-09')),
            pa.tenta(format('insert into public.producao_pautas (organization_id, sala_id, titulo, inicio, fim) values (%L, %L, %L, %L, %L)', pa.id('a0'), pa.id('71'), 'x', '2026-01-01', '2027-02-01')),
            pa.tenta(format('insert into public.producao_pautas (organization_id, sala_id, titulo, inicio, fim, situacao) values (%L, %L, %L, %L, %L, %L)', pa.id('a0'), pa.id('71'), 'x', '2026-12-10', '2026-12-10', 'talvez')),
            pa.tenta(format('insert into public.producao_pautas (organization_id, sala_id, titulo, inicio, fim, ordem_na_fila) values (%L, %L, %L, %L, %L, 1)', pa.id('a0'), pa.id('71'), 'x', '2026-12-10', '2026-12-10')),
            pa.tenta(format('insert into public.producao_pautas (organization_id, sala_id, titulo, inicio, fim, situacao, ordem_na_fila, valida_ate) values (%L, %L, %L, %L, %L, %L, 1, %L)', pa.id('a0'), pa.id('71'), 'x', '2026-12-10', '2026-12-10', 'pre_reserva', '2026-11-30')),
            pa.tenta(format('insert into public.producao_pautas (organization_id, sala_id, titulo, inicio, fim) values (%L, %L, %L, %L, %L)', pa.id('a0'), pa.id('71'), ' ', '2026-12-10', '2026-12-10')),
            pa.tenta(format('insert into public.producao_pautas (organization_id, sala_id, titulo, inicio, fim) values (%L, %L, %L, %L, %L)', pa.id('a0'), pa.id('7b'), 'x', '2026-12-10', '2026-12-10')),
            pa.tenta(format('insert into public.producao_pautas (organization_id, sala_id, titulo, inicio, fim, data_id) values (%L, %L, %L, %L, %L, %L)', pa.id('a0'), pa.id('71'), 'x', '2026-12-10', '2026-12-10', pa.id('4b'))),
            pa.tenta(format('update public.producao_pautas set organization_id = %L where id = %L', pa.id('b0'), pa.id('81'))),
            pa.tenta(format('insert into public.producao_pautas (organization_id, sala_id, titulo, inicio, fim, situacao) values (%L, %L, %L, %L, %L, %L)', pa.id('a0'), pa.id('71'), 'Outra confirmada', '2026-12-06', '2026-12-08', 'confirmada'))],
          array['23514 producao_pautas_periodo_check', '23514 producao_pautas_periodo_check', '23514 producao_pautas_situacao_check', '23514 producao_pautas_pre_reserva_check',
                'aceito', '23514 producao_pautas_titulo_check', '23514 sala_de_outra_organizacao', '23514 data_de_outra_organizacao', '23514 organizacao_nao_muda', 'aceito'],
          'período, situação, fila só na pré-reserva, título, sala e data da organização, organização fixa; duas confirmadas na mesma sala passam (conflito é aviso)');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_pautas set titulo = 'Show da banda (nova data)' where id = pa.id('81');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade_id = pa.id('81') and acao = 'alterou'),
          'titulo', 'mudar o título deixa uma linha de histórico');
select pa.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_pautas' and entidade_id = pa.id('81')) > 0, 'quem lê a pauta lê o histórico dela');
select pa.volta();

select * from finish();
rollback;
