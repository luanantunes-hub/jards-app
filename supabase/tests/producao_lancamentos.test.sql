-- PD5.3 (primeiro corte): lançamentos da temporada (producao_lancamentos e producao_lancamento_linhas).
--
-- Dinheiro: só lê e escreve quem tem a permissão. Regras: valor e divisão maiores que zero; a soma da divisão não passa do valor do lançamento; a linha do
-- orçamento é da temporada do lançamento; nota repetida do mesmo favorecido é recusada; linha do orçamento com pagamento não se apaga; sem histórico.
-- Ids 0d800000-0000-4000-8000-0000000000XX, ou ct.id('XX'). Cenário desfeito no fim.
--   A (a0): temporadas t1 e t2; orçamento c1 de t1 (linhas 11 e 12), c2 de t2 (linha 13); lançamentos 71 (valor 1000, dividido 600 na linha 11) e 72 (valor 500, nota NF1 de
--   Hotel X); a1 administrador, a2 colaborador com dinheiro, a3 colaborador sem dinheiro, a4 leitor com dinheiro.  B (b0): b1 admin, temporada tb, orçamento cb (linha 1b), lançamento 7b com divisão 9b.
-- Rodar: supabase/tests/README.md, com as migrations do orçamento e producao_lancamentos na frente se não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

create schema ct;
grant usage on schema ct to authenticated, anon;

create function ct.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d800000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
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
    (ct.id('51'), ct.id('a0'), 'turne', 'circula', 'teatro', 'CT Temporada 1'),
    (ct.id('52'), ct.id('a0'), 'turne', 'circula', 'teatro', 'CT Temporada 2'),
    (ct.id('5b'), ct.id('b0'), 'turne', 'circula', 'teatro', 'CT Temporada B');
  insert into public.producao_orcamentos (id, organization_id, temporada_id, nome) values
    (ct.id('c1'), ct.id('a0'), ct.id('51'), 'Orçamento 1'), (ct.id('c2'), ct.id('a0'), ct.id('52'), 'Orçamento 2'), (ct.id('cb'), ct.id('b0'), ct.id('5b'), 'Orçamento B');
  insert into public.producao_orcamento_linhas (id, organization_id, orcamento_id, categoria, descricao, estimativa) values
    (ct.id('11'), ct.id('a0'), ct.id('c1'), 'cache', 'Cachê', 1000),
    (ct.id('12'), ct.id('a0'), ct.id('c1'), 'hospedagem', 'Hotel', 500),
    (ct.id('13'), ct.id('a0'), ct.id('c2'), 'transporte', 'Van', 300),
    (ct.id('1b'), ct.id('b0'), ct.id('cb'), 'cache', 'Cachê B', 100);
  insert into public.producao_lancamentos (id, organization_id, temporada_id, descricao, favorecido, documento, data, valor) values
    (ct.id('71'), ct.id('a0'), ct.id('51'), 'Cachê elenco', 'Cia Atores', 'REC-1', date '2027-03-05', 1000),
    (ct.id('72'), ct.id('a0'), ct.id('51'), 'Hospedagem', 'Hotel X', 'NF1', date '2027-03-06', 500),
    (ct.id('7b'), ct.id('b0'), ct.id('5b'), 'Cachê B', null, null, date '2027-03-05', 100);
  insert into public.producao_lancamento_linhas (id, organization_id, lancamento_id, orcamento_linha_id, valor) values
    (ct.id('91'), ct.id('a0'), ct.id('71'), ct.id('11'), 600),
    (ct.id('9b'), ct.id('b0'), ct.id('7b'), ct.id('1b'), 100);
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
  select count(*) into a from public.producao_lancamentos where organization_id = ct.id(o || '0');
  select count(*) into b from public.producao_lancamento_linhas where organization_id = ct.id(o || '0');
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

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_lancamentos', 'producao_lancamento_linhas') and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 10, 'cinco regras em cada tabela, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_lancamentos'::regclass) and (select relrowsecurity from pg_class where oid = 'public.producao_lancamento_linhas'::regclass), 'segurança por linha ligada nas duas');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint where contype = 'f' and conrelid in ('public.producao_lancamentos'::regclass, 'public.producao_lancamento_linhas'::regclass)),
          'producao_lancamento_linhas_lancamento_id_fkey=c, producao_lancamento_linhas_orcamento_linha_id_fkey=r, producao_lancamento_linhas_organization_id_fkey=c, producao_lancamentos_organization_id_fkey=c, producao_lancamentos_temporada_id_fkey=c',
          'a divisão sai com o lançamento; a linha do orçamento com pagamento não se apaga (restrict)');
select ok(not has_table_privilege('anon', 'public.producao_lancamentos', 'select')
          and not has_table_privilege('anon', 'public.producao_lancamento_linhas', 'select')
          and not has_function_privilege('authenticated', 'public.fn_producao_lancamento_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_lancamento_linha_coerencia()', 'execute')
          and (select count(*)::int from pg_trigger where tgrelid in ('public.producao_lancamentos'::regclass, 'public.producao_lancamento_linhas'::regclass) and not tgisinternal) = 3,
          'o visitante não toca; sem gatilho de histórico (dinheiro)');

-- ─── Quem lê (dinheiro) ─────────────────────────────────────────────────────

select ct.como('a1');
select is(ct.ve('a'), '2|1', 'administrador lê');
select ct.como('a2');
select is(ct.ve('a'), '2|1', 'colaborador com dinheiro lê');
select ct.como('a3');
select is(ct.ve('a'), '0|0', 'colaborador sem dinheiro não vê nada');
select ct.como('a4');
select is(ct.ve('a'), '2|1', 'leitor com dinheiro lê');
select ct.como('b1');
select is(ct.ve('a') || ' ' || ct.ve('b'), '0|0 1|1', 'outra organização só lê o que é dela');
select ct.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ct.como('a2');
select is(ct.tenta(format('insert into public.producao_lancamentos (organization_id, temporada_id, descricao, data, valor) values (%L, %L, %L, date ''2027-03-07'', 50)', ct.id('a0'), ct.id('51'), 'Táxi')), 'aceito', 'colaborador com dinheiro lança o pagamento');
select ct.como('a3');
select ok(ct.tenta(format('insert into public.producao_lancamentos (organization_id, temporada_id, descricao, data, valor) values (%L, %L, %L, date ''2027-03-07'', 50)', ct.id('a0'), ct.id('51'), 'Táxi')) like '42501%'
          and ct.efeito(format('update public.producao_lancamentos set valor = 2000 where id = %L', ct.id('71'))) = '', 'colaborador sem dinheiro não lança nem altera');
select ct.como('a4');
select ok(ct.tenta(format('insert into public.producao_lancamento_linhas (organization_id, lancamento_id, orcamento_linha_id, valor) values (%L, %L, %L, 10)', ct.id('a0'), ct.id('72'), ct.id('12'))) like '42501%', 'leitor, mesmo com dinheiro, não grava');
select ct.como('b1');
select is(ct.efeito(format('update public.producao_lancamentos set valor = 2000 where id = %L', ct.id('71'))), '', 'outra organização não altera');
select ct.volta();

-- ─── Regras do lançamento e da divisão ──────────────────────────────────────

select is(array[
            ct.tenta(format('insert into public.producao_lancamentos (organization_id, temporada_id, descricao, data, valor) values (%L, %L, %L, date ''2027-03-07'', 0)', ct.id('a0'), ct.id('51'), 'Zero')),
            ct.tenta(format('insert into public.producao_lancamentos (organization_id, temporada_id, descricao, data, valor) values (%L, %L, %L, date ''2027-03-07'', -5)', ct.id('a0'), ct.id('51'), 'Negativo')),
            ct.tenta(format('insert into public.producao_lancamentos (organization_id, temporada_id, descricao, data, valor) values (%L, %L, %L, date ''2027-03-07'', 5)', ct.id('a0'), ct.id('51'), ' ')),
            ct.tenta(format('insert into public.producao_lancamentos (organization_id, temporada_id, descricao, favorecido, documento, data, valor) values (%L, %L, %L, %L, %L, date ''2027-03-07'', 5)', ct.id('a0'), ct.id('51'), 'Repetida', ' hotel x ', ' nf1 ')),
            ct.tenta(format('insert into public.producao_lancamentos (organization_id, temporada_id, descricao, favorecido, documento, data, valor) values (%L, %L, %L, %L, %L, date ''2027-03-07'', 5)', ct.id('a0'), ct.id('51'), 'Outra nota', 'Hotel X', 'NF2')),
            ct.tenta(format('insert into public.producao_lancamentos (organization_id, temporada_id, descricao, data, valor) values (%L, %L, %L, date ''2027-03-07'', 5)', ct.id('a0'), ct.id('5b'), 'Outra org')),
            ct.tenta(format('update public.producao_lancamentos set organization_id = %L where id = %L', ct.id('b0'), ct.id('71'))),
            ct.tenta(format('update public.producao_lancamentos set temporada_id = %L where id = %L', ct.id('52'), ct.id('71'))),
            ct.tenta(format('update public.producao_lancamentos set valor = 500 where id = %L', ct.id('71'))),
            ct.tenta(format('update public.producao_lancamentos set valor = 600 where id = %L', ct.id('71')))],
          array['23514 producao_lancamentos_valor_check', '23514 producao_lancamentos_valor_check', '23514 producao_lancamentos_descricao_check', '23505 producao_lancamentos_documento_idx', 'aceito',
                '23514 temporada_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 temporada_nao_muda', '23514 divisao_passa_do_valor', 'aceito'],
          'valor maior que zero, descrição, nota repetida do mesmo favorecido recusada, temporada da organização, o que não muda e valor não abaixo do já dividido');
select is(array[
            ct.tenta(format('insert into public.producao_lancamento_linhas (organization_id, lancamento_id, orcamento_linha_id, valor) values (%L, %L, %L, 500)', ct.id('a0'), ct.id('71'), ct.id('12'))),
            ct.tenta(format('insert into public.producao_lancamento_linhas (organization_id, lancamento_id, orcamento_linha_id, valor) values (%L, %L, %L, 400)', ct.id('a0'), ct.id('71'), ct.id('12'))),
            ct.tenta(format('insert into public.producao_lancamento_linhas (organization_id, lancamento_id, orcamento_linha_id, valor) values (%L, %L, %L, 100)', ct.id('a0'), ct.id('71'), ct.id('13'))),
            ct.tenta(format('insert into public.producao_lancamento_linhas (organization_id, lancamento_id, orcamento_linha_id, valor) values (%L, %L, %L, 100)', ct.id('a0'), ct.id('71'), ct.id('1b'))),
            ct.tenta(format('insert into public.producao_lancamento_linhas (organization_id, lancamento_id, orcamento_linha_id, valor) values (%L, %L, %L, 50)', ct.id('a0'), ct.id('71'), ct.id('11'))),
            ct.tenta(format('insert into public.producao_lancamento_linhas (organization_id, lancamento_id, orcamento_linha_id, valor) values (%L, %L, %L, 0)', ct.id('a0'), ct.id('71'), ct.id('12'))),
            ct.tenta(format('insert into public.producao_lancamento_linhas (organization_id, lancamento_id, orcamento_linha_id, valor) values (%L, %L, %L, 10)', ct.id('a0'), ct.id('7b'), ct.id('12'))),
            ct.tenta(format('update public.producao_lancamento_linhas set valor = 1100 where id = %L', ct.id('91'))),
            ct.tenta(format('update public.producao_lancamento_linhas set lancamento_id = %L where id = %L', ct.id('72'), ct.id('91'))),
            ct.tenta(format('update public.producao_lancamento_linhas set organization_id = %L where id = %L', ct.id('b0'), ct.id('91')))],
          array['23514 divisao_passa_do_valor', 'aceito', '23514 linha_de_outra_temporada', '23514 linha_de_outra_temporada', '23505 producao_lancamento_linhas_key', '23514 producao_lancamento_linhas_valor_check',
                '23514 lancamento_de_outra_organizacao', '23514 divisao_passa_do_valor', '23514 lancamento_nao_muda', '23514 organizacao_nao_muda'],
          'a divisão não passa do valor, a linha é da temporada do lançamento, uma vez por lançamento, valor maior que zero e o que não muda');

-- ─── Linha do orçamento com pagamento não se apaga ──────────────────────────

select is(array[
            ct.tenta(format('delete from public.producao_orcamento_linhas where id = %L', ct.id('11'))),
            ct.tenta(format('delete from public.producao_orcamento_linhas where id = %L', ct.id('12')))],
          array['23503 producao_lancamento_linhas_orcamento_linha_id_fkey', 'aceito'], 'a linha do orçamento que recebeu pagamento não se apaga; a sem pagamento, sim');

select ct.como('a1');
delete from public.producao_lancamentos where id = ct.id('71');
select ct.volta();
select ok((select count(*) from public.producao_lancamento_linhas where lancamento_id = ct.id('71')) = 0 and (select count(*) from public.producao_orcamento_linhas where id = ct.id('11')) = 1,
          'apagar o lançamento leva a divisão junto e libera a linha do orçamento');

select is((select count(*)::int from public.producao_historico where entidade in ('producao_lancamentos', 'producao_lancamento_linhas')), 0, 'o lançamento não tem histórico: nenhum valor vaza para quem não vê o dinheiro');

select * from finish();
rollback;
