-- PD3.2: equipamentos da casa e manutenção (producao_equipamentos e producao_manutencoes).
--
-- Quem lê e quem grava o equipamento e a manutenção (administrador, colaborador, leitor, o recorte "só onde está
-- vinculado", que vê e edita só os equipamentos do espaço em que tem vínculo, outra organização, produção só para leitura
-- e visitante), a forma (categoria e estado da lista, quantidade, tipo e recorrência da manutenção), a coerência entre
-- organizações (espaço, sala do mesmo espaço, equipamento, e o que não muda), as chaves e o histórico, que só o
-- equipamento tem. Ids 0d2a0000-0000-4000-8000-0000000000XX, ou qp.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: espaços 31 e 32; salas 71 (do 31) e 72 (do 32); equipamentos 81 (no 31, sala 71) e 82 (no 32);
--   manutenções 91 (do 81, preventiva a cada 90 dias) e 92 (do 82); a1 admin, a2 colaborador, a3 leitor, a5 colaborador
--   com o recorte "vinculado" e vínculo só com o espaço 31 (pessoa 51, vínculo 61).
--   B (b0), cortesia: espaço 3b, sala 7b, equipamento 8b; b1 admin.  C (c0), produção só para leitura: espaço 3c,
--   equipamento 8c, manutenção 9c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_equipamentos na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(25);

create schema qp;
grant usage on schema qp to authenticated, anon;

create function qp.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d2a0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
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
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (qp.id('31'), qp.id('a0'), 'QP E1', 'Teatro'), (qp.id('32'), qp.id('a0'), 'QP E2', 'Teatro'),
    (qp.id('3b'), qp.id('b0'), 'QP EB', 'Teatro'), (qp.id('3c'), qp.id('c0'), 'QP EC', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values
    (qp.id('71'), qp.id('a0'), qp.id('31'), 'S1'), (qp.id('72'), qp.id('a0'), qp.id('32'), 'S2'), (qp.id('7b'), qp.id('b0'), qp.id('3b'), 'SB');
  insert into public.producao_pessoas (id, organization_id, nome, user_id) values (qp.id('51'), qp.id('a0'), 'QP Pessoa', qp.id('a5'));
  insert into public.producao_vinculos (id, organization_id, pessoa_id, espaco_id, funcao, situacao) values
    (qp.id('61'), qp.id('a0'), qp.id('51'), qp.id('31'), 'Produção', 'confirmada');
  insert into public.producao_equipamentos (id, organization_id, espaco_id, sala_id, nome, categoria, quantidade, estado) values
    (qp.id('81'), qp.id('a0'), qp.id('31'), qp.id('71'), 'Refletor LED', 'luz', 24, 'em_uso'),
    (qp.id('82'), qp.id('a0'), qp.id('32'), null, 'Mesa de som', 'som', 1, 'avariado'),
    (qp.id('8b'), qp.id('b0'), qp.id('3b'), null, 'Equipamento da B', 'outro', 1, 'em_uso'),
    (qp.id('8c'), qp.id('c0'), qp.id('3c'), null, 'Equipamento da C', 'outro', 1, 'em_uso');
  insert into public.producao_manutencoes (id, organization_id, equipamento_id, tipo, descricao, prevista_para, recorrencia_dias) values
    (qp.id('91'), qp.id('a0'), qp.id('81'), 'preventiva', 'Limpeza e revisão', date '2026-12-01', 90),
    (qp.id('92'), qp.id('a0'), qp.id('82'), 'corretiva', 'Trocar a fonte', date '2026-11-20', null),
    (qp.id('9c'), qp.id('c0'), qp.id('8c'), 'preventiva', 'Revisão da C', date '2026-12-01', null);
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

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_equipamentos', 'producao_manutencoes')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 10, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_equipamentos'::regclass, 'public.producao_manutencoes'::regclass) and relrowsecurity), 2, 'segurança por linha ligada nas duas');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_equipamentos'::regclass, 'public.producao_manutencoes'::regclass)),
          'producao_equipamentos.producao_equipamentos_espaco_id_fkey=c, producao_equipamentos.producao_equipamentos_organization_id_fkey=c, producao_equipamentos.producao_equipamentos_sala_id_fkey=n, '
          || 'producao_manutencoes.producao_manutencoes_equipamento_id_fkey=c, producao_manutencoes.producao_manutencoes_organization_id_fkey=c',
          'o equipamento sai com o espaço e leva as manutenções; apagar a sala só solta o equipamento');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_equipamento_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_manutencao_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_equipamentos', 'select'), 'as coerências não são chamáveis e o visitante não toca nas tabelas');
select is((select string_agg(tgrelid::regclass::text || '.' || tgname::text, ' ' order by tgrelid::regclass::text collate "C", tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid in ('public.producao_equipamentos'::regclass, 'public.producao_manutencoes'::regclass)),
          'producao_equipamentos.producao_equipamentos_coerencia producao_equipamentos.producao_equipamentos_historico producao_equipamentos.producao_equipamentos_updated_at '
          || 'producao_manutencoes.producao_manutencoes_coerencia producao_manutencoes.producao_manutencoes_updated_at', 'os gatilhos (só o equipamento tem histórico)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select qp.como('a1');
select is(qp.ve('producao_equipamentos', 'a'), '2', 'administrador lê os equipamentos');
select qp.como('a2');
select is(qp.ve('producao_equipamentos', 'a'), '2', 'colaborador lê os equipamentos');
select qp.como('a3');
select is(qp.ve('producao_equipamentos', 'a'), '2', 'leitor lê os equipamentos');
select qp.como('a5');
select is(qp.ve('producao_equipamentos', 'a'), '1', 'o recorte "vinculado" lê só os equipamentos do espaço em que tem vínculo');
select qp.como('b1');
select is(qp.ve('producao_equipamentos', 'a'), '0', 'outra organização não lê');
select qp.como('c1');
select is(qp.ve('producao_equipamentos', 'c'), '1', 'produção só para leitura lê');
select qp.como(null);
select is(qp.efeito('select 1 from public.producao_equipamentos'), '', 'visitante não lê');
select qp.como('a2');
select is(qp.ve('producao_manutencoes', 'a'), '2', 'colaborador lê as manutenções');
select qp.como('a5');
select is(qp.ve('producao_manutencoes', 'a'), '1', 'o recorte "vinculado" lê só as manutenções do espaço dele');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select qp.como('a2');
select is(qp.efeito(format('update public.producao_equipamentos set estado = %L where id = %L', 'manutencao', qp.id('82'))), 'sim', 'colaborador muda o estado do equipamento');
select is(qp.tenta(format('insert into public.producao_equipamentos (organization_id, espaco_id, nome) values (%L, %L, %L)', qp.id('a0'), qp.id('31'), 'Projetor')), 'aceito', 'colaborador cadastra o equipamento');
select qp.como('a3');
select ok(qp.tenta(format('insert into public.producao_equipamentos (organization_id, espaco_id, nome) values (%L, %L, %L)', qp.id('a0'), qp.id('31'), 'x')) like '42501%', 'leitor não cadastra');
select qp.como('c1');
select ok(qp.tenta(format('insert into public.producao_equipamentos (organization_id, espaco_id, nome) values (%L, %L, %L)', qp.id('c0'), qp.id('3c'), 'x')) like '42501%', 'produção só para leitura não grava');
select qp.como('a5');
select is(qp.tenta(format('insert into public.producao_equipamentos (organization_id, espaco_id, nome) values (%L, %L, %L)', qp.id('a0'), qp.id('31'), 'Cabo')), 'aceito', 'o recorte cadastra no espaço dele');
select ok(qp.tenta(format('insert into public.producao_equipamentos (organization_id, espaco_id, nome) values (%L, %L, %L)', qp.id('a0'), qp.id('32'), 'x')) like '42501%', 'o recorte não cadastra em outro espaço');
select is(qp.tenta(format('insert into public.producao_manutencoes (organization_id, equipamento_id, descricao, prevista_para) values (%L, %L, %L, %L)', qp.id('a0'), qp.id('81'), 'Revisão extra', '2027-01-10')), 'aceito', 'o recorte agenda manutenção do equipamento dele');
select qp.como('a3');
select ok(qp.tenta(format('insert into public.producao_manutencoes (organization_id, equipamento_id, descricao, prevista_para) values (%L, %L, %L, %L)', qp.id('a0'), qp.id('81'), 'x', '2027-01-10')) like '42501%', 'leitor não agenda manutenção');
select qp.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            qp.tenta(format('insert into public.producao_equipamentos (organization_id, espaco_id, nome) values (%L, %L, %L)', qp.id('a0'), qp.id('31'), ' ')),
            qp.tenta(format('insert into public.producao_equipamentos (organization_id, espaco_id, nome, categoria) values (%L, %L, %L, %L)', qp.id('a0'), qp.id('31'), 'x', 'drone')),
            qp.tenta(format('insert into public.producao_equipamentos (organization_id, espaco_id, nome, quantidade) values (%L, %L, %L, 0)', qp.id('a0'), qp.id('31'), 'x')),
            qp.tenta(format('insert into public.producao_equipamentos (organization_id, espaco_id, nome, estado) values (%L, %L, %L, %L)', qp.id('a0'), qp.id('31'), 'x', 'quebrado')),
            qp.tenta(format('insert into public.producao_equipamentos (organization_id, espaco_id, nome, observacoes) values (%L, %L, %L, repeat(%L, 2001))', qp.id('a0'), qp.id('31'), 'x', 'a')),
            qp.tenta(format('insert into public.producao_equipamentos (organization_id, espaco_id, nome) values (%L, %L, %L)', qp.id('a0'), qp.id('3b'), 'x')),
            qp.tenta(format('insert into public.producao_equipamentos (organization_id, espaco_id, sala_id, nome) values (%L, %L, %L, %L)', qp.id('a0'), qp.id('31'), qp.id('7b'), 'x')),
            qp.tenta(format('insert into public.producao_equipamentos (organization_id, espaco_id, sala_id, nome) values (%L, %L, %L, %L)', qp.id('a0'), qp.id('31'), qp.id('72'), 'x')),
            qp.tenta(format('update public.producao_equipamentos set organization_id = %L where id = %L', qp.id('b0'), qp.id('81'))),
            qp.tenta(format('update public.producao_equipamentos set espaco_id = %L where id = %L', qp.id('32'), qp.id('81'))),
            qp.tenta(format('insert into public.producao_manutencoes (organization_id, equipamento_id, tipo, descricao, prevista_para) values (%L, %L, %L, %L, %L)', qp.id('a0'), qp.id('81'), 'geral', 'x', '2027-01-10')),
            qp.tenta(format('insert into public.producao_manutencoes (organization_id, equipamento_id, descricao, prevista_para) values (%L, %L, %L, %L)', qp.id('a0'), qp.id('81'), ' ', '2027-01-10')),
            qp.tenta(format('insert into public.producao_manutencoes (organization_id, equipamento_id, descricao, prevista_para, recorrencia_dias) values (%L, %L, %L, %L, 0)', qp.id('a0'), qp.id('81'), 'x', '2027-01-10')),
            qp.tenta(format('insert into public.producao_manutencoes (organization_id, equipamento_id, tipo, descricao, prevista_para, recorrencia_dias) values (%L, %L, %L, %L, %L, 30)', qp.id('a0'), qp.id('81'), 'corretiva', 'x', '2027-01-10')),
            qp.tenta(format('insert into public.producao_manutencoes (organization_id, equipamento_id, descricao, prevista_para) values (%L, %L, %L, %L)', qp.id('a0'), qp.id('8b'), 'x', '2027-01-10')),
            qp.tenta(format('update public.producao_manutencoes set equipamento_id = %L where id = %L', qp.id('82'), qp.id('91')))],
          array['23514 producao_equipamentos_nome_check', '23514 producao_equipamentos_categoria_check', '23514 producao_equipamentos_quantidade_check', '23514 producao_equipamentos_estado_check',
                '23514 producao_equipamentos_observacoes_check', '23514 espaco_de_outra_organizacao', '23514 sala_de_outra_organizacao', '23514 sala_de_outro_espaco',
                '23514 organizacao_nao_muda', '23514 espaco_nao_muda',
                '23514 producao_manutencoes_tipo_check', '23514 producao_manutencoes_descricao_check', '23514 producao_manutencoes_recorrencia_check',
                '23514 producao_manutencoes_recorrencia_tipo_check', '23514 equipamento_de_outra_organizacao', '23514 equipamento_nao_muda'],
          'categoria, estado, quantidade, tipo e recorrência; espaço, sala do mesmo espaço e equipamento da organização; o que não muda');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_equipamentos set nome = 'Refletor LED 200 W' where id = qp.id('81');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade_id = qp.id('81') and acao = 'alterou'),
          'nome', 'mudar o nome deixa uma linha de histórico');
select qp.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_equipamentos' and entidade_id = qp.id('81')) > 0, 'quem lê o equipamento lê o histórico dele');
select qp.volta();

select * from finish();
rollback;
