-- PD7.1 (primeiro corte): roteiro ao vivo (producao_blocos.iniciado_em e terminado_em).
--
-- Quem marca o começo e o fim de um bloco (colaborador sim; leitor, outra organização e visitante não), a conferência (terminar exige
-- ter começado, e nunca antes), o que fica no histórico do bloco e que o bloco antigo continua válido sem as marcas.
-- Ids 0d330000-0000-4000-8000-0000000000XX, ou rv.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: temporada 21, data 41, blocos 61 e 62; a2 colaborador, a3 leitor.  B (b0), cortesia: b1 admin.
-- Rodar: supabase/tests/README.md, com a migration producao_roteiro_ao_vivo na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

create schema rv;
grant usage on schema rv to authenticated, anon;

create function rv.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d330000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select rv.id(s), 'rv-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'b1']) as s;
  insert into public.organizations (id, nome) values (rv.id('a0'), 'RV A'), (rv.id('b0'), 'RV B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (rv.id('a0'), 'producao', 'cortesia', 20), (rv.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select rv.id(o), rv.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values (rv.id('21'), rv.id('a0'), 'circulacao', 'circula', 'teatro', 'RV T');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values (rv.id('41'), rv.id('a0'), rv.id('21'), date '2026-12-05');
  insert into public.producao_blocos (id, organization_id, data_id, dia, inicio, fim, tipo, titulo) values
    (rv.id('61'), rv.id('a0'), rv.id('41'), date '2026-12-05', timestamptz '2026-12-05 14:00-03', timestamptz '2026-12-05 15:00-03', 'ensaio', 'Ensaio'),
    (rv.id('62'), rv.id('a0'), rv.id('41'), date '2026-12-05', timestamptz '2026-12-05 15:00-03', timestamptz '2026-12-05 16:00-03', 'carga', 'Carga');
end
$dados$;

create function rv.tenta(comando text) returns text language plpgsql as $$
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

create function rv.efeito(comando text) returns text language plpgsql as $$
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

create function rv.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', rv.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function rv.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── As colunas e a conferência ─────────────────────────────────────────────

select is((select string_agg(column_name::text || '=' || is_nullable, ', ' order by column_name::text collate "C") from information_schema.columns
           where table_schema = 'public' and table_name = 'producao_blocos' and column_name in ('iniciado_em', 'terminado_em')),
          'iniciado_em=YES, terminado_em=YES', 'as duas colunas existem e nascem vazias (o bloco antigo segue válido)');
select ok((select count(*) from public.producao_blocos where id in (rv.id('61'), rv.id('62')) and iniciado_em is null and terminado_em is null) = 2, 'os blocos já gravados ficam sem marcas');
select is(array[
            rv.tenta(format('update public.producao_blocos set terminado_em = now() where id = %L', rv.id('61'))),
            rv.tenta(format('update public.producao_blocos set iniciado_em = %L, terminado_em = %L where id = %L', '2026-12-05 15:00-03', '2026-12-05 14:30-03', rv.id('61'))),
            rv.tenta(format('update public.producao_blocos set iniciado_em = %L, terminado_em = %L where id = %L', '2026-12-05 14:05-03', '2026-12-05 15:10-03', rv.id('61'))),
            rv.tenta(format('update public.producao_blocos set iniciado_em = %L where id = %L', '2026-12-05 14:05-03', rv.id('61')))],
          array['23514 producao_blocos_execucao_check', '23514 producao_blocos_execucao_check', 'aceito', 'aceito'],
          'terminar sem ter começado e terminar antes de começar são recusados; começar e terminar depois valem');

-- ─── Quem marca ─────────────────────────────────────────────────────────────

select rv.como('a2');
select is(rv.efeito(format('update public.producao_blocos set iniciado_em = now() where id = %L', rv.id('62'))), 'sim', 'o colaborador marca o começo do bloco');
select rv.como('a3');
select is(rv.efeito(format('update public.producao_blocos set iniciado_em = now() where id = %L', rv.id('62'))), '', 'o leitor não marca');
select rv.como('b1');
select is(rv.efeito(format('update public.producao_blocos set iniciado_em = now() where id = %L', rv.id('62'))), '', 'outra organização não marca');
select rv.como(null);
select is(rv.efeito(format('update public.producao_blocos set iniciado_em = now() where id = %L', rv.id('62'))), '', 'o visitante não marca');
select rv.volta();

-- ─── O histórico do bloco ───────────────────────────────────────────────────

update public.producao_blocos set iniciado_em = timestamptz '2026-12-05 14:05-03' where id = rv.id('61');
select ok((select count(*) from public.producao_historico where entidade = 'producao_blocos' and entidade_id = rv.id('61') and campo = 'iniciado_em') > 0, 'marcar o começo deixa uma linha de histórico do bloco');
select rv.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_blocos' and entidade_id = rv.id('61') and campo = 'iniciado_em') > 0, 'quem lê o bloco lê o histórico dele');
select rv.volta();
select is(rv.tenta(format('update public.producao_blocos set iniciado_em = null, terminado_em = null where id = %L', rv.id('61'))), 'aceito', 'desfazer (voltar as duas marcas a vazio) vale');

select * from finish();
rollback;
