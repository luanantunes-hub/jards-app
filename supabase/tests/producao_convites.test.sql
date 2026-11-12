-- PD6.9 (primeiro corte): convite em massa com resposta sem login (producao_convites, fn_producao_convite_gerar e
-- fn_producao_convite_responder).
--
-- Quem lê e quem grava (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização,
-- produção só para leitura e visitante), o hash do código que nunca sai para o navegador, gerar links de várias pessoas de uma
-- vez (só o hash fica guardado; pessoa de outra organização é ignorada; leitor e quem não vê a temporada são barrados; prazo de 1
-- a 90 dias), a resposta pelo link (vou, não vou, link inexistente, vencido, desativado, temporada cancelada; só o servidor
-- executa), a forma dos dados, a coerência e o histórico, que deixa de fora o hash, a viagem e a observação.
-- Ids 0d300000-0000-4000-8000-0000000000XX, ou cv.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: temporadas 21 e 22 (cancelada); pessoas 51 a 56; convites 91 (pessoa 51 em 21, link válido), 92 (52, vencido),
--   93 (53, desativado), 94 (51 na temporada cancelada) e 95 (54, já respondeu "vou"); a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado".
--   B (b0), cortesia: temporada 2b, pessoa 5b; b1 admin.  C (c0), produção só para leitura: temporada 2c, pessoa 5c, convite 9c; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_convites na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

create schema cv;
grant usage on schema cv to authenticated, anon;

create function cv.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d300000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

create function cv.hash(texto text) returns text language sql immutable as $$
  select encode(extensions.digest(texto, 'sha256'), 'hex');
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select cv.id(s), 'cv-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (cv.id('a0'), 'CV A'), (cv.id('b0'), 'CV B'), (cv.id('c0'), 'CV C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (cv.id('a0'), 'producao', 'cortesia', 20), (cv.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (cv.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = cv.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select cv.id(o), cv.id(p), papel, m::text[] from (values
    ('a0', 'a1', 'admin', '{producao}'), ('a0', 'a2', 'colaborador', '{producao}'), ('a0', 'a3', 'leitor', '{producao}'),
    ('a0', 'a5', 'colaborador', '{producao}'), ('b0', 'b1', 'admin', '{producao}'), ('c0', 'c1', 'colaborador', '{producao}')
  ) as v(o, p, papel, m);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (cv.id('a0'), cv.id('a5'), false, 'vinculado');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo, situacao) values
    (cv.id('21'), cv.id('a0'), 'circulacao', 'circula', 'teatro', 'CV T', 'planejada'), (cv.id('22'), cv.id('a0'), 'circulacao', 'circula', 'teatro', 'CV T2', 'cancelada'),
    (cv.id('2b'), cv.id('b0'), 'circulacao', 'circula', 'teatro', 'CV TB', 'planejada'), (cv.id('2c'), cv.id('c0'), 'circulacao', 'circula', 'teatro', 'CV TC', 'planejada');
  insert into public.producao_pessoas (id, organization_id, nome) values
    (cv.id('51'), cv.id('a0'), 'CV Pessoa 1'), (cv.id('52'), cv.id('a0'), 'CV Pessoa 2'), (cv.id('53'), cv.id('a0'), 'CV Pessoa 3'),
    (cv.id('54'), cv.id('a0'), 'CV Pessoa 4'), (cv.id('55'), cv.id('a0'), 'CV Pessoa 5'), (cv.id('56'), cv.id('a0'), 'CV Pessoa 6'),
    (cv.id('5b'), cv.id('b0'), 'CV Pessoa B'), (cv.id('5c'), cv.id('c0'), 'CV Pessoa C');
  insert into public.producao_convites (id, organization_id, temporada_id, pessoa_id, token_hash, link_expira_em, link_revogado_em) values
    (cv.id('91'), cv.id('a0'), cv.id('21'), cv.id('51'), cv.hash('h1'), now() + interval '30 days', null),
    (cv.id('92'), cv.id('a0'), cv.id('21'), cv.id('52'), cv.hash('h2'), now() - interval '1 day', null),
    (cv.id('93'), cv.id('a0'), cv.id('21'), cv.id('53'), cv.hash('h3'), now() + interval '30 days', now()),
    (cv.id('94'), cv.id('a0'), cv.id('22'), cv.id('51'), cv.hash('h4'), now() + interval '30 days', null),
    (cv.id('95'), cv.id('a0'), cv.id('21'), cv.id('54'), cv.hash('h5'), now() + interval '2 days', null),
    (cv.id('9c'), cv.id('c0'), cv.id('2c'), cv.id('5c'), cv.hash('hc'), now() + interval '30 days', null);
  update public.producao_convites set resposta = 'vou', chegada_dia = date '2026-12-04' where id = cv.id('95');
end
$dados$;

create function cv.tenta(comando text) returns text language plpgsql as $$
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

create function cv.efeito(comando text) returns text language plpgsql as $$
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

create function cv.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using cv.id(o || '0');
  return n::text;
end;
$$;

create function cv.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', cv.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function cv.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_convites'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select is((select count(*)::int from pg_class where oid = 'public.producao_convites'::regclass and relrowsecurity), 1, 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_convites'::regclass and confrelid <> 'auth.users'::regclass),
          'producao_convites_organization_id_fkey=c, producao_convites_pessoa_id_fkey=r, producao_convites_temporada_id_fkey=c',
          'o convite sai com a temporada; a pessoa convidada não se apaga');
select ok(not has_column_privilege('authenticated', 'public.producao_convites', 'token_hash', 'select')
          and has_column_privilege('authenticated', 'public.producao_convites', 'resposta', 'select')
          and not has_table_privilege('anon', 'public.producao_convites', 'select'), 'o hash do código não sai para o navegador, o resto sim, e o visitante não toca na tabela');
select ok(has_function_privilege('authenticated', 'public.fn_producao_convite_gerar(uuid, uuid[], integer)', 'execute')
          and not has_function_privilege('anon', 'public.fn_producao_convite_gerar(uuid, uuid[], integer)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_convite_responder(text, text, date, time, date, time, text)', 'execute')
          and has_function_privilege('service_role', 'public.fn_producao_convite_responder(text, text, date, time, date, time, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_convite_coerencia()', 'execute'),
          'gerar é da produção logada; responder só do servidor; a coerência de ninguém');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_convites'::regclass),
          'producao_convites_coerencia producao_convites_historico producao_convites_updated_at', 'os gatilhos');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select cv.como('a1');
select is(cv.ve('producao_convites', 'a'), '5', 'administrador lê');
select cv.como('a2');
select is(cv.ve('producao_convites', 'a'), '5', 'colaborador lê');
select cv.como('a3');
select is(cv.ve('producao_convites', 'a'), '5', 'leitor lê');
select cv.como('a5');
select is(cv.ve('producao_convites', 'a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select cv.como('b1');
select is(cv.ve('producao_convites', 'a'), '0', 'outra organização não lê');
select cv.como('c1');
select is(cv.ve('producao_convites', 'c'), '1', 'produção só para leitura lê');
select cv.como(null);
select is(cv.efeito('select 1 from public.producao_convites'), '', 'visitante não lê');

-- ─── Gerar os links ─────────────────────────────────────────────────────────

select cv.como('a2');
select is(jsonb_array_length(public.fn_producao_convite_gerar(cv.id('21'), array[cv.id('55'), cv.id('56'), cv.id('55')], 30)), 2, 'o colaborador gera o link de duas pessoas (a repetida conta uma vez)');
select is(jsonb_array_length(public.fn_producao_convite_gerar(cv.id('21'), array[cv.id('5b')], 30)), 0, 'pessoa de outra organização é ignorada');
select is(cv.tenta(format('select public.fn_producao_convite_gerar(%L, array[%L]::uuid[], 0)', cv.id('21'), cv.id('51'))), 'P0001 prazo_invalido', 'prazo de 0 dia é recusado');
select is(cv.tenta(format('select public.fn_producao_convite_gerar(%L, array[%L]::uuid[], 91)', cv.id('21'), cv.id('51'))), 'P0001 prazo_invalido', 'prazo de 91 dias é recusado');
select set_config('cv.codigo', (public.fn_producao_convite_gerar(cv.id('21'), array[cv.id('54')], 30) -> 0 ->> 'codigo'), true);
select cv.volta();
select ok(current_setting('cv.codigo') ~ '^[A-Za-z0-9_-]{43}$'
          and (select token_hash from public.producao_convites where id = cv.id('95')) = cv.hash(current_setting('cv.codigo'))
          and (select resposta from public.producao_convites where id = cv.id('95')) = 'vou'
          and (select link_expira_em > now() + interval '29 days' from public.producao_convites where id = cv.id('95')),
          'o código tem 43 letras, o banco guarda só o hash dele, o link renovado vale no lugar do antigo e quem já respondeu mantém a resposta');
select cv.como('a3');
select ok(cv.tenta(format('select public.fn_producao_convite_gerar(%L, array[%L]::uuid[], 30)', cv.id('21'), cv.id('51'))) like '42501%', 'leitor não gera link');
select cv.como('a5');
select is(cv.tenta(format('select public.fn_producao_convite_gerar(%L, array[%L]::uuid[], 30)', cv.id('21'), cv.id('51'))), 'P0002 temporada_nao_encontrada', 'o recorte "vinculado" sem vínculo não vê a temporada');
select cv.como('c1');
select ok(cv.tenta(format('select public.fn_producao_convite_gerar(%L, array[%L]::uuid[], 30)', cv.id('2c'), cv.id('5c'))) like '42501%', 'produção só para leitura não gera link');
select cv.volta();

-- ─── A resposta pelo link (só o servidor) ───────────────────────────────────

select cv.como('a2');
select ok(cv.tenta(format('select public.fn_producao_convite_responder(%L, %L, null, null, null, null, null)', cv.hash('h1'), 'vou')) like '42501%', 'o navegador logado não responde por link');
select cv.volta();
select is(public.fn_producao_convite_responder(cv.hash('h1'), 'vou', date '2026-12-04', time '14:30', date '2026-12-06', time '10:00', '  Chego de ônibus  '), 'ok', 'responder "vou" com chegada e saída');
select cv.volta();
select is((select resposta || '|' || chegada_dia || '|' || chegada_hora || '|' || saida_dia || '|' || saida_hora || '|' || observacao from public.producao_convites where id = cv.id('91')),
          'vou|2026-12-04|14:30:00|2026-12-06|10:00:00|Chego de ônibus', 'a resposta ficou gravada, com a observação aparada');
select is(public.fn_producao_convite_responder(cv.hash('h1'), 'nao_vou', date '2026-12-04', time '14:30', null, null, ''), 'ok', 'trocar para "não vou" vale enquanto o link vale');
select cv.volta();
select is((select resposta || '|' || coalesce(chegada_dia::text, '-') || '|' || coalesce(observacao, '-') from public.producao_convites where id = cv.id('91')), 'nao_vou|-|-', 'quem não vai fica sem datas e sem observação');
select is(array[
            public.fn_producao_convite_responder(cv.hash('nao-existe'), 'vou', null, null, null, null, null),
            public.fn_producao_convite_responder(cv.hash('h2'), 'vou', null, null, null, null, null),
            public.fn_producao_convite_responder(cv.hash('h3'), 'vou', null, null, null, null, null),
            public.fn_producao_convite_responder(cv.hash('h4'), 'vou', null, null, null, null, null)],
          array['inexistente', 'expirado', 'revogado', 'temporada_cancelada'], 'link inexistente, vencido, desativado ou de temporada cancelada não grava');
select is(cv.tenta(format('select public.fn_producao_convite_responder(%L, %L, null, null, null, null, null)', cv.hash('h1'), 'talvez')), '23514 resposta_invalida', 'resposta fora da lista é recusada');
select cv.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            cv.tenta(format('update public.producao_convites set resposta = %L where id = %L', 'talvez', cv.id('91'))),
            cv.tenta(format('update public.producao_convites set chegada_dia = %L where id = %L', '2026-12-04', cv.id('91'))),
            cv.tenta(format('update public.producao_convites set resposta = %L, chegada_dia = %L, saida_dia = %L where id = %L', 'vou', '2026-12-06', '2026-12-04', cv.id('91'))),
            cv.tenta(format('update public.producao_convites set observacao = %L where id = %L', ' ', cv.id('91'))),
            cv.tenta(format('update public.producao_convites set token_hash = %L where id = %L', 'curto', cv.id('91'))),
            cv.tenta(format('update public.producao_convites set token_hash = %L where id = %L', cv.hash('h2'), cv.id('91'))),
            cv.tenta(format('insert into public.producao_convites (organization_id, temporada_id, pessoa_id) values (%L, %L, %L)', cv.id('a0'), cv.id('21'), cv.id('51'))),
            cv.tenta(format('insert into public.producao_convites (organization_id, temporada_id, pessoa_id) values (%L, %L, %L)', cv.id('a0'), cv.id('2b'), cv.id('51'))),
            cv.tenta(format('insert into public.producao_convites (organization_id, temporada_id, pessoa_id) values (%L, %L, %L)', cv.id('a0'), cv.id('22'), cv.id('5b'))),
            cv.tenta(format('update public.producao_convites set organization_id = %L where id = %L', cv.id('b0'), cv.id('91'))),
            cv.tenta(format('update public.producao_convites set temporada_id = %L where id = %L', cv.id('22'), cv.id('91'))),
            cv.tenta(format('update public.producao_convites set pessoa_id = %L where id = %L', cv.id('52'), cv.id('91')))],
          array['23514 producao_convites_resposta_check', '23514 producao_convites_viagem_check', '23514 producao_convites_periodo_check', '23514 producao_convites_observacao_check',
                '23514 producao_convites_token_hash_formato_check', '23505 producao_convites_token_hash_key', '23505 producao_convites_pessoa_key',
                '23514 temporada_de_outra_organizacao', '23514 pessoa_de_outra_organizacao',
                '23514 organizacao_nao_muda', '23514 temporada_nao_muda', '23514 pessoa_nao_muda'],
          'resposta, viagem só de quem vai, período, observação, formato e unicidade do hash, uma pessoa por temporada; organização e o que não muda');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_convites set resposta = 'vou', chegada_dia = date '2026-12-04', observacao = 'segredo', token_hash = cv.hash('novo') where id = cv.id('91');
select is((select string_agg(distinct campo, ',' order by campo) from public.producao_historico where entidade_id = cv.id('91') and acao = 'alterou'),
          'respondido_em,resposta', 'mudar a resposta deixa o histórico dela e da hora da resposta; o hash, a viagem e a observação não aparecem');
select cv.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_convites' and entidade_id = cv.id('91')) > 0, 'quem lê o convite lê o histórico dele');
select cv.volta();

select * from finish();
rollback;
