-- PD7.9 (primeiro corte): acerto de contas do borderô (producao_bordero_acertos).
--
-- Dinheiro: só lê e escreve quem tem a permissão; quem aprovou e quando só o gatilho escreve (o navegador não toca nessas colunas). Regras: as porcentagens
-- do borderô somam até 100; só se aprova com o borderô fechado; a linha aprovada não muda nem se apaga; desaprova-se enquanto não houver `pago_em`;
-- `pago_em` só existe em linha aprovada; o borderô não reabre com acerto aprovado; no máximo uma parte "resto"; sem histórico (valor).
-- Ids 0d400000-0000-4000-8000-0000000000XX, ou ct.id('XX'). Cenário desfeito no fim.
--   A (a0): sessões 91 (borderô b1, rascunho, com ac3: Companhia 50%) e 92 (borderô b2, FECHADO, com ac1: Companhia 60% e ac2: Casa 30%); a1 administrador, a2 colaborador
--   com dinheiro, a3 colaborador sem dinheiro, a4 leitor com dinheiro.  B (b0): b1 admin, borderô brb com o acerto acb.
-- Rodar: supabase/tests/README.md, com as migrations producao_bordero e producao_bordero_acertos na frente se não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

create schema ct;
grant usage on schema ct to authenticated, anon;

create function ct.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d400000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ct.id(s), 'ct-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'b1']) as s;
  insert into public.organizations (id, nome) values (ct.id('a0'), 'CT A'), (ct.id('b0'), 'CT B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (ct.id('a0'), 'producao', 'cortesia', 20), (ct.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ct.id(o), ct.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'colaborador'), ('a0', 'a4', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, escopo) values
    (ct.id('a0'), ct.id('a2'), true, 'organizacao'), (ct.id('a0'), ct.id('a3'), false, 'organizacao'), (ct.id('a0'), ct.id('a4'), true, 'organizacao');
  insert into public.producao_espacos (id, organization_id, nome, tipo) values (ct.id('31'), ct.id('a0'), 'CT E1', 'Teatro'), (ct.id('3b'), ct.id('b0'), 'CT EB', 'Teatro');
  insert into public.producao_salas (id, organization_id, espaco_id, nome) values (ct.id('71'), ct.id('a0'), ct.id('31'), 'S1'), (ct.id('7b'), ct.id('b0'), ct.id('3b'), 'SB');
  insert into public.producao_pautas (id, organization_id, sala_id, titulo, inicio, fim, situacao) values
    (ct.id('81'), ct.id('a0'), ct.id('71'), 'Festival', date '2026-12-05', date '2026-12-09', 'confirmada'),
    (ct.id('8b'), ct.id('b0'), ct.id('7b'), 'Pauta B', date '2026-12-05', date '2026-12-07', 'consulta');
  insert into public.producao_sessoes (id, organization_id, pauta_id, dia, inicio, fim) values
    (ct.id('91'), ct.id('a0'), ct.id('81'), date '2026-12-05', time '18:00', time '20:00'),
    (ct.id('92'), ct.id('a0'), ct.id('81'), date '2026-12-06', time '18:00', time '20:00'),
    (ct.id('9b'), ct.id('b0'), ct.id('8b'), date '2026-12-05', time '18:00', time '20:00');
  insert into public.producao_borderos (id, organization_id, sessao_id) values (ct.id('c1'), ct.id('a0'), ct.id('91')), (ct.id('c2'), ct.id('a0'), ct.id('92')), (ct.id('cb'), ct.id('b0'), ct.id('9b'));
  insert into public.producao_bordero_acertos (id, organization_id, bordero_id, parte, papel, forma, valor) values
    (ct.id('d1'), ct.id('a0'), ct.id('c2'), 'Companhia', 'companhia', 'percentual', 60),
    (ct.id('d2'), ct.id('a0'), ct.id('c2'), 'Casa', 'casa', 'percentual', 30),
    (ct.id('d3'), ct.id('a0'), ct.id('c1'), 'Companhia', 'companhia', 'percentual', 50),
    (ct.id('db'), ct.id('b0'), ct.id('cb'), 'Companhia', 'companhia', 'percentual', 100);
  update public.producao_borderos set situacao = 'fechado' where id = ct.id('c2');
end
$dados$;

create function ct.tenta(comando text) returns text language plpgsql as $$
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

create function ct.efeito(comando text) returns text language plpgsql as $$
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

create function ct.ve(o text) returns text language plpgsql as $$
declare n bigint;
begin
  select count(*) into n from public.producao_bordero_acertos where organization_id = ct.id(o || '0');
  return n::text;
end;
$$;

create function ct.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ct.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function ct.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_bordero_acertos' and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_bordero_acertos'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint where contype = 'f' and conrelid = 'public.producao_bordero_acertos'::regclass and confrelid <> 'auth.users'::regclass),
          'producao_bordero_acertos_bordero_id_fkey=c, producao_bordero_acertos_organization_id_fkey=c', 'o acerto sai com o borderô');
select ok(not has_table_privilege('anon', 'public.producao_bordero_acertos', 'select')
          and not has_column_privilege('authenticated', 'public.producao_bordero_acertos', 'aprovado_por', 'update')
          and not has_column_privilege('authenticated', 'public.producao_bordero_acertos', 'aprovado_em', 'update')
          and not has_column_privilege('authenticated', 'public.producao_bordero_acertos', 'aprovado_por', 'insert')
          and has_column_privilege('authenticated', 'public.producao_bordero_acertos', 'pago_em', 'update')
          and not has_function_privilege('authenticated', 'public.fn_producao_bordero_acerto_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_bordero_reabrir_guarda()', 'execute')
          and exists (select 1 from pg_trigger where tgrelid = 'public.producao_borderos'::regclass and tgname = 'producao_borderos_reabrir_guarda')
          and (select count(*)::int from pg_trigger where tgrelid = 'public.producao_bordero_acertos'::regclass and not tgisinternal) = 2,
          'o visitante não toca; o navegador não escreve quem aprovou nem quando; o guarda do borderô existe; sem gatilho de histórico (dinheiro)');

-- ─── Quem lê (dinheiro) ─────────────────────────────────────────────────────

select ct.como('a1');
select is(ct.ve('a'), '3', 'administrador lê');
select ct.como('a2');
select is(ct.ve('a'), '3', 'colaborador com dinheiro lê');
select ct.como('a3');
select is(ct.ve('a'), '0', 'colaborador sem dinheiro não vê nenhuma linha');
select ct.como('a4');
select is(ct.ve('a'), '3', 'leitor com dinheiro lê');
select ct.como('b1');
select is(ct.ve('a') || '|' || ct.ve('b'), '0|1', 'outra organização só lê o que é dela');
select ct.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ct.como('a2');
select is(ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte, papel, forma, valor) values (%L, %L, %L, %L, %L, 20)', ct.id('a0'), ct.id('c1'), 'Casa', 'casa', 'percentual')), 'aceito', 'colaborador com dinheiro propõe a parte');
select ct.como('a3');
select ok(ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte, papel, forma, valor) values (%L, %L, %L, %L, %L, 20)', ct.id('a0'), ct.id('c1'), 'Casa', 'casa', 'percentual')) like '42501%', 'colaborador sem dinheiro não grava');
select ct.como('a4');
select ok(ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte, papel, forma, valor) values (%L, %L, %L, %L, %L, 20)', ct.id('a0'), ct.id('c1'), 'Casa', 'casa', 'percentual')) like '42501%', 'leitor, mesmo com dinheiro, não grava');
select ct.como('b1');
select is(ct.efeito(format('update public.producao_bordero_acertos set valor = 1 where id = %L', ct.id('d1'))), '', 'outra organização não altera');
select ct.volta();

-- ─── As regras do acerto ────────────────────────────────────────────────────
-- b2 (fechado) tem Companhia 60% e Casa 30%: sobram 10%.

select is(array[
            ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte, forma, valor) values (%L, %L, %L, %L, 11)', ct.id('a0'), ct.id('c2'), 'Patrocinador', 'percentual')),
            ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte, forma, valor) values (%L, %L, %L, %L, 10)', ct.id('a0'), ct.id('c2'), 'Patrocinador', 'percentual')),
            ct.tenta(format('update public.producao_bordero_acertos set valor = 41 where id = %L', ct.id('d2'))),
            ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte, forma, valor) values (%L, %L, %L, %L, 5000)', ct.id('a0'), ct.id('c2'), 'Patrocinador', 'fixo'))],
          array['23514 percentuais_passam_de_100', 'aceito', '23514 percentuais_passam_de_100', 'aceito'], 'as porcentagens somam até 100 (60 + 30 + 10); passar de 100 é recusado; valor fixo não entra nessa soma');
select is(ct.tenta(format('update public.producao_bordero_acertos set situacao = %L where id = %L', 'aprovado', ct.id('d3'))), '23514 bordero_nao_fechado', 'só se aprova com o borderô fechado');
select ct.como('a2');
update public.producao_bordero_acertos set situacao = 'aprovado' where id = ct.id('d1');
select ct.volta();
select ok((select aprovado_por = ct.id('a2') and aprovado_em is not null from public.producao_bordero_acertos where id = ct.id('d1')), 'aprovar carimba quem aprovou e quando (pelo gatilho)');
select is(array[
            ct.tenta(format('update public.producao_bordero_acertos set valor = 50 where id = %L', ct.id('d1'))),
            ct.tenta(format('update public.producao_bordero_acertos set parte = %L where id = %L', 'Outra', ct.id('d1'))),
            ct.tenta(format('delete from public.producao_bordero_acertos where id = %L', ct.id('d1')))],
          array['23514 acerto_aprovado', '23514 acerto_aprovado', '23514 acerto_aprovado'], 'a linha aprovada não muda nem se apaga');
update public.producao_bordero_acertos set pago_em = date '2026-12-20' where id = ct.id('d1');
select is(array[
            ct.tenta(format('update public.producao_bordero_acertos set situacao = %L where id = %L', 'proposto', ct.id('d1'))),
            ct.tenta(format('update public.producao_bordero_acertos set pago_em = date ''2026-12-20'' where id = %L', ct.id('d2'))),
            ct.tenta(format('update public.producao_borderos set situacao = %L where id = %L', 'conferido', ct.id('c2')))],
          array['23514 acerto_pago', '23514 producao_bordero_acertos_pago_check', '23514 acerto_aprovado'],
          'com pago_em não se desaprova; pago_em só em linha aprovada; e o borderô não reabre com acerto aprovado');
update public.producao_bordero_acertos set situacao = 'aprovado' where id = ct.id('d2');
select is(ct.tenta(format('update public.producao_bordero_acertos set situacao = %L where id = %L', 'proposto', ct.id('d2'))), 'aceito', 'enquanto não foi pago, desaprova-se (e o carimbo sai)');
insert into public.producao_bordero_acertos (organization_id, bordero_id, parte, papel, forma, valor) values (ct.id('a0'), ct.id('c1'), 'Casa (resto)', 'casa', 'resto', 0);
select is(ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte, forma, valor) values (%L, %L, %L, %L, 0)', ct.id('a0'), ct.id('c1'), 'Outro resto', 'resto')), '23505 producao_bordero_acertos_resto_idx', 'no máximo uma parte "resto" por borderô');

-- ─── Forma e coerência ──────────────────────────────────────────────────────

select is(array[
            ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte) values (%L, %L, %L)', ct.id('a0'), ct.id('c1'), ' ')),
            ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte, papel) values (%L, %L, %L, %L)', ct.id('a0'), ct.id('c1'), 'Nova', 'estranha')),
            ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte, forma) values (%L, %L, %L, %L)', ct.id('a0'), ct.id('c1'), 'Nova', 'metade')),
            ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte, forma, valor) values (%L, %L, %L, %L, 101)', ct.id('a0'), ct.id('c2'), 'Nova', 'percentual')),
            ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte, forma, valor) values (%L, %L, %L, %L, 5)', ct.id('a0'), ct.id('c2'), 'Nova', 'resto')),
            ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte) values (%L, %L, %L)', ct.id('a0'), ct.id('c1'), ' companhia ')),
            ct.tenta(format('insert into public.producao_bordero_acertos (organization_id, bordero_id, parte) values (%L, %L, %L)', ct.id('a0'), ct.id('cb'), 'Nova')),
            ct.tenta(format('update public.producao_bordero_acertos set organization_id = %L where id = %L', ct.id('b0'), ct.id('d3'))),
            ct.tenta(format('update public.producao_bordero_acertos set bordero_id = %L where id = %L', ct.id('c2'), ct.id('d3')))],
          array['23514 producao_bordero_acertos_parte_check', '23514 producao_bordero_acertos_papel_check', '23514 producao_bordero_acertos_forma_check', '23514 percentuais_passam_de_100',
                '23514 producao_bordero_acertos_valor_check', '23505 producao_bordero_acertos_parte_idx', '23514 bordero_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 bordero_nao_muda'],
          'parte, papel, forma, porcentagem acima de 100, o resto não leva valor, parte única no borderô, borderô da organização e o que não muda');

select is((select count(*)::int from public.producao_historico where entidade = 'producao_bordero_acertos'), 0, 'o acerto não tem histórico: nenhum valor vaza para quem não vê o dinheiro');

select * from finish();
rollback;
