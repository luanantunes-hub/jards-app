-- PD5.4 (primeiro corte): pedidos de pagamento com alçada (producao_pedidos, fn_producao_pedido_mudar e a ligação do lançamento ao pedido).
--
-- Dinheiro: só lê e escreve quem tem a permissão. A situação, quem aprovou, quando e o motivo da recusa só a função escreve (o navegador não tem a coluna).
-- A função confere cada passo: enviar, retirar, pagar e concluir pedem editar e dinheiro; aprovar e recusar pedem a ação aprovar (administrador, ou colaborador com
-- dinheiro e alçada) e, para aprovar, o valor contra a alçada (administrador sem teto); recusar pede o motivo; pago só com lançamentos ligados somando o valor.
-- Ids 0da00000-0000-4000-8000-0000000000XX, ou ct.id('XX'). Cenário desfeito no fim.
--   A (a0): a1 administrador, a2 colaborador com dinheiro e alçada 1000, a3 colaborador com dinheiro sem alçada, a4 colaborador sem dinheiro, a5 leitor com dinheiro;
--   temporadas t1 e t2; orçamento c1 (t1, linha 11) e c2 (t2, linha 12); pedidos 71 (rascunho, 500, linha 11), 72 (pendente, 5000), 73 (pendente, 200), 74 (rascunho, 100).
--   B (b0): b1 admin, temporada tb, pedido 7b.
-- Rodar: supabase/tests/README.md, com as migrations do orçamento, lançamentos e producao_pedidos na frente se não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(38);

create schema ct;
grant usage on schema ct to authenticated, anon;

create function ct.id(sufixo text) returns uuid language sql immutable as $$
  select ('0da00000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select ct.id(s), 'ct-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from unnest(array['a1', 'a2', 'a3', 'a4', 'a5', 'b1']) as s;
  insert into public.organizations (id, nome) values (ct.id('a0'), 'CT A'), (ct.id('b0'), 'CT B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (ct.id('a0'), 'producao', 'cortesia', 20), (ct.id('b0'), 'producao', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select ct.id(o), ct.id(p), papel, '{producao}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'colaborador'), ('a0', 'a4', 'colaborador'), ('a0', 'a5', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.producao_funcoes (organization_id, user_id, dinheiro, alcada, escopo) values
    (ct.id('a0'), ct.id('a2'), true, 1000, 'organizacao'), (ct.id('a0'), ct.id('a3'), true, null, 'organizacao'),
    (ct.id('a0'), ct.id('a4'), false, null, 'organizacao'), (ct.id('a0'), ct.id('a5'), true, null, 'organizacao');
  insert into public.producao_temporadas (id, organization_id, formato, lado, tipo, titulo) values
    (ct.id('51'), ct.id('a0'), 'turne', 'circula', 'teatro', 'CT Temporada 1'),
    (ct.id('52'), ct.id('a0'), 'turne', 'circula', 'teatro', 'CT Temporada 2'),
    (ct.id('5b'), ct.id('b0'), 'turne', 'circula', 'teatro', 'CT Temporada B');
  insert into public.producao_orcamentos (id, organization_id, temporada_id, nome) values
    (ct.id('c1'), ct.id('a0'), ct.id('51'), 'Orçamento 1'), (ct.id('c2'), ct.id('a0'), ct.id('52'), 'Orçamento 2');
  insert into public.producao_orcamento_linhas (id, organization_id, orcamento_id, categoria, descricao, estimativa) values
    (ct.id('11'), ct.id('a0'), ct.id('c1'), 'cache', 'Cachê', 5000), (ct.id('12'), ct.id('a0'), ct.id('c2'), 'transporte', 'Van', 300);
  insert into public.producao_pedidos (id, organization_id, temporada_id, orcamento_linha_id, descricao, valor) values
    (ct.id('71'), ct.id('a0'), ct.id('51'), ct.id('11'), 'Cachê do elenco', 500),
    (ct.id('72'), ct.id('a0'), ct.id('51'), ct.id('11'), 'Cachê do diretor', 5000),
    (ct.id('73'), ct.id('a0'), ct.id('51'), null, 'Táxi', 200),
    (ct.id('74'), ct.id('a0'), ct.id('51'), null, 'Lanche', 100),
    (ct.id('7b'), ct.id('b0'), ct.id('5b'), null, 'Pedido B', 300);
  perform set_config('jards.producao_pedido', 'on', true);
  update public.producao_pedidos set situacao = 'pendente' where id in (ct.id('72'), ct.id('73'));
  perform set_config('jards.producao_pedido', 'off', true);
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
  select count(*) into n from public.producao_pedidos where organization_id = ct.id(o || '0');
  return n::text;
end;
$$;

-- Muda a situação como a pessoa (a tela chama a função assim). Devolve 'ok' ou o erro com o código.
create function ct.passo(pedido text, passo text, motivo text default '') returns text language plpgsql as $$
begin
  perform public.fn_producao_pedido_mudar(ct.id(pedido), passo, motivo);
  return 'ok';
exception when others then
  return sqlstate || ' ' || sqlerrm;
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

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'producao_pedidos' and coalesce(qual, '') <> 'true' and coalesce(with_check, '') <> 'true'), 5, 'cinco regras, nenhuma aberta');
select ok((select relrowsecurity from pg_class where oid = 'public.producao_pedidos'::regclass), 'segurança por linha ligada');
select is((select string_agg(conname::text || '=' || confdeltype::text, ', ' order by conname::text collate "C") from pg_constraint where contype = 'f' and conrelid = 'public.producao_pedidos'::regclass and confrelid <> 'auth.users'::regclass),
          'producao_pedidos_orcamento_linha_id_fkey=n, producao_pedidos_organization_id_fkey=c, producao_pedidos_temporada_id_fkey=c', 'o pedido só perde a ligação se a linha do orçamento sai (set null)');
select ok(not has_table_privilege('anon', 'public.producao_pedidos', 'select')
          and not has_column_privilege('authenticated', 'public.producao_pedidos', 'situacao', 'update')
          and not has_column_privilege('authenticated', 'public.producao_pedidos', 'situacao', 'insert')
          and not has_column_privilege('authenticated', 'public.producao_pedidos', 'aprovado_por', 'update')
          and not has_column_privilege('authenticated', 'public.producao_pedidos', 'motivo_recusa', 'update')
          and has_column_privilege('authenticated', 'public.producao_pedidos', 'pendencia', 'update')
          and has_function_privilege('authenticated', 'public.fn_producao_pedido_mudar(uuid, text, text)', 'execute')
          and not has_function_privilege('anon', 'public.fn_producao_pedido_mudar(uuid, text, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_producao_pedido_coerencia()', 'execute')
          and (select count(*)::int from pg_trigger where tgrelid = 'public.producao_pedidos'::regclass and not tgisinternal) = 2,
          'o visitante não toca; o navegador não escreve situação nem quem aprovou; só a função muda a situação; sem gatilho de histórico (dinheiro)');

-- ─── Quem lê (dinheiro) ─────────────────────────────────────────────────────

select ct.como('a1');
select is(ct.ve('a'), '4', 'administrador lê');
select ct.como('a2');
select is(ct.ve('a'), '4', 'colaborador com dinheiro lê');
select ct.como('a4');
select is(ct.ve('a'), '0', 'colaborador sem dinheiro não vê nada');
select ct.como('a5');
select is(ct.ve('a'), '4', 'leitor com dinheiro lê');
select ct.como('b1');
select is(ct.ve('a') || ' ' || ct.ve('b'), '0 1', 'outra organização só lê o que é dela');
select ct.volta();

-- ─── Quem grava ─────────────────────────────────────────────────────────────

select ct.como('a2');
select ok(ct.tenta(format('insert into public.producao_pedidos (organization_id, temporada_id, descricao, valor) values (%L, %L, %L, 80)', ct.id('a0'), ct.id('51'), 'Novo')) = 'aceito'
          and ct.tenta(format('update public.producao_pedidos set situacao = %L where id = %L', 'aprovado', ct.id('71'))) like '42501%'
          and ct.tenta(format('update public.producao_pedidos set aprovado_por = %L where id = %L', ct.id('a2'), ct.id('71'))) like '42501%',
          'colaborador com dinheiro cria o pedido, mas não escreve a situação nem quem aprovou');
select ct.como('a4');
select ok(ct.tenta(format('insert into public.producao_pedidos (organization_id, temporada_id, descricao, valor) values (%L, %L, %L, 80)', ct.id('a0'), ct.id('51'), 'Novo')) like '42501%', 'colaborador sem dinheiro não cria');
select ct.como('a5');
select ok(ct.tenta(format('insert into public.producao_pedidos (organization_id, temporada_id, descricao, valor) values (%L, %L, %L, 80)', ct.id('a0'), ct.id('51'), 'Novo')) like '42501%', 'leitor, mesmo com dinheiro, não cria');
select ct.como('b1');
select is(ct.efeito(format('update public.producao_pedidos set pendencia = %L where id = %L', 'x', ct.id('71'))), '', 'outra organização não altera');
select ct.volta();

-- ─── Forma do pedido ────────────────────────────────────────────────────────

select is(array[
            ct.tenta(format('insert into public.producao_pedidos (organization_id, temporada_id, descricao, valor) values (%L, %L, %L, 0)', ct.id('a0'), ct.id('51'), 'Zero')),
            ct.tenta(format('insert into public.producao_pedidos (organization_id, temporada_id, descricao, valor) values (%L, %L, %L, 5)', ct.id('a0'), ct.id('51'), ' ')),
            ct.tenta(format('insert into public.producao_pedidos (organization_id, temporada_id, descricao, valor, situacao) values (%L, %L, %L, 5, %L)', ct.id('a0'), ct.id('51'), 'Aprovado de saída', 'aprovado')),
            ct.tenta(format('insert into public.producao_pedidos (organization_id, temporada_id, descricao, valor) values (%L, %L, %L, 5)', ct.id('a0'), ct.id('5b'), 'Outra org')),
            ct.tenta(format('insert into public.producao_pedidos (organization_id, temporada_id, orcamento_linha_id, descricao, valor) values (%L, %L, %L, %L, 5)', ct.id('a0'), ct.id('51'), ct.id('12'), 'Linha de outra temporada')),
            ct.tenta(format('update public.producao_pedidos set organization_id = %L where id = %L', ct.id('b0'), ct.id('71'))),
            ct.tenta(format('update public.producao_pedidos set temporada_id = %L where id = %L', ct.id('52'), ct.id('71'))),
            ct.tenta(format('update public.producao_pedidos set situacao = %L where id = %L', 'aprovado', ct.id('71')))],
          array['23514 producao_pedidos_valor_check', '23514 producao_pedidos_descricao_check', '23514 pedido_nasce_rascunho', '23514 temporada_de_outra_organizacao', '23514 linha_de_outra_temporada',
                '23514 organizacao_nao_muda', '23514 temporada_nao_muda', '23514 pedido_situacao_so_pela_funcao'],
          'valor maior que zero, descrição, nasce em rascunho, temporada e linha do orçamento da temporada, o que não muda, e a situação não muda fora da função');

-- ─── Enviar e retirar ───────────────────────────────────────────────────────

select ct.como('a5');
select is(ct.passo('71', 'enviar'), '42501 sem_permissao', 'leitor não envia pedido');
select ct.como('a4');
select is(ct.passo('71', 'enviar'), '42501 sem_permissao', 'colaborador sem dinheiro não envia pedido');
select ct.como('b1');
select is(ct.passo('71', 'enviar'), '42501 sem_permissao', 'quem é de outra organização não envia');
select ct.como('a2');
select is(ct.passo('71', 'inventado'), '23514 passo_desconhecido', 'passo desconhecido');
select is(array[ct.passo('71', 'enviar'), ct.passo('71', 'retirar'), ct.passo('71', 'enviar')], array['ok', 'ok', 'ok'], 'colaborador com dinheiro envia, retira e envia de novo');
select ct.volta();
select is(array[
            ct.tenta(format('update public.producao_pedidos set valor = 900 where id = %L', ct.id('71'))),
            ct.tenta(format('update public.producao_pedidos set descricao = %L where id = %L', 'Outra', ct.id('71'))),
            ct.tenta(format('update public.producao_pedidos set pendencia = %L, pendencia_ate = date ''2027-04-01'' where id = %L', 'Falta a nota do fornecedor', ct.id('71'))),
            ct.tenta(format('delete from public.producao_pedidos where id = %L', ct.id('71')))],
          array['23514 pedido_enviado', '23514 pedido_enviado', 'aceito', '23514 pedido_enviado'],
          'depois de enviado, o que foi pedido não muda; a próxima pendência segue livre; e não se apaga');

-- ─── Alçada ─────────────────────────────────────────────────────────────────

select ct.como('a4');
select is(ct.passo('71', 'aprovar'), '42501 sem_permissao', 'sem a função de dinheiro não aprova');
select ct.como('a3');
select is(ct.passo('71', 'aprovar'), '42501 sem_permissao', 'colaborador com dinheiro mas sem alçada não aprova');
select ct.como('a5');
select is(ct.passo('71', 'aprovar'), '42501 sem_permissao', 'leitor não aprova nunca');
select ct.como('a2');
select is(ct.passo('72', 'aprovar'), '23514 alcada_insuficiente', 'o valor (5.000) passa da alçada de 1.000');
select is(ct.passo('71', 'aprovar'), 'ok', 'dentro da alçada (500 de 1.000), aprova');
select ct.como('a1');
select is(ct.passo('72', 'aprovar'), 'ok', 'o administrador não tem teto');
select ct.volta();
select ok((select aprovado_por = ct.id('a2') and aprovado_em is not null from public.producao_pedidos where id = ct.id('71'))
          and (select aprovado_por = ct.id('a1') from public.producao_pedidos where id = ct.id('72')), 'aprovar carimba quem aprovou e quando (pela função)');

-- ─── Recusar e reabrir ──────────────────────────────────────────────────────

select ct.como('a1');
select is(ct.passo('73', 'recusar', '  '), '23514 pedido_sem_motivo', 'recusar pede o motivo');
select is(ct.passo('73', 'recusar', 'Sem verba neste mês'), 'ok', 'recusar com o motivo');
select ct.volta();
select ok((select situacao = 'recusado' and motivo_recusa = 'Sem verba neste mês' and aprovado_por = ct.id('a1') from public.producao_pedidos where id = ct.id('73')), 'o pedido recusado guarda o motivo e quem decidiu');
select ct.como('a2');
select is(ct.passo('73', 'reabrir'), 'ok', 'recusado volta a rascunho para ajustar e pedir de novo');
select ct.volta();
select ok((select situacao = 'rascunho' and motivo_recusa is null and aprovado_por is null from public.producao_pedidos where id = ct.id('73')), 'reabrir limpa a decisão');

-- ─── Pagar: só com lançamento ligado ────────────────────────────────────────

select ct.como('a2');
select is(array[ct.passo('71', 'concluir'), ct.passo('71', 'pagar'), ct.passo('71', 'concluir')], array['23514 pedido_sem_lancamento', 'ok', '23514 pedido_sem_lancamento'], 'só se conclui depois de pagar, e com lançamentos ligados');
select ct.volta();

select is(array[
            ct.tenta(format('insert into public.producao_lancamentos (organization_id, temporada_id, pedido_id, descricao, data, valor) values (%L, %L, %L, %L, date ''2027-03-07'', 300)', ct.id('a0'), ct.id('51'), ct.id('74'), 'Para pedido em rascunho')),
            ct.tenta(format('insert into public.producao_lancamentos (organization_id, temporada_id, pedido_id, descricao, data, valor) values (%L, %L, %L, %L, date ''2027-03-07'', 300)', ct.id('a0'), ct.id('51'), ct.id('7b'), 'Para pedido de outra organização')),
            ct.tenta(format('insert into public.producao_lancamentos (organization_id, temporada_id, pedido_id, descricao, data, valor) values (%L, %L, %L, %L, date ''2027-03-07'', 300)', ct.id('a0'), ct.id('52'), ct.id('71'), 'Para pedido de outra temporada')),
            ct.tenta(format('insert into public.producao_lancamentos (organization_id, temporada_id, pedido_id, descricao, data, valor) values (%L, %L, %L, %L, date ''2027-03-07'', 300)', ct.id('a0'), ct.id('51'), ct.id('71'), 'Para pedido aprovado'))],
          array['23514 pedido_nao_aprovado', '23514 pedido_de_outra_temporada', '23514 pedido_de_outra_temporada', 'aceito'], 'o lançamento só liga a pedido aprovado da mesma temporada');
insert into public.producao_lancamentos (organization_id, temporada_id, pedido_id, descricao, data, valor) values (ct.id('a0'), ct.id('51'), ct.id('71'), 'Primeira parte', date '2027-03-07', 300);
select ct.como('a2');
select is(ct.passo('71', 'concluir'), '23514 pedido_sem_lancamento', 'lançamentos de 300 não cobrem o pedido de 500');
select ct.volta();
insert into public.producao_lancamentos (organization_id, temporada_id, pedido_id, descricao, data, valor) values (ct.id('a0'), ct.id('51'), ct.id('71'), 'Segunda parte', date '2027-03-08', 200);
select ct.como('a2');
select is(ct.passo('71', 'concluir'), 'ok', 'com 300 + 200 ligados, o pedido vira pago');
select ct.volta();
select is(array[
            (select situacao from public.producao_pedidos where id = ct.id('71')),
            ct.tenta(format('update public.producao_pedidos set pendencia = %L where id = %L', 'depois de pago', ct.id('71'))),
            ct.tenta(format('delete from public.producao_pedidos where id = %L', ct.id('71'))),
            ct.tenta(format('delete from public.producao_pedidos where id = %L', ct.id('74'))),
            ct.tenta(format('delete from public.producao_pedidos where id = %L', ct.id('72')))],
          array['pago', '23514 pedido_pago', '23514 pedido_enviado', 'aceito', '23514 pedido_enviado'], 'pago não muda nem se apaga; rascunho se apaga; aprovado não');

select is((select count(*)::int from public.producao_historico where entidade = 'producao_pedidos'), 0, 'o pedido não tem histórico: nenhum valor vaza para quem não vê o dinheiro');

select * from finish();
rollback;
