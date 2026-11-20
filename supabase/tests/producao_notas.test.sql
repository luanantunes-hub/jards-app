-- PD1.6: notas da data (producao_notas).
--
-- Quem lê e quem grava a nota (administrador, colaborador, leitor, recorte "só onde está vinculado"
-- sem vínculo, outra organização, visitante), a produção só para leitura, a coerência com a data, a
-- forma dos dados, o histórico e o que acontece ao apagar (pelo catálogo, sem DELETE).
-- Ids 0d220000-0000-4000-8000-0000000000XX, ou nt.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: temporada T (21), data D (41); nota N1 (61), outra data D2 (42); a1 admin, a2 colaborador,
--   a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.
--   B (b0), cortesia: temporada (2b), data (4b); b1 admin.  C (c0), produção só para leitura: data (4c),
--   nota (6c); c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_notas na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

create schema nt;
grant usage on schema nt to authenticated, anon;

create function nt.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d220000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select nt.id(s), 'nt-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (nt.id('a0'), 'NT A'), (nt.id('b0'), 'NT B'), (nt.id('c0'), 'NT C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (nt.id('a0'), 'producao', 'cortesia', 20), (nt.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (nt.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = nt.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select nt.id(o), nt.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (nt.id('a0'), nt.id('a5'), false, 'vinculado');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (nt.id('21'), nt.id('a0'), 'circulacao', 'circula', 'teatro', 'NT T'), (nt.id('2b'), nt.id('b0'), 'circulacao', 'circula', 'teatro', 'NT TB'),
    (nt.id('2c'), nt.id('c0'), 'circulacao', 'circula', 'teatro', 'NT TC');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (nt.id('41'), nt.id('a0'), nt.id('21'), date '2026-12-05'), (nt.id('42'), nt.id('a0'), nt.id('21'), date '2026-12-06'), (nt.id('4b'), nt.id('b0'), nt.id('2b'), date '2026-12-05'),
    (nt.id('4c'), nt.id('c0'), nt.id('2c'), date '2026-12-05');
  insert into public.producao_notas (id, organization_id, data_id, texto) values
    (nt.id('61'), nt.id('a0'), nt.id('41'), 'Combinar a van com o produtor'),
    (nt.id('6c'), nt.id('c0'), nt.id('4c'), 'Nota da C');
end
$dados$;

create function nt.tenta(comando text) returns text language plpgsql as $$
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

create function nt.efeito(comando text) returns text language plpgsql as $$
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

create function nt.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_notas where organization_id = nt.id(o || '0'))::text;
$$;

create function nt.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', nt.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function nt.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_notas'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select is((select relrowsecurity from pg_class where oid = 'public.producao_notas'::regclass), true, 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_notas'::regclass),
          'producao_notas_autor_fkey=n, producao_notas_data_id_fkey=c, producao_notas_organization_id_fkey=c', 'a nota sai com a data e com a organização; apagar quem escreveu só limpa o autor');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_nota_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_notas', 'select'), 'a coerência não é chamável e o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_notas'::regclass),
          'producao_notas_coerencia producao_notas_historico producao_notas_updated_at', 'os três gatilhos');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select nt.como('a1');
select is(nt.ve('a'), '1', 'administrador lê');
select nt.como('a2');
select is(nt.ve('a'), '1', 'colaborador lê');
select nt.como('a3');
select is(nt.ve('a'), '1', 'leitor lê');
select nt.como('a5');
select is(nt.ve('a'), '0', 'recorte "vinculado" sem vínculo não vê a data, então não vê a nota');
select nt.como('b1');
select is(nt.ve('a'), '0', 'outra organização não lê');
select nt.como('c1');
select is(nt.ve('c'), '1', 'produção só para leitura lê');
select nt.como(null);
select is(nt.efeito('select 1 from public.producao_notas'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select nt.como('a2');
select is(nt.tenta(format('insert into public.producao_notas (organization_id, data_id, texto) values (%L, %L, %L)',
                          nt.id('a0'), nt.id('41'), 'O contratante pediu o rider até sexta')), 'aceito', 'colaborador cria a nota');
select is(nt.efeito(format('update public.producao_notas set texto = %L where id = %L', 'Van confirmada', nt.id('61'))), 'sim', 'colaborador altera');
select nt.como('a3');
select ok(nt.tenta(format('insert into public.producao_notas (organization_id, data_id, texto) values (%L, %L, %L)', nt.id('a0'), nt.id('41'), 'x')) like '42501%',
          'leitor não cria');
select nt.como('c1');
select ok(nt.tenta(format('insert into public.producao_notas (organization_id, data_id, texto) values (%L, %L, %L)', nt.id('c0'), nt.id('4c'), 'x')) like '42501%',
          'produção só para leitura não grava');
select nt.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            nt.tenta(format('insert into public.producao_notas (organization_id, data_id, texto) values (%L, %L, %L)', nt.id('a0'), nt.id('41'), ' ')),
            nt.tenta(format('insert into public.producao_notas (organization_id, data_id, texto) values (%L, %L, %L)', nt.id('a0'), nt.id('41'), repeat('a', 4001))),
            nt.tenta(format('insert into public.producao_notas (organization_id, data_id, texto) values (%L, %L, %L)', nt.id('a0'), nt.id('4b'), 'x')),
            nt.tenta(format('update public.producao_notas set organization_id = %L where id = %L', nt.id('b0'), nt.id('61'))),
            nt.tenta(format('update public.producao_notas set data_id = %L where id = %L', nt.id('42'), nt.id('61')))],
          array['23514 producao_notas_texto_check', '23514 producao_notas_texto_check', '23514 data_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 data_nao_muda'],
          'texto de 1 a 4000 letras, data da mesma organização, organização e data fixas');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_notas set texto = 'Van 15 lugares' where id = nt.id('61');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade_id = nt.id('61') and acao = 'alterou'),
          'texto', 'mudar o texto deixa uma linha de histórico');
select nt.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_notas' and entidade_id = nt.id('61')) > 0, 'quem lê a nota lê o histórico dela');
select nt.volta();

select * from finish();
rollback;
