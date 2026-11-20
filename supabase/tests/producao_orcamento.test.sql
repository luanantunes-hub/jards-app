-- PD5.1 (primeiro corte): orçamento vivo da temporada (producao_orcamentos e producao_orcamento_linhas).
--
-- Dinheiro: só lê e escreve quem tem a permissão; quem aprovou e quando só o gatilho escreve. Regras: o orçamento nasce em rascunho e só anda para a frente;
-- aprovar copia a estimativa para o aprovado das linhas; aprovado, estimativa, aprovado e categoria não mudam, linha com valor aprovado não se apaga e linha nova
-- entra sem valor aprovado; encerrado, nada muda; sem histórico (valor).
-- Ids 0d500000-0000-4000-8000-0000000000XX, ou ct.id('XX'). Cenário desfeito no fim.
--   A (a0): temporada t1; orçamentos c1 (rascunho: l1 cachê 1000, l2 hotel 500), c2 (rascunho: l3 van 300), c3 (encerrado: l4); a1 administrador,
--   a2 colaborador com dinheiro, a3 colaborador sem dinheiro, a4 leitor com dinheiro.  B (b0): b1 admin, temporada tb, orçamento cb com a linha lb.
-- Rodar: supabase/tests/README.md, com a migration producao_orcamento na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

create schema ct;
grant usage on schema ct to authenticated, anon;

create function ct.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d500000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
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
    (ct.id('c3'), ct.id('a0'), ct.id('51'), 'Antigo'),
    (ct.id('cb'), ct.id('b0'), ct.id('5b'), 'Orçamento B');
  insert into public.producao_orcamento_linhas (id, organization_id, orcamento_id, categoria, descricao, estimativa) values
    (ct.id('e1'), ct.id('a0'), ct.id('c1'), 'cache', 'Cachê elenco', 1000),
    (ct.id('e2'), ct.id('a0'), ct.id('c1'), 'hospedagem', 'Hotel', 500),
    (ct.id('e3'), ct.id('a0'), ct.id('c2'), 'transporte', 'Van', 300),
    (ct.id('e4'), ct.id('a0'), ct.id('c3'), 'frete', 'Carga', 200),
    (ct.id('eb'), ct.id('b0'), ct.id('cb'), 'cache', 'Cachê B', 100);
  update public.producao_orcamentos set situacao = 'encerrado' where id = ct.id('c3');
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
declare a bigint; b bigint;
begin
  select count(*) into a from public.producao_orcamentos where organization_id = ct.id(o || '0');
  select count(*) into b from public.producao_orcamento_linhas where organization_id = ct.id(o || '0');
  return a::text || '|' || b::text;
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

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_orcamentos', 'producao_orcamento_linhas') and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 10, 'cinco regras em cada tabela, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_orcamentos'::regclass) and (select relrowsecurity from pg_class where oid = 'public.producao_orcamento_linhas'::regclass), 'segurança por linha ligada nas duas');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint where contype = 'f' and conrelid in ('public.producao_orcamentos'::regclass, 'public.producao_orcamento_linhas'::regclass) and confrelid <> 'auth.users'::regclass),
          'producao_orcamento_linhas_orcamento_id_fkey=c, producao_orcamento_linhas_organization_id_fkey=c, producao_orcamentos_organization_id_fkey=c, producao_orcamentos_temporada_id_fkey=c', 'a linha sai com o orçamento e o orçamento com a temporada');
select ok(not has_table_privilege('anon', 'public.producao_orcamentos', 'select')
          and not has_table_privilege('anon', 'public.producao_orcamento_linhas', 'select')
          and not has_column_privilege('authenticated', 'public.producao_orcamentos', 'aprovado_por', 'update')
          and not has_column_privilege('authenticated', 'public.producao_orcamentos', 'aprovado_em', 'update')
          and not has_column_privilege('authenticated', 'public.producao_orcamentos', 'aprovado_por', 'insert')
          and has_column_privilege('authenticated', 'public.producao_orcamentos', 'situacao', 'update')
          and not has_function_privilege('authenticated', 'public.fn_producao_orcamento_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_orcamento_linha_coerencia()', 'execute')
          and (select count(*)::int from pg_trigger where tgrelid in ('public.producao_orcamentos'::regclass, 'public.producao_orcamento_linhas'::regclass) and not tgisinternal) = 4,
          'o visitante não toca; o navegador não escreve quem aprovou nem quando; sem gatilho de histórico (dinheiro)');

-- ─── Quem lê (dinheiro) ─────────────────────────────────────────────────────

select ct.como('a1');
select is(ct.ve('a'), '3|4', 'administrador lê');
select ct.como('a2');
select is(ct.ve('a'), '3|4', 'colaborador com dinheiro lê');
select ct.como('a3');
select is(ct.ve('a'), '0|0', 'colaborador sem dinheiro não vê nada');
select ct.como('a4');
select is(ct.ve('a'), '3|4', 'leitor com dinheiro lê');
select ct.como('b1');
select is(ct.ve('a') || ' ' || ct.ve('b'), '0|0 1|1', 'outra organização só lê o que é dela');
select ct.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ct.como('a2');
select is(ct.tenta(format('insert into public.producao_orcamentos (organization_id, temporada_id, nome) values (%L, %L, %L)', ct.id('a0'), ct.id('51'), 'Novo')), 'aceito', 'colaborador com dinheiro cria o orçamento');
select ct.como('a3');
select ok(ct.tenta(format('insert into public.producao_orcamentos (organization_id, temporada_id, nome) values (%L, %L, %L)', ct.id('a0'), ct.id('51'), 'Novo')) like '42501%'
          and ct.efeito(format('update public.producao_orcamentos set situacao = %L where id = %L', 'aprovado', ct.id('c1'))) = ''
          and ct.efeito(format('update public.producao_orcamento_linhas set pago = 5 where id = %L', ct.id('e1'))) = '', 'colaborador sem dinheiro não cria, não aprova e não altera linha');
select ct.como('a4');
select ok(ct.tenta(format('insert into public.producao_orcamento_linhas (organization_id, orcamento_id, descricao) values (%L, %L, %L)', ct.id('a0'), ct.id('c1'), 'Extra')) like '42501%', 'leitor, mesmo com dinheiro, não grava');
select ct.como('b1');
select is(ct.efeito(format('update public.producao_orcamento_linhas set pago = 5 where id = %L', ct.id('e1'))), '', 'outra organização não altera');
select ct.volta();

-- ─── Regras do orçamento e das linhas ───────────────────────────────────────

select is(array[
            ct.tenta(format('insert into public.producao_orcamentos (organization_id, temporada_id, nome, situacao) values (%L, %L, %L, %L)', ct.id('a0'), ct.id('51'), 'Já aprovado', 'aprovado')),
            ct.tenta(format('insert into public.producao_orcamentos (organization_id, temporada_id, nome) values (%L, %L, %L)', ct.id('a0'), ct.id('5b'), 'Outra temporada')),
            ct.tenta(format('insert into public.producao_orcamentos (organization_id, temporada_id, nome) values (%L, %L, %L)', ct.id('a0'), ct.id('51'), ' orçamento a ')),
            ct.tenta(format('insert into public.producao_orcamentos (organization_id, temporada_id, nome) values (%L, %L, %L)', ct.id('a0'), ct.id('51'), ' ')),
            ct.tenta(format('update public.producao_orcamentos set organization_id = %L where id = %L', ct.id('b0'), ct.id('c1'))),
            ct.tenta(format('update public.producao_orcamentos set temporada_id = %L where id = %L', ct.id('5b'), ct.id('c1')))],
          array['23514 orcamento_nasce_rascunho', '23514 temporada_de_outra_organizacao', '23505 producao_orcamentos_nome_idx', '23514 producao_orcamentos_nome_check', '23514 organizacao_nao_muda', '23514 temporada_nao_muda'],
          'nasce em rascunho, temporada da organização, nome único e não vazio, e o que não muda');
select is(array[
            ct.tenta(format('insert into public.producao_orcamento_linhas (organization_id, orcamento_id, categoria, descricao) values (%L, %L, %L, %L)', ct.id('a0'), ct.id('c1'), 'viagem', 'X')),
            ct.tenta(format('insert into public.producao_orcamento_linhas (organization_id, orcamento_id, descricao) values (%L, %L, %L)', ct.id('a0'), ct.id('c1'), ' ')),
            ct.tenta(format('insert into public.producao_orcamento_linhas (organization_id, orcamento_id, descricao, estimativa) values (%L, %L, %L, -1)', ct.id('a0'), ct.id('c1'), 'Negativa')),
            ct.tenta(format('insert into public.producao_orcamento_linhas (organization_id, orcamento_id, categoria, descricao) values (%L, %L, %L, %L)', ct.id('a0'), ct.id('c1'), 'cache', ' cachê ELENCO ')),
            ct.tenta(format('insert into public.producao_orcamento_linhas (organization_id, orcamento_id, descricao) values (%L, %L, %L)', ct.id('a0'), ct.id('cb'), 'Outra')),
            ct.tenta(format('update public.producao_orcamento_linhas set organization_id = %L where id = %L', ct.id('b0'), ct.id('e1'))),
            ct.tenta(format('update public.producao_orcamento_linhas set orcamento_id = %L where id = %L', ct.id('c2'), ct.id('e1')))],
          array['23514 producao_orcamento_linhas_categoria_check', '23514 producao_orcamento_linhas_descricao_check', '23514 producao_orcamento_linhas_valores_check', '23505 producao_orcamento_linhas_descricao_idx',
                '23514 orcamento_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 orcamento_nao_muda'],
          'categoria da lista, descrição, valor não negativo, linha única, orçamento da organização e o que não muda');

-- ─── Aprovar ────────────────────────────────────────────────────────────────

select ct.como('a2');
update public.producao_orcamentos set situacao = 'aprovado' where id = ct.id('c1');
select ct.volta();
select ok((select aprovado_por = ct.id('a2') and aprovado_em is not null from public.producao_orcamentos where id = ct.id('c1'))
          and (select aprovado from public.producao_orcamento_linhas where id = ct.id('e1')) = 1000
          and (select aprovado from public.producao_orcamento_linhas where id = ct.id('e2')) = 500
          and (select aprovado from public.producao_orcamento_linhas where id = ct.id('e3')) is null, 'aprovar carimba quem e quando e copia a estimativa para o aprovado das linhas daquele orçamento');
select is(array[
            ct.tenta(format('update public.producao_orcamento_linhas set estimativa = 2000 where id = %L', ct.id('e1'))),
            ct.tenta(format('update public.producao_orcamento_linhas set aprovado = 2000 where id = %L', ct.id('e1'))),
            ct.tenta(format('update public.producao_orcamento_linhas set categoria = %L where id = %L', 'outros', ct.id('e1'))),
            ct.tenta(format('insert into public.producao_orcamento_linhas (organization_id, orcamento_id, descricao, aprovado) values (%L, %L, %L, 10)', ct.id('a0'), ct.id('c1'), 'Com aprovado')),
            ct.tenta(format('delete from public.producao_orcamento_linhas where id = %L', ct.id('e1'))),
            ct.tenta(format('update public.producao_orcamentos set situacao = %L where id = %L', 'rascunho', ct.id('c1')))],
          array['23514 orcamento_aprovado', '23514 orcamento_aprovado', '23514 orcamento_aprovado', '23514 orcamento_aprovado', '23514 orcamento_aprovado', '23514 orcamento_nao_volta'],
          'aprovado: estimativa, aprovado e categoria não mudam, linha aprovada não se apaga, linha nova não nasce aprovada e o orçamento não volta');
select is(array[
            ct.tenta(format('update public.producao_orcamento_linhas set revisado = 1200, comprometido = 800, pago = 300 where id = %L', ct.id('e1'))),
            ct.tenta(format('insert into public.producao_orcamento_linhas (organization_id, orcamento_id, descricao, estimativa) values (%L, %L, %L, 50)', ct.id('a0'), ct.id('c1'), 'Extra sem aprovado')),
            ct.tenta(format('update public.producao_orcamentos set nome = %L where id = %L', 'Orçamento A (aprovado)', ct.id('c1')))],
          array['aceito', 'aceito', 'aceito'], 'aprovado: o revisado, o comprometido e o pago seguem editáveis, entra linha extra e o nome muda');

-- ─── Encerrar ───────────────────────────────────────────────────────────────

update public.producao_orcamentos set situacao = 'encerrado' where id = ct.id('c1');
select is(array[
            ct.tenta(format('update public.producao_orcamentos set nome = %L where id = %L', 'Outro nome', ct.id('c1'))),
            ct.tenta(format('update public.producao_orcamento_linhas set revisado = 1 where id = %L', ct.id('e1'))),
            ct.tenta(format('insert into public.producao_orcamento_linhas (organization_id, orcamento_id, descricao) values (%L, %L, %L)', ct.id('a0'), ct.id('c1'), 'Depois de encerrar')),
            ct.tenta(format('delete from public.producao_orcamento_linhas where id = %L', ct.id('e1')))],
          array['23514 orcamento_encerrado', '23514 orcamento_encerrado', '23514 orcamento_encerrado', '23514 orcamento_encerrado'], 'encerrado: nada muda');

select ct.como('a1');
delete from public.producao_orcamentos where id = ct.id('c3');
select ct.volta();
select is((select count(*)::int from public.producao_orcamento_linhas where orcamento_id = ct.id('c3')), 0, 'apagar o orçamento (mesmo encerrado) leva as linhas junto');

select is((select count(*)::int from public.producao_historico where entidade in ('producao_orcamentos', 'producao_orcamento_linhas')), 0, 'o orçamento não tem histórico: nenhum valor vaza para quem não vê o dinheiro');

select * from finish();
rollback;
