-- PD6.4 (primeiro corte): abastecimento e quilometragem do motorista (producao_abastecimentos, os odômetros de
-- producao_deslocamentos e fn_equipe_registrar_viagem).
--
-- A tabela: quem lê e quem grava (colaborador, leitor, outra organização), as chaves, o gatilho e a forma dos dados. Os odômetros:
-- chegada nunca antes da saída. A função da pessoa convidada: só o MOTORISTA do deslocamento registra (não outra pessoa da equipe, não
-- quem não tem convite, não convite revogado, não data cancelada), cada valor inválido volta com o motivo, quem não informa não apaga
-- o que já estava, e a folha do motorista devolve os odômetros e só os abastecimentos que ELE registrou.
-- Ids 0d320000-0000-4000-8000-0000000000XX, ou ab.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: temporada 21, datas 41 e 42 (cancelada); pessoas 51 (Ana), 52 (Bia), 53 (Caio); deslocamentos 91 (motorista Ana),
--   92 (motorista Bia), 93 (motorista Caio, convite revogado), 94 (motorista Ana, na data cancelada); a2 colaborador, a3 leitor.
--   Contas convidadas: c1 (Ana), c2 (Bia), c5 (Caio, revogado), c4 (sem convite).  B (b0): b1 admin.
-- Rodar: supabase/tests/README.md, com a migration producao_abastecimento na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

create schema ab;
grant usage on schema ab to authenticated, anon;

create function ab.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d320000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ab.id(s), 'ab-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'b1', 'c1', 'c2', 'c4', 'c5']) as s;
  insert into public.organizations (id, nome) values (ab.id('a0'), 'AB A'), (ab.id('b0'), 'AB B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (ab.id('a0'), 'producao', 'cortesia', 20), (ab.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ab.id(o), ab.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values (ab.id('21'), ab.id('a0'), 'circulacao', 'circula', 'teatro', 'AB T');
  insert into public.producao_datas (id, organization_id, temporada_id, data, situacao) values
    (ab.id('41'), ab.id('a0'), ab.id('21'), date '2026-12-05', 'confirmada'), (ab.id('42'), ab.id('a0'), ab.id('21'), date '2026-12-12', 'cancelada');
  insert into public.producao_pessoas (id, organization_id, nome) values
    (ab.id('51'), ab.id('a0'), 'AB Ana'), (ab.id('52'), ab.id('a0'), 'AB Bia'), (ab.id('53'), ab.id('a0'), 'AB Caio');
  insert into public.producao_escalas (organization_id, pessoa_id, data_id, funcao) values
    (ab.id('a0'), ab.id('51'), ab.id('41'), 'Motorista'), (ab.id('a0'), ab.id('52'), ab.id('41'), 'Motorista');
  insert into public.producao_deslocamentos (id, organization_id, data_id, tipo, motorista_id) values
    (ab.id('91'), ab.id('a0'), ab.id('41'), 'van', ab.id('51')), (ab.id('92'), ab.id('a0'), ab.id('41'), 'van', ab.id('52')),
    (ab.id('93'), ab.id('a0'), ab.id('41'), 'van', ab.id('53')), (ab.id('94'), ab.id('a0'), ab.id('42'), 'van', ab.id('51'));
  insert into public.producao_abastecimentos (organization_id, deslocamento_id, pessoa_id, litros) values (ab.id('a0'), ab.id('91'), null, 20);
  insert into public.producao_acessos_equipe (organization_id, pessoa_id, email) values
    (ab.id('a0'), ab.id('51'), 'ab-c1@teste.invalid'), (ab.id('a0'), ab.id('52'), 'ab-c2@teste.invalid'), (ab.id('a0'), ab.id('53'), 'ab-c5@teste.invalid');
end
$dados$;

create function ab.tenta(comando text) returns text language plpgsql as $$
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

create function ab.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using ab.id(o || '0');
  return n::text;
end;
$$;

create function ab.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ab.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function ab.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- Liga as contas convidadas aos convites (o e-mail confirmado), e revoga o do Caio.
select ab.como('c1');
select public.fn_equipe_aceitar();
select ab.como('c2');
select public.fn_equipe_aceitar();
select ab.como('c5');
select public.fn_equipe_aceitar();
select ab.volta();
update public.producao_acessos_equipe set revogado_em = now() where pessoa_id = ab.id('53');

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_abastecimentos'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select is((select count(*)::int from pg_class where oid = 'public.producao_abastecimentos'::regclass and relrowsecurity), 1, 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_abastecimentos'::regclass),
          'producao_abastecimentos_deslocamento_id_fkey=c, producao_abastecimentos_organization_id_fkey=c, producao_abastecimentos_pessoa_id_fkey=n',
          'sai com o deslocamento; apagar a pessoa só solta quem registrou');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_abastecimento_coerencia()', 'execute')
          and not has_table_privilege('anon', 'public.producao_abastecimentos', 'select')
          and has_function_privilege('authenticated', 'public.fn_equipe_registrar_viagem(uuid, integer, integer, numeric, text, text)', 'execute')
          and not has_function_privilege('anon', 'public.fn_equipe_registrar_viagem(uuid, integer, integer, numeric, text, text)', 'execute'),
          'a coerência não é chamável, o visitante não toca na tabela nem na função, e a função da pessoa convidada é do usuário logado');

-- ─── A tabela: quem vê e quem grava ─────────────────────────────────────────

select ab.como('a2');
select is(ab.tenta(format('insert into public.producao_abastecimentos (organization_id, deslocamento_id, litros) values (%L, %L, 30)', ab.id('a0'), ab.id('91'))), 'aceito', 'colaborador registra um abastecimento');
select ab.como('a3');
select ok(ab.tenta(format('insert into public.producao_abastecimentos (organization_id, deslocamento_id, litros) values (%L, %L, 30)', ab.id('a0'), ab.id('91'))) like '42501%', 'leitor não registra');
select ab.como('b1');
select is(ab.ve('producao_abastecimentos', 'a'), '0', 'outra organização não lê');
select ab.volta();

select is(array[
            ab.tenta(format('insert into public.producao_abastecimentos (organization_id, deslocamento_id, litros) values (%L, %L, 0)', ab.id('a0'), ab.id('91'))),
            ab.tenta(format('insert into public.producao_abastecimentos (organization_id, deslocamento_id, litros, combustivel) values (%L, %L, 10, %L)', ab.id('a0'), ab.id('91'), 'agua')),
            ab.tenta(format('insert into public.producao_abastecimentos (organization_id, deslocamento_id, litros, posto) values (%L, %L, 10, %L)', ab.id('a0'), ab.id('91'), ' ')),
            ab.tenta(format('insert into public.producao_abastecimentos (organization_id, deslocamento_id, litros) values (%L, %L, 10)', ab.id('b0'), ab.id('91'))),
            ab.tenta(format('update public.producao_deslocamentos set odometro_saida_km = 1000, odometro_chegada_km = 900 where id = %L', ab.id('91'))),
            ab.tenta(format('update public.producao_deslocamentos set odometro_saida_km = -1 where id = %L', ab.id('91'))),
            ab.tenta(format('update public.producao_deslocamentos set odometro_saida_km = 1000, odometro_chegada_km = 1000 where id = %L', ab.id('91')))],
          array['23514 producao_abastecimentos_litros_check', '23514 producao_abastecimentos_combustivel_check', '23514 producao_abastecimentos_posto_check',
                '23514 deslocamento_de_outra_organizacao', '23514 producao_deslocamentos_odometro_periodo_check', '23514 producao_deslocamentos_odometro_saida_check', 'aceito'],
          'litros, combustível, posto, deslocamento da organização, odômetro (chegada nunca antes da saída)');

-- ─── A função da pessoa convidada ───────────────────────────────────────────

select ab.como('c1');
select is(public.fn_equipe_registrar_viagem(ab.id('91'), 10000, 10412, 45.3, 'diesel_s10', '  Posto Estrela  '), 'ok', 'a Ana, motorista, registra os odômetros e um abastecimento');
select is(public.fn_equipe_registrar_viagem(ab.id('92'), 1, 2, null, null, null), 'nao_e_motorista', 'a Ana não é a motorista do deslocamento da Bia');
select is(public.fn_equipe_registrar_viagem(ab.id('94'), 1, 2, null, null, null), 'data_cancelada', 'data cancelada não recebe registro');
select is(array[
            public.fn_equipe_registrar_viagem(ab.id('91'), -5, null, null, null, null),
            public.fn_equipe_registrar_viagem(ab.id('91'), null, 100, null, null, null),
            public.fn_equipe_registrar_viagem(ab.id('91'), null, null, 0, 'flex', null),
            public.fn_equipe_registrar_viagem(ab.id('91'), null, null, 10, null, null),
            public.fn_equipe_registrar_viagem(ab.id('91'), null, null, 10, 'agua', null),
            public.fn_equipe_registrar_viagem(ab.id('91'), null, null, null, null, null)],
          array['odometro_invalido', 'odometro_invalido', 'litros_invalidos', 'combustivel_invalido', 'combustivel_invalido', 'nada_a_registrar'],
          'odômetro negativo, chegada antes da saída já gravada, litros zero, combustível ausente ou fora da lista, nada a registrar');
select is(public.fn_equipe_registrar_viagem(ab.id('91'), null, 10500, null, null, null), 'ok', 'só a chegada: a saída que já estava não se perde');
select is(jsonb_path_query_first(public.fn_equipe_folha(ab.id('41')), '$.deslocamentos[*] ? (@.motorista == true).odometro_saida_km')::text, '10000', 'a folha da Ana traz o odômetro da saída');
select is(jsonb_path_query_first(public.fn_equipe_folha(ab.id('41')), '$.deslocamentos[*] ? (@.motorista == true).odometro_chegada_km')::text, '10500', 'e o da chegada');
select is(jsonb_path_query_array(public.fn_equipe_folha(ab.id('41')), '$.deslocamentos[*].abastecimentos[*].litros')::text, '[45.30]', 'e só o abastecimento que ela registrou (o do colaborador não aparece)');
select ab.como('c2');
select is(jsonb_path_query_array(public.fn_equipe_folha(ab.id('41')), '$.deslocamentos[*].abastecimentos[*].litros')::text, '[]', 'a folha da Bia não traz o abastecimento da Ana');
select ab.como('c4');
select is(public.fn_equipe_registrar_viagem(ab.id('91'), 1, 2, null, null, null), 'sem_acesso', 'quem não tem convite não registra');
select ab.como('c5');
select is(public.fn_equipe_registrar_viagem(ab.id('93'), 1, 2, null, null, null), 'sem_acesso', 'convite revogado não registra');
select ab.volta();
select is((select litros::text || '|' || combustivel || '|' || posto || '|' || (pessoa_id = ab.id('51'))::text from public.producao_abastecimentos where deslocamento_id = ab.id('91') and pessoa_id is not null),
          '45.30|diesel_s10|Posto Estrela|true', 'o abastecimento ficou com os litros, o combustível, o posto aparado e quem registrou');

select * from finish();
rollback;
