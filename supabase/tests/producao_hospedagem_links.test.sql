-- PD8.6 (primeiro corte): o link público da lista de quartos de uma hospedagem (producao_hospedagem_links).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção
-- só para leitura e visitante); o hash do código, que o navegador não lê; gerar o link (só o hash fica guardado, o código tem 43 letras,
-- a validade vai de 1 a 90 dias, padrão 30); revogar; a forma e a coerência; e as chaves. Ids
-- 0d310000-0000-4000-8000-0000000000XX, ou hl.id('XX'). Desfeito no fim.
--   A (a0), cortesia: temporada 21, hospedagem 61, link 71.  a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.
--   B (b0): temporada 2b, hospedagem 6b; b1 admin.  C (c0), produção só para leitura: temporada 2c, hospedagem 6c, link 7c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_hospedagem_links na frente se não estiver aplicada. A seção "Chaves" usa DELETE:
-- rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

create schema hl;
grant usage on schema hl to authenticated, anon;

create function hl.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d310000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select hl.id(s), 'hl-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (hl.id('a0'), 'HL A'), (hl.id('b0'), 'HL B'), (hl.id('c0'), 'HL C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (hl.id('a0'), 'producao', 'cortesia', 20), (hl.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (hl.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = hl.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select hl.id(o), hl.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (hl.id('a0'), hl.id('a5'), false, 'vinculado');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (hl.id('21'), hl.id('a0'), 'circulacao', 'circula', 'teatro', 'HL T'), (hl.id('2b'), hl.id('b0'), 'circulacao', 'circula', 'teatro', 'HL TB'),
    (hl.id('2c'), hl.id('c0'), 'circulacao', 'circula', 'teatro', 'HL TC');
  insert into public.producao_hospedagens (id, organization_id, temporada_id, hotel) values
    (hl.id('61'), hl.id('a0'), hl.id('21'), 'Hotel Central'), (hl.id('6b'), hl.id('b0'), hl.id('2b'), 'Hotel B'), (hl.id('6c'), hl.id('c0'), hl.id('2c'), 'Hotel C');
  insert into public.producao_hospedagem_links (id, organization_id, hospedagem_id, token_hash, expira_em) values
    (hl.id('71'), hl.id('a0'), hl.id('61'), repeat('a', 64), now() + interval '30 days'),
    (hl.id('7c'), hl.id('c0'), hl.id('6c'), repeat('c', 64), now() + interval '30 days');
end
$dados$;

create function hl.tenta(comando text) returns text language plpgsql as $$
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

create function hl.efeito(comando text) returns text language plpgsql as $$
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

create function hl.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_hospedagem_links where organization_id = hl.id(o || '0'))::text;
$$;

create function hl.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', hl.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function hl.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

create temp table hl_ids (nome text primary key, valor text);
grant all on hl_ids to authenticated;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_hospedagem_links'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_hospedagem_links'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_hospedagem_links'::regclass),
          'producao_hospedagem_links_criado_por_fkey=n, producao_hospedagem_links_hospedagem_id_fkey=c, producao_hospedagem_links_organization_id_fkey=c',
          'o link sai com a hospedagem e a organização; apagar quem criou só solta o autor');
select ok(not has_column_privilege('authenticated', 'public.producao_hospedagem_links', 'token_hash', 'select')
          and not has_table_privilege('anon', 'public.producao_hospedagem_links', 'select'), 'o navegador não lê o hash do código e o visitante não toca na tabela');
select ok(not has_function_privilege('anon', 'public.fn_producao_hospedagem_criar_link(uuid, integer)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_hospedagem_link_coerencia()', 'execute'), 'o visitante não gera link e a coerência não é chamável');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_hospedagem_links'::regclass),
          'producao_hospedagem_links_coerencia producao_hospedagem_links_updated_at', 'os dois gatilhos (sem histórico: o hash é segredo)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select hl.como('a1');
select is(hl.ve('a'), '1', 'administrador lê os links');
select hl.como('a2');
select is(hl.ve('a'), '1', 'colaborador lê os links');
select hl.como('a3');
select is(hl.ve('a'), '1', 'leitor lê os links');
select hl.como('a5');
select is(hl.ve('a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select hl.como('b1');
select is(hl.ve('a'), '0', 'outra organização não lê');
select hl.como('c1');
select is(hl.ve('c'), '1', 'produção só para leitura lê');
select hl.como(null);
select is(hl.efeito('select 1 from public.producao_hospedagem_links'), '', 'visitante não lê');

-- ─── Gerar e revogar ────────────────────────────────────────────────────────

select hl.como('a2');
insert into hl_ids select 'codigo', public.fn_producao_hospedagem_criar_link(hl.id('61'), 7);
insert into hl_ids select 'padrao', public.fn_producao_hospedagem_criar_link(hl.id('61'), null);
select is(hl.tenta(format('select token_hash from public.producao_hospedagem_links where hospedagem_id = %L', hl.id('61'))), '42501 permission denied for table producao_hospedagem_links', 'o navegador não lê o hash');
select hl.volta();
select is((select length(valor) from hl_ids where nome = 'codigo'), 43, 'o código do link tem 43 letras');
select is((select token_hash = encode(extensions.digest((select valor from hl_ids where nome = 'codigo'), 'sha256'), 'hex') and criado_por = hl.id('a2')
                  and expira_em between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour'
           from public.producao_hospedagem_links where hospedagem_id = hl.id('61') and expira_em < now() + interval '8 days' and id <> hl.id('71')),
          true, 'o banco guarda só o hash, quem criou e a validade pedida (7 dias)');
select is((select count(*)::int from public.producao_hospedagem_links where hospedagem_id = hl.id('61') and expira_em between now() + interval '29 days 23 hours' and now() + interval '30 days 1 hour' and id <> hl.id('71')),
          1, 'sem validade informada, vale 30 dias');
select is(array[hl.tenta(format('select public.fn_producao_hospedagem_criar_link(%L, %s)', hl.id('61'), 91)), hl.tenta(format('select public.fn_producao_hospedagem_criar_link(%L, %s)', hl.id('61'), -1))],
          array['P0001 validade_invalida', 'P0001 validade_invalida'], 'a validade vai de 1 a 90 dias');
select hl.como('a3');
select ok(hl.tenta(format('select public.fn_producao_hospedagem_criar_link(%L, %s)', hl.id('61'), 7)) like '42501%', 'leitor não gera o link');
select hl.como('c1');
select ok(hl.tenta(format('select public.fn_producao_hospedagem_criar_link(%L, %s)', hl.id('6c'), 7)) like '42501%', 'produção só para leitura não gera');
select hl.como('a5');
select ok(hl.tenta(format('select public.fn_producao_hospedagem_criar_link(%L, %s)', hl.id('61'), 7)) like 'P0002%', 'o recorte sem vínculo nem enxerga a hospedagem');
select hl.como('a2');
select is(hl.efeito(format('update public.producao_hospedagem_links set revogado_em = now() where id = %L', hl.id('71'))), 'sim', 'colaborador revoga o link');
select hl.como('a3');
select is(hl.efeito(format('update public.producao_hospedagem_links set revogado_em = now() where id = %L', hl.id('71'))), '', 'leitor não revoga');
select hl.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            hl.tenta(format('insert into public.producao_hospedagem_links (organization_id, hospedagem_id, token_hash, expira_em) values (%L, %L, %L, now())', hl.id('a0'), hl.id('61'), 'abc')),
            hl.tenta(format('insert into public.producao_hospedagem_links (organization_id, hospedagem_id, token_hash, expira_em) values (%L, %L, %L, now())', hl.id('a0'), hl.id('61'), repeat('a', 64))),
            hl.tenta(format('insert into public.producao_hospedagem_links (organization_id, hospedagem_id, token_hash, expira_em) values (%L, %L, %L, now())', hl.id('a0'), hl.id('6b'), repeat('d', 64))),
            hl.tenta(format('update public.producao_hospedagem_links set organization_id = %L where id = %L', hl.id('b0'), hl.id('71'))),
            hl.tenta(format('update public.producao_hospedagem_links set hospedagem_id = %L where id = %L', hl.id('6b'), hl.id('71')))],
          array['23514 producao_hospedagem_links_token_hash_formato_check', '23505 producao_hospedagem_links_token_hash_key',
                '23514 hospedagem_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 hospedagem_nao_muda'],
          'hash (formato e único); hospedagem da organização; organização e hospedagem fixas');

-- ─── Chaves ─────────────────────────────────────────────────────────────────

delete from public.producao_hospedagens where id = hl.id('61');
select is((select count(*)::int from public.producao_hospedagem_links where hospedagem_id = hl.id('61')), 0, 'apagar a hospedagem leva os links dela');

select * from finish();
rollback;
