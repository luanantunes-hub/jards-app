-- PD3.1: ficha do espaço e ficha técnica da sala (producao_espaco_fichas e producao_sala_fichas).
--
-- Quem lê e quem grava as fichas (administrador, colaborador, leitor, o recorte "só onde está vinculado", que vê e
-- edita só a ficha do espaço em que tem vínculo, outra organização, produção só para leitura e visitante), a forma
-- dos dados (medidas, canais, tensão, fases, contato) e a coerência entre organizações (espaço, sala, e os dois que não
-- mudam). Ids 0d290000-0000-4000-8000-0000000000XX, ou fi.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: espaços 31, 32 e 33; salas 71 (do 31), 72 (do 32), 73 (do 31, sem ficha) e 74 (do 32, sem ficha);
--   fichas dos espaços 31 e 32 e das salas 71 e 72; a1 admin, a2 colaborador, a3 leitor; a5 colaborador com o recorte
--   "vinculado" e vínculo só com o espaço 31 (pessoa 51, vínculo 61).
--   B (b0), cortesia: espaço 3b, sala 7b; b1 admin.  C (c0), produção só para leitura: espaço 3c, sala 7c, fichas; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_fichas na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

create schema fi;
grant usage on schema fi to authenticated, anon;

create function fi.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d290000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select fi.id(s), 'fi-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (fi.id('a0'), 'FI A'), (fi.id('b0'), 'FI B'), (fi.id('c0'), 'FI C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (fi.id('a0'), 'producao', 'cortesia', 20), (fi.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (fi.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = fi.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select fi.id(o), fi.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (fi.id('a0'), fi.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (fi.id('31'), fi.id('a0'), 'FI E1', 'Teatro'), (fi.id('32'), fi.id('a0'), 'FI E2', 'Teatro'), (fi.id('33'), fi.id('a0'), 'FI E3', 'Teatro'),
    (fi.id('3b'), fi.id('b0'), 'FI EB', 'Teatro'), (fi.id('3c'), fi.id('c0'), 'FI EC', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values
    (fi.id('71'), fi.id('a0'), fi.id('31'), 'S1'), (fi.id('72'), fi.id('a0'), fi.id('32'), 'S2'), (fi.id('73'), fi.id('a0'), fi.id('31'), 'S3'),
    (fi.id('74'), fi.id('a0'), fi.id('32'), 'S4'), (fi.id('7b'), fi.id('b0'), fi.id('3b'), 'SB'), (fi.id('7c'), fi.id('c0'), fi.id('3c'), 'SC');
  insert into public.producao_pessoas (id, organization_id, nome, user_id) values (fi.id('51'), fi.id('a0'), 'FI Pessoa', fi.id('a5'));
  insert into public.producao_vinculos (id, organization_id, pessoa_id, espaco_id, funcao, situacao) values
    (fi.id('61'), fi.id('a0'), fi.id('51'), fi.id('31'), 'Produção', 'confirmada');
  insert into public.producao_espaco_fichas (espaco_id, organization_id, funcionamento, contato_nome) values
    (fi.id('31'), fi.id('a0'), 'Terça a domingo', 'Ana'), (fi.id('32'), fi.id('a0'), 'Só fins de semana', 'Bia'), (fi.id('3c'), fi.id('c0'), 'Da C', null);
  insert into public.producao_sala_fichas (sala_id, organization_id, palco_boca_m, palco_profundidade_m) values
    (fi.id('71'), fi.id('a0'), 10, 8), (fi.id('72'), fi.id('a0'), 6, 5), (fi.id('7c'), fi.id('c0'), 8, 6);
end
$dados$;

create function fi.tenta(comando text) returns text language plpgsql as $$
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

create function fi.efeito(comando text) returns text language plpgsql as $$
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

create function fi.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using fi.id(o || '0');
  return n::text;
end;
$$;

create function fi.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', fi.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function fi.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_espaco_fichas', 'producao_sala_fichas')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 10, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_espaco_fichas'::regclass, 'public.producao_sala_fichas'::regclass) and relrowsecurity), 2, 'segurança por linha ligada nas duas');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_espaco_fichas'::regclass, 'public.producao_sala_fichas'::regclass)),
          'producao_espaco_fichas.producao_espaco_fichas_espaco_id_fkey=c, producao_espaco_fichas.producao_espaco_fichas_organization_id_fkey=c, '
          || 'producao_sala_fichas.producao_sala_fichas_organization_id_fkey=c, producao_sala_fichas.producao_sala_fichas_sala_id_fkey=c',
          'a ficha sai com o espaço, com a sala e com a organização');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_espaco_ficha_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_sala_ficha_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_espaco_fichas', 'select')
          and not has_table_privilege('anon', 'public.producao_sala_fichas', 'select'), 'as coerências não são chamáveis e o visitante não toca nas tabelas');
select is((select string_agg(tgrelid::regclass::text || '.' || tgname::text, ' ' order by tgrelid::regclass::text collate "C", tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid in ('public.producao_espaco_fichas'::regclass, 'public.producao_sala_fichas'::regclass)),
          'producao_espaco_fichas.producao_espaco_fichas_coerencia producao_espaco_fichas.producao_espaco_fichas_updated_at '
          || 'producao_sala_fichas.producao_sala_fichas_coerencia producao_sala_fichas.producao_sala_fichas_updated_at', 'os gatilhos (sem histórico: o contato é dado pessoal)');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select fi.como('a1');
select is(fi.ve('producao_espaco_fichas', 'a'), '2', 'administrador lê as duas fichas de espaço');
select fi.como('a2');
select is(fi.ve('producao_espaco_fichas', 'a'), '2', 'colaborador lê as duas');
select fi.como('a3');
select is(fi.ve('producao_espaco_fichas', 'a'), '2', 'leitor lê as duas');
select fi.como('a5');
select is(fi.ve('producao_espaco_fichas', 'a'), '1', 'o recorte "vinculado" lê só a ficha do espaço em que tem vínculo');
select fi.como('b1');
select is(fi.ve('producao_espaco_fichas', 'a'), '0', 'outra organização não lê');
select fi.como('c1');
select is(fi.ve('producao_espaco_fichas', 'c'), '1', 'produção só para leitura lê');
select fi.como(null);
select is(fi.efeito('select 1 from public.producao_espaco_fichas'), '', 'visitante não lê');
select fi.como('a2');
select is(fi.ve('producao_sala_fichas', 'a'), '2', 'colaborador lê as fichas das salas');
select fi.como('a5');
select is(fi.ve('producao_sala_fichas', 'a'), '1', 'o recorte "vinculado" lê só a ficha da sala do espaço em que tem vínculo');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select fi.como('a2');
select is(fi.efeito(format('update public.producao_espaco_fichas set funcionamento = %L where espaco_id = %L', 'Todos os dias', fi.id('32'))), 'sim', 'colaborador altera a ficha do espaço');
select is(fi.tenta(format('insert into public.producao_sala_fichas (sala_id, organization_id, palco_boca_m) values (%L, %L, 9)', fi.id('73'), fi.id('a0'))), 'aceito', 'colaborador cria a ficha da sala');
select fi.como('a3');
select ok(fi.tenta(format('insert into public.producao_sala_fichas (sala_id, organization_id) values (%L, %L)', fi.id('73'), fi.id('a0'))) like '42501%', 'leitor não cria a ficha');
select fi.como('c1');
select ok(fi.tenta(format('insert into public.producao_espaco_fichas (espaco_id, organization_id) values (%L, %L)', fi.id('3c'), fi.id('c0'))) like '42501%'
          or fi.efeito(format('update public.producao_espaco_fichas set funcionamento = %L where espaco_id = %L', 'x', fi.id('3c'))) = '', 'produção só para leitura não grava');
select fi.como('a5');
select is(fi.efeito(format('update public.producao_espaco_fichas set funcionamento = %L where espaco_id = %L', 'Mudou', fi.id('31'))), 'sim', 'o recorte edita a ficha do espaço dele');
select is(fi.efeito(format('update public.producao_espaco_fichas set funcionamento = %L where espaco_id = %L', 'Mudou', fi.id('32'))), '', 'o recorte não edita a ficha de outro espaço (nem a vê)');
select is(fi.tenta(format('insert into public.producao_sala_fichas (sala_id, organization_id, palco_boca_m) values (%L, %L, 9)', fi.id('73'), fi.id('a0'))), 'aceito', 'o recorte cria a ficha da sala do espaço dele');
select ok(fi.tenta(format('insert into public.producao_sala_fichas (sala_id, organization_id) values (%L, %L)', fi.id('74'), fi.id('a0'))) like '42501%', 'o recorte não cria ficha de sala de outro espaço');
select fi.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            fi.tenta(format('insert into public.producao_espaco_fichas (espaco_id, organization_id, doca_altura_m) values (%L, %L, 25)', fi.id('33'), fi.id('a0'))),
            fi.tenta(format('insert into public.producao_espaco_fichas (espaco_id, organization_id, veiculo_max_m) values (%L, %L, 41)', fi.id('33'), fi.id('a0'))),
            fi.tenta(format('insert into public.producao_espaco_fichas (espaco_id, organization_id, contato_email) values (%L, %L, %L)', fi.id('33'), fi.id('a0'), 'sem-arroba')),
            fi.tenta(format('insert into public.producao_espaco_fichas (espaco_id, organization_id, contato_telefone) values (%L, %L, %L)', fi.id('33'), fi.id('a0'), ' ')),
            fi.tenta(format('insert into public.producao_espaco_fichas (espaco_id, organization_id, contato_nome) values (%L, %L, %L)', fi.id('33'), fi.id('a0'), ' ')),
            fi.tenta(format('update public.producao_espaco_fichas set organization_id = %L where espaco_id = %L', fi.id('b0'), fi.id('31'))),
            fi.tenta(format('insert into public.producao_espaco_fichas (espaco_id, organization_id) values (%L, %L)', fi.id('3b'), fi.id('a0'))),
            fi.tenta(format('update public.producao_espaco_fichas set espaco_id = %L where espaco_id = %L', fi.id('33'), fi.id('31'))),
            fi.tenta(format('insert into public.producao_sala_fichas (sala_id, organization_id, palco_boca_m) values (%L, %L, 201)', fi.id('73'), fi.id('a0'))),
            fi.tenta(format('insert into public.producao_sala_fichas (sala_id, organization_id, energia_tensao_v) values (%L, %L, 99)', fi.id('73'), fi.id('a0'))),
            fi.tenta(format('insert into public.producao_sala_fichas (sala_id, organization_id, energia_fases) values (%L, %L, 4)', fi.id('73'), fi.id('a0'))),
            fi.tenta(format('insert into public.producao_sala_fichas (sala_id, organization_id, som_canais_entrada) values (%L, %L, 257)', fi.id('73'), fi.id('a0'))),
            fi.tenta(format('insert into public.producao_sala_fichas (sala_id, organization_id, luz_refletores) values (%L, %L, 5001)', fi.id('73'), fi.id('a0'))),
            fi.tenta(format('insert into public.producao_sala_fichas (sala_id, organization_id, camarins_capacidade) values (%L, %L, 1001)', fi.id('73'), fi.id('a0'))),
            fi.tenta(format('insert into public.producao_sala_fichas (sala_id, organization_id, notas) values (%L, %L, repeat(%L, 4001))', fi.id('73'), fi.id('a0'), 'a')),
            fi.tenta(format('insert into public.producao_sala_fichas (sala_id, organization_id, energia_kva) values (%L, %L, -1)', fi.id('73'), fi.id('a0'))),
            fi.tenta(format('insert into public.producao_sala_fichas (sala_id, organization_id) values (%L, %L)', fi.id('7b'), fi.id('a0'))),
            fi.tenta(format('update public.producao_sala_fichas set sala_id = %L where sala_id = %L', fi.id('73'), fi.id('71'))),
            fi.tenta(format('update public.producao_sala_fichas set organization_id = %L where sala_id = %L', fi.id('b0'), fi.id('71')))],
          array['23514 producao_espaco_fichas_doca_check', '23514 producao_espaco_fichas_veiculo_check', '23514 producao_espaco_fichas_contato_email_check',
                '23514 producao_espaco_fichas_contato_telefone_check', '23514 producao_espaco_fichas_contato_nome_check', '23514 organizacao_nao_muda',
                '23514 espaco_de_outra_organizacao', '23514 espaco_nao_muda',
                '23514 producao_sala_fichas_boca_check', '23514 producao_sala_fichas_energia_tensao_check', '23514 producao_sala_fichas_energia_fases_check',
                '23514 producao_sala_fichas_som_canais_check', '23514 producao_sala_fichas_luz_refletores_check', '23514 producao_sala_fichas_camarins_capacidade_check',
                '23514 producao_sala_fichas_notas_check', '23514 producao_sala_fichas_energia_kva_check', '23514 sala_de_outra_organizacao', '23514 sala_nao_muda', '23514 organizacao_nao_muda'],
          'medidas, contato, canais, tensão, fases, espaço e sala da organização, e o que não muda');

select * from finish();
rollback;
