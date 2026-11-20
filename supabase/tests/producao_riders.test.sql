-- PD2.5: o rider estruturado (producao_riders e producao_rider_itens).
--
-- Quem lê e quem grava o rider e as linhas (administrador, colaborador, leitor, o recorte "só onde está vinculado", que
-- não vê os riders da organização, outra organização, produção só para leitura e visitante), a forma (nome, medidas
-- mínimas, observações, seção da lista, texto, quantidade e ordem), a coerência entre organizações (planta, obra e rider),
-- as chaves (o rider leva as linhas; planta e obra só se soltam) e o histórico, que só o rider tem.
-- Ids 0d280000-0000-4000-8000-0000000000XX, ou rd.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: planta 61, obra 51; riders 71 e 72; linhas 81 e 82 (do rider 71);
--   a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado".
--   B (b0), cortesia: planta 6b, obra 5b, rider 7b; b1 admin.  C (c0), produção só para leitura: rider 7c, linha 8c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_riders na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

create schema rd;
grant usage on schema rd to authenticated, anon;

create function rd.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d280000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select rd.id(s), 'rd-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (rd.id('a0'), 'RD A'), (rd.id('b0'), 'RD B'), (rd.id('c0'), 'RD C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (rd.id('a0'), 'producao', 'cortesia', 20), (rd.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (rd.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = rd.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select rd.id(o), rd.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (rd.id('a0'), rd.id('a5'), false, 'vinculado');
  insert into public.producao_plantas (id, organization_id, nome, tipo, largura_m, profundidade_m) values
    (rd.id('61'), rd.id('a0'), 'Palco', 'palco', 12, 8), (rd.id('6b'), rd.id('b0'), 'Palco B', 'palco', 10, 6);
  insert into public.producao_obras (id, organization_id, tipo, titulo) values
    (rd.id('51'), rd.id('a0'), 'teatro', 'RD Obra'), (rd.id('5b'), rd.id('b0'), 'teatro', 'RD Obra B');
  insert into public.producao_riders (id, organization_id, nome, planta_id, palco_largura_min_m, palco_profundidade_min_m) values
    (rd.id('71'), rd.id('a0'), 'Rider do show', rd.id('61'), 10, 6), (rd.id('72'), rd.id('a0'), 'Rider reduzido', null, null, null),
    (rd.id('7b'), rd.id('b0'), 'Rider da B', null, null, null), (rd.id('7c'), rd.id('c0'), 'Rider da C', null, null, null);
  insert into public.producao_rider_itens (id, organization_id, rider_id, secao, texto, quantidade) values
    (rd.id('81'), rd.id('a0'), rd.id('71'), 'som', 'Mesa de som com 16 canais', 1),
    (rd.id('82'), rd.id('a0'), rd.id('71'), 'camarim', 'Água e frutas', null),
    (rd.id('8c'), rd.id('c0'), rd.id('7c'), 'geral', 'Item da C', null);
end
$dados$;

create function rd.tenta(comando text) returns text language plpgsql as $$
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

create function rd.efeito(comando text) returns text language plpgsql as $$
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

create function rd.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using rd.id(o || '0');
  return n::text;
end;
$$;

create function rd.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', rd.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function rd.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_riders', 'producao_rider_itens')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 10, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_riders'::regclass, 'public.producao_rider_itens'::regclass) and relrowsecurity), 2, 'segurança por linha ligada nas duas');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_riders'::regclass, 'public.producao_rider_itens'::regclass)),
          'producao_rider_itens.producao_rider_itens_organization_id_fkey=c, producao_rider_itens.producao_rider_itens_rider_id_fkey=c, '
          || 'producao_riders.producao_riders_obra_id_fkey=n, producao_riders.producao_riders_organization_id_fkey=c, producao_riders.producao_riders_planta_id_fkey=n',
          'o rider leva as linhas; apagar a planta ou a obra só solta a ligação');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_rider_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_rider_item_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_riders', 'select'), 'as coerências não são chamáveis e o visitante não toca nas tabelas');
select is((select string_agg(tgrelid::regclass::text || '.' || tgname::text, ' ' order by tgrelid::regclass::text collate "C", tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid in ('public.producao_riders'::regclass, 'public.producao_rider_itens'::regclass)),
          'producao_rider_itens.producao_rider_itens_coerencia producao_rider_itens.producao_rider_itens_updated_at producao_riders.producao_riders_coerencia '
          || 'producao_riders.producao_riders_historico producao_riders.producao_riders_updated_at', 'os gatilhos de cada tabela (só o rider tem histórico)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select rd.como('a1');
select is(rd.ve('producao_riders', 'a'), '2', 'administrador lê os riders');
select rd.como('a2');
select is(rd.ve('producao_riders', 'a'), '2', 'colaborador lê os riders');
select rd.como('a3');
select is(rd.ve('producao_riders', 'a'), '2', 'leitor lê os riders');
select rd.como('a5');
select is(rd.ve('producao_riders', 'a'), '0', 'o recorte "vinculado" não vê os riders da organização');
select rd.como('b1');
select is(rd.ve('producao_riders', 'a'), '0', 'outra organização não lê');
select rd.como('c1');
select is(rd.ve('producao_riders', 'c'), '1', 'produção só para leitura lê');
select rd.como(null);
select is(rd.efeito('select 1 from public.producao_riders'), '', 'visitante não lê');
select rd.como('a2');
select is(rd.ve('producao_rider_itens', 'a'), '2', 'colaborador lê as linhas');
select rd.como('a5');
select is(rd.ve('producao_rider_itens', 'a'), '0', 'o recorte "vinculado" não vê as linhas (não vê o rider)');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select rd.como('a2');
select is(rd.tenta(format('insert into public.producao_riders (organization_id, nome) values (%L, %L)', rd.id('a0'), 'Rider novo')), 'aceito', 'colaborador cria o rider');
select is(rd.efeito(format('update public.producao_riders set palco_largura_min_m = 12 where id = %L', rd.id('71'))), 'sim', 'colaborador altera o rider');
select is(rd.tenta(format('insert into public.producao_rider_itens (organization_id, rider_id, secao, texto) values (%L, %L, %L, %L)', rd.id('a0'), rd.id('71'), 'luz', 'Seis refletores')), 'aceito', 'colaborador põe uma linha');
select rd.como('a3');
select ok(rd.tenta(format('insert into public.producao_riders (organization_id, nome) values (%L, %L)', rd.id('a0'), 'x')) like '42501%', 'leitor não cria o rider');
select ok(rd.tenta(format('insert into public.producao_rider_itens (organization_id, rider_id, texto) values (%L, %L, %L)', rd.id('a0'), rd.id('71'), 'x')) like '42501%', 'leitor não põe linha');
select rd.como('c1');
select ok(rd.tenta(format('insert into public.producao_riders (organization_id, nome) values (%L, %L)', rd.id('c0'), 'x')) like '42501%', 'produção só para leitura não grava');
select rd.como('a5');
select ok(rd.tenta(format('insert into public.producao_riders (organization_id, nome) values (%L, %L)', rd.id('a0'), 'x')) like '42501%', 'o recorte não grava riders');
select rd.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            rd.tenta(format('insert into public.producao_riders (organization_id, nome) values (%L, %L)', rd.id('a0'), ' ')),
            rd.tenta(format('insert into public.producao_riders (organization_id, nome, palco_largura_min_m) values (%L, %L, 0.1)', rd.id('a0'), 'x')),
            rd.tenta(format('insert into public.producao_riders (organization_id, nome, palco_profundidade_min_m) values (%L, %L, 501)', rd.id('a0'), 'x')),
            rd.tenta(format('insert into public.producao_riders (organization_id, nome, observacoes) values (%L, %L, repeat(%L, 4001))', rd.id('a0'), 'x', 'a')),
            rd.tenta(format('insert into public.producao_riders (organization_id, nome, planta_id) values (%L, %L, %L)', rd.id('a0'), 'x', rd.id('6b'))),
            rd.tenta(format('insert into public.producao_riders (organization_id, nome, obra_id) values (%L, %L, %L)', rd.id('a0'), 'x', rd.id('5b'))),
            rd.tenta(format('update public.producao_riders set organization_id = %L where id = %L', rd.id('b0'), rd.id('71'))),
            rd.tenta(format('insert into public.producao_rider_itens (organization_id, rider_id, secao, texto) values (%L, %L, %L, %L)', rd.id('a0'), rd.id('71'), 'cozinha', 'x')),
            rd.tenta(format('insert into public.producao_rider_itens (organization_id, rider_id, texto) values (%L, %L, %L)', rd.id('a0'), rd.id('71'), ' ')),
            rd.tenta(format('insert into public.producao_rider_itens (organization_id, rider_id, texto, quantidade) values (%L, %L, %L, 0)', rd.id('a0'), rd.id('71'), 'x')),
            rd.tenta(format('insert into public.producao_rider_itens (organization_id, rider_id, texto, ordem) values (%L, %L, %L, -1)', rd.id('a0'), rd.id('71'), 'x')),
            rd.tenta(format('insert into public.producao_rider_itens (organization_id, rider_id, texto) values (%L, %L, %L)', rd.id('a0'), rd.id('7b'), 'x')),
            rd.tenta(format('update public.producao_rider_itens set rider_id = %L where id = %L', rd.id('72'), rd.id('81')))],
          array['23514 producao_riders_nome_check', '23514 producao_riders_largura_check', '23514 producao_riders_profundidade_check', '23514 producao_riders_observacoes_check',
                '23514 planta_de_outra_organizacao', '23514 obra_de_outra_organizacao', '23514 organizacao_nao_muda',
                '23514 producao_rider_itens_secao_check', '23514 producao_rider_itens_texto_check', '23514 producao_rider_itens_quantidade_check', '23514 producao_rider_itens_ordem_check',
                '23514 rider_de_outra_organizacao', '23514 rider_nao_muda'],
          'nome, medidas, observações, seção, texto, quantidade e ordem; planta, obra e rider da organização; organização e rider fixos');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_riders set nome = 'Rider do show (v2)' where id = rd.id('71');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade_id = rd.id('71') and acao = 'alterou'),
          'nome', 'mudar o nome deixa uma linha de histórico');
select rd.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_riders' and entidade_id = rd.id('71')) > 0, 'quem lê o rider lê o histórico dele');
select rd.volta();

select * from finish();
rollback;
