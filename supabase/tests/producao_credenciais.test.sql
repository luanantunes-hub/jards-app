-- PD7.3 (primeiro corte): credenciais dos convidados e leitura na porta (producao_credenciais, producao_porta_leituras,
-- fn_producao_credenciais_emitir, fn_producao_credencial_reemitir, fn_producao_credencial_achar e fn_producao_porta_ler).
--
-- Quem lê e quem grava (colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção só para
-- leitura), o hash que nunca sai para o navegador, emitir só para confirmados e sem repetir, trocar o código, a leitura na porta
-- (permitido até o número de lugares, já entrou, negado por código desconhecido, revogado ou convidado que deixou de estar confirmado),
-- o registro só de acrescentar e a forma dos dados.
-- Ids 0d370000-0000-4000-8000-0000000000XX, ou cr.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: sessões 91 e 92; convidados d1 (91, 2 lugares, confirmado), d2 (91, pedido), d3 (91, confirmado), d4 (92, confirmado);
--   a2 colaborador, a3 leitor, a5 colaborador com o recorte "vinculado" e sem vínculo.  B (b0): b1 admin, sessão 9b.
--   C (c0), produção só para leitura: c1 colaborador, sessão 9c, convidado dc.
-- Rodar: supabase/tests/README.md, com a migration producao_credenciais na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(33);

create schema cr;
grant usage on schema cr to authenticated, anon;

create function cr.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d370000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select cr.id(s), 'cr-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (cr.id('a0'), 'CR A'), (cr.id('b0'), 'CR B'), (cr.id('c0'), 'CR C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (cr.id('a0'), 'producao', 'cortesia', 20), (cr.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (cr.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = cr.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select cr.id(o), cr.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (cr.id('a0'), cr.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (cr.id('31'), cr.id('a0'), 'CR E1', 'Teatro'), (cr.id('3b'), cr.id('b0'), 'CR EB', 'Teatro'), (cr.id('3c'), cr.id('c0'), 'CR EC', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values
    (cr.id('71'), cr.id('a0'), cr.id('31'), 'S1'), (cr.id('7b'), cr.id('b0'), cr.id('3b'), 'SB'), (cr.id('7c'), cr.id('c0'), cr.id('3c'), 'SC');
  insert into public.producao_pautas (id, organization_id, sala_id, titulo, inicio, fim, situacao) values
    (cr.id('81'), cr.id('a0'), cr.id('71'), 'Festival', date '2026-12-05', date '2026-12-07', 'confirmada'),
    (cr.id('8b'), cr.id('b0'), cr.id('7b'), 'Pauta B', date '2026-12-05', date '2026-12-07', 'consulta'),
    (cr.id('8c'), cr.id('c0'), cr.id('7c'), 'Pauta C', date '2026-12-05', date '2026-12-07', 'consulta');
  insert into public.producao_sessoes (id, organization_id, pauta_id, dia, inicio, fim) values
    (cr.id('91'), cr.id('a0'), cr.id('81'), date '2026-12-05', time '18:00', time '20:00'),
    (cr.id('92'), cr.id('a0'), cr.id('81'), date '2026-12-06', time '18:00', time '20:00'),
    (cr.id('9b'), cr.id('b0'), cr.id('8b'), date '2026-12-05', time '18:00', time '20:00'),
    (cr.id('9c'), cr.id('c0'), cr.id('8c'), date '2026-12-05', time '18:00', time '20:00');
  insert into public.producao_credencial_tipos (id, organization_id, nome) values
    (cr.id('c1'), cr.id('a0'), 'Imprensa'), (cr.id('cb'), cr.id('b0'), 'Imprensa'), (cr.id('cc'), cr.id('c0'), 'Imprensa');
  insert into public.producao_convidados (id, organization_id, sessao_id, tipo_id, nome, afiliacao, quantidade, situacao) values
    (cr.id('d1'), cr.id('a0'), cr.id('91'), cr.id('c1'), 'CR Rita', 'Jornal do Bairro', 2, 'confirmado'),
    (cr.id('d2'), cr.id('a0'), cr.id('91'), cr.id('c1'), 'CR Paulo', null, 1, 'pedido'),
    (cr.id('d3'), cr.id('a0'), cr.id('91'), cr.id('c1'), 'CR Sol', null, 1, 'confirmado'),
    (cr.id('d4'), cr.id('a0'), cr.id('92'), cr.id('c1'), 'CR Tom', null, 1, 'confirmado'),
    (cr.id('db'), cr.id('b0'), cr.id('9b'), cr.id('cb'), 'CR Bia', null, 1, 'confirmado'),
    (cr.id('dc'), cr.id('c0'), cr.id('9c'), cr.id('cc'), 'CR Caio', null, 1, 'confirmado');
  -- A credencial do convidado da C, para a produção só para leitura ter o que ler (código fixo: 0000000000000C01).
  insert into public.producao_credenciais (id, organization_id, sessao_id, convidado_id, token_hash) values
    (cr.id('e0'), cr.id('c0'), cr.id('9c'), cr.id('dc'), encode(extensions.digest('0000000000000C01', 'sha256'), 'hex'));
end
$dados$;

create function cr.tenta(comando text) returns text language plpgsql as $$
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

create function cr.efeito(comando text) returns text language plpgsql as $$
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

create function cr.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using cr.id(o || '0');
  return n::text;
end;
$$;

create function cr.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', cr.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function cr.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- A leitura na porta como uma pessoa, devolvendo "resultado/motivo/entradas" (ou o erro). O comando roda de verdade (não é desfeito).
create function cr.porta(sessao text, codigo text) returns text language plpgsql as $$
declare r jsonb;
begin
  r := public.fn_producao_porta_ler(cr.id(sessao), codigo);
  return (r ->> 'resultado') || '/' || coalesce(r ->> 'motivo', '-') || '/' || coalesce(r ->> 'entradas', '-');
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_credenciais', 'producao_porta_leituras')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 8, 'cinco regras na credencial e três no registro da porta, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_credenciais'::regclass, 'public.producao_porta_leituras'::regclass) and relrowsecurity), 2, 'segurança por linha ligada nas duas');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_credenciais'::regclass, 'public.producao_porta_leituras'::regclass) and confrelid <> 'auth.users'::regclass),
          'producao_credenciais.producao_credenciais_convidado_id_fkey=c, producao_credenciais.producao_credenciais_organization_id_fkey=c, producao_credenciais.producao_credenciais_sessao_id_fkey=c, '
          || 'producao_porta_leituras.producao_porta_leituras_credencial_id_fkey=n, producao_porta_leituras.producao_porta_leituras_organization_id_fkey=c, producao_porta_leituras.producao_porta_leituras_sessao_id_fkey=c',
          'a credencial e o registro saem com a sessão; apagar a credencial só solta a leitura');
select ok(not has_column_privilege('authenticated', 'public.producao_credenciais', 'token_hash', 'select')
          and has_column_privilege('authenticated', 'public.producao_credenciais', 'entradas', 'select')
          and not has_table_privilege('anon', 'public.producao_credenciais', 'select') and not has_table_privilege('anon', 'public.producao_porta_leituras', 'select')
          and not has_table_privilege('authenticated', 'public.producao_porta_leituras', 'update') and not has_table_privilege('authenticated', 'public.producao_porta_leituras', 'delete'),
          'o hash não sai para o navegador, o visitante não toca nas tabelas e o registro da porta é só de acrescentar');
select ok(has_function_privilege('authenticated', 'public.fn_producao_credenciais_emitir(uuid)', 'execute')
          and has_function_privilege('authenticated', 'public.fn_producao_credencial_reemitir(uuid)', 'execute')
          and has_function_privilege('authenticated', 'public.fn_producao_porta_ler(uuid, text)', 'execute')
          and not has_function_privilege('anon', 'public.fn_producao_porta_ler(uuid, text)', 'execute')
          and not has_function_privilege('anon', 'public.fn_producao_credenciais_emitir(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_credencial_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_porta_leitura_coerencia()', 'execute'),
          'a produção logada emite e lê; o visitante e as coerências, não');

-- ─── Emitir ─────────────────────────────────────────────────────────────────

select cr.como('a3');
select ok(cr.tenta(format('select public.fn_producao_credenciais_emitir(%L)', cr.id('91'))) like '42501%', 'leitor não emite');
select cr.como('a5');
select is(cr.tenta(format('select public.fn_producao_credenciais_emitir(%L)', cr.id('91'))), 'P0002 sessao_nao_encontrada', 'o recorte "vinculado" sem vínculo não vê a sessão');
select cr.como('b1');
select is(cr.tenta(format('select public.fn_producao_credenciais_emitir(%L)', cr.id('91'))), 'P0002 sessao_nao_encontrada', 'outra organização não vê a sessão');
select cr.como('c1');
select is(cr.tenta(format('select public.fn_producao_credencial_reemitir(%L)', cr.id('dc'))), 'P0002 credencial_nao_encontrada', 'produção só para leitura não troca o código');
select cr.como('a2');
select set_config('cr.emitidas', public.fn_producao_credenciais_emitir(cr.id('91'))::text, true);
select cr.volta();
select is(((current_setting('cr.emitidas')::jsonb) -> 0 ->> 'nome') || '|' || ((current_setting('cr.emitidas')::jsonb) -> 1 ->> 'nome') || '|' || jsonb_array_length(current_setting('cr.emitidas')::jsonb)::text,
          'CR Rita|CR Sol|2', 'emitiu só para os confirmados (o pedido ficou de fora), em ordem de nome');
select ok(((current_setting('cr.emitidas')::jsonb) -> 0 ->> 'codigo') ~ '^[0-9A-F]{16}$'
          and (select token_hash from public.producao_credenciais where convidado_id = cr.id('d1')) = encode(extensions.digest(((current_setting('cr.emitidas')::jsonb) -> 0 ->> 'codigo'), 'sha256'), 'hex'),
          'o código tem 16 letras e números e só o hash fica guardado');
select cr.como('a2');
select is(public.fn_producao_credenciais_emitir(cr.id('91'))::text, '[]', 'emitir de novo não repete nem troca o código de ninguém');
select ok(cr.tenta('select token_hash from public.producao_credenciais') like '42501%', 'o navegador não lê o hash');
select cr.volta();

-- ─── A leitura na porta ─────────────────────────────────────────────────────

select set_config('cr.rita', ((current_setting('cr.emitidas')::jsonb) -> 0 ->> 'codigo'), true);
select set_config('cr.sol', ((current_setting('cr.emitidas')::jsonb) -> 1 ->> 'codigo'), true);
select cr.como('a2');
select is(cr.porta('91', lower(substr(current_setting('cr.rita'), 1, 4) || '-' || substr(current_setting('cr.rita'), 5, 4) || ' ' || substr(current_setting('cr.rita'), 9))), 'permitido/-/1', 'a primeira entrada vale (código em minúsculas, com traço e espaço)');
select is(cr.porta('91', current_setting('cr.rita')), 'permitido/-/2', 'a segunda entrada (o convite é de 2 lugares) vale');
select is(cr.porta('91', current_setting('cr.rita')), 'ja_entrou/-/2', 'a terceira é "já entrou": os lugares acabaram');
select is(cr.porta('91', 'FFFFFFFFFFFFFFFF'), 'negado/desconhecida/-', 'código desconhecido é negado');
select is(cr.porta('92', current_setting('cr.rita')), 'negado/desconhecida/-', 'o código de uma sessão não vale em outra');
select cr.volta();
update public.producao_convidados set situacao = 'recusado' where id = cr.id('d3');
select cr.como('a2');
select is(cr.porta('91', current_setting('cr.sol')), 'negado/nao_confirmado/0', 'convidado que deixou de estar confirmado é negado');
select cr.volta();
update public.producao_convidados set situacao = 'confirmado' where id = cr.id('d3');
update public.producao_credenciais set revogada_em = now() where convidado_id = cr.id('d3');
select cr.como('a2');
select is(cr.porta('91', current_setting('cr.sol')), 'negado/revogada/0', 'credencial revogada é negada');
select cr.como('a3');
select ok(cr.tenta(format('select public.fn_producao_porta_ler(%L, %L)', cr.id('91'), current_setting('cr.sol'))) like '42501%', 'leitor não lê na porta');
select cr.como('a5');
select is(cr.tenta(format('select public.fn_producao_porta_ler(%L, %L)', cr.id('91'), current_setting('cr.sol'))), 'P0002 sessao_nao_encontrada', 'sem ver a sessão, não lê');
select cr.como('c1');
select ok(cr.tenta(format('select public.fn_producao_porta_ler(%L, %L)', cr.id('9c'), '0000000000000C01')) like '42501%', 'produção só para leitura não lê na porta');
select cr.volta();

-- ─── Trocar o código ────────────────────────────────────────────────────────

select cr.como('a2');
select set_config('cr.sol_novo', public.fn_producao_credencial_reemitir(cr.id('d3')), true);
select is(cr.porta('91', current_setting('cr.sol')), 'negado/desconhecida/-', 'o código antigo deixa de valer');
select is(cr.porta('91', current_setting('cr.sol_novo')), 'permitido/-/1', 'o código novo vale e a credencial revogada volta a funcionar');
select cr.como('a3');
select is(cr.tenta(format('select public.fn_producao_credencial_reemitir(%L)', cr.id('d3'))), 'P0002 credencial_nao_encontrada', 'leitor não troca o código');
select cr.volta();

-- ─── O registro da porta ────────────────────────────────────────────────────

select is((select string_agg(resultado || ':' || n::text, ',' order by resultado) from (select resultado, count(*) as n from public.producao_porta_leituras where sessao_id = cr.id('91') group by resultado) x),
          'ja_entrou:1,negado:4,permitido:3', 'cada leitura ficou registrada (e a presença é a das permitidas)');
select cr.como('a2');
select is(cr.efeito('update public.producao_porta_leituras set resultado = ''permitido''') || '|' || cr.efeito('delete from public.producao_porta_leituras'), '|', 'ninguém altera nem apaga uma leitura');
select cr.volta();

-- ─── Quem lê ────────────────────────────────────────────────────────────────

select cr.como('a3');
select is(cr.ve('producao_credenciais', 'a') || '|' || cr.ve('producao_porta_leituras', 'a'), '2|9', 'leitor lê as credenciais e o registro');
select cr.como('a5');
select is(cr.ve('producao_credenciais', 'a') || '|' || cr.ve('producao_porta_leituras', 'a'), '0|0', 'o recorte "vinculado" sem vínculo não lê');
select cr.como('b1');
select is(cr.ve('producao_credenciais', 'a') || '|' || cr.ve('producao_credenciais', 'b'), '0|0', 'outra organização não lê');
select cr.como('c1');
select is(cr.ve('producao_credenciais', 'c'), '1', 'produção só para leitura lê');
select cr.volta();

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            cr.tenta(format('update public.producao_credenciais set entradas = 3 where convidado_id = %L', cr.id('d1'))),
            cr.tenta(format('insert into public.producao_credenciais (organization_id, sessao_id, convidado_id, token_hash) values (%L, %L, %L, %L)', cr.id('a0'), cr.id('91'), cr.id('d4'), repeat('a', 64))),
            cr.tenta(format('insert into public.producao_credenciais (organization_id, sessao_id, convidado_id, token_hash) values (%L, %L, %L, %L)', cr.id('a0'), cr.id('91'), cr.id('d2'), 'curto')),
            cr.tenta(format('insert into public.producao_credenciais (organization_id, sessao_id, convidado_id, token_hash) values (%L, %L, %L, (select token_hash from public.producao_credenciais where convidado_id = %L))', cr.id('a0'), cr.id('91'), cr.id('d2'), cr.id('d1'))),
            cr.tenta(format('insert into public.producao_credenciais (organization_id, sessao_id, convidado_id, token_hash) values (%L, %L, %L, %L)', cr.id('a0'), cr.id('91'), cr.id('d1'), repeat('b', 64))),
            cr.tenta(format('update public.producao_credenciais set organization_id = %L where convidado_id = %L', cr.id('b0'), cr.id('d1'))),
            cr.tenta(format('update public.producao_credenciais set sessao_id = %L where convidado_id = %L', cr.id('92'), cr.id('d1'))),
            cr.tenta(format('update public.producao_credenciais set convidado_id = %L where convidado_id = %L', cr.id('d2'), cr.id('d1'))),
            cr.tenta(format('insert into public.producao_porta_leituras (organization_id, sessao_id, resultado) values (%L, %L, %L)', cr.id('a0'), cr.id('91'), 'talvez')),
            cr.tenta(format('insert into public.producao_porta_leituras (organization_id, sessao_id, resultado) values (%L, %L, %L)', cr.id('a0'), cr.id('9b'), 'negado')),
            cr.tenta(format('insert into public.producao_porta_leituras (organization_id, sessao_id, credencial_id, resultado) values (%L, %L, %L, %L)', cr.id('a0'), cr.id('92'), (select id from public.producao_credenciais where convidado_id = cr.id('d1')), 'negado'))],
          array['23514 entradas_alem_dos_lugares', '23514 convidado_de_outra_sessao', '23514 producao_credenciais_hash_check', '23505 producao_credenciais_hash_key',
                '23505 producao_credenciais_convidado_key', '23514 organizacao_nao_muda', '23514 sessao_nao_muda', '23514 convidado_nao_muda', '23514 producao_porta_leituras_resultado_check',
                '23514 sessao_de_outra_organizacao', '23514 credencial_de_outra_sessao'],
          'entradas até os lugares, hash em formato e único, uma credencial por convidado, o convidado é da sessão, o que não muda e a leitura coerente');

select * from finish();
rollback;
