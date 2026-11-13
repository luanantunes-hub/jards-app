-- PD5.6 (primeiro corte): adiantamentos com prestação e saldo, e diárias com recibo (producao_adiantamentos, producao_adiantamento_gastos, producao_diarias).
--
-- Dinheiro: só lê e escreve quem tem a permissão. Adiantamento: a prestação mais o devolvido não passam do valor; só se encerra com o saldo zerado; encerrado não muda nem se
-- apaga. Diária: período de 1 a 366 dias, sem cruzar outro da mesma pessoa, recibo para pagar, paga não muda nem se apaga. Sem histórico.
-- Ids 0dc00000-0000-4000-8000-0000000000XX, ou ct.id('XX'). Cenário desfeito no fim.
--   A (a0): a1 administrador, a2 colaborador com dinheiro, a3 colaborador sem dinheiro, a4 leitor com dinheiro; temporada t1; pessoas p1 e p2; adiantamento d1 (1000, gasto de 300),
--   d2 (500, encerrado com 500 de gastos); diárias r1 (de 01 a 05/03, 5 dias a 200) e r2 (de 10 a 12/03, paga com recibo). B (b0): b1 admin, temporada tb, pessoa pb, adiantamento db.
-- Rodar: supabase/tests/README.md, com a migration producao_adiantamentos_diarias na frente se não estiver aplicada.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

create schema ct;
grant usage on schema ct to authenticated, anon;

create function ct.id(sufixo text) returns uuid language sql immutable as $$
  select ('0dc00000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
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
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (ct.id('51'), ct.id('a0'), 'turne', 'circula', 'teatro', 'CT Temporada A'), (ct.id('5b'), ct.id('b0'), 'turne', 'circula', 'teatro', 'CT Temporada B');
  insert into public.producao_pessoas (id, organization_id, nome) values
    (ct.id('e1'), ct.id('a0'), 'Pessoa Um'), (ct.id('e2'), ct.id('a0'), 'Pessoa Dois'), (ct.id('eb'), ct.id('b0'), 'Pessoa B');
  insert into public.producao_adiantamentos (id, organization_id, temporada_id, pessoa_id, descricao, valor, data) values
    (ct.id('d1'), ct.id('a0'), ct.id('51'), ct.id('e1'), 'Verba da estrada', 1000, date '2027-03-01'),
    (ct.id('d2'), ct.id('a0'), ct.id('51'), ct.id('e2'), 'Cartão da equipe', 500, date '2027-03-02'),
    (ct.id('db'), ct.id('b0'), ct.id('5b'), ct.id('eb'), 'Verba B', 100, date '2027-03-01');
  insert into public.producao_adiantamento_gastos (id, organization_id, adiantamento_id, descricao, valor, data) values
    (ct.id('91'), ct.id('a0'), ct.id('d1'), 'Combustível', 300, date '2027-03-03'),
    (ct.id('92'), ct.id('a0'), ct.id('d2'), 'Refeições', 500, date '2027-03-04'),
    (ct.id('9b'), ct.id('b0'), ct.id('db'), 'Gasto B', 50, date '2027-03-03');
  update public.producao_adiantamentos set situacao = 'encerrado' where id = ct.id('d2');
  insert into public.producao_diarias (id, organization_id, temporada_id, pessoa_id, de, ate, dias, valor_dia) values
    (ct.id('f1'), ct.id('a0'), ct.id('51'), ct.id('e1'), date '2027-03-01', date '2027-03-05', 5, 200),
    (ct.id('f2'), ct.id('a0'), ct.id('51'), ct.id('e2'), date '2027-03-10', date '2027-03-12', 3, 150),
    (ct.id('fb'), ct.id('b0'), ct.id('5b'), ct.id('eb'), date '2027-03-01', date '2027-03-02', 2, 100);
  update public.producao_diarias set recibo = 'REC-7', pago_em = date '2027-03-20' where id = ct.id('f2');
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
declare a bigint; b bigint; c bigint;
begin
  select count(*) into a from public.producao_adiantamentos where organization_id = ct.id(o || '0');
  select count(*) into b from public.producao_adiantamento_gastos where organization_id = ct.id(o || '0');
  select count(*) into c from public.producao_diarias where organization_id = ct.id(o || '0');
  return a::text || '|' || b::text || '|' || c::text;
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

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('producao_adiantamentos', 'producao_adiantamento_gastos', 'producao_diarias') and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 15, 'cinco regras em cada tabela, nenhuma aberta');
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.producao_adiantamentos'::regclass, 'public.producao_adiantamento_gastos'::regclass, 'public.producao_diarias'::regclass)), 'segurança por linha ligada nas três');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint where contype = 'f'
           and conrelid in ('public.producao_adiantamentos'::regclass, 'public.producao_adiantamento_gastos'::regclass, 'public.producao_diarias'::regclass)),
          'producao_adiantamento_gastos_adiantamento_id_fkey=c, producao_adiantamento_gastos_organization_id_fkey=c, producao_adiantamentos_organization_id_fkey=c, producao_adiantamentos_pessoa_id_fkey=r, producao_adiantamentos_temporada_id_fkey=c, producao_diarias_organization_id_fkey=c, producao_diarias_pessoa_id_fkey=r, producao_diarias_temporada_id_fkey=c',
          'a prestação sai com o adiantamento; a pessoa com adiantamento ou diária não se apaga (restrict)');
select ok(not has_table_privilege('anon', 'public.producao_adiantamentos', 'select')
          and not has_table_privilege('anon', 'public.producao_adiantamento_gastos', 'select')
          and not has_table_privilege('anon', 'public.producao_diarias', 'select')
          and not has_function_privilege('authenticated', 'public.fn_producao_adiantamento_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_adiantamento_gasto_coerencia()', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_diaria_coerencia()', 'execute')
          and (select count(*)::int from pg_trigger where tgrelid in ('public.producao_adiantamentos'::regclass, 'public.producao_adiantamento_gastos'::regclass, 'public.producao_diarias'::regclass) and not tgisinternal) = 6,
          'o visitante não toca; sem gatilho de histórico (dinheiro)');

-- ─── Quem lê (dinheiro) ─────────────────────────────────────────────────────

select ct.como('a1');
select is(ct.ve('a'), '2|2|2', 'administrador lê');
select ct.como('a2');
select is(ct.ve('a'), '2|2|2', 'colaborador com dinheiro lê');
select ct.como('a3');
select is(ct.ve('a'), '0|0|0', 'colaborador sem dinheiro não vê nada');
select ct.como('a4');
select is(ct.ve('a'), '2|2|2', 'leitor com dinheiro lê');
select ct.como('b1');
select is(ct.ve('a') || ' ' || ct.ve('b'), '0|0|0 1|1|1', 'outra organização só lê o que é dela');
select ct.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ct.como('a2');
select ok(ct.tenta(format('insert into public.producao_adiantamentos (organization_id, temporada_id, pessoa_id, descricao, valor, data) values (%L, %L, %L, %L, 100, date ''2027-03-06'')', ct.id('a0'), ct.id('51'), ct.id('e1'), 'Outro')) = 'aceito'
          and ct.tenta(format('insert into public.producao_diarias (organization_id, temporada_id, pessoa_id, de, ate, dias, valor_dia) values (%L, %L, %L, date ''2027-04-01'', date ''2027-04-02'', 2, 100)', ct.id('a0'), ct.id('51'), ct.id('e1'))) = 'aceito',
          'colaborador com dinheiro lança o adiantamento e a diária');
select ct.como('a3');
select ok(ct.tenta(format('insert into public.producao_adiantamentos (organization_id, temporada_id, pessoa_id, descricao, valor, data) values (%L, %L, %L, %L, 100, date ''2027-03-06'')', ct.id('a0'), ct.id('51'), ct.id('e1'), 'Outro')) like '42501%'
          and ct.efeito(format('update public.producao_diarias set valor_dia = 1 where id = %L', ct.id('f1'))) = '', 'colaborador sem dinheiro não lança nem altera');
select ct.como('a4');
select ok(ct.tenta(format('insert into public.producao_adiantamento_gastos (organization_id, adiantamento_id, descricao, valor, data) values (%L, %L, %L, 10, date ''2027-03-06'')', ct.id('a0'), ct.id('d1'), 'X')) like '42501%', 'leitor, mesmo com dinheiro, não grava');
select ct.como('b1');
select is(ct.efeito(format('update public.producao_adiantamentos set observacao = %L where id = %L', 'x', ct.id('d1'))), '', 'outra organização não altera');
select ct.volta();

-- ─── Adiantamento ───────────────────────────────────────────────────────────

select is(array[
            ct.tenta(format('insert into public.producao_adiantamentos (organization_id, temporada_id, pessoa_id, descricao, valor, data) values (%L, %L, %L, %L, 0, date ''2027-03-06'')', ct.id('a0'), ct.id('51'), ct.id('e1'), 'Zero')),
            ct.tenta(format('insert into public.producao_adiantamentos (organization_id, temporada_id, pessoa_id, descricao, valor, data) values (%L, %L, %L, %L, 100, date ''2027-03-06'')', ct.id('a0'), ct.id('51'), ct.id('e1'), ' ')),
            ct.tenta(format('insert into public.producao_adiantamentos (organization_id, temporada_id, pessoa_id, descricao, valor, data, devolvido) values (%L, %L, %L, %L, 100, date ''2027-03-06'', 200)', ct.id('a0'), ct.id('51'), ct.id('e1'), 'Devolve demais')),
            ct.tenta(format('insert into public.producao_adiantamentos (organization_id, temporada_id, pessoa_id, descricao, valor, data, situacao) values (%L, %L, %L, %L, 100, date ''2027-03-06'', %L)', ct.id('a0'), ct.id('51'), ct.id('e1'), 'Já encerrado', 'encerrado')),
            ct.tenta(format('insert into public.producao_adiantamentos (organization_id, temporada_id, pessoa_id, descricao, valor, data) values (%L, %L, %L, %L, 100, date ''2027-03-06'')', ct.id('a0'), ct.id('5b'), ct.id('e1'), 'Outra org')),
            ct.tenta(format('insert into public.producao_adiantamentos (organization_id, temporada_id, pessoa_id, descricao, valor, data) values (%L, %L, %L, %L, 100, date ''2027-03-06'')', ct.id('a0'), ct.id('51'), ct.id('eb'), 'Pessoa de outra org')),
            ct.tenta(format('update public.producao_adiantamentos set organization_id = %L where id = %L', ct.id('b0'), ct.id('d1'))),
            ct.tenta(format('update public.producao_adiantamentos set pessoa_id = %L where id = %L', ct.id('e2'), ct.id('d1')))],
          array['23514 producao_adiantamentos_valor_check', '23514 producao_adiantamentos_descricao_check', '23514 producao_adiantamentos_valor_check', '23514 adiantamento_nasce_aberto',
                '23514 temporada_de_outra_organizacao', '23514 pessoa_de_outra_organizacao', '23514 organizacao_nao_muda', '23514 pessoa_nao_muda'],
          'valor maior que zero, descrição, devolvido até o valor, nasce aberto, temporada e pessoa da organização e o que não muda');
select is(array[
            ct.tenta(format('insert into public.producao_adiantamento_gastos (organization_id, adiantamento_id, descricao, valor, data) values (%L, %L, %L, 701, date ''2027-03-06'')', ct.id('a0'), ct.id('d1'), 'Passa')),
            ct.tenta(format('insert into public.producao_adiantamento_gastos (organization_id, adiantamento_id, descricao, valor, data) values (%L, %L, %L, 700, date ''2027-03-06'')', ct.id('a0'), ct.id('d1'), 'Fecha o saldo')),
            ct.tenta(format('update public.producao_adiantamento_gastos set valor = 1000 where id = %L', ct.id('91'))),
            ct.tenta(format('update public.producao_adiantamentos set devolvido = 701 where id = %L', ct.id('d1'))),
            ct.tenta(format('update public.producao_adiantamentos set devolvido = 700 where id = %L', ct.id('d1'))),
            ct.tenta(format('insert into public.producao_adiantamento_gastos (organization_id, adiantamento_id, descricao, valor, data) values (%L, %L, %L, 0, date ''2027-03-06'')', ct.id('a0'), ct.id('d1'), 'Zero')),
            ct.tenta(format('insert into public.producao_adiantamento_gastos (organization_id, adiantamento_id, descricao, valor, data) values (%L, %L, %L, 10, date ''2027-03-06'')', ct.id('a0'), ct.id('db'), 'Adiantamento de outra org')),
            ct.tenta(format('update public.producao_adiantamento_gastos set adiantamento_id = %L where id = %L', ct.id('d2'), ct.id('91')))],
          array['23514 prestacao_passa_do_adiantamento', 'aceito', 'aceito', '23514 prestacao_passa_do_adiantamento', 'aceito', '23514 producao_adiantamento_gastos_valor_check', '23514 adiantamento_de_outra_organizacao', '23514 adiantamento_nao_muda'],
          'a prestação mais o devolvido não passam do valor (300 já prestados de 1.000)');
select is(array[
            ct.tenta(format('update public.producao_adiantamentos set situacao = %L where id = %L', 'encerrado', ct.id('d1'))),
            ct.tenta(format('update public.producao_adiantamentos set situacao = %L, devolvido = 700 where id = %L', 'encerrado', ct.id('d1')))],
          array['23514 adiantamento_com_saldo', 'aceito'], 'só se encerra com o saldo zerado (300 prestados + 700 devolvidos de 1.000)');
select is(array[
            ct.tenta(format('update public.producao_adiantamentos set observacao = %L where id = %L', 'depois de encerrar', ct.id('d2'))),
            ct.tenta(format('insert into public.producao_adiantamento_gastos (organization_id, adiantamento_id, descricao, valor, data) values (%L, %L, %L, 1, date ''2027-03-06'')', ct.id('a0'), ct.id('d2'), 'Depois de encerrar')),
            ct.tenta(format('update public.producao_adiantamento_gastos set valor = 400 where id = %L', ct.id('92'))),
            ct.tenta(format('delete from public.producao_adiantamento_gastos where id = %L', ct.id('92'))),
            ct.tenta(format('delete from public.producao_adiantamentos where id = %L', ct.id('d2')))],
          array['23514 adiantamento_encerrado', '23514 adiantamento_encerrado', '23514 adiantamento_encerrado', '23514 adiantamento_encerrado', '23514 adiantamento_encerrado'], 'encerrado: nada muda nem se apaga');
select ok(ct.tenta(format('delete from public.producao_adiantamentos where id = %L', ct.id('d1'))) = 'aceito' and ct.tenta(format('delete from public.producao_pessoas where id = %L', ct.id('e1'))) like '23503%', 'o aberto se apaga com a prestação; a pessoa com adiantamento não');

-- ─── Diária ─────────────────────────────────────────────────────────────────

select is(array[
            ct.tenta(format('insert into public.producao_diarias (organization_id, temporada_id, pessoa_id, de, ate, dias, valor_dia) values (%L, %L, %L, date ''2027-03-05'', date ''2027-03-07'', 3, 100)', ct.id('a0'), ct.id('51'), ct.id('e1'))),
            ct.tenta(format('insert into public.producao_diarias (organization_id, temporada_id, pessoa_id, de, ate, dias, valor_dia) values (%L, %L, %L, date ''2027-03-06'', date ''2027-03-07'', 2, 100)', ct.id('a0'), ct.id('51'), ct.id('e1'))),
            ct.tenta(format('insert into public.producao_diarias (organization_id, temporada_id, pessoa_id, de, ate, dias, valor_dia) values (%L, %L, %L, date ''2027-03-05'', date ''2027-03-07'', 3, 100)', ct.id('a0'), ct.id('51'), ct.id('e2'))),
            ct.tenta(format('insert into public.producao_diarias (organization_id, temporada_id, pessoa_id, de, ate, dias, valor_dia) values (%L, %L, %L, date ''2027-03-20'', date ''2027-03-10'', 1, 100)', ct.id('a0'), ct.id('51'), ct.id('e1'))),
            ct.tenta(format('insert into public.producao_diarias (organization_id, temporada_id, pessoa_id, de, ate, dias, valor_dia) values (%L, %L, %L, date ''2027-03-20'', date ''2027-03-21'', 3, 100)', ct.id('a0'), ct.id('51'), ct.id('e1'))),
            ct.tenta(format('insert into public.producao_diarias (organization_id, temporada_id, pessoa_id, de, ate, dias, valor_dia) values (%L, %L, %L, date ''2027-03-20'', date ''2027-03-21'', 0, 100)', ct.id('a0'), ct.id('51'), ct.id('e1'))),
            ct.tenta(format('insert into public.producao_diarias (organization_id, temporada_id, pessoa_id, de, ate, dias, valor_dia) values (%L, %L, %L, date ''2027-03-20'', date ''2027-03-21'', 2, -1)', ct.id('a0'), ct.id('51'), ct.id('e1'))),
            ct.tenta(format('insert into public.producao_diarias (organization_id, temporada_id, pessoa_id, de, ate, dias, valor_dia) values (%L, %L, %L, date ''2027-03-20'', date ''2027-03-21'', 2, 100)', ct.id('a0'), ct.id('51'), ct.id('eb'))),
            ct.tenta(format('update public.producao_diarias set pessoa_id = %L where id = %L', ct.id('e2'), ct.id('f1'))),
            ct.tenta(format('update public.producao_diarias set dias = 3, valor_dia = 250 where id = %L', ct.id('f1')))],
          array['23514 diaria_sobreposta', 'aceito', 'aceito', '23514 dias_ou_periodo_invalido', '23514 dias_ou_periodo_invalido', '23514 dias_ou_periodo_invalido',
                '23514 producao_diarias_valor_check', '23514 pessoa_de_outra_organizacao', '23514 pessoa_nao_muda', 'aceito'],
          'a mesma pessoa não cruza períodos (períodos colados e outra pessoa podem), de 1 até o número de dias do período, valor do dia não negativo, pessoa da organização e o que não muda');
select is(array[
            ct.tenta(format('update public.producao_diarias set pago_em = date ''2027-03-20'' where id = %L', ct.id('f1'))),
            ct.tenta(format('update public.producao_diarias set recibo = %L, pago_em = date ''2027-03-20'' where id = %L', 'REC-8', ct.id('f1'))),
            ct.tenta(format('update public.producao_diarias set valor_dia = 1 where id = %L', ct.id('f2'))),
            ct.tenta(format('update public.producao_diarias set pago_em = null where id = %L', ct.id('f2'))),
            ct.tenta(format('delete from public.producao_diarias where id = %L', ct.id('f2'))),
            ct.tenta(format('delete from public.producao_diarias where id = %L', ct.id('f1')))],
          array['23514 diaria_sem_recibo', 'aceito', '23514 diaria_paga', '23514 diaria_paga', '23514 diaria_paga', 'aceito'], 'pagar pede o recibo; paga não muda nem se apaga; a não paga se apaga');

select is((select count(*)::int from public.producao_historico where entidade in ('producao_adiantamentos', 'producao_adiantamento_gastos', 'producao_diarias')), 0, 'sem histórico: nenhum valor vaza para quem não vê o dinheiro');

select * from finish();
rollback;
