-- PD7.2 (primeiro corte): convidados e cortesias por sessão (producao_credencial_tipos e producao_convidados).
--
-- Quem lê e quem grava (colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra organização, produção só para
-- leitura e visitante), a forma dos dados, a coerência (organização, sessão e tipo), a cota por sessão e por tipo conferida pelo banco
-- (lugares recusados não contam; baixar a cota não trava a edição) e o histórico.
-- Ids 0d360000-0000-4000-8000-0000000000XX, ou cv.id('XX'). Cenário desfeito no fim.
--   A (a0), cortesia: espaço 31, sala 71, pauta 81, sessões 91 e 92; tipos t1 (Imprensa, cota 3), t2 (Elenco, sem cota), t3 (arquivado);
--   convidados d1 (91, t1, 2 lugares, confirmado) e d2 (91, t1, 1 lugar, recusado); a2 colaborador, a3 leitor, a5 colaborador com o
--   recorte "vinculado" e sem vínculo.  B (b0), cortesia: sessão 9b, tipo tb; b1 admin.
--   C (c0), produção só para leitura: sessão 9c, tipo tc, convidado dc; c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_convidados na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

create schema cv;
grant usage on schema cv to authenticated, anon;

create function cv.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d360000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select cv.id(s), 'cv-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (cv.id('a0'), 'CV A'), (cv.id('b0'), 'CV B'), (cv.id('c0'), 'CV C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (cv.id('a0'), 'producao', 'cortesia', 20), (cv.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (cv.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = cv.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select cv.id(o), cv.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (cv.id('a0'), cv.id('a5'), false, 'vinculado');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values
    (cv.id('31'), cv.id('a0'), 'CV E1', 'Teatro'), (cv.id('3b'), cv.id('b0'), 'CV EB', 'Teatro'), (cv.id('3c'), cv.id('c0'), 'CV EC', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values
    (cv.id('71'), cv.id('a0'), cv.id('31'), 'S1'), (cv.id('7b'), cv.id('b0'), cv.id('3b'), 'SB'), (cv.id('7c'), cv.id('c0'), cv.id('3c'), 'SC');
  insert into public.producao_pautas (id, organization_id, sala_id, titulo, inicio, fim, situacao) values
    (cv.id('81'), cv.id('a0'), cv.id('71'), 'Festival de teatro', date '2026-12-05', date '2026-12-07', 'confirmada'),
    (cv.id('8b'), cv.id('b0'), cv.id('7b'), 'Pauta da B', date '2026-12-05', date '2026-12-07', 'consulta'),
    (cv.id('8c'), cv.id('c0'), cv.id('7c'), 'Pauta da C', date '2026-12-05', date '2026-12-07', 'consulta');
  insert into public.producao_sessoes (id, organization_id, pauta_id, dia, inicio, fim) values
    (cv.id('91'), cv.id('a0'), cv.id('81'), date '2026-12-05', time '18:00', time '20:00'),
    (cv.id('92'), cv.id('a0'), cv.id('81'), date '2026-12-06', time '18:00', time '20:00'),
    (cv.id('9b'), cv.id('b0'), cv.id('8b'), date '2026-12-05', time '18:00', time '20:00'),
    (cv.id('9c'), cv.id('c0'), cv.id('8c'), date '2026-12-05', time '18:00', time '20:00');
  insert into public.producao_credencial_tipos (id, organization_id, nome, cota_por_sessao, arquivado) values
    (cv.id('b1'), cv.id('a0'), 'Imprensa', 3, false), (cv.id('b2'), cv.id('a0'), 'Elenco', null, false), (cv.id('b3'), cv.id('a0'), 'Antigo', 5, true),
    (cv.id('bb'), cv.id('b0'), 'Imprensa', 2, false), (cv.id('bc'), cv.id('c0'), 'Imprensa', 2, false);
  insert into public.producao_convidados (id, organization_id, sessao_id, tipo_id, nome, afiliacao, quantidade, situacao) values
    (cv.id('d1'), cv.id('a0'), cv.id('91'), cv.id('b1'), 'CV Rita', 'Jornal do Bairro', 2, 'confirmado'),
    (cv.id('d2'), cv.id('a0'), cv.id('91'), cv.id('b1'), 'CV Paulo', null, 1, 'recusado'),
    (cv.id('db'), cv.id('b0'), cv.id('9b'), cv.id('bb'), 'CV Bia', null, 1, 'pedido'),
    (cv.id('dc'), cv.id('c0'), cv.id('9c'), cv.id('bc'), 'CV Caio', null, 1, 'pedido');
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

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_credencial_tipos', 'producao_convidados')
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 10, 'cinco regras em cada tabela, nenhuma aberta');
select is((select count(*)::int from pg_class where oid in ('public.producao_credencial_tipos'::regclass, 'public.producao_convidados'::regclass) and relrowsecurity), 2, 'segurança por linha ligada nas duas');
select is((select string_agg(conrelid::regclass::text || '.' || conname::text || '=' || confdeltype::text, ', ' order by conrelid::regclass::text collate "C", conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid in ('public.producao_credencial_tipos'::regclass, 'public.producao_convidados'::regclass)),
          'producao_convidados.producao_convidados_organization_id_fkey=c, producao_convidados.producao_convidados_sessao_id_fkey=c, producao_convidados.producao_convidados_tipo_id_fkey=r, '
          || 'producao_credencial_tipos.producao_credencial_tipos_organization_id_fkey=c',
          'o convidado sai com a sessão; um tipo em uso não se apaga (arquiva-se)');
select ok(not has_table_privilege('anon', 'public.producao_credencial_tipos', 'select') and not has_table_privilege('anon', 'public.producao_convidados', 'select')
          and not has_function_privilege('authenticated', 'public.fn_producao_credencial_tipo_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_convidado_coerencia()', 'execute'),
          'o visitante não toca nas tabelas e ninguém executa as coerências');
select is((select count(*)::int from pg_trigger where tgrelid in ('public.producao_credencial_tipos'::regclass, 'public.producao_convidados'::regclass) and not tgisinternal), 6,
          'seis gatilhos: coerência, updated_at e histórico em cada tabela');

-- ─── Quem lê ────────────────────────────────────────────────────────────────

select cv.como('a2');
select is(cv.ve('producao_convidados', 'a') || '|' || cv.ve('producao_credencial_tipos', 'a'), '2|3', 'colaborador lê os convidados e os tipos');
select cv.como('a3');
select is(cv.ve('producao_convidados', 'a') || '|' || cv.ve('producao_credencial_tipos', 'a'), '2|3', 'leitor lê');
select cv.como('a5');
select is(cv.ve('producao_convidados', 'a'), '0', 'o recorte "vinculado" sem vínculo não lê os convidados (herdam a sessão)');
select cv.como('b1');
select is(cv.ve('producao_convidados', 'a') || '|' || cv.ve('producao_credencial_tipos', 'a') || '|' || cv.ve('producao_convidados', 'b'), '0|0|1', 'outra organização não lê');
select cv.como('c1');
select is(cv.ve('producao_convidados', 'c') || '|' || cv.ve('producao_credencial_tipos', 'c'), '1|1', 'produção só para leitura lê');
select cv.como(null);
select is(cv.efeito('select 1 from public.producao_convidados'), '', 'visitante não lê');
select cv.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select cv.como('a2');
select is(cv.tenta(format('insert into public.producao_credencial_tipos (organization_id, nome, cota_por_sessao) values (%L, %L, 4)', cv.id('a0'), 'Parceiros')), 'aceito', 'colaborador cria o tipo');
select is(cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome, afiliacao) values (%L, %L, %L, %L, %L)', cv.id('a0'), cv.id('91'), cv.id('b2'), 'CV Lia', 'Teatro X')), 'aceito', 'colaborador convida');
select is(cv.efeito(format('update public.producao_convidados set situacao = %L where id = %L', 'confirmado', cv.id('d1'))) || '|' || cv.efeito(format('delete from public.producao_convidados where id = %L', cv.id('d2'))), 'sim|sim', 'colaborador altera e apaga');
select cv.como('a3');
select ok(cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome) values (%L, %L, %L, %L)', cv.id('a0'), cv.id('91'), cv.id('b2'), 'x')) like '42501%'
          and cv.tenta(format('insert into public.producao_credencial_tipos (organization_id, nome) values (%L, %L)', cv.id('a0'), 'x')) like '42501%', 'leitor não grava');
select cv.como('a5');
select ok(cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome) values (%L, %L, %L, %L)', cv.id('a0'), cv.id('91'), cv.id('b2'), 'x')) like '42501%', 'o recorte sem vínculo não grava');
select cv.como('c1');
select ok(cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome) values (%L, %L, %L, %L)', cv.id('c0'), cv.id('9c'), cv.id('bc'), 'x')) like '42501%', 'produção só para leitura não grava');
select cv.como('b1');
select is(cv.efeito(format('update public.producao_convidados set nome = %L where id = %L', 'invasor', cv.id('d1'))), '', 'outra organização não altera');
select cv.volta();

-- (cv.tenta e cv.efeito desfazem o que executam: o cenário só avança com os comandos soltos, como os da cota abaixo.)

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            cv.tenta(format('insert into public.producao_credencial_tipos (organization_id, nome) values (%L, %L)', cv.id('a0'), ' ')),
            cv.tenta(format('insert into public.producao_credencial_tipos (organization_id, nome, cota_por_sessao) values (%L, %L, -1)', cv.id('a0'), 'Novo')),
            cv.tenta(format('insert into public.producao_credencial_tipos (organization_id, nome) values (%L, %L)', cv.id('a0'), ' imprensa ')),
            cv.tenta(format('update public.producao_credencial_tipos set organization_id = %L where id = %L', cv.id('b0'), cv.id('b2'))),
            cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome, quantidade) values (%L, %L, %L, %L, 0)', cv.id('a0'), cv.id('91'), cv.id('b2'), 'x')),
            cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome, situacao) values (%L, %L, %L, %L, %L)', cv.id('a0'), cv.id('91'), cv.id('b2'), 'x', 'talvez')),
            cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome) values (%L, %L, %L, %L)', cv.id('a0'), cv.id('91'), cv.id('b2'), ' ')),
            cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome) values (%L, %L, %L, %L)', cv.id('a0'), cv.id('9b'), cv.id('b2'), 'x')),
            cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome) values (%L, %L, %L, %L)', cv.id('a0'), cv.id('91'), cv.id('bb'), 'x')),
            cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome) values (%L, %L, %L, %L)', cv.id('a0'), cv.id('91'), cv.id('b3'), 'x')),
            cv.tenta(format('update public.producao_convidados set organization_id = %L where id = %L', cv.id('b0'), cv.id('d2'))),
            cv.tenta(format('update public.producao_convidados set sessao_id = %L where id = %L', cv.id('92'), cv.id('d2'))),
            cv.tenta(format('delete from public.producao_credencial_tipos where id = %L', cv.id('b1')))],
          array['23514 producao_credencial_tipos_nome_check', '23514 producao_credencial_tipos_cota_check', '23505 producao_credencial_tipos_nome_idx', '23514 organizacao_nao_muda',
                '23514 producao_convidados_quantidade_check', '23514 producao_convidados_situacao_check', '23514 producao_convidados_nome_check',
                '23514 sessao_de_outra_organizacao', '23514 tipo_de_outra_organizacao', '23514 tipo_arquivado', '23514 organizacao_nao_muda', '23514 sessao_nao_muda',
                '23503 producao_convidados_tipo_id_fkey'],
          'nome, cota, nome repetido, lugares, situação; sessão e tipo da organização, tipo arquivado e o que não muda; tipo em uso não se apaga');

-- ─── A cota ─────────────────────────────────────────────────────────────────
-- t1 (Imprensa) tem cota 3 por sessão; na sessão 91 há d1 (2 lugares, confirmado) e d2 (1 lugar, recusado: não conta).

select is(cv.tenta(format('insert into public.producao_convidados (id, organization_id, sessao_id, tipo_id, nome, quantidade) values (%L, %L, %L, %L, %L, 1)', cv.id('d3'), cv.id('a0'), cv.id('91'), cv.id('b1'), 'CV Sol')),
          'aceito', 'o último lugar da cota cabe (2 + 1 = 3; o recusado não conta)');
insert into public.producao_convidados (id, organization_id, sessao_id, tipo_id, nome, quantidade) values (cv.id('d3'), cv.id('a0'), cv.id('91'), cv.id('b1'), 'CV Sol', 1);
select is(cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome, quantidade) values (%L, %L, %L, %L, 1)', cv.id('a0'), cv.id('91'), cv.id('b1'), 'CV Tom')),
          '23514 cota_excedida', 'um lugar além da cota é recusado');
select is(cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome, quantidade) values (%L, %L, %L, %L, 3)', cv.id('a0'), cv.id('92'), cv.id('b1'), 'CV Uma')),
          'aceito', 'a cota é por sessão: na outra sessão há 3 lugares livres');
select is(array[
            cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome, quantidade, situacao) values (%L, %L, %L, %L, 5, %L)', cv.id('a0'), cv.id('91'), cv.id('b1'), 'CV Rec', 'recusado')),
            cv.tenta(format('insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome, quantidade) values (%L, %L, %L, %L, 20)', cv.id('a0'), cv.id('91'), cv.id('b2'), 'CV Livre'))],
          array['aceito', 'aceito'], 'lugar recusado não conta, e o tipo sem cota não tem limite');
insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome, quantidade, situacao) values (cv.id('a0'), cv.id('91'), cv.id('b1'), 'CV Rec', 5, 'recusado');
insert into public.producao_convidados (organization_id, sessao_id, tipo_id, nome, quantidade) values (cv.id('a0'), cv.id('91'), cv.id('b2'), 'CV Livre', 20);
select is(array[
            cv.tenta(format('update public.producao_convidados set situacao = %L where id = %L', 'pedido', cv.id('d2'))),
            cv.tenta(format('update public.producao_convidados set quantidade = 2 where id = %L', cv.id('d3'))),
            cv.tenta(format('update public.producao_convidados set tipo_id = %L where id = %L', cv.id('b1'), (select id from public.producao_convidados where nome = 'CV Livre')))],
          array['23514 cota_excedida', '23514 cota_excedida', '23514 cota_excedida'], 'recusado que volta, mais lugares e troca de tipo também respeitam a cota');
select is(cv.tenta(format('update public.producao_convidados set quantidade = 2, nome = %L where id = %L', 'CV Rita (editada)', cv.id('d1'))), 'aceito',
          'editar sem aumentar o consumo não conta o próprio lugar duas vezes');
update public.producao_credencial_tipos set cota_por_sessao = 1 where id = cv.id('b1');
select is(array[
            cv.tenta(format('update public.producao_convidados set nome = %L where id = %L', 'CV Rita (de novo)', cv.id('d1'))),
            cv.tenta(format('update public.producao_convidados set situacao = %L where id = %L', 'pedido', cv.id('d1'))),
            cv.tenta(format('update public.producao_convidados set quantidade = 1 where id = %L', cv.id('d1')))],
          array['aceito', 'aceito', 'aceito'], 'baixar a cota abaixo do que já foi dado não trava a edição nem a confirmação');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_convidados set nome = 'CV Rita (editada)', situacao = 'pedido', quantidade = 1 where id = cv.id('d1');
select is((select string_agg(distinct campo, ',' order by campo) from public.producao_historico where entidade_id = cv.id('d1') and acao = 'alterou'),
          'nome,quantidade,situacao', 'o histórico guarda nome, lugares e situação do convidado');
select cv.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_convidados' and entidade_id = cv.id('d1')) > 0
          and (select count(*) from public.producao_historico where entidade = 'producao_credencial_tipos' and entidade_id = cv.id('b1')) > 0, 'quem lê o convidado e o tipo lê o histórico deles');
select cv.volta();

select * from finish();
rollback;
