-- PD7.8 (primeiro corte): ocorrências do dia (producao_ocorrencias).
--
-- Quem lê e quem grava (colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção só para
-- leitura e visitante), a forma dos dados (tipo e gravidade da lista, textos, resolução), a coerência (data da organização; o que não
-- muda), a hora da resolução carimbada pelo banco, e o histórico, que deixa a descrição e a providência de fora.
-- Ids 0d340000-0000-4000-8000-0000000000XX, ou oc.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: temporada 21, data 41, ocorrência 61; a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado".
--   B (b0), cortesia: temporada 2b, data 4b; b1 admin.  C (c0), produção só para leitura: temporada 2c, data 4c, ocorrência 6c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_ocorrencias na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

create schema oc;
grant usage on schema oc to authenticated, anon;

create function oc.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d340000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select oc.id(s), 'oc-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (oc.id('a0'), 'OC A'), (oc.id('b0'), 'OC B'), (oc.id('c0'), 'OC C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (oc.id('a0'), 'producao', 'cortesia', 20), (oc.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (oc.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = oc.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select oc.id(o), oc.id(p), papel, m::text[] from (values
    ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'), ('a0', 'a5', 'colaborador', '{producao}'),
    ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (oc.id('a0'), oc.id('a5'), false, 'vinculado');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (oc.id('21'), oc.id('a0'), 'circulacao', 'circula', 'teatro', 'OC T'), (oc.id('2b'), oc.id('b0'), 'circulacao', 'circula', 'teatro', 'OC TB'),
    (oc.id('2c'), oc.id('c0'), 'circulacao', 'circula', 'teatro', 'OC TC');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (oc.id('41'), oc.id('a0'), oc.id('21'), date '2026-12-05'), (oc.id('4b'), oc.id('b0'), oc.id('2b'), date '2026-12-05'), (oc.id('4c'), oc.id('c0'), oc.id('2c'), date '2026-12-05');
  insert into public.producao_ocorrencias (id, organization_id, data_id, tipo, gravidade, descricao, providencia) values
    (oc.id('61'), oc.id('a0'), oc.id('41'), 'tecnica', 'media', 'A mesa de som caiu no meio do ensaio', 'Troca pela reserva'),
    (oc.id('6c'), oc.id('c0'), oc.id('4c'), 'outro', 'baixa', 'Nota da C', null);
end
$dados$;

create function oc.tenta(comando text) returns text language plpgsql as $$
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

create function oc.efeito(comando text) returns text language plpgsql as $$
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

create function oc.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using oc.id(o || '0');
  return n::text;
end;
$$;

create function oc.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', oc.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function oc.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_ocorrencias'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select is((select count(*)::int from pg_class where oid = 'public.producao_ocorrencias'::regclass and relrowsecurity), 1, 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_ocorrencias'::regclass and confrelid <> 'auth.users'::regclass),
          'producao_ocorrencias_data_id_fkey=c, producao_ocorrencias_organization_id_fkey=c', 'a ocorrência sai com a data e com a organização');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_ocorrencia_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_ocorrencias', 'select'), 'a coerência não é chamável e o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_ocorrencias'::regclass),
          'producao_ocorrencias_coerencia producao_ocorrencias_historico producao_ocorrencias_updated_at', 'os gatilhos');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select oc.como('a2');
select is(oc.ve('producao_ocorrencias', 'a'), '1', 'colaborador lê');
select oc.como('a3');
select is(oc.ve('producao_ocorrencias', 'a'), '1', 'leitor lê');
select oc.como('a5');
select is(oc.ve('producao_ocorrencias', 'a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select oc.como('b1');
select is(oc.ve('producao_ocorrencias', 'a'), '0', 'outra organização não lê');
select oc.como('c1');
select is(oc.ve('producao_ocorrencias', 'c'), '1', 'produção só para leitura lê');
select oc.como(null);
select is(oc.efeito('select 1 from public.producao_ocorrencias'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select oc.como('a2');
select is(oc.tenta(format('insert into public.producao_ocorrencias (organization_id, data_id, descricao, criado_por) values (%L, %L, %L, %L)', oc.id('a0'), oc.id('41'), 'Porta travada', oc.id('a2'))), 'aceito', 'colaborador registra uma ocorrência');
select is(oc.efeito(format('update public.producao_ocorrencias set providencia = %L where id = %L', 'Chamado o técnico', oc.id('61'))), 'sim', 'colaborador anota a providência');
select oc.como('a3');
select ok(oc.tenta(format('insert into public.producao_ocorrencias (organization_id, data_id, descricao) values (%L, %L, %L)', oc.id('a0'), oc.id('41'), 'x')) like '42501%', 'leitor não registra');
select oc.como('c1');
select ok(oc.tenta(format('insert into public.producao_ocorrencias (organization_id, data_id, descricao) values (%L, %L, %L)', oc.id('c0'), oc.id('4c'), 'x')) like '42501%', 'produção só para leitura não grava');
select oc.como('a5');
select ok(oc.tenta(format('insert into public.producao_ocorrencias (organization_id, data_id, descricao) values (%L, %L, %L)', oc.id('a0'), oc.id('41'), 'x')) like '42501%', 'o recorte "vinculado" sem vínculo não registra');
select oc.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            oc.tenta(format('insert into public.producao_ocorrencias (organization_id, data_id, descricao, tipo) values (%L, %L, %L, %L)', oc.id('a0'), oc.id('41'), 'x', 'alienigena')),
            oc.tenta(format('insert into public.producao_ocorrencias (organization_id, data_id, descricao, gravidade) values (%L, %L, %L, %L)', oc.id('a0'), oc.id('41'), 'x', 'enorme')),
            oc.tenta(format('insert into public.producao_ocorrencias (organization_id, data_id, descricao) values (%L, %L, %L)', oc.id('a0'), oc.id('41'), ' ')),
            oc.tenta(format('insert into public.producao_ocorrencias (organization_id, data_id, descricao, providencia) values (%L, %L, %L, %L)', oc.id('a0'), oc.id('41'), 'x', ' ')),
            oc.tenta(format('insert into public.producao_ocorrencias (organization_id, data_id, descricao) values (%L, %L, %L)', oc.id('a0'), oc.id('4b'), 'x')),
            oc.tenta(format('update public.producao_ocorrencias set organization_id = %L where id = %L', oc.id('b0'), oc.id('61'))),
            oc.tenta(format('update public.producao_ocorrencias set data_id = %L where id = %L', oc.id('4b'), oc.id('61'))),
            oc.tenta(format('update public.producao_ocorrencias set resolvida_em = now() where id = %L', oc.id('61'))),
            oc.tenta(format('insert into public.producao_ocorrencias (organization_id, data_id, descricao, tipo, gravidade) values (%L, %L, %L, %L, %L)', oc.id('a0'), oc.id('41'), 'Queda de energia', 'tecnica', 'alta'))],
          array['23514 producao_ocorrencias_tipo_check', '23514 producao_ocorrencias_gravidade_check', '23514 producao_ocorrencias_descricao_check', '23514 producao_ocorrencias_providencia_check',
                '23514 data_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 data_nao_muda', '23514 producao_ocorrencias_resolucao_check', 'aceito'],
          'tipo, gravidade, textos, data da organização, o que não muda e hora de resolução só em ocorrência resolvida');

-- ─── A hora da resolução e o histórico ──────────────────────────────────────

select is(oc.tenta(format('do $x$ declare r timestamptz; begin insert into public.producao_ocorrencias (organization_id, data_id, descricao, resolvida) values (%L, %L, %L, true) returning resolvida_em into r; if r is null then raise exception %L; end if; end $x$',
                          oc.id('a0'), oc.id('41'), 'Já resolvida', 'sem_hora_ao_criar')), 'aceito', 'criada já resolvida, a hora da resolução é carimbada');
update public.producao_ocorrencias set resolvida = true where id = oc.id('61');
select ok((select resolvida_em is not null from public.producao_ocorrencias where id = oc.id('61')), 'resolver carimba a hora');
update public.producao_ocorrencias set resolvida = false where id = oc.id('61');
select ok((select resolvida_em is null from public.producao_ocorrencias where id = oc.id('61')), 'reabrir limpa a hora');
update public.producao_ocorrencias set gravidade = 'alta', descricao = 'Texto novo que não vai ao histórico', providencia = 'Outra providência' where id = oc.id('61');
select is((select string_agg(distinct campo, ',' order by campo) from public.producao_historico where entidade_id = oc.id('61') and acao = 'alterou' and campo in ('gravidade', 'descricao', 'providencia')),
          'gravidade', 'o histórico guarda a gravidade e deixa a descrição e a providência de fora');
select oc.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_ocorrencias' and entidade_id = oc.id('61')) > 0, 'quem lê a ocorrência lê o histórico dela');
select oc.volta();

select * from finish();
rollback;
