-- PD6.2 (primeiro corte): deslocamentos da data (producao_deslocamentos).
--
-- Quem lê e quem grava o deslocamento (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo,
-- outra organização, produção só para leitura e visitante), a coerência (data, veículo e motorista da organização; a
-- organização e a data não mudam), a forma dos dados (tipo da lista, textos, chegada depois da saída), as chaves e o
-- histórico, que deixa o localizador de fora. Ids 0d2c0000-0000-4000-8000-0000000000XX, ou dl.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: temporada 21, data 41, veículo 81, pessoa 51 (motorista), deslocamento 61 (van, com veículo e motorista);
--   a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.
--   B (b0), cortesia: temporada 2b, data 4b, veículo 8b, pessoa 5b; b1 admin.
--   C (c0), produção só para leitura: temporada 2c, data 4c, deslocamento 6c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com as migrations producao_veiculos e producao_deslocamentos na frente se não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

create schema dl;
grant usage on schema dl to authenticated, anon;

create function dl.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d2c0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select dl.id(s), 'dl-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (dl.id('a0'), 'DL A'), (dl.id('b0'), 'DL B'), (dl.id('c0'), 'DL C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (dl.id('a0'), 'producao', 'cortesia', 20), (dl.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (dl.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = dl.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select dl.id(o), dl.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (dl.id('a0'), dl.id('a5'), false, 'vinculado');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (dl.id('21'), dl.id('a0'), 'circulacao', 'circula', 'teatro', 'DL T'), (dl.id('2b'), dl.id('b0'), 'circulacao', 'circula', 'teatro', 'DL TB'),
    (dl.id('2c'), dl.id('c0'), 'circulacao', 'circula', 'teatro', 'DL TC');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (dl.id('41'), dl.id('a0'), dl.id('21'), date '2026-12-05'), (dl.id('4b'), dl.id('b0'), dl.id('2b'), date '2026-12-05'),
    (dl.id('4c'), dl.id('c0'), dl.id('2c'), date '2026-12-05');
  insert into public.producao_veiculos (id, organization_id, nome) values (dl.id('81'), dl.id('a0'), 'DL Van'), (dl.id('8b'), dl.id('b0'), 'DL Van B');
  insert into public.producao_pessoas (id, organization_id, nome) values (dl.id('51'), dl.id('a0'), 'DL Motorista'), (dl.id('5b'), dl.id('b0'), 'DL Motorista B');
  insert into public.producao_deslocamentos (id, organization_id, data_id, tipo, origem, destino, saida, chegada, veiculo_id, motorista_id, localizador) values
    (dl.id('61'), dl.id('a0'), dl.id('41'), 'van', 'São Paulo', 'Campinas', timestamptz '2026-12-05 09:00-03', timestamptz '2026-12-05 11:00-03', dl.id('81'), dl.id('51'), 'ABC123'),
    (dl.id('6c'), dl.id('c0'), dl.id('4c'), 'van', null, null, null, null, null, null, 'XYZ');
end
$dados$;

create function dl.tenta(comando text) returns text language plpgsql as $$
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

create function dl.efeito(comando text) returns text language plpgsql as $$
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

create function dl.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using dl.id(o || '0');
  return n::text;
end;
$$;

create function dl.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', dl.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function dl.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_deslocamentos'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select is((select count(*)::int from pg_class where oid = 'public.producao_deslocamentos'::regclass and relrowsecurity), 1, 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_deslocamentos'::regclass),
          'producao_deslocamentos_data_id_fkey=c, producao_deslocamentos_motorista_id_fkey=n, producao_deslocamentos_organization_id_fkey=c, producao_deslocamentos_veiculo_id_fkey=n',
          'o deslocamento sai com a data; apagar o veículo ou a pessoa só os solta dele');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_deslocamento_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_deslocamentos', 'select'), 'a coerência não é chamável e o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_deslocamentos'::regclass),
          'producao_deslocamentos_coerencia producao_deslocamentos_historico producao_deslocamentos_updated_at', 'os gatilhos');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select dl.como('a1');
select is(dl.ve('producao_deslocamentos', 'a'), '1', 'administrador lê');
select dl.como('a2');
select is(dl.ve('producao_deslocamentos', 'a'), '1', 'colaborador lê');
select dl.como('a3');
select is(dl.ve('producao_deslocamentos', 'a'), '1', 'leitor lê');
select dl.como('a5');
select is(dl.ve('producao_deslocamentos', 'a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select dl.como('b1');
select is(dl.ve('producao_deslocamentos', 'a'), '0', 'outra organização não lê');
select dl.como('c1');
select is(dl.ve('producao_deslocamentos', 'c'), '1', 'produção só para leitura lê');
select dl.como(null);
select is(dl.efeito('select 1 from public.producao_deslocamentos'), '', 'visitante não lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select dl.como('a2');
select is(dl.efeito(format('update public.producao_deslocamentos set destino = %L where id = %L', 'Sorocaba', dl.id('61'))), 'sim', 'colaborador muda o deslocamento');
select is(dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id, tipo) values (%L, %L, %L)', dl.id('a0'), dl.id('41'), 'aviao')), 'aceito', 'colaborador cadastra o deslocamento');
select dl.como('a3');
select ok(dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id) values (%L, %L)', dl.id('a0'), dl.id('41'))) like '42501%', 'leitor não cadastra');
select dl.como('c1');
select ok(dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id) values (%L, %L)', dl.id('c0'), dl.id('4c'))) like '42501%', 'produção só para leitura não grava');
select dl.como('a5');
select ok(dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id) values (%L, %L)', dl.id('a0'), dl.id('41'))) like '42501%', 'o recorte "vinculado" sem vínculo não cadastra');
select dl.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id, tipo) values (%L, %L, %L)', dl.id('a0'), dl.id('41'), 'foguete')),
            dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id, origem) values (%L, %L, %L)', dl.id('a0'), dl.id('41'), ' ')),
            dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id, destino) values (%L, %L, %L)', dl.id('a0'), dl.id('41'), ' ')),
            dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id, chegada) values (%L, %L, %L)', dl.id('a0'), dl.id('41'), '2026-12-05 11:00-03')),
            dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id, saida, chegada) values (%L, %L, %L, %L)', dl.id('a0'), dl.id('41'), '2026-12-05 11:00-03', '2026-12-05 09:00-03')),
            dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id, companhia) values (%L, %L, %L)', dl.id('a0'), dl.id('41'), ' ')),
            dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id, localizador) values (%L, %L, %L)', dl.id('a0'), dl.id('41'), ' ')),
            dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id, notas) values (%L, %L, %L)', dl.id('a0'), dl.id('41'), ' ')),
            dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id) values (%L, %L)', dl.id('a0'), dl.id('4b'))),
            dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id, veiculo_id) values (%L, %L, %L)', dl.id('a0'), dl.id('41'), dl.id('8b'))),
            dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id, motorista_id) values (%L, %L, %L)', dl.id('a0'), dl.id('41'), dl.id('5b'))),
            dl.tenta(format('update public.producao_deslocamentos set organization_id = %L where id = %L', dl.id('b0'), dl.id('61'))),
            dl.tenta(format('update public.producao_deslocamentos set data_id = %L where id = %L', dl.id('4b'), dl.id('61'))),
            dl.tenta(format('insert into public.producao_deslocamentos (organization_id, data_id, tipo, saida, chegada, veiculo_id, motorista_id) values (%L, %L, %L, %L, %L, %L, %L)', dl.id('a0'), dl.id('41'), 'onibus', '2026-12-05 09:00-03', '2026-12-05 09:00-03', dl.id('81'), dl.id('51')))],
          array['23514 producao_deslocamentos_tipo_check', '23514 producao_deslocamentos_origem_check', '23514 producao_deslocamentos_destino_check',
                '23514 producao_deslocamentos_periodo_check', '23514 producao_deslocamentos_periodo_check', '23514 producao_deslocamentos_companhia_check',
                '23514 producao_deslocamentos_localizador_check', '23514 producao_deslocamentos_notas_check',
                '23514 data_de_outra_organizacao', '23514 veiculo_de_outra_organizacao', '23514 motorista_de_outra_organizacao',
                '23514 organizacao_nao_muda', '23514 data_nao_muda', 'aceito'],
          'tipo, textos, chegada depois da saída; data, veículo e motorista da organização; o que não muda; dois deslocamentos no mesmo horário são aceitos (a tela avisa)');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_deslocamentos set tipo = 'onibus', localizador = 'NOVO999' where id = dl.id('61');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade_id = dl.id('61') and acao = 'alterou'),
          'tipo', 'mudar o tipo deixa uma linha; o localizador não aparece no histórico');
select dl.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_deslocamentos' and entidade_id = dl.id('61')) > 0, 'quem lê o deslocamento lê o histórico dele');
select dl.volta();

select * from finish();
rollback;
