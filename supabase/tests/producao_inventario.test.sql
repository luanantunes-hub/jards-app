-- PD2.1: inventário da produção (producao_itens, producao_itens_valores e producao_item_datas).
--
-- Quem lê e quem grava o item (administrador, colaborador, leitor, o recorte "só onde está vinculado", outra
-- organização, produção só para leitura e visitante), o dinheiro do item (só quem vê o dinheiro), a ligação do item à
-- data (herda o item e a data à vista), a forma dos dados (categoria, dono, locação só no locado, quantidade,
-- dimensões, canais), a coerência entre organizações, as chaves e o histórico (só o item tem; sem o valor).
-- Ids 0d250000-0000-4000-8000-0000000000XX, ou iv.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: espaço 31, obra 51, temporada 21, datas 41; itens 61 (da produção) e 62 (locado);
--   valor do 61; ligação 71 (item 61 na data 41); a1 admin, a2 colaborador, a3 leitor, a4 colaborador com a
--   permissão de dinheiro, a5 colaborador com o recorte "vinculado".
--   B (b0), cortesia: espaço 3b, obra 5b, temporada 2b, data 4b; b1 admin.
--   C (c0), produção só para leitura: item 6c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_inventario na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(29);

create schema iv;
grant usage on schema iv to authenticated, anon;

create function iv.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d250000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select iv.id(s), 'iv-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (iv.id('a0'), 'IV A'), (iv.id('b0'), 'IV B'), (iv.id('c0'), 'IV C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (iv.id('a0'), 'producao', 'cortesia', 20), (iv.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (iv.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = iv.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select iv.id(o), iv.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a4', 'colaborador', '{producao}'), ('a0', 'a5', 'colaborador', '{producao}'),
    ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values
    (iv.id('a0'), iv.id('a4'), true, 'organizacao'), (iv.id('a0'), iv.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (iv.id('31'), iv.id('a0'), 'IV E1', 'Teatro'), (iv.id('3b'), iv.id('b0'), 'IV EB', 'Teatro');
  insert into public.producao_obras (id, organization_id, tipo, titulo) values
    (iv.id('51'), iv.id('a0'), 'teatro', 'IV Obra'), (iv.id('5b'), iv.id('b0'), 'teatro', 'IV Obra B');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (iv.id('21'), iv.id('a0'), 'circulacao', 'circula', 'teatro', 'IV T'), (iv.id('2b'), iv.id('b0'), 'circulacao', 'circula', 'teatro', 'IV TB');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (iv.id('41'), iv.id('a0'), iv.id('21'), date '2026-12-05'), (iv.id('4b'), iv.id('b0'), iv.id('2b'), date '2026-12-05');
  insert into public.producao_itens (id, organization_id, nome, categoria, dono, quantidade, comprimento_cm, largura_cm, altura_cm, peso_kg) values
    (iv.id('61'), iv.id('a0'), 'Praticável 2x1', 'praticavel', 'producao', 4, 200, 100, 40, 18.5);
  insert into public.producao_itens (id, organization_id, nome, categoria, dono, fornecedor, locacao_inicio, locacao_fim) values
    (iv.id('62'), iv.id('a0'), 'Mesa de som 32 canais', 'som', 'locado', 'Som & Luz Ltda', date '2026-12-01', date '2026-12-10'),
    (iv.id('6c'), iv.id('c0'), 'Item da C', 'outro', 'producao', null, null, null);
  insert into public.producao_itens_valores (item_id, organization_id, valor_unitario) values (iv.id('61'), iv.id('a0'), 1200);
  insert into public.producao_item_datas (id, organization_id, item_id, data_id, quantidade) values (iv.id('71'), iv.id('a0'), iv.id('61'), iv.id('41'), 4);
end
$dados$;

create function iv.tenta(comando text) returns text language plpgsql as $$
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

create function iv.efeito(comando text) returns text language plpgsql as $$
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

create function iv.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using iv.id(o || '0');
  return n::text;
end;
$$;

create function iv.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', iv.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function iv.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_itens', 'producao_itens_valores', 'producao_item_datas')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 15, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_itens'::regclass, 'public.producao_itens_valores'::regclass, 'public.producao_item_datas'::regclass) and relrowsecurity), 3, 'segurança por linha ligada nas três');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text, conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_itens'::regclass, 'public.producao_itens_valores'::regclass, 'public.producao_item_datas'::regclass)),
          'producao_item_datas.producao_item_datas_data_id_fkey=c, producao_item_datas.producao_item_datas_item_id_fkey=c, producao_item_datas.producao_item_datas_organization_id_fkey=c, '
          || 'producao_itens.producao_itens_espaco_id_fkey=n, producao_itens.producao_itens_obra_id_fkey=n, producao_itens.producao_itens_organization_id_fkey=c, '
          || 'producao_itens_valores.producao_itens_valores_item_id_fkey=c, producao_itens_valores.producao_itens_valores_organization_id_fkey=c',
          'o item sai com a organização, os valores e as ligações saem com o item, a data só solta a ligação, a obra e o espaço só se desligam');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_item_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_item_valor_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_item_data_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_itens', 'select')
          and not has_table_privilege('anon', 'public.producao_itens_valores', 'select'), 'as coerências não são chamáveis e o visitante não toca nas tabelas');
select is((select string_agg(tgrelid::regclass::text || '.' || tgname::text, ' ' order by tgrelid::regclass::text, tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid in ('public.producao_itens'::regclass, 'public.producao_itens_valores'::regclass, 'public.producao_item_datas'::regclass)),
          'producao_item_datas.producao_item_datas_coerencia producao_item_datas.producao_item_datas_updated_at producao_itens.producao_itens_coerencia producao_itens.producao_itens_historico '
          || 'producao_itens.producao_itens_updated_at producao_itens_valores.producao_itens_valores_coerencia producao_itens_valores.producao_itens_valores_updated_at', 'os gatilhos de cada tabela (só o item tem histórico)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select iv.como('a1');
select is(iv.ve('producao_itens', 'a'), '2', 'administrador lê os itens');
select iv.como('a2');
select is(iv.ve('producao_itens', 'a'), '2', 'colaborador lê os itens');
select iv.como('a3');
select is(iv.ve('producao_itens', 'a'), '2', 'leitor lê os itens');
select iv.como('a5');
select is(iv.ve('producao_itens', 'a'), '0', 'o recorte "vinculado" não vê o inventário da organização');
select iv.como('b1');
select is(iv.ve('producao_itens', 'a'), '0', 'outra organização não lê');
select iv.como('c1');
select is(iv.ve('producao_itens', 'c'), '1', 'produção só para leitura lê');
select iv.como(null);
select is(iv.efeito('select 1 from public.producao_itens'), '', 'visitante não lê');

-- ─── O dinheiro e a ligação à data ──────────────────────────────────────────

select iv.como('a1');
select is(iv.ve('producao_itens_valores', 'a'), '1', 'administrador vê o valor');
select iv.como('a2');
select is(iv.ve('producao_itens_valores', 'a'), '0', 'colaborador sem a permissão de dinheiro não vê o valor');
select iv.como('a4');
select is(iv.ve('producao_itens_valores', 'a'), '1', 'colaborador com a permissão de dinheiro vê o valor');
select iv.como('a2');
select is(iv.ve('producao_item_datas', 'a'), '1', 'colaborador lê a ligação do item à data');
select iv.como('a5');
select is(iv.ve('producao_item_datas', 'a'), '0', 'o recorte "vinculado" não vê a ligação (não vê o item)');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select iv.como('a2');
select is(iv.tenta(format('insert into public.producao_itens (organization_id, nome, categoria) values (%L, %L, %L)', iv.id('a0'), 'Rack de som', 'som')), 'aceito', 'colaborador cria o item');
select is(iv.efeito(format('update public.producao_itens set quantidade = 6 where id = %L', iv.id('61'))), 'sim', 'colaborador altera o item');
select iv.como('a3');
select ok(iv.tenta(format('insert into public.producao_itens (organization_id, nome) values (%L, %L)', iv.id('a0'), 'x')) like '42501%', 'leitor não cria');
select iv.como('c1');
select ok(iv.tenta(format('insert into public.producao_itens (organization_id, nome) values (%L, %L)', iv.id('c0'), 'x')) like '42501%', 'produção só para leitura não grava');
select iv.como('a5');
select ok(iv.tenta(format('insert into public.producao_itens (organization_id, nome) values (%L, %L)', iv.id('a0'), 'x')) like '42501%', 'o recorte não grava no inventário');
select iv.como('a2');
select ok(iv.tenta(format('insert into public.producao_itens_valores (item_id, organization_id, valor_unitario) values (%L, %L, 10)', iv.id('62'), iv.id('a0'))) like '42501%', 'sem a permissão de dinheiro não grava o valor');
select iv.como('a4');
select is(iv.tenta(format('insert into public.producao_itens_valores (item_id, organization_id, valor_unitario, valor_locacao) values (%L, %L, 10, 3500)', iv.id('62'), iv.id('a0'))), 'aceito', 'com a permissão de dinheiro grava o valor');
select iv.como('a2');
select is(iv.tenta(format('insert into public.producao_item_datas (organization_id, item_id, data_id, quantidade) values (%L, %L, %L, 1)', iv.id('a0'), iv.id('62'), iv.id('41'))), 'aceito', 'colaborador leva um item à data');
select iv.como('a3');
select ok(iv.tenta(format('insert into public.producao_item_datas (organization_id, item_id, data_id, quantidade) values (%L, %L, %L, 1)', iv.id('a0'), iv.id('62'), iv.id('41'))) like '42501%', 'leitor não leva item à data');
select iv.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            iv.tenta(format('insert into public.producao_itens (organization_id, nome) values (%L, %L)', iv.id('a0'), ' ')),
            iv.tenta(format('insert into public.producao_itens (organization_id, nome, categoria) values (%L, %L, %L)', iv.id('a0'), 'x', 'outra')),
            iv.tenta(format('insert into public.producao_itens (organization_id, nome, dono) values (%L, %L, %L)', iv.id('a0'), 'x', 'amigo')),
            iv.tenta(format('insert into public.producao_itens (organization_id, nome, fornecedor) values (%L, %L, %L)', iv.id('a0'), 'x', 'Fornecedor')),
            iv.tenta(format('insert into public.producao_itens (organization_id, nome, espaco_id) values (%L, %L, %L)', iv.id('a0'), 'x', iv.id('31'))),
            iv.tenta(format('insert into public.producao_itens (organization_id, nome, dono, locacao_inicio, locacao_fim) values (%L, %L, %L, %L, %L)', iv.id('a0'), 'x', 'locado', '2026-12-10', '2026-12-01')),
            iv.tenta(format('insert into public.producao_itens (organization_id, nome, quantidade) values (%L, %L, 0)', iv.id('a0'), 'x')),
            iv.tenta(format('insert into public.producao_itens (organization_id, nome, altura_cm) values (%L, %L, -1)', iv.id('a0'), 'x')),
            iv.tenta(format('insert into public.producao_itens (organization_id, nome, canais) values (%L, %L, 513)', iv.id('a0'), 'x')),
            iv.tenta(format('insert into public.producao_itens (organization_id, nome, obra_id) values (%L, %L, %L)', iv.id('a0'), 'x', iv.id('5b'))),
            iv.tenta(format('insert into public.producao_itens (organization_id, nome, dono, espaco_id) values (%L, %L, %L, %L)', iv.id('a0'), 'x', 'espaco', iv.id('3b'))),
            iv.tenta(format('update public.producao_itens set organization_id = %L where id = %L', iv.id('b0'), iv.id('61'))),
            iv.tenta(format('update public.producao_itens_valores set valor_unitario = -5 where item_id = %L', iv.id('61'))),
            iv.tenta(format('insert into public.producao_itens_valores (item_id, organization_id, valor_unitario) values (%L, %L, 10)', iv.id('62'), iv.id('b0'))),
            iv.tenta(format('insert into public.producao_item_datas (organization_id, item_id, data_id) values (%L, %L, %L)', iv.id('a0'), iv.id('61'), iv.id('41'))),
            iv.tenta(format('insert into public.producao_item_datas (organization_id, item_id, data_id, quantidade) values (%L, %L, %L, 0)', iv.id('a0'), iv.id('62'), iv.id('41'))),
            iv.tenta(format('insert into public.producao_item_datas (organization_id, item_id, data_id) values (%L, %L, %L)', iv.id('a0'), iv.id('61'), iv.id('4b'))),
            iv.tenta(format('update public.producao_item_datas set item_id = %L where id = %L', iv.id('62'), iv.id('71')))],
          array['23514 producao_itens_nome_check', '23514 producao_itens_categoria_check', '23514 producao_itens_dono_check', '23514 producao_itens_locacao_check',
                '23514 producao_itens_espaco_check', '23514 producao_itens_periodo_check', '23514 producao_itens_quantidade_check', '23514 producao_itens_dimensoes_check',
                '23514 producao_itens_canais_check', '23514 obra_de_outra_organizacao', '23514 espaco_de_outra_organizacao', '23514 organizacao_nao_muda',
                '23514 producao_itens_valores_unitario_check', '23514 item_de_outra_organizacao', '23505 producao_item_datas_item_data_key',
                '23514 producao_item_datas_quantidade_check', '23514 data_de_outra_organizacao', '23514 item_nao_muda'],
          'categoria, dono, locação só no locado, período, quantidade, dimensões, canais, obra e espaço da organização, valores, ligação à data e organização fixa');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_itens set nome = 'Praticável 2x1 (novo)' where id = iv.id('61');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade_id = iv.id('61') and acao = 'alterou'),
          'nome', 'mudar o nome deixa uma linha de histórico');
select iv.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_itens' and entidade_id = iv.id('61')) > 0, 'quem lê o item lê o histórico dele');
select iv.volta();

select * from finish();
rollback;
