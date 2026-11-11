-- PD3.4: os turnos da equipe fixa da casa (producao_turnos).
--
-- Quem lê e quem grava o turno (administrador, colaborador, leitor, o recorte "só onde está vinculado", que vê e grava só
-- os turnos do espaço em que tem vínculo, outra organização, produção só para leitura e visitante), a forma (horas, função,
-- notas, um turno por pessoa, dia e hora de início), a coerência entre organizações (espaço, pessoa e pauta, e a pauta ser
-- de uma sala do mesmo espaço; organização e espaço não mudam), as chaves e o histórico. Ids
-- 0d2c0000-0000-4000-8000-0000000000XX, ou tn.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: espaços 31 e 32; salas 71 (do 31) e 72 (do 32); pautas 81 (sala 71) e 82 (sala 72);
--   pessoas 51 (a5) e 52, as duas com vínculo no espaço 31; turnos 91 (espaço 31, pessoa 52, pauta 81) e 92 (espaço 32);
--   a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado".
--   B (b0), cortesia: espaço 3b, sala 7b, pauta 8b, pessoa 5b; b1 admin.  C (c0), produção só para leitura: espaço 3c,
--   pessoa 5c, turno 9c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_turnos na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

create schema tn;
grant usage on schema tn to authenticated, anon;

create function tn.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d2c0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tn.id(s), 'tn-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (tn.id('a0'), 'TN A'), (tn.id('b0'), 'TN B'), (tn.id('c0'), 'TN C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tn.id('a0'), 'producao', 'cortesia', 20), (tn.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (tn.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = tn.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tn.id(o), tn.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (tn.id('a0'), tn.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (tn.id('31'), tn.id('a0'), 'TN E1', 'Teatro'), (tn.id('32'), tn.id('a0'), 'TN E2', 'Teatro'),
    (tn.id('3b'), tn.id('b0'), 'TN EB', 'Teatro'), (tn.id('3c'), tn.id('c0'), 'TN EC', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values
    (tn.id('71'), tn.id('a0'), tn.id('31'), 'S1'), (tn.id('72'), tn.id('a0'), tn.id('32'), 'S2'), (tn.id('7b'), tn.id('b0'), tn.id('3b'), 'SB');
  insert into public.producao_pautas (id, organization_id, sala_id, titulo, inicio, fim, situacao) values
    (tn.id('81'), tn.id('a0'), tn.id('71'), 'Show da banda', date '2026-12-05', date '2026-12-05', 'confirmada'),
    (tn.id('82'), tn.id('a0'), tn.id('72'), 'Peça infantil', date '2026-12-05', date '2026-12-05', 'consulta'),
    (tn.id('8b'), tn.id('b0'), tn.id('7b'), 'Pauta da B', date '2026-12-05', date '2026-12-05', 'consulta');
  insert into public.producao_pessoas (id, organization_id, nome, user_id) values
    (tn.id('51'), tn.id('a0'), 'TN Pessoa 1', tn.id('a5')), (tn.id('52'), tn.id('a0'), 'TN Pessoa 2', null),
    (tn.id('5b'), tn.id('b0'), 'TN Pessoa B', null), (tn.id('5c'), tn.id('c0'), 'TN Pessoa C', null);
  insert into public.producao_vinculos (id, organization_id, pessoa_id, espaco_id, funcao, situacao) values
    (tn.id('61'), tn.id('a0'), tn.id('51'), tn.id('31'), 'Bilheteria', 'confirmada'),
    (tn.id('62'), tn.id('a0'), tn.id('52'), tn.id('31'), 'Técnico', 'confirmada');
  insert into public.producao_turnos (id, organization_id, espaco_id, pessoa_id, pauta_id, dia, inicio, fim, funcao) values
    (tn.id('91'), tn.id('a0'), tn.id('31'), tn.id('52'), tn.id('81'), date '2026-12-05', time '18:00', time '23:00', 'Técnico de som'),
    (tn.id('92'), tn.id('a0'), tn.id('32'), tn.id('52'), null, date '2026-12-05', time '10:00', time '14:00', 'Limpeza'),
    (tn.id('9c'), tn.id('c0'), tn.id('3c'), tn.id('5c'), null, date '2026-12-05', time '10:00', time '14:00', 'Portaria');
end
$dados$;

create function tn.tenta(comando text) returns text language plpgsql as $$
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

create function tn.efeito(comando text) returns text language plpgsql as $$
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

create function tn.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using tn.id(o || '0');
  return n::text;
end;
$$;

create function tn.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tn.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tn.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_turnos'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_turnos'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_turnos'::regclass),
          'producao_turnos_espaco_id_fkey=c, producao_turnos_organization_id_fkey=c, producao_turnos_pauta_id_fkey=n, producao_turnos_pessoa_id_fkey=c',
          'o turno sai com o espaço, a pessoa e a organização; apagar a pauta só solta o turno');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_turno_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_turnos', 'select'), 'a coerência não é chamável e o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_turnos'::regclass),
          'producao_turnos_coerencia producao_turnos_historico producao_turnos_updated_at', 'os três gatilhos');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select tn.como('a1');
select is(tn.ve('producao_turnos', 'a'), '2', 'administrador lê os turnos');
select tn.como('a2');
select is(tn.ve('producao_turnos', 'a'), '2', 'colaborador lê os turnos');
select tn.como('a3');
select is(tn.ve('producao_turnos', 'a'), '2', 'leitor lê os turnos');
select tn.como('a5');
select is(tn.ve('producao_turnos', 'a'), '1', 'o recorte "vinculado" lê só os turnos do espaço em que tem vínculo');
select tn.como('b1');
select is(tn.ve('producao_turnos', 'a'), '0', 'outra organização não lê');
select tn.como('c1');
select is(tn.ve('producao_turnos', 'c'), '1', 'produção só para leitura lê');
select tn.como(null);
select is(tn.efeito('select 1 from public.producao_turnos'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select tn.como('a2');
select is(tn.tenta(format('insert into public.producao_turnos (organization_id, espaco_id, pessoa_id, dia, inicio, fim) values (%L, %L, %L, %L, %L, %L)',
                          tn.id('a0'), tn.id('31'), tn.id('52'), '2026-12-06', '09:00', '13:00')), 'aceito', 'colaborador cria o turno');
select is(tn.efeito(format('update public.producao_turnos set funcao = %L where id = %L', 'Operador de luz', tn.id('91'))), 'sim', 'colaborador altera o turno');
select is(tn.efeito(format('delete from public.producao_turnos where id = %L', tn.id('92'))), 'sim', 'colaborador apaga o turno');
select tn.como('a3');
select ok(tn.tenta(format('insert into public.producao_turnos (organization_id, espaco_id, pessoa_id, dia, inicio, fim) values (%L, %L, %L, %L, %L, %L)',
                          tn.id('a0'), tn.id('31'), tn.id('52'), '2026-12-06', '09:00', '13:00')) like '42501%', 'leitor não cria o turno');
select tn.como('c1');
select ok(tn.tenta(format('insert into public.producao_turnos (organization_id, espaco_id, pessoa_id, dia, inicio, fim) values (%L, %L, %L, %L, %L, %L)',
                          tn.id('c0'), tn.id('3c'), tn.id('5c'), '2026-12-06', '09:00', '13:00')) like '42501%', 'produção só para leitura não grava');
select tn.como('a5');
select is(tn.tenta(format('insert into public.producao_turnos (organization_id, espaco_id, pessoa_id, dia, inicio, fim) values (%L, %L, %L, %L, %L, %L)',
                          tn.id('a0'), tn.id('31'), tn.id('52'), '2026-12-07', '09:00', '13:00')), 'aceito', 'o recorte grava turnos no espaço em que tem vínculo');
select ok(tn.tenta(format('insert into public.producao_turnos (organization_id, espaco_id, pessoa_id, dia, inicio, fim) values (%L, %L, %L, %L, %L, %L)',
                          tn.id('a0'), tn.id('32'), tn.id('52'), '2026-12-07', '09:00', '13:00')) like '42501%', 'o recorte não grava em outro espaço');
select tn.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            tn.tenta(format('insert into public.producao_turnos (organization_id, espaco_id, pessoa_id, dia, inicio, fim) values (%L, %L, %L, %L, %L, %L)', tn.id('a0'), tn.id('31'), tn.id('52'), '2026-12-08', '09:00', '09:00')),
            tn.tenta(format('insert into public.producao_turnos (organization_id, espaco_id, pessoa_id, dia, inicio, fim, funcao) values (%L, %L, %L, %L, %L, %L, %L)', tn.id('a0'), tn.id('31'), tn.id('52'), '2026-12-08', '09:00', '12:00', ' ')),
            tn.tenta(format('insert into public.producao_turnos (organization_id, espaco_id, pessoa_id, dia, inicio, fim, notas) values (%L, %L, %L, %L, %L, %L, repeat(%L, 501))', tn.id('a0'), tn.id('31'), tn.id('52'), '2026-12-08', '09:00', '12:00', 'a')),
            tn.tenta(format('insert into public.producao_turnos (organization_id, espaco_id, pessoa_id, pauta_id, dia, inicio, fim) values (%L, %L, %L, %L, %L, %L, %L)', tn.id('a0'), tn.id('31'), tn.id('52'), tn.id('82'), '2026-12-08', '09:00', '12:00')),
            tn.tenta(format('insert into public.producao_turnos (organization_id, espaco_id, pessoa_id, pauta_id, dia, inicio, fim) values (%L, %L, %L, %L, %L, %L, %L)', tn.id('a0'), tn.id('31'), tn.id('52'), tn.id('8b'), '2026-12-08', '09:00', '12:00')),
            tn.tenta(format('insert into public.producao_turnos (organization_id, espaco_id, pessoa_id, dia, inicio, fim) values (%L, %L, %L, %L, %L, %L)', tn.id('a0'), tn.id('31'), tn.id('5b'), '2026-12-08', '09:00', '12:00')),
            tn.tenta(format('insert into public.producao_turnos (organization_id, espaco_id, pessoa_id, dia, inicio, fim) values (%L, %L, %L, %L, %L, %L)', tn.id('a0'), tn.id('3b'), tn.id('52'), '2026-12-08', '09:00', '12:00')),
            tn.tenta(format('update public.producao_turnos set organization_id = %L where id = %L', tn.id('b0'), tn.id('91'))),
            tn.tenta(format('update public.producao_turnos set espaco_id = %L where id = %L', tn.id('32'), tn.id('91'))),
            tn.tenta(format('insert into public.producao_turnos (organization_id, espaco_id, pessoa_id, dia, inicio, fim) values (%L, %L, %L, %L, %L, %L)', tn.id('a0'), tn.id('31'), tn.id('52'), '2026-12-05', '18:00', '20:00'))],
          array['23514 producao_turnos_horas_check', '23514 producao_turnos_funcao_check', '23514 producao_turnos_notas_check',
                '23514 pauta_de_outro_espaco', '23514 pauta_de_outra_organizacao', '23514 pessoa_de_outra_organizacao', '23514 espaco_de_outra_organizacao',
                '23514 organizacao_nao_muda', '23514 espaco_nao_muda', '23505 producao_turnos_pessoa_dia_inicio_key'],
          'horas, função, notas; espaço, pessoa e pauta da organização, pauta do mesmo espaço; organização e espaço fixos; um turno por pessoa, dia e início');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_turnos set funcao = 'Técnico de luz' where id = tn.id('91');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade = 'producao_turnos' and entidade_id = tn.id('91') and acao = 'alterou'),
          'funcao', 'mudar a função deixa uma linha de histórico');
select tn.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_turnos' and entidade_id = tn.id('91')) > 0, 'quem lê o turno lê o histórico dele');
select tn.volta();

-- ─── Chaves ─────────────────────────────────────────────────────────────────

delete from public.producao_pautas where id = tn.id('81');
select is((select pauta_id from public.producao_turnos where id = tn.id('91')), null, 'apagar a pauta só solta o turno dela');
insert into public.producao_turnos (id, organization_id, espaco_id, pessoa_id, dia, inicio, fim) values (tn.id('93'), tn.id('a0'), tn.id('32'), tn.id('52'), date '2026-12-09', time '09:00', time '12:00');
delete from public.producao_espacos where id = tn.id('32');
select is((select count(*)::int from public.producao_turnos where espaco_id = tn.id('32')), 0, 'apagar o espaço leva os turnos dele');
delete from public.producao_pessoas where id = tn.id('52');
select is((select count(*)::int from public.producao_turnos where pessoa_id = tn.id('52')), 0, 'apagar a pessoa leva os turnos dela');

select * from finish();
rollback;
