-- T5 (parte 2) da Ticketeria: o custo do meio de pagamento pago pelo comprador, a taxa fixa e o parcelamento escolhido pelo produtor
-- (ticketeria_custos_meio, ticketeria_lojas.parcelas_max, ticketeria_pedidos.meio/parcelas/custo_meio_centavos; fn_ticketeria_custo_do_meio,
-- fn_ticketeria_definir_meio e fn_ticketeria_confirmar_pagamento trocada).
--
-- A conta do custo (os mesmos casos de tests/ticketeria-custo-meio.test.ts), as regras iniciais provisórias (taxa fixa de R$ 1,35 e os
-- custos do Asaas), a escolha do meio (Pix, cartão à vista e parcelado; o limite de parcelas da loja; pedido pago, vencido ou de valor zero),
-- a confirmação com o custo, o razão que não muda, e quem vê e quem grava. Ids 0d750000-0000-4000-8000-0000000000XX, ou tm.id('XX').
--   A (a0): loja 61 (parcelas_max 1), local 51, setor 41 (100 lugares), evento 71 publicado, sessão 81, ingresso 31 Inteira (lote 21: R$ 60,
--   10 lugares) e 33 Gratuito (lote 23). a1 admin, a3 leitor.   B (b0): b1 admin.
-- Rodar: com as migrations da T2, da T3, ticketeria_pagamentos e ticketeria_custo_do_meio na frente, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

create schema tm;
grant usage on schema tm to authenticated, anon;

create function tm.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d750000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tm.id(s), 'tm-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a3', 'b1']) as s;
  insert into public.organizations (id, nome) values (tm.id('a0'), 'TM A'), (tm.id('b0'), 'TM B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tm.id('a0'), 'ticketeria', 'cortesia', 20), (tm.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tm.id(o), tm.id(p), papel, '{ticketeria}'::text[] from (values ('a0', 'a1', 'admin'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tm.id('61'), tm.id('a0'), 'Loja A'), (tm.id('6b'), tm.id('b0'), 'Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tm.id('51'), tm.id('a0'), tm.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (tm.id('41'), tm.id('a0'), tm.id('51'), 'Plateia', 100);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tm.id('71'), tm.id('a0'), tm.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (tm.id('81'), tm.id('a0'), tm.id('71'), tm.id('51'), now() + interval '10 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values
    (tm.id('31'), tm.id('a0'), tm.id('71'), tm.id('41'), 'Inteira', 'inteira'), (tm.id('33'), tm.id('a0'), tm.id('71'), tm.id('41'), 'Gratuito', 'gratuito');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values
    (tm.id('21'), tm.id('a0'), tm.id('31'), '1º lote', 0, 6000, 10), (tm.id('23'), tm.id('a0'), tm.id('33'), 'Retirada', 0, 0, 10);
end
$dados$;

create table tm.pedidos (nome text primary key, resposta jsonb);
grant select on tm.pedidos to authenticated, anon;
create function tm.reservar(nome text, ingresso text, qtd int) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  r := public.fn_ticketeria_reservar(tm.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tm.id(ingresso), 'quantidade', qtd)), 'Rita Teste', 'rita@teste.invalid', 15);
  insert into tm.pedidos values (nome, r);
  return r;
end;
$$;
create function tm.pedido(nome text) returns uuid language sql as $$ select (resposta ->> 'pedido_id')::uuid from tm.pedidos where pedidos.nome = pedido.nome $$;

create function tm.tenta(comando text) returns text language plpgsql as $$
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

create function tm.efeito(comando text) returns text language plpgsql as $$
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

create function tm.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using tm.id(o || '0');
  return n::text;
end;
$$;

create function tm.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tm.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tm.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── As regras iniciais e a estrutura ───────────────────────────────────────

select is((select row(percentual_bps, fixo_centavos, quem_paga)::text from public.fn_ticketeria_taxa_vigente(tm.id('61'))), '(0,135,comprador)', 'a taxa do Jards sem regra da loja: valor fixo de R$ 1,35, paga pelo comprador');
select is((select string_agg(meio || ' ' || parcelas_de || '-' || parcelas_ate || ' ' || percentual_bps || 'bps+' || fixo_centavos, ', ' order by meio, parcelas_de) from public.ticketeria_custos_meio where provedor = 'asaas'),
          'cartao 1-1 299bps+49, cartao 2-6 349bps+49, pix 1-1 0bps+199', 'os custos do Asaas gravados (provisórios): Pix R$ 1,99; cartão 2,99% + R$ 0,49; 2 a 6 parcelas 3,49% + R$ 0,49');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_custo_do_meio(text, text, integer, bigint)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_definir_meio(uuid, text, integer)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_custo_do_meio(text, text, integer, bigint)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_definir_meio(uuid, text, integer)', 'execute')
          and not has_table_privilege('authenticated', 'public.ticketeria_custos_meio', 'update') and not has_table_privilege('anon', 'public.ticketeria_custos_meio', 'select'),
          'as funções só pelo servidor; os custos, só o super admin grava');
select is((select string_agg(cmd, ',' order by cmd) from pg_policies where schemaname = 'public' and tablename = 'ticketeria_custos_meio'), 'INSERT,SELECT', 'duas regras, só do super admin');

-- ─── A conta do custo ───────────────────────────────────────────────────────

select is(array[
            public.fn_ticketeria_custo_do_meio('asaas', 'pix', null, 6135), public.fn_ticketeria_custo_do_meio('asaas', 'cartao', 1, 6135),
            public.fn_ticketeria_custo_do_meio('asaas', 'cartao', 3, 6135), public.fn_ticketeria_custo_do_meio('asaas', 'cartao', 6, 6135),
            public.fn_ticketeria_custo_do_meio('asaas', 'cartao', null, 6135), public.fn_ticketeria_custo_do_meio('asaas', 'pix', null, 100),
            public.fn_ticketeria_custo_do_meio('asaas', 'cartao', 1, 100), public.fn_ticketeria_custo_do_meio('asaas', 'cartao', 1, 0)],
          array[199, 240, 273, 273, 240, 199, 54, 51]::bigint[],
          'o custo "por dentro": Pix R$ 1,99; cartão à vista de R$ 61,35 líquidos custa R$ 2,40 (total R$ 63,75); 2 a 6 parcelas R$ 2,73; valores pequenos (R$ 1 custa R$ 0,54; zero custa só o fixo, R$ 0,51 com o arredondamento para cima)');
select is(array[
            tm.tenta($t$select public.fn_ticketeria_custo_do_meio('asaas', 'cartao', 7, 6135)$t$), tm.tenta($t$select public.fn_ticketeria_custo_do_meio('asaas', 'boleto', null, 6135)$t$),
            tm.tenta($t$select public.fn_ticketeria_custo_do_meio('outro', 'pix', null, 6135)$t$)],
          array['23514 meio_indisponivel', '23514 meio_indisponivel', '23514 meio_indisponivel'], 'parcela sem custo cadastrado, meio que não existe e provedor sem tabela: indisponível');
-- (a migration e o teste correm na mesma transação: as regras iniciais ficam "de ontem" para as linhas novas valerem mais)
update public.ticketeria_custos_meio set vigente_desde = now() - interval '1 day';
insert into public.ticketeria_custos_meio (provedor, meio, parcelas_de, parcelas_ate, percentual_bps, fixo_centavos, vigente_desde) values ('asaas', 'pix', 1, 1, 0, 99, now() - interval '1 minute');
select is(public.fn_ticketeria_custo_do_meio('asaas', 'pix', null, 6135), 99::bigint, 'uma linha nova em vigor troca o custo, sem migration');
insert into public.ticketeria_custos_meio (provedor, meio, parcelas_de, parcelas_ate, percentual_bps, fixo_centavos, vigente_desde) values ('asaas', 'pix', 1, 1, 0, 500, now() + interval '1 day');
select is(public.fn_ticketeria_custo_do_meio('asaas', 'pix', null, 6135), 99::bigint, 'a linha que ainda não entrou em vigor não vale');
delete from public.ticketeria_custos_meio where fixo_centavos in (99, 500);

-- ─── Escolher o meio ────────────────────────────────────────────────────────

select is((select row(r ->> 'total_centavos', r ->> 'taxa_centavos', r ->> 'produtor_centavos')::text from tm.reservar('p1', '31', 1) r), '(6135,135,6000)', 'um ingresso de R$ 60: total R$ 61,35 = produtor R$ 60 + taxa R$ 1,35');
select is(public.fn_ticketeria_definir_meio(tm.pedido('p1'), 'pix', null) - 'pedido_id', '{"meio": "pix", "parcelas": null, "total_centavos": 6135, "custo_meio_centavos": 199, "a_pagar_centavos": 6334}'::jsonb, 'Pix: o comprador paga R$ 63,34, e o produtor segue com os R$ 60');
select is(tm.tenta(format('select public.fn_ticketeria_definir_meio(%L, %L, 3)', tm.pedido('p1'), 'cartao')), '23514 parcelas_indisponiveis', 'a loja só oferece à vista (parcelas_max 1): 3 parcelas não');
select is(public.fn_ticketeria_definir_meio(tm.pedido('p1'), 'cartao', 1) ->> 'a_pagar_centavos', '6375', 'cartão à vista: o comprador paga R$ 63,75 (o meio pode ser trocado até pagar)');
update public.ticketeria_lojas set parcelas_max = 6 where id = tm.id('61');
select is(public.fn_ticketeria_definir_meio(tm.pedido('p1'), 'cartao', 3) - 'pedido_id', '{"meio": "cartao", "parcelas": 3, "total_centavos": 6135, "custo_meio_centavos": 273, "a_pagar_centavos": 6408}'::jsonb, 'o produtor liga o parcelamento até 6x: 3 parcelas custam R$ 2,73 ao comprador');
select is(array[
            tm.tenta(format('select public.fn_ticketeria_definir_meio(%L, %L, 7)', tm.pedido('p1'), 'cartao')), tm.tenta(format('select public.fn_ticketeria_definir_meio(%L, %L, 0)', tm.pedido('p1'), 'cartao')),
            tm.tenta(format('select public.fn_ticketeria_definir_meio(%L, %L, 2)', tm.pedido('p1'), 'pix')), tm.tenta(format('select public.fn_ticketeria_definir_meio(%L, %L, null)', tm.pedido('p1'), 'boleto')),
            tm.tenta(format('select public.fn_ticketeria_definir_meio(%L, %L, null)', tm.id('99'), 'pix'))],
          array['23514 parcelas_indisponiveis', '23514 parcelas_indisponiveis', '23514 parcelas_indisponiveis', '23514 meio_indisponivel', '23514 pedido_inexistente'],
          'parcelas acima do máximo ou zero; Pix com parcelas; meio que não existe; pedido que não existe');
select is((select row(r ->> 'total_centavos', r ->> 'situacao')::text from tm.reservar('g1', '33', 2) r) || tm.tenta(format('select public.fn_ticketeria_definir_meio(%L, %L, null)', tm.pedido('g1'), 'pix')),
          '(0,pago)23514 pedido_nao_aguarda', 'o pedido gratuito já nasce pago: não escolhe meio');
select is((select row(meio, parcelas, custo_meio_centavos)::text from public.ticketeria_pedidos where id = tm.pedido('g1')), '(,,0)', 'sem meio, o custo é zero');
select is(tm.tenta(format('update public.ticketeria_pedidos set meio = %L, parcelas = 2, custo_meio_centavos = 10 where id = %L', 'pix', tm.pedido('p1'))), '23514 ticketeria_pedidos_parcelas_check', 'a regra do banco: parcelas só no cartão');
select is(tm.tenta(format('update public.ticketeria_pedidos set meio = null, parcelas = null where id = %L', tm.pedido('p1'))), '23514 ticketeria_pedidos_custo_meio_check', 'a regra do banco: sem meio, sem custo');

-- ─── Confirmar com o custo ──────────────────────────────────────────────────

select is(tm.tenta(format('select public.fn_ticketeria_confirmar_pagamento(%L, %L, %L, 6135)', tm.pedido('p1'), 'mentira', 'ref-1')), '23514 valor_divergente', 'pagar só o total, sem o custo do meio, não confirma');
select is(public.fn_ticketeria_confirmar_pagamento(tm.pedido('p1'), 'mentira', 'ref-1', 6408), 'pago', 'pagar o total mais o custo (3 parcelas: R$ 64,08) confirma');
set constraints all immediate;
select is((select string_agg(p.conta || '=' || p.valor_centavos, ' ' order by p.conta) from public.ticketeria_partidas p join public.ticketeria_transacoes t on t.id = p.transacao_id where t.pedido_id = tm.pedido('p1')),
          'plataforma=-135 produtor=-6000 psp_a_receber=6135', 'o razão registra o que chega líquido: do produtor os R$ 60 inteiros e do Jards os R$ 1,35 (o custo do meio não é de nenhum dos dois)');
select is(tm.tenta(format('select public.fn_ticketeria_definir_meio(%L, %L, null)', tm.pedido('p1'), 'pix')), '23514 pedido_nao_aguarda', 'pedido pago não muda de meio');
select is((select row(r ->> 'total_centavos')::text from tm.reservar('p2', '31', 2) r), '(12270)', 'dois ingressos: a taxa fixa é por ingresso (2 x R$ 1,35)');
update public.ticketeria_pedidos set reservado_ate = now() - interval '1 minute' where id = tm.pedido('p2');
select is(tm.tenta(format('select public.fn_ticketeria_definir_meio(%L, %L, null)', tm.pedido('p2'), 'pix')), '23514 reserva_expirada', 'reserva vencida não escolhe meio');

-- ─── Quem vê e quem grava ───────────────────────────────────────────────────

select tm.como('a1');
select is(tm.efeito('select 1 from public.ticketeria_custos_meio'), '', 'quem edita a ticketeria não lê a tabela de custos (só o super admin)');
select ok(tm.tenta(format('select public.fn_ticketeria_definir_meio(%L, %L, null)', tm.pedido('p2'), 'pix')) like '42501%', 'quem está logado não define o meio direto: só o servidor');
select ok(tm.tenta(format('insert into public.ticketeria_custos_meio (meio, parcelas_de, parcelas_ate) values (%L, 1, 1)', 'pix')) like '42501%', 'quem edita não grava custo');
select is(tm.efeito(format('update public.ticketeria_lojas set parcelas_max = 3 where id = %L', tm.id('61'))), 'sim', 'o produtor escolhe o parcelamento da própria loja');
select is(tm.efeito(format('update public.ticketeria_lojas set parcelas_max = 3 where id = %L', tm.id('6b'))), '', 'e não o da loja de outra organização');
select tm.como('a3');
select is(tm.efeito(format('update public.ticketeria_lojas set parcelas_max = 2 where id = %L', tm.id('61'))), '', 'o leitor não muda o parcelamento');
select tm.volta();
select is(tm.tenta(format('update public.ticketeria_lojas set parcelas_max = 7 where id = %L', tm.id('61'))), '23514 ticketeria_lojas_parcelas_max_check', 'parcelamento acima de 6x não existe');

select * from finish();
rollback;
