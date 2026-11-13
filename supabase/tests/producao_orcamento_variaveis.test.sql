-- PD5.2 (primeiro corte): variáveis e fórmulas do orçamento (producao_orcamento_variaveis e a coluna formula das linhas).
--
-- Dinheiro: só lê e escreve quem tem a permissão. Regras: nome curto em minúsculas (sem os nomes das funções), valor de 0 a 1 bilhão, nome único no orçamento;
-- as variáveis só mudam com o orçamento em rascunho; a fórmula da linha acompanha a estimativa (aprovado, não muda); sem histórico.
-- Ids 0d600000-0000-4000-8000-0000000000XX, ou ct.id('XX'). Cenário desfeito no fim.
--   A (a0): temporada t1; orçamentos c1 (rascunho: linha l1 com fórmula, variável v1 pessoas), c2 (aprovado: linha l2, variável v2); a1 administrador,
--   a2 colaborador com dinheiro, a3 colaborador sem dinheiro, a4 leitor com dinheiro.  B (b0): b1 admin, temporada tb, orçamento cb com a variável vb.
-- Rodar: supabase/tests/README.md, com as migrations producao_orcamento e producao_orcamento_variaveis na frente se não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

create schema ct;
grant usage on schema ct to authenticated, anon;

create function ct.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d600000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ct.id(s), 'ct-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'b1']) as s;
  insert into public.organizations (id, nome) values (ct.id('a0'), 'CT A'), (ct.id('b0'), 'CT B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (ct.id('a0'), 'producao', 'cortesia', 20), (ct.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ct.id(o), ct.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'colaborador'), ('a0', 'a4', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values
    (ct.id('a0'), ct.id('a2'), true, 'organizacao'), (ct.id('a0'), ct.id('a3'), false, 'organizacao'), (ct.id('a0'), ct.id('a4'), true, 'organizacao');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (ct.id('51'), ct.id('a0'), 'turne', 'circula', 'teatro', 'CT Temporada A'),
    (ct.id('5b'), ct.id('b0'), 'turne', 'circula', 'teatro', 'CT Temporada B');
  insert into public.producao_orcamentos (id, organization_id, temporada_id, nome) values
    (ct.id('c1'), ct.id('a0'), ct.id('51'), 'Orçamento A'),
    (ct.id('c2'), ct.id('a0'), ct.id('51'), 'Cenário B'),
    (ct.id('cb'), ct.id('b0'), ct.id('5b'), 'Orçamento B');
  insert into public.producao_orcamento_linhas (id, organization_id, orcamento_id, categoria, descricao, estimativa, formula) values
    (ct.id('e1'), ct.id('a0'), ct.id('c1'), 'hospedagem', 'Hotel', 500, 'pessoas * 100'),
    (ct.id('e2'), ct.id('a0'), ct.id('c2'), 'hospedagem', 'Hotel', 400, 'pessoas * 80');
  insert into public.producao_orcamento_variaveis (id, organization_id, orcamento_id, nome, rotulo, valor) values
    (ct.id('f1'), ct.id('a0'), ct.id('c1'), 'pessoas', 'Pessoas viajando', 5),
    (ct.id('f2'), ct.id('a0'), ct.id('c2'), 'pessoas', 'Pessoas viajando', 5),
    (ct.id('fb'), ct.id('b0'), ct.id('cb'), 'pessoas', null, 3);
  update public.producao_orcamentos set situacao = 'aprovado' where id = ct.id('c2');
end
$dados$;

create function ct.tenta(comando text) returns text language plpgsql as $$
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

create function ct.efeito(comando text) returns text language plpgsql as $$
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

create function ct.ve(o text) returns text language plpgsql as $$
declare n bigint;
begin
  select count(*) into n from public.producao_orcamento_variaveis where organization_id = ct.id(o || '0');
  return n::text;
end;
$$;

create function ct.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ct.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function ct.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_orcamento_variaveis' and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_orcamento_variaveis'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint where contype = 'f' and conrelid = 'public.producao_orcamento_variaveis'::regclass),
          'producao_orcamento_variaveis_orcamento_id_fkey=c, producao_orcamento_variaveis_organization_id_fkey=c', 'a variável sai com o orçamento');
select ok(not has_table_privilege('anon', 'public.producao_orcamento_variaveis', 'select')
          and not has_function_privilege('authenticated', 'public.fn_producao_orcamento_variavel_coerencia()', 'execute')
          and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'producao_orcamento_linhas' and column_name = 'formula')
          and (select count(*)::int from pg_trigger where tgrelid = 'public.producao_orcamento_variaveis'::regclass and not tgisinternal) = 2,
          'o visitante não toca; a fórmula existe na linha; sem gatilho de histórico (dinheiro)');

-- ─── Quem lê (dinheiro) ─────────────────────────────────────────────────────

select ct.como('a1');
select is(ct.ve('a'), '2', 'administrador lê');
select ct.como('a2');
select is(ct.ve('a'), '2', 'colaborador com dinheiro lê');
select ct.como('a3');
select is(ct.ve('a'), '0', 'colaborador sem dinheiro não vê nada');
select ct.como('a4');
select is(ct.ve('a'), '2', 'leitor com dinheiro lê');
select ct.como('b1');
select is(ct.ve('a') || ' ' || ct.ve('b'), '0 1', 'outra organização só lê o que é dela');
select ct.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ct.como('a2');
select is(ct.tenta(format('insert into public.producao_orcamento_variaveis (organization_id, orcamento_id, nome, valor) values (%L, %L, %L, 4)', ct.id('a0'), ct.id('c1'), 'dias_de_estrada')), 'aceito', 'colaborador com dinheiro cria a variável');
select ct.como('a3');
select ok(ct.tenta(format('insert into public.producao_orcamento_variaveis (organization_id, orcamento_id, nome, valor) values (%L, %L, %L, 4)', ct.id('a0'), ct.id('c1'), 'dias_de_estrada')) like '42501%', 'colaborador sem dinheiro não grava');
select ct.como('a4');
select ok(ct.tenta(format('insert into public.producao_orcamento_variaveis (organization_id, orcamento_id, nome, valor) values (%L, %L, %L, 4)', ct.id('a0'), ct.id('c1'), 'dias_de_estrada')) like '42501%', 'leitor, mesmo com dinheiro, não grava');
select ct.como('b1');
select is(ct.efeito(format('update public.producao_orcamento_variaveis set valor = 9 where id = %L', ct.id('f1'))), '', 'outra organização não altera');
select ct.volta();

-- ─── Regras da variável e da fórmula ────────────────────────────────────────

select is(array[
            ct.tenta(format('insert into public.producao_orcamento_variaveis (organization_id, orcamento_id, nome) values (%L, %L, %L)', ct.id('a0'), ct.id('c1'), 'Pessoas')),
            ct.tenta(format('insert into public.producao_orcamento_variaveis (organization_id, orcamento_id, nome) values (%L, %L, %L)', ct.id('a0'), ct.id('c1'), '1x')),
            ct.tenta(format('insert into public.producao_orcamento_variaveis (organization_id, orcamento_id, nome) values (%L, %L, %L)', ct.id('a0'), ct.id('c1'), 'max')),
            ct.tenta(format('insert into public.producao_orcamento_variaveis (organization_id, orcamento_id, nome) values (%L, %L, %L)', ct.id('a0'), ct.id('c1'), 'a' || repeat('b', 30))),
            ct.tenta(format('insert into public.producao_orcamento_variaveis (organization_id, orcamento_id, nome, valor) values (%L, %L, %L, -1)', ct.id('a0'), ct.id('c1'), 'negativa')),
            ct.tenta(format('insert into public.producao_orcamento_variaveis (organization_id, orcamento_id, nome, valor) values (%L, %L, %L, 2000000000)', ct.id('a0'), ct.id('c1'), 'enorme')),
            ct.tenta(format('insert into public.producao_orcamento_variaveis (organization_id, orcamento_id, nome) values (%L, %L, %L)', ct.id('a0'), ct.id('c1'), 'pessoas')),
            ct.tenta(format('insert into public.producao_orcamento_variaveis (organization_id, orcamento_id, nome) values (%L, %L, %L)', ct.id('a0'), ct.id('cb'), 'outra')),
            ct.tenta(format('update public.producao_orcamento_variaveis set organization_id = %L where id = %L', ct.id('b0'), ct.id('f1'))),
            ct.tenta(format('update public.producao_orcamento_variaveis set orcamento_id = %L where id = %L', ct.id('c2'), ct.id('f1')))],
          array['23514 producao_orcamento_variaveis_nome_check', '23514 producao_orcamento_variaveis_nome_check', '23514 producao_orcamento_variaveis_nome_check', '23514 producao_orcamento_variaveis_nome_check',
                '23514 producao_orcamento_variaveis_valor_check', '23514 producao_orcamento_variaveis_valor_check', '23505 producao_orcamento_variaveis_nome_idx',
                '23514 orcamento_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 orcamento_nao_muda'],
          'nome curto em minúsculas e sem nome de função, valor de 0 a 1 bilhão, nome único no orçamento, orçamento da organização e o que não muda');
select is(array[
            ct.tenta(format('update public.producao_orcamento_linhas set formula = %L where id = %L', ' ', ct.id('e1'))),
            ct.tenta(format('update public.producao_orcamento_linhas set formula = %L where id = %L', repeat('x', 201), ct.id('e1'))),
            ct.tenta(format('update public.producao_orcamento_linhas set formula = %L, estimativa = 600 where id = %L', 'pessoas * 120', ct.id('e1'))),
            ct.tenta(format('update public.producao_orcamento_linhas set formula = null where id = %L', ct.id('e1')))],
          array['23514 producao_orcamento_linhas_formula_check', '23514 producao_orcamento_linhas_formula_check', 'aceito', 'aceito'], 'a fórmula tem de 1 a 200 letras e muda à vontade em rascunho');
select is(array[
            ct.tenta(format('insert into public.producao_orcamento_variaveis (organization_id, orcamento_id, nome) values (%L, %L, %L)', ct.id('a0'), ct.id('c2'), 'dias')),
            ct.tenta(format('update public.producao_orcamento_variaveis set valor = 9 where id = %L', ct.id('f2'))),
            ct.tenta(format('delete from public.producao_orcamento_variaveis where id = %L', ct.id('f2'))),
            ct.tenta(format('update public.producao_orcamento_linhas set formula = %L where id = %L', 'pessoas * 90', ct.id('e2'))),
            ct.tenta(format('update public.producao_orcamento_linhas set revisado = 450 where id = %L', ct.id('e2')))],
          array['23514 orcamento_aprovado', '23514 orcamento_aprovado', '23514 orcamento_aprovado', '23514 orcamento_aprovado', 'aceito'],
          'aprovado: as variáveis e a fórmula da linha não mudam (o revisado segue livre)');
update public.producao_orcamentos set situacao = 'encerrado' where id = ct.id('c2');
select is(array[
            ct.tenta(format('insert into public.producao_orcamento_variaveis (organization_id, orcamento_id, nome) values (%L, %L, %L)', ct.id('a0'), ct.id('c2'), 'dias')),
            ct.tenta(format('update public.producao_orcamento_variaveis set valor = 9 where id = %L', ct.id('f2')))],
          array['23514 orcamento_encerrado', '23514 orcamento_encerrado'], 'encerrado: nada muda');

select ct.como('a1');
delete from public.producao_orcamentos where id = ct.id('c1');
select ct.volta();
select is((select count(*)::int from public.producao_orcamento_variaveis where orcamento_id = ct.id('c1')), 0, 'apagar o orçamento leva as variáveis junto');

select is((select count(*)::int from public.producao_historico where entidade = 'producao_orcamento_variaveis'), 0, 'a variável não tem histórico');

select * from finish();
rollback;
