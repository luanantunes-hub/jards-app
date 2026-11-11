-- PD4.9: licenças e liberações por data (producao_licencas) e a tarefa que nasce com cada uma.
--
-- Quem lê e quem grava (administrador, colaborador, leitor, o recorte "só onde está vinculado" sem vínculo, outra
-- organização, produção só para leitura e visitante); a tarefa da licença (nasce aberta com o prazo da data, fica feita
-- quando a licença é concedida, volta a abrir, acompanha o prazo e a data, e sai com a licença); a forma dos dados e a
-- coerência; o histórico; e as chaves. Ids 0d2d0000-0000-4000-8000-0000000000XX, ou lc.id('XX'). Desfeito no fim.
--   A (a0), cortesia: data D1 (41, em 05/12/2026), pessoa P1 (51); licenças L1 (61, alvará, a pedir, 30 dias antes),
--   L2 (62, ECAD, pedida, sem prazo) e L3 (63, AVCB, concedida). a1 admin, a2 colaborador, a3 leitor, a5 colaborador com o
--   recorte "vinculado" e sem vínculo.  B (b0): data (4b), pessoa (5b); b1 admin.
--   C (c0), produção só para leitura: data (4c), licença (6c); c1 colaborador.
-- Rodar: supabase/tests/README.md, com a migration producao_licencas na frente se não estiver aplicada. A seção
-- "Chaves" usa DELETE: rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

create schema lc;
grant usage on schema lc to authenticated, anon;

create function lc.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d2d0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select lc.id(s), 'lc-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'a5', 'b1', 'c1']) as s;
  insert into public.organizations (id, nome) values (lc.id('a0'), 'LC A'), (lc.id('b0'), 'LC B'), (lc.id('c0'), 'LC C');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (lc.id('a0'), 'producao', 'cortesia', 20), (lc.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_modulos (organization_id, modulo, status) values (lc.id('c0'), 'producao', 'ativo');
  update public.organization_modulos set status = 'cancelado', encerrado_em = now() where organization_id = lc.id('c0') and modulo = 'producao';
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select lc.id(o), lc.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('a0', 'a5', 'colaborador'), ('b0', 'b1', 'admin'), ('c0', 'c1', 'colaborador')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values (lc.id('a0'), lc.id('a5'), false, 'vinculado');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (lc.id('21'), lc.id('a0'), 'circulacao', 'circula', 'teatro', 'LC T'), (lc.id('2b'), lc.id('b0'), 'circulacao', 'circula', 'teatro', 'LC TB'),
    (lc.id('2c'), lc.id('c0'), 'circulacao', 'circula', 'teatro', 'LC TC');
  insert into public.producao_datas (id, organization_id, temporada_id, data) values
    (lc.id('41'), lc.id('a0'), lc.id('21'), date '2026-12-05'), (lc.id('4b'), lc.id('b0'), lc.id('2b'), date '2026-12-05'), (lc.id('4c'), lc.id('c0'), lc.id('2c'), date '2026-12-05');
  insert into public.producao_pessoas (id, organization_id, nome) values (lc.id('51'), lc.id('a0'), 'LC Ana'), (lc.id('5b'), lc.id('b0'), 'LC B');
  insert into public.producao_licencas (id, organization_id, data_id, tipo, situacao, prazo_dias, responsavel_pessoa_id) values
    (lc.id('61'), lc.id('a0'), lc.id('41'), 'alvara', 'a_pedir', -30, lc.id('51')),
    (lc.id('62'), lc.id('a0'), lc.id('41'), 'ecad', 'pedida', null, null),
    (lc.id('63'), lc.id('a0'), lc.id('41'), 'avcb', 'concedida', null, null),
    (lc.id('6c'), lc.id('c0'), lc.id('4c'), 'outro', 'a_pedir', null, null);
end
$dados$;

create function lc.tenta(comando text) returns text language plpgsql as $$
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

create function lc.efeito(comando text) returns text language plpgsql as $$
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

create function lc.ve(o text) returns text language sql as $$
  select (select count(*) from public.producao_licencas where organization_id = lc.id(o || '0'))::text;
$$;

create function lc.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', lc.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function lc.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_licencas'
             and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_licencas'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint
           where contype = 'f' and conrelid = 'public.producao_licencas'::regclass),
          'producao_licencas_data_id_fkey=c, producao_licencas_organization_id_fkey=c, producao_licencas_responsavel_pessoa_id_fkey=n',
          'a licença sai com a data e a organização; apagar a pessoa só desliga o responsável');
select is((select confdeltype::text from pg_constraint where conname = 'producao_tarefas_licenca_id_fkey'), 'c', 'a tarefa da licença sai com ela');
select ok(not has_function_privilege('authenticated', 'public.fn_producao_licenca_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_licenca_tarefa()', 'execute')
          and not has_table_privilege('anon', 'public.producao_licencas', 'select'), 'as funções de gatilho não são chamáveis e o visitante não toca na tabela');
select is((select string_agg(tgname::text, ' ' order by tgname::text collate "C") from pg_trigger
           where not tgisinternal and tgrelid = 'public.producao_licencas'::regclass),
          'producao_licencas_coerencia producao_licencas_historico producao_licencas_tarefa producao_licencas_updated_at', 'os quatro gatilhos');

-- ─── Quem vê ────────────────────────────────────────────────────────────────

select lc.como('a1');
select is(lc.ve('a'), '3', 'administrador lê as licenças');
select lc.como('a2');
select is(lc.ve('a'), '3', 'colaborador lê as licenças');
select lc.como('a3');
select is(lc.ve('a'), '3', 'leitor lê as licenças');
select lc.como('a5');
select is(lc.ve('a'), '0', 'o recorte "vinculado" sem vínculo não lê');
select lc.como('b1');
select is(lc.ve('a'), '0', 'outra organização não lê');
select lc.como('c1');
select is(lc.ve('c'), '1', 'produção só para leitura lê');

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select lc.como('a2');
select is(lc.tenta(format('insert into public.producao_licencas (organization_id, data_id, tipo) values (%L, %L, %L)', lc.id('a0'), lc.id('41'), 'filmagem')), 'aceito', 'colaborador cria a licença');
select is(lc.efeito(format('update public.producao_licencas set situacao = %L where id = %L', 'pedida', lc.id('61'))), 'sim', 'colaborador altera a licença');
select lc.como('a3');
select ok(lc.tenta(format('insert into public.producao_licencas (organization_id, data_id) values (%L, %L)', lc.id('a0'), lc.id('41'))) like '42501%', 'leitor não cria a licença');
select lc.como('c1');
select ok(lc.tenta(format('insert into public.producao_licencas (organization_id, data_id) values (%L, %L)', lc.id('c0'), lc.id('4c'))) like '42501%', 'produção só para leitura não grava');
select lc.como('a5');
select ok(lc.tenta(format('insert into public.producao_licencas (organization_id, data_id) values (%L, %L)', lc.id('a0'), lc.id('41'))) like '42501%', 'o recorte sem vínculo não grava');
select lc.volta();

-- ─── A tarefa da licença ────────────────────────────────────────────────────

select is((select titulo || '|' || situacao || '|' || prazo::text from public.producao_tarefas where licenca_id = lc.id('61')),
          'Licença: alvará|aberta|2026-11-05', 'a licença a pedir tem a tarefa aberta, com o prazo contado da data');
select is((select situacao from public.producao_tarefas where licenca_id = lc.id('63')), 'feita', 'a licença concedida tem a tarefa feita');
update public.producao_licencas set situacao = 'concedida' where id = lc.id('61');
select is((select situacao || '|' || (concluida_em is not null)::text from public.producao_tarefas where licenca_id = lc.id('61')), 'feita|true', 'conceder a licença conclui a tarefa');
update public.producao_licencas set situacao = 'pedida', prazo_dias = -10 where id = lc.id('61');
select is((select situacao || '|' || prazo::text from public.producao_tarefas where licenca_id = lc.id('61')), 'aberta|2026-11-25', 'voltar a pedida reabre a tarefa e o prazo novo vale');
update public.producao_datas set data = date '2026-12-10' where id = lc.id('41');
select is((select prazo::text from public.producao_tarefas where licenca_id = lc.id('61')), '2026-11-30', 'adiar a data move o prazo da tarefa');
select is((select count(*)::int from public.producao_tarefas where licenca_id = lc.id('61')), 1, 'uma tarefa só por licença');

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            lc.tenta(format('insert into public.producao_licencas (organization_id, data_id, tipo) values (%L, %L, %L)', lc.id('a0'), lc.id('41'), 'passaporte')),
            lc.tenta(format('insert into public.producao_licencas (organization_id, data_id, situacao) values (%L, %L, %L)', lc.id('a0'), lc.id('41'), 'talvez')),
            lc.tenta(format('insert into public.producao_licencas (organization_id, data_id, prazo_dias) values (%L, %L, 800)', lc.id('a0'), lc.id('41'))),
            lc.tenta(format('insert into public.producao_licencas (organization_id, data_id, protocolo) values (%L, %L, %L)', lc.id('a0'), lc.id('41'), ' ')),
            lc.tenta(format('insert into public.producao_licencas (organization_id, data_id, notas) values (%L, %L, repeat(%L, 501))', lc.id('a0'), lc.id('41'), 'a')),
            lc.tenta(format('insert into public.producao_licencas (organization_id, data_id) values (%L, %L)', lc.id('a0'), lc.id('4b'))),
            lc.tenta(format('insert into public.producao_licencas (organization_id, data_id, responsavel_pessoa_id) values (%L, %L, %L)', lc.id('a0'), lc.id('41'), lc.id('5b'))),
            lc.tenta(format('update public.producao_licencas set organization_id = %L where id = %L', lc.id('b0'), lc.id('61'))),
            lc.tenta(format('update public.producao_licencas set data_id = %L where id = %L', lc.id('4b'), lc.id('61')))],
          array['23514 producao_licencas_tipo_check', '23514 producao_licencas_situacao_check', '23514 producao_licencas_prazo_dias_check', '23514 producao_licencas_protocolo_check',
                '23514 producao_licencas_notas_check', '23514 data_de_outra_organizacao', '23514 pessoa_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 data_nao_muda'],
          'tipo, situação, prazo, protocolo e notas; data e pessoa da organização; organização e data fixas');

-- ─── Histórico ──────────────────────────────────────────────────────────────

update public.producao_licencas set protocolo = '2026/0001' where id = lc.id('63');
select is((select string_agg(campo, ',' order by campo) from public.producao_historico where entidade = 'producao_licencas' and entidade_id = lc.id('63') and acao = 'alterou'),
          'protocolo', 'mudar o protocolo deixa uma linha de histórico');
select lc.como('a3');
select ok((select count(*) from public.producao_historico where entidade = 'producao_licencas' and entidade_id = lc.id('63')) > 0, 'quem lê a licença lê o histórico dela');
select lc.volta();

-- ─── Chaves ─────────────────────────────────────────────────────────────────

delete from public.producao_licencas where id = lc.id('62');
select is((select count(*)::int from public.producao_tarefas where licenca_id = lc.id('62')), 0, 'apagar a licença leva a tarefa dela');

select * from finish();
rollback;
