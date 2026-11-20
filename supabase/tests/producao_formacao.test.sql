-- PD7.10 (primeiro corte): formação (producao_turmas, producao_turma_aulas, producao_matriculas e producao_presencas).
--
-- Quem lê e quem grava (colaborador, leitor, o recorte "só onde está vinculado", outra organização, produção só para leitura e
-- visitante), a forma dos dados, as vagas da turma, a coerência (aula, matrícula e turma) e o certificado, que o banco só deixa emitir para
-- matrícula confirmada, de turma não cancelada, com aulas realizadas e a frequência mínima; e o histórico, que deixa o contato de fora.
-- Ids 0d3b0000-0000-4000-8000-0000000000XX, ou tf.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: turma c1 (vagas 2, frequência mínima 75), c2 (cancelada), c3 (só aula no futuro); aulas e1, e2, e3 (passadas) e e4 (futura)
--   em c1, e5 (passada) em c2, e6 (futura) em c3; matrículas d1 (c1, confirmada, presente nas 3 aulas passadas), d2 (c1, inscrita, presente em 1),
--   d3 (c1, desistente), d5 (c2, confirmada), d6 (c3, confirmada); a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado".
--   B (b0): b1 admin, turma cb, aula eb, matrícula db.  C (c0), produção só para leitura: c1 colaborador, turma cc, aula ec, matrícula dc.
-- Rodar: supabase/tests/README.md, com a migration producao_formacao na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

create schema tf;
grant usage on schema tf to authenticated, anon;

create function tf.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d3b0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tf.id(s), 'tf-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (tf.id('a0'), 'TF A'), (tf.id('b0'), 'TF B'), (tf.id('c0'), 'TF C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tf.id('a0'), 'producao', 'cortesia', 20), (tf.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (tf.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = tf.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tf.id(o), tf.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (tf.id('a0'), tf.id('a5'), false, 'vinculado');
  insert into public.producao_turmas (id, organization_id, nome, vagas, frequencia_minima, situacao) values
    (tf.id('c1'), tf.id('a0'), 'TF Oficina', 2, 75, 'em_andamento'), (tf.id('c2'), tf.id('a0'), 'TF Cancelada', null, 75, 'cancelada'),
    (tf.id('c3'), tf.id('a0'), 'TF Futura', null, 75, 'aberta'), (tf.id('cb'), tf.id('b0'), 'TF B', null, 75, 'aberta'), (tf.id('cc'), tf.id('c0'), 'TF C', null, 75, 'aberta');
  insert into public.producao_turma_aulas (id, organization_id, turma_id, dia, inicio, fim) values
    (tf.id('e1'), tf.id('a0'), tf.id('c1'), date '2020-01-01', time '10:00', time '12:00'),
    (tf.id('e2'), tf.id('a0'), tf.id('c1'), date '2020-01-02', time '10:00', time '12:00'),
    (tf.id('e3'), tf.id('a0'), tf.id('c1'), date '2020-01-03', time '10:00', time '12:00'),
    (tf.id('e4'), tf.id('a0'), tf.id('c1'), date '2099-01-01', time '10:00', time '12:00'),
    (tf.id('e5'), tf.id('a0'), tf.id('c2'), date '2020-01-01', time '10:00', time '12:00'),
    (tf.id('e6'), tf.id('a0'), tf.id('c3'), date '2099-01-01', time '10:00', time '12:00'),
    (tf.id('eb'), tf.id('b0'), tf.id('cb'), date '2020-01-01', time '10:00', time '12:00'),
    (tf.id('ec'), tf.id('c0'), tf.id('cc'), date '2020-01-01', time '10:00', time '12:00');
  insert into public.producao_matriculas (id, organization_id, turma_id, nome, email, situacao) values
    (tf.id('d1'), tf.id('a0'), tf.id('c1'), 'TF Aluna Um', 'um@exemplo.test', 'confirmado'),
    (tf.id('d2'), tf.id('a0'), tf.id('c1'), 'TF Aluno Dois', null, 'inscrito'),
    (tf.id('d3'), tf.id('a0'), tf.id('c1'), 'TF Aluno Três', null, 'desistente'),
    (tf.id('d5'), tf.id('a0'), tf.id('c2'), 'TF Aluna Cinco', null, 'confirmado'),
    (tf.id('d6'), tf.id('a0'), tf.id('c3'), 'TF Aluno Seis', null, 'confirmado'),
    (tf.id('db'), tf.id('b0'), tf.id('cb'), 'TF Aluna B', null, 'confirmado'),
    (tf.id('dc'), tf.id('c0'), tf.id('cc'), 'TF Aluna C', null, 'confirmado');
  insert into public.producao_presencas (organization_id, aula_id, matricula_id, presente) values
    (tf.id('a0'), tf.id('e1'), tf.id('d1'), true), (tf.id('a0'), tf.id('e2'), tf.id('d1'), true), (tf.id('a0'), tf.id('e3'), tf.id('d1'), true),
    (tf.id('a0'), tf.id('e1'), tf.id('d2'), true), (tf.id('a0'), tf.id('e2'), tf.id('d2'), false),
    (tf.id('c0'), tf.id('ec'), tf.id('dc'), true);
end
$dados$;

create function tf.tenta(comando text) returns text language plpgsql as $$
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

create function tf.efeito(comando text) returns text language plpgsql as $$
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

-- Quantas linhas a pessoa lê de cada tabela da organização: turmas, aulas, matrículas e presenças.
create function tf.ve(o text) returns text language plpgsql as $$
declare t bigint; a bigint; m bigint; p bigint;
begin
  select count(*) into t from public.producao_turmas where organization_id = tf.id(o || '0');
  select count(*) into a from public.producao_turma_aulas where organization_id = tf.id(o || '0');
  select count(*) into m from public.producao_matriculas where organization_id = tf.id(o || '0');
  select count(*) into p from public.producao_presencas where organization_id = tf.id(o || '0');
  return t || '|' || a || '|' || m || '|' || p;
end;
$$;

create function tf.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tf.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tf.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_turmas', 'producao_turma_aulas', 'producao_matriculas', 'producao_presencas')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 20, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_turmas'::regclass, 'public.producao_turma_aulas'::regclass, 'public.producao_matriculas'::regclass, 'public.producao_presencas'::regclass) and relrowsecurity), 4, 'segurança por linha ligada nas quatro');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_turmas'::regclass, 'public.producao_turma_aulas'::regclass, 'public.producao_matriculas'::regclass, 'public.producao_presencas'::regclass)),
          'producao_matriculas.producao_matriculas_organization_id_fkey=c, producao_matriculas.producao_matriculas_turma_id_fkey=c, producao_presencas.producao_presencas_aula_id_fkey=c, '
          || 'producao_presencas.producao_presencas_matricula_id_fkey=c, producao_presencas.producao_presencas_organization_id_fkey=c, producao_turma_aulas.producao_turma_aulas_organization_id_fkey=c, '
          || 'producao_turma_aulas.producao_turma_aulas_turma_id_fkey=c, producao_turmas.producao_turmas_organization_id_fkey=c',
          'tudo sai com a turma e com a organização');
select ok(not has_table_privilege('anon', 'public.producao_matriculas', 'select')
          and not has_function_privilege('authenticated', 'public.fn_producao_matricula_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_presenca_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_turma_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_turma_aula_coerencia()', 'execute'),
          'o visitante não toca nas tabelas e ninguém executa as coerências');
select is((select count(*)::int from pg_trigger where tgrelid in ('public.producao_turmas'::regclass, 'public.producao_turma_aulas'::regclass, 'public.producao_matriculas'::regclass, 'public.producao_presencas'::regclass) and not tgisinternal), 11,
          'onze gatilhos: coerência e updated_at nas quatro, histórico em turmas, aulas e matrículas');

-- ─── Quem lê ────────────────────────────────────────────────────────────────

select tf.como('a2');
select is(tf.ve('a'), '3|6|5|5', 'colaborador lê turmas, aulas, matrículas e presenças');
select tf.como('a3');
select is(tf.ve('a'), '3|6|5|5', 'leitor lê');
select tf.como('a5');
select is(tf.ve('a'), '0|0|0|0', 'o recorte "vinculado" sem vínculo não lê');
select tf.como('b1');
select is(tf.ve('a') || '/' || tf.ve('b'), '0|0|0|0/1|1|1|0', 'outra organização só lê o que é dela');
select tf.como('c1');
select is(tf.ve('c'), '1|1|1|1', 'produção só para leitura lê');
select tf.como(null);
select is(tf.efeito('select 1 from public.producao_turmas'), '', 'visitante não lê');
select tf.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select tf.como('a2');
select is(tf.tenta(format('insert into public.producao_turmas (organization_id, nome) values (%L, %L)', tf.id('a0'), 'TF Nova')), 'aceito', 'colaborador cria a turma');
select tf.como('a3');
select ok(tf.tenta(format('insert into public.producao_turmas (organization_id, nome) values (%L, %L)', tf.id('a0'), 'TF Nova')) like '42501%', 'leitor não grava');
select tf.como('a5');
select ok(tf.tenta(format('insert into public.producao_turmas (organization_id, nome) values (%L, %L)', tf.id('a0'), 'TF Nova')) like '42501%', 'o recorte sem vínculo não grava');
select tf.como('c1');
select ok(tf.tenta(format('insert into public.producao_turmas (organization_id, nome) values (%L, %L)', tf.id('c0'), 'TF Nova')) like '42501%', 'produção só para leitura não grava');
select tf.como('b1');
select is(tf.efeito(format('update public.producao_matriculas set nome = %L where id = %L', 'invasor', tf.id('d1'))), '', 'outra organização não altera');
select tf.volta();

-- ─── As vagas ───────────────────────────────────────────────────────────────

select is(array[
            tf.tenta(format('insert into public.producao_matriculas (organization_id, turma_id, nome) values (%L, %L, %L)', tf.id('a0'), tf.id('c1'), 'TF Nova pessoa')),
            tf.tenta(format('update public.producao_matriculas set situacao = %L where id = %L', 'inscrito', tf.id('d3'))),
            tf.tenta(format('insert into public.producao_matriculas (organization_id, turma_id, nome, situacao) values (%L, %L, %L, %L)', tf.id('a0'), tf.id('c1'), 'TF Desistente', 'desistente')),
            tf.tenta(format('update public.producao_matriculas set nome = %L where id = %L', 'TF Aluno Dois (editado)', tf.id('d2')))],
          array['23514 vagas_esgotadas', '23514 vagas_esgotadas', 'aceito', 'aceito'],
          'as vagas valem (2 de 2; o desistente não conta e quem volta de desistente também confere); editar quem já está não confere');

-- ─── O certificado ──────────────────────────────────────────────────────────

select is(array[
            tf.tenta(format('update public.producao_matriculas set certificado_emitido_em = now() where id = %L', tf.id('d1'))),
            tf.tenta(format('update public.producao_matriculas set certificado_emitido_em = now() where id = %L', tf.id('d2'))),
            tf.tenta(format('update public.producao_matriculas set certificado_emitido_em = now() where id = %L', tf.id('d5'))),
            tf.tenta(format('update public.producao_matriculas set certificado_emitido_em = now() where id = %L', tf.id('d6'))),
            tf.tenta(format('update public.producao_matriculas set situacao = %L, certificado_emitido_em = now() where id = %L', 'confirmado', tf.id('d2'))),
            tf.tenta(format('insert into public.producao_matriculas (organization_id, turma_id, nome, situacao, certificado_emitido_em) values (%L, %L, %L, %L, now())', tf.id('a0'), tf.id('c3'), 'TF Com certificado', 'confirmado'))],
          array['aceito', '23514 matricula_nao_confirmada', '23514 turma_cancelada', '23514 sem_aulas_realizadas', '23514 frequencia_insuficiente', '23514 matricula_nao_confirmada'],
          'certificado: confirmada com 3 de 3 aulas pode; inscrita, turma cancelada, sem aula realizada, 1 de 3 (33%) e matrícula já nascida com certificado, não');
update public.producao_matriculas set certificado_emitido_em = now() where id = tf.id('d1');
select ok((select certificado_emitido_em is not null from public.producao_matriculas where id = tf.id('d1')), 'o certificado fica gravado');
select is(tf.tenta(format('update public.producao_matriculas set certificado_emitido_em = null where id = %L', tf.id('d1'))), 'aceito', 'tirar o certificado é livre');

-- ─── A presença ─────────────────────────────────────────────────────────────

select is(array[
            tf.tenta(format('insert into public.producao_presencas (organization_id, aula_id, matricula_id) values (%L, %L, %L)', tf.id('a0'), tf.id('e5'), tf.id('d1'))),
            tf.tenta(format('insert into public.producao_presencas (organization_id, aula_id, matricula_id) values (%L, %L, %L)', tf.id('a0'), tf.id('e1'), tf.id('d1'))),
            tf.tenta(format('insert into public.producao_presencas (organization_id, aula_id, matricula_id) values (%L, %L, %L)', tf.id('a0'), tf.id('e3'), tf.id('d2'))),
            tf.tenta(format('update public.producao_presencas set aula_id = %L where aula_id = %L and matricula_id = %L', tf.id('e3'), tf.id('e1'), tf.id('d1'))),
            tf.tenta(format('update public.producao_presencas set matricula_id = %L where aula_id = %L and matricula_id = %L', tf.id('d2'), tf.id('e1'), tf.id('d1'))),
            tf.tenta(format('update public.producao_presencas set organization_id = %L where aula_id = %L and matricula_id = %L', tf.id('b0'), tf.id('e1'), tf.id('d1')))],
          array['23514 aula_e_matricula_de_turmas_diferentes', '23505 producao_presencas_par_key', 'aceito', '23514 aula_nao_muda', '23514 matricula_nao_muda', '23514 organizacao_nao_muda'],
          'a aula e a matrícula são da mesma turma; uma marca por par; a aula, a matrícula e a organização não mudam');

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            tf.tenta(format('insert into public.producao_turmas (organization_id, nome) values (%L, %L)', tf.id('a0'), ' ')),
            tf.tenta(format('insert into public.producao_turmas (organization_id, nome, inicio, fim) values (%L, %L, %L, %L)', tf.id('a0'), 'x', '2026-12-10', '2026-12-01')),
            tf.tenta(format('insert into public.producao_turmas (organization_id, nome, vagas) values (%L, %L, 0)', tf.id('a0'), 'x')),
            tf.tenta(format('insert into public.producao_turmas (organization_id, nome, frequencia_minima) values (%L, %L, 101)', tf.id('a0'), 'x')),
            tf.tenta(format('insert into public.producao_turmas (organization_id, nome, situacao) values (%L, %L, %L)', tf.id('a0'), 'x', 'talvez')),
            tf.tenta(format('update public.producao_turmas set organization_id = %L where id = %L', tf.id('b0'), tf.id('c1'))),
            tf.tenta(format('insert into public.producao_turma_aulas (organization_id, turma_id, dia, inicio, fim) values (%L, %L, %L, %L, %L)', tf.id('a0'), tf.id('c1'), '2026-12-10', '12:00', '10:00')),
            tf.tenta(format('insert into public.producao_turma_aulas (organization_id, turma_id, dia, inicio, fim) values (%L, %L, %L, %L, %L)', tf.id('a0'), tf.id('c1'), '2020-01-01', '10:00', '11:00')),
            tf.tenta(format('insert into public.producao_turma_aulas (organization_id, turma_id, dia, inicio, fim) values (%L, %L, %L, %L, %L)', tf.id('a0'), tf.id('cb'), '2026-12-10', '10:00', '11:00')),
            tf.tenta(format('update public.producao_turma_aulas set turma_id = %L where id = %L', tf.id('c3'), tf.id('e1'))),
            tf.tenta(format('insert into public.producao_matriculas (organization_id, turma_id, nome) values (%L, %L, %L)', tf.id('a0'), tf.id('c3'), ' ')),
            tf.tenta(format('insert into public.producao_matriculas (organization_id, turma_id, nome, email) values (%L, %L, %L, %L)', tf.id('a0'), tf.id('c3'), 'x', 'sem-arroba')),
            tf.tenta(format('insert into public.producao_matriculas (organization_id, turma_id, nome, telefone) values (%L, %L, %L, %L)', tf.id('a0'), tf.id('c3'), 'x', '123')),
            tf.tenta(format('insert into public.producao_matriculas (organization_id, turma_id, nome, situacao) values (%L, %L, %L, %L)', tf.id('a0'), tf.id('c3'), 'x', 'talvez')),
            tf.tenta(format('insert into public.producao_matriculas (organization_id, turma_id, nome, email, situacao) values (%L, %L, %L, %L, %L)', tf.id('a0'), tf.id('c1'), 'x', 'UM@exemplo.test', 'desistente')),
            tf.tenta(format('insert into public.producao_matriculas (organization_id, turma_id, nome) values (%L, %L, %L)', tf.id('a0'), tf.id('cb'), 'x')),
            tf.tenta(format('update public.producao_matriculas set turma_id = %L where id = %L', tf.id('c3'), tf.id('d1')))],
          array['23514 producao_turmas_nome_check', '23514 producao_turmas_periodo_check', '23514 producao_turmas_vagas_check', '23514 producao_turmas_frequencia_check', '23514 producao_turmas_situacao_check',
                '23514 organizacao_nao_muda', '23514 producao_turma_aulas_horas_check', '23505 producao_turma_aulas_unica_key', '23514 turma_de_outra_organizacao', '23514 turma_nao_muda',
                '23514 producao_matriculas_nome_check', '23514 producao_matriculas_email_check', '23514 producao_matriculas_telefone_check', '23514 producao_matriculas_situacao_check',
                '23505 producao_matriculas_email_idx', '23514 turma_de_outra_organizacao', '23514 turma_nao_muda'],
          'turma (nome, período, vagas, frequência, situação), aula (horas, única, turma da organização), matrícula (nome, e-mail, telefone, situação, e-mail único na turma) e o que não muda');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_matriculas set nome = 'TF Aluna Um (nova)', email = 'novo@exemplo.test', telefone = '(11) 98888-0000' where id = tf.id('d1');
select is((select string_agg(distinct campo, ',' order by campo) from public.producao_historico where entidade_id = tf.id('d1') and acao = 'alterou'),
          'certificado_emitido_em,nome', 'o histórico guarda o nome e quando o certificado saiu, e deixa o e-mail e o telefone de fora');
select tf.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_matriculas' and entidade_id = tf.id('d1')) > 0, 'quem lê a matrícula lê o histórico dela');
select tf.volta();

select * from finish();
rollback;
