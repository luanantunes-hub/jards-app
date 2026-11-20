-- PD1.8: viagem e hospedagem do dia (producao_cartoes_dia).
--
-- Quem lê e quem grava o cartão (administrador, colaborador, leitor, recorte "só onde está vinculado"
-- sem vínculo, outra organização, visitante), a produção só para leitura, a coerência com a data, a
-- forma dos dados, o histórico (sem o localizador) e o que acontece ao apagar (pelo catálogo, sem DELETE).
-- Ids 0d1c0000-0000-4000-8000-0000000000XX, ou cd.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: temporada T (21), data D (41); cartão de viagem C1 (61); a1 admin, a2 colaborador,
--   a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.
--   B (b0), cortesia: temporada (2b), data (4b); b1 admin.  C (c0), produção só para leitura: data (4c),
--   cartão (6c); c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_cartoes_dia na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

create schema cd;
grant usage on schema cd to authenticated, anon;

create function cd.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d1c0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select cd.id(s), 'cd-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (cd.id('a0'), 'CD A'), (cd.id('b0'), 'CD B'), (cd.id('c0'), 'CD C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (cd.id('a0'), 'producao', 'cortesia', 20), (cd.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (cd.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = cd.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select cd.id(o), cd.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (cd.id('a0'), cd.id('a5'), false, 'vinculado');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (cd.id('21'), cd.id('a0'), 'circulacao', 'circula', 'teatro', 'CD T'), (cd.id('2b'), cd.id('b0'), 'circulacao', 'circula', 'teatro', 'CD TB'),
    (cd.id('2c'), cd.id('c0'), 'circulacao', 'circula', 'teatro', 'CD TC');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (cd.id('41'), cd.id('a0'), cd.id('21'), date '2026-12-05'), (cd.id('4b'), cd.id('b0'), cd.id('2b'), date '2026-12-05'),
    (cd.id('4c'), cd.id('c0'), cd.id('2c'), date '2026-12-05');
  insert into public.producao_cartoes_dia (id, organization_id, data_id, tipo, titulo, localizador) values
    (cd.id('61'), cd.id('a0'), cd.id('41'), 'viagem', 'Van da companhia', 'ABC123'),
    (cd.id('6c'), cd.id('c0'), cd.id('4c'), 'viagem', 'Van', 'XYZ');
end
$dados$;

create function cd.tenta(comando text) returns text language plpgsql as $$
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

create function cd.efeito(comando text) returns text language plpgsql as $$
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

create function cd.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_cartoes_dia where organization_id = cd.id(o || '0'))::text;
$$;

create function cd.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', cd.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function cd.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_cartoes_dia'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select is((select relrowsecurity from pg_class where oid = 'public.producao_cartoes_dia'::regclass), true, 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_cartoes_dia'::regclass),
          'producao_cartoes_dia_data_id_fkey=c, producao_cartoes_dia_organization_id_fkey=c', 'o cartão sai com a data e com a organização');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_cartao_dia_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_cartoes_dia', 'select'), 'a coerência não é chamável e o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_cartoes_dia'::regclass),
          'producao_cartoes_dia_coerencia producao_cartoes_dia_historico producao_cartoes_dia_updated_at', 'os três gatilhos');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select cd.como('a1');
select is(cd.ve('a'), '1', 'administrador lê');
select cd.como('a2');
select is(cd.ve('a'), '1', 'colaborador lê');
select cd.como('a3');
select is(cd.ve('a'), '1', 'leitor lê');
select cd.como('a5');
select is(cd.ve('a'), '0', 'recorte "vinculado" sem vínculo não vê a data, então não vê o cartão');
select cd.como('b1');
select is(cd.ve('a'), '0', 'outra organização não lê');
select cd.como('c1');
select is(cd.ve('c'), '1', 'produção só para leitura lê');
select cd.como(null);
select is(cd.efeito('select 1 from public.producao_cartoes_dia'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select cd.como('a2');
select is(cd.tenta(format('insert into public.producao_cartoes_dia (organization_id, data_id, tipo, titulo) values (%L, %L, %L, %L)',
                          cd.id('a0'), cd.id('41'), 'hospedagem', 'Hotel Central')), 'aceito', 'colaborador cria o cartão de hospedagem');
select is(cd.efeito(format('update public.producao_cartoes_dia set endereco = %L where id = %L', 'Av. Central, 900', cd.id('61'))), 'sim', 'colaborador altera');
select cd.como('a3');
select ok(cd.tenta(format('insert into public.producao_cartoes_dia (organization_id, data_id, tipo) values (%L, %L, %L)', cd.id('a0'), cd.id('41'), 'hospedagem')) like '42501%',
          'leitor não cria');
select cd.como('c1');
select ok(cd.tenta(format('insert into public.producao_cartoes_dia (organization_id, data_id, tipo) values (%L, %L, %L)', cd.id('c0'), cd.id('4c'), 'hospedagem')) like '42501%',
          'produção só para leitura não grava');
select cd.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            cd.tenta(format('insert into public.producao_cartoes_dia (organization_id, data_id, tipo) values (%L, %L, %L)', cd.id('a0'), cd.id('41'), 'viagem')),
            cd.tenta(format('insert into public.producao_cartoes_dia (organization_id, data_id, tipo) values (%L, %L, %L)', cd.id('a0'), cd.id('41'), 'transfer')),
            cd.tenta(format('insert into public.producao_cartoes_dia (organization_id, data_id, tipo, inicio, fim) values (%L, %L, %L, %L, %L)',
                            cd.id('a0'), cd.id('41'), 'hospedagem', '2026-12-05 20:00-03', '2026-12-05 19:00-03')),
            cd.tenta(format('insert into public.producao_cartoes_dia (organization_id, data_id, tipo, titulo) values (%L, %L, %L, %L)', cd.id('a0'), cd.id('41'), 'hospedagem', ' ')),
            cd.tenta(format('insert into public.producao_cartoes_dia (organization_id, data_id, tipo) values (%L, %L, %L)', cd.id('a0'), cd.id('4b'), 'hospedagem')),
            cd.tenta(format('update public.producao_cartoes_dia set organization_id = %L where id = %L', cd.id('b0'), cd.id('61')))],
          array['23505 producao_cartoes_dia_data_tipo_key', '23514 producao_cartoes_dia_tipo_check', '23514 producao_cartoes_dia_periodo_check',
                '23514 producao_cartoes_dia_titulo_check', '23514 data_de_outra_organizacao', '23514 organizacao_nao_muda'],
          'um de cada tipo por data, tipo da lista, fim depois do início, título não vazio, data da mesma organização, organização fixa');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_cartoes_dia set titulo = 'Van 15 lugares', localizador = 'ZZZ999' where id = cd.id('61');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade_id = cd.id('61') and acao = 'alterou'),
          'titulo', 'mudar título e localizador deixa só o título no histórico');
select is((select count(*)::int from public.producao_historico where organization_id = cd.id('a0') and (coalesce(antes, '') || coalesce(depois, '')) ~ '(ABC123|ZZZ999)'),
          0, 'o localizador não aparece em nenhuma linha do histórico');
select cd.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_cartoes_dia' and entidade_id = cd.id('61')) > 0, 'quem lê o cartão lê o histórico dele');
select cd.volta();

select * from finish();
rollback;
