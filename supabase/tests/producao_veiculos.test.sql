-- PD6.1: veículos da produção e os documentos deles (producao_veiculos e producao_veiculo_documentos).
--
-- Quem lê e quem grava o veículo e o documento (administrador, colaborador, leitor, o recorte "só onde está vinculado",
-- que NÃO vê os veículos, outra organização, produção só para leitura e visitante), a forma (categoria, combustível e
-- contratação da lista, placa, ano, consumo, lugares, fornecedor só fora do próprio, placa única por organização, tipo e
-- número do documento), a coerência (veículo da organização, o que não muda), as chaves e o histórico, que só o veículo
-- tem. Ids 0d2b0000-0000-4000-8000-0000000000XX, ou qp.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: veículos 81 (van própria, placa ABC1D23) e 82 (ônibus fretado, com fornecedor); documentos 91 (do 81,
--   seguro) e 92 (do 82); a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" (pessoa 51,
--   vínculo 61 com o espaço 31).  B (b0), cortesia: veículo 8b, documento 9b; b1 admin.
--   C (c0), produção só para leitura: veículo 8c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_veiculos na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(24);

create schema qp;
grant usage on schema qp to authenticated, anon;

create function qp.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d2b0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select qp.id(s), 'qp-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (qp.id('a0'), 'QP A'), (qp.id('b0'), 'QP B'), (qp.id('c0'), 'QP C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (qp.id('a0'), 'producao', 'cortesia', 20), (qp.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (qp.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = qp.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select qp.id(o), qp.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (qp.id('a0'), qp.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values (qp.id('31'), qp.id('a0'), 'QP E1', 'Teatro');
  insert into public.producao_pessoas (id, organization_id, nome, user_id) values (qp.id('51'), qp.id('a0'), 'QP Pessoa', qp.id('a5'));
  insert into public.producao_vinculos (id, organization_id, pessoa_id, espaco_id, funcao, situacao) values
    (qp.id('61'), qp.id('a0'), qp.id('51'), qp.id('31'), 'Produção', 'confirmada');
  insert into public.producao_veiculos (id, organization_id, nome, placa, categoria, combustivel, contratacao, fornecedor, lugares) values
    (qp.id('81'), qp.id('a0'), 'Van da produção', 'ABC1D23', 'van', 'diesel_s10', 'proprio', null, 15),
    (qp.id('82'), qp.id('a0'), 'Ônibus da turnê', null, 'onibus', 'diesel_s10', 'fretado_combustivel_incluso', 'Viação Sul', 44),
    (qp.id('8b'), qp.id('b0'), 'Veículo da B', null, 'leve', 'flex', 'proprio', null, null),
    (qp.id('8c'), qp.id('c0'), 'Veículo da C', null, 'leve', 'flex', 'proprio', null, null);
  insert into public.producao_veiculo_documentos (id, organization_id, veiculo_id, tipo, numero, validade) values
    (qp.id('91'), qp.id('a0'), qp.id('81'), 'seguro', 'AP-123', date '2026-12-31'),
    (qp.id('92'), qp.id('a0'), qp.id('82'), 'antt', 'T-99', date '2027-03-01'),
    (qp.id('9b'), qp.id('b0'), qp.id('8b'), 'documento_do_veiculo', null, null);
end
$dados$;

create function qp.tenta(comando text) returns text language plpgsql as $$
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

create function qp.efeito(comando text) returns text language plpgsql as $$
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

create function qp.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using qp.id(o || '0');
  return n::text;
end;
$$;

create function qp.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', qp.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function qp.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_veiculos', 'producao_veiculo_documentos')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 10, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_veiculos'::regclass, 'public.producao_veiculo_documentos'::regclass) and relrowsecurity), 2, 'segurança por linha ligada nas duas');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_veiculos'::regclass, 'public.producao_veiculo_documentos'::regclass)),
          'producao_veiculo_documentos.producao_veiculo_documentos_organization_id_fkey=c, producao_veiculo_documentos.producao_veiculo_documentos_veiculo_id_fkey=c, '
          || 'producao_veiculos.producao_veiculos_organization_id_fkey=c',
          'o veículo sai com a organização e leva os documentos');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_veiculo_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_veiculo_documento_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_veiculos', 'select'), 'as coerências não são chamáveis e o visitante não toca nas tabelas');
select is((select string_agg(tgrelid::regclass::text || '.' || tgname::text, ' ' order by tgrelid::regclass::text collate "C", tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid in ('public.producao_veiculos'::regclass, 'public.producao_veiculo_documentos'::regclass)),
          'producao_veiculo_documentos.producao_veiculo_documentos_coerencia producao_veiculo_documentos.producao_veiculo_documentos_updated_at '
          || 'producao_veiculos.producao_veiculos_coerencia producao_veiculos.producao_veiculos_historico producao_veiculos.producao_veiculos_updated_at', 'os gatilhos (só o veículo tem histórico)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select qp.como('a1');
select is(qp.ve('producao_veiculos', 'a'), '2', 'administrador lê os veículos');
select qp.como('a2');
select is(qp.ve('producao_veiculos', 'a'), '2', 'colaborador lê os veículos');
select qp.como('a3');
select is(qp.ve('producao_veiculos', 'a'), '2', 'leitor lê os veículos');
select qp.como('a5');
select is(qp.ve('producao_veiculos', 'a'), '0', 'o recorte "vinculado" não vê os veículos (são da organização inteira)');
select qp.como('b1');
select is(qp.ve('producao_veiculos', 'a'), '0', 'outra organização não lê');
select qp.como('c1');
select is(qp.ve('producao_veiculos', 'c'), '1', 'produção só para leitura lê');
select qp.como(null);
select is(qp.efeito('select 1 from public.producao_veiculos'), '', 'visitante não lê');
select qp.como('a2');
select is(qp.ve('producao_veiculo_documentos', 'a'), '2', 'colaborador lê os documentos');
select qp.como('a5');
select is(qp.ve('producao_veiculo_documentos', 'a'), '0', 'o recorte "vinculado" não vê os documentos');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select qp.como('a2');
select is(qp.efeito(format('update public.producao_veiculos set lugares = 9 where id = %L', qp.id('81'))), 'sim', 'colaborador muda o veículo');
select is(qp.tenta(format('insert into public.producao_veiculos (organization_id, nome, placa) values (%L, %L, %L)', qp.id('a0'), 'Carro de apoio', 'DEF4G56')), 'aceito', 'colaborador cadastra o veículo');
select is(qp.tenta(format('insert into public.producao_veiculo_documentos (organization_id, veiculo_id, tipo, validade) values (%L, %L, %L, %L)', qp.id('a0'), qp.id('81'), 'vistoria', '2027-01-10')), 'aceito', 'colaborador cadastra o documento');
select qp.como('a3');
select ok(qp.tenta(format('insert into public.producao_veiculos (organization_id, nome) values (%L, %L)', qp.id('a0'), 'x')) like '42501%', 'leitor não cadastra o veículo');
select ok(qp.tenta(format('insert into public.producao_veiculo_documentos (organization_id, veiculo_id) values (%L, %L)', qp.id('a0'), qp.id('81'))) like '42501%', 'leitor não cadastra o documento');
select qp.como('c1');
select ok(qp.tenta(format('insert into public.producao_veiculos (organization_id, nome) values (%L, %L)', qp.id('c0'), 'x')) like '42501%', 'produção só para leitura não grava');
select qp.como('a5');
select ok(qp.tenta(format('insert into public.producao_veiculos (organization_id, nome) values (%L, %L)', qp.id('a0'), 'x')) like '42501%', 'o recorte "vinculado" não cadastra veículo');
select qp.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            qp.tenta(format('insert into public.producao_veiculos (organization_id, nome) values (%L, %L)', qp.id('a0'), ' ')),
            qp.tenta(format('insert into public.producao_veiculos (organization_id, nome, placa) values (%L, %L, %L)', qp.id('a0'), 'x', 'abc1d23')),
            qp.tenta(format('insert into public.producao_veiculos (organization_id, nome, categoria) values (%L, %L, %L)', qp.id('a0'), 'x', 'foguete')),
            qp.tenta(format('insert into public.producao_veiculos (organization_id, nome, combustivel) values (%L, %L, %L)', qp.id('a0'), 'x', 'agua')),
            qp.tenta(format('insert into public.producao_veiculos (organization_id, nome, contratacao) values (%L, %L, %L)', qp.id('a0'), 'x', 'emprestado')),
            qp.tenta(format('insert into public.producao_veiculos (organization_id, nome, contratacao, fornecedor) values (%L, %L, %L, %L)', qp.id('a0'), 'x', 'proprio', 'Locadora')),
            qp.tenta(format('insert into public.producao_veiculos (organization_id, nome, consumo_km_por_litro) values (%L, %L, 0)', qp.id('a0'), 'x')),
            qp.tenta(format('insert into public.producao_veiculos (organization_id, nome, ano) values (%L, %L, 1900)', qp.id('a0'), 'x')),
            qp.tenta(format('insert into public.producao_veiculos (organization_id, nome, lugares) values (%L, %L, 0)', qp.id('a0'), 'x')),
            qp.tenta(format('insert into public.producao_veiculos (organization_id, nome, placa) values (%L, %L, %L)', qp.id('a0'), 'x', 'ABC1D23')),
            qp.tenta(format('insert into public.producao_veiculos (organization_id, nome, placa) values (%L, %L, %L)', qp.id('b0'), 'x', 'ABC1D23')),
            qp.tenta(format('update public.producao_veiculos set organization_id = %L where id = %L', qp.id('b0'), qp.id('81'))),
            qp.tenta(format('insert into public.producao_veiculo_documentos (organization_id, veiculo_id, tipo) values (%L, %L, %L)', qp.id('a0'), qp.id('81'), 'rg')),
            qp.tenta(format('insert into public.producao_veiculo_documentos (organization_id, veiculo_id, numero) values (%L, %L, %L)', qp.id('a0'), qp.id('81'), ' ')),
            qp.tenta(format('insert into public.producao_veiculo_documentos (organization_id, veiculo_id) values (%L, %L)', qp.id('a0'), qp.id('8b'))),
            qp.tenta(format('update public.producao_veiculo_documentos set veiculo_id = %L where id = %L', qp.id('82'), qp.id('91')))],
          array['23514 producao_veiculos_nome_check', '23514 producao_veiculos_placa_check', '23514 producao_veiculos_categoria_check', '23514 producao_veiculos_combustivel_check',
                '23514 producao_veiculos_contratacao_check', '23514 producao_veiculos_fornecedor_contratacao_check', '23514 producao_veiculos_consumo_check',
                '23514 producao_veiculos_ano_check', '23514 producao_veiculos_lugares_check', '23505 producao_veiculos_placa_idx', 'aceito',
                '23514 organizacao_nao_muda',
                '23514 producao_veiculo_documentos_tipo_check', '23514 producao_veiculo_documentos_numero_check', '23514 veiculo_de_outra_organizacao', '23514 veiculo_nao_muda'],
          'listas, placa, ano, consumo, lugares, fornecedor só fora do próprio, placa única por organização, documento; veículo da organização e o que não muda');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_veiculos set nome = 'Van da produção (2)' where id = qp.id('81');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade_id = qp.id('81') and acao = 'alterou'),
          'nome', 'mudar o nome deixa uma linha de histórico');
select qp.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_veiculos' and entidade_id = qp.id('81')) > 0, 'quem lê o veículo lê o histórico dele');
select qp.volta();

select * from finish();
rollback;
