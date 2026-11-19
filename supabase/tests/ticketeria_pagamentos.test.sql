-- T4 da Ticketeria: o núcleo de pagamento (ticketeria_taxas, ticketeria_pedidos, ticketeria_pedido_itens, ticketeria_transacoes,
-- ticketeria_partidas e ticketeria_notificacoes_provedor; fn_ticketeria_reservar e fn_ticketeria_confirmar_pagamento).
--
-- A taxa (a conta de um ingresso, nos mesmos casos de tests/ticketeria-pagamento.test.ts, e a regra em vigor: zero, padrão, da loja);
-- a reserva (lote da vez em sequência, divisão entre lotes, esgotado, reserva vencida que libera o lugar, gratuito já pago, e cada
-- recusa); a confirmação (valor, idempotência, reserva vencida sem lugar); o razão (soma zero, imutável); quem vê e quem grava; e o
-- que se apaga. Ids 0d740000-0000-4000-8000-0000000000XX, ou tp.id('XX'). Desfeito no fim.
--   A (a0): loja 61; locais 51 (setor 41, 100 lugares) e 52 (setor 42); evento 71 publicado com as sessões 81 (daqui a 10 dias),
--   82 (cancelada) e 83 (passada); evento 72 em rascunho com a sessão 84. Ingressos do 71: 31 Inteira (lotes 21: 2 lugares a R$ 50;
--   22: 3 a R$ 80), 32 Cortesia (não pública), 33 Gratuito (lote 23: 10 a zero), 34 Meia (lote 24, janela que abre amanhã) e 35
--   Inteira no setor 42 (outro local). a1 admin, a2 colaborador, a3 leitor.   B (b0): b1 admin, sem nada.
-- Rodar: supabase/tests/README.md, com as migrations da T2, da T3, ticketeria_pagamentos e ticketeria_custo_do_meio na frente se não estiverem aplicadas.
-- (A migration do custo do meio grava a taxa padrão provisória e troca a confirmação: o teste apaga a taxa padrão para provar a regra sem nada gravado e define o meio de pagamento antes de pagar.)
-- A seção "Apagar" usa DELETE (cada um desfeito): rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

create schema tp;
grant usage on schema tp to authenticated, anon;

create function tp.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d740000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

create table tp.pedidos (nome text primary key, resposta jsonb);
grant select on tp.pedidos to authenticated, anon;

create function tp.reservar(nome text, sessao text, itens jsonb) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  r := public.fn_ticketeria_reservar(tp.id(sessao), itens, 'Rita Teste', 'rita@teste.invalid', 15);
  insert into tp.pedidos values (nome, r);
  return r;
end;
$$;

create function tp.pedido(nome text) returns uuid language sql as $$ select (resposta ->> 'pedido_id')::uuid from tp.pedidos where pedidos.nome = pedido.nome $$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tp.id(s), 'tp-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'a3', 'b1']) as s;
  insert into public.organizations (id, nome) values (tp.id('a0'), 'TP A'), (tp.id('b0'), 'TP B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tp.id('a0'), 'ticketeria', 'cortesia', 20), (tp.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tp.id(o), tp.id(p), papel, '{ticketeria}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'colaborador'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tp.id('61'), tp.id('a0'), 'Loja A');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values
    (tp.id('51'), tp.id('a0'), tp.id('61'), 'Teatro A'), (tp.id('52'), tp.id('a0'), tp.id('61'), 'Galpão');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values
    (tp.id('41'), tp.id('a0'), tp.id('51'), 'Plateia', 100), (tp.id('42'), tp.id('a0'), tp.id('52'), 'Pista', 100);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values
    (tp.id('71'), tp.id('a0'), tp.id('61'), 'Hamlet', 'publicado'), (tp.id('72'), tp.id('a0'), tp.id('61'), 'Rascunho', 'rascunho');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio, cancelada_em) values
    (tp.id('81'), tp.id('a0'), tp.id('71'), tp.id('51'), now() + interval '10 days', null),
    (tp.id('82'), tp.id('a0'), tp.id('71'), tp.id('51'), now() + interval '11 days', now()),
    (tp.id('83'), tp.id('a0'), tp.id('71'), tp.id('51'), now() - interval '1 day', null),
    (tp.id('84'), tp.id('a0'), tp.id('72'), tp.id('51'), now() + interval '10 days', null);
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria, publico) values
    (tp.id('31'), tp.id('a0'), tp.id('71'), tp.id('41'), 'Inteira', 'inteira', true),
    (tp.id('32'), tp.id('a0'), tp.id('71'), tp.id('41'), 'Cortesia', 'cortesia', false),
    (tp.id('33'), tp.id('a0'), tp.id('71'), tp.id('41'), 'Gratuito', 'gratuito', true),
    (tp.id('34'), tp.id('a0'), tp.id('71'), tp.id('41'), 'Meia', 'meia', true),
    (tp.id('35'), tp.id('a0'), tp.id('71'), tp.id('42'), 'Pista', 'inteira', true);
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade, vendas_inicio) values
    (tp.id('21'), tp.id('a0'), tp.id('31'), '1º lote', 0, 5000, 2, null),
    (tp.id('22'), tp.id('a0'), tp.id('31'), '2º lote', 1, 8000, 3, null),
    (tp.id('25'), tp.id('a0'), tp.id('32'), 'Convidados', 0, 0, 5, null),
    (tp.id('23'), tp.id('a0'), tp.id('33'), 'Retirada', 0, 0, 10, null),
    (tp.id('24'), tp.id('a0'), tp.id('34'), '1º lote', 0, 2500, 10, now() + interval '1 day'),
    (tp.id('26'), tp.id('a0'), tp.id('35'), '1º lote', 0, 5000, 10, null);
  delete from public.ticketeria_taxas;
end
$dados$;

create function tp.tenta(comando text) returns text language plpgsql as $$
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

create function tp.efeito(comando text) returns text language plpgsql as $$
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

create function tp.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using tp.id(o || '0');
  return n::text;
end;
$$;

create function tp.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tp.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tp.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- ─── Catálogo ───────────────────────────────────────────────────────────────

select is((select count(*)::int from pg_class where oid in ('public.ticketeria_taxas'::regclass, 'public.ticketeria_pedidos'::regclass, 'public.ticketeria_pedido_itens'::regclass,
             'public.ticketeria_transacoes'::regclass, 'public.ticketeria_partidas'::regclass, 'public.ticketeria_notificacoes_provedor'::regclass) and relrowsecurity), 6, 'segurança por linha ligada nas seis');
select is((select string_agg(tablename || '.' || cmd, ' ' order by tablename, cmd) from pg_policies where schemaname = 'public' and tablename::text ~ '^ticketeria_(taxas|pedidos|pedido_itens|transacoes|partidas|notificacoes_provedor)$'),
          'ticketeria_partidas.SELECT ticketeria_pedido_itens.SELECT ticketeria_pedidos.SELECT ticketeria_taxas.INSERT ticketeria_taxas.SELECT ticketeria_transacoes.SELECT',
          'pedido e razão só se leem; a taxa, o super admin grava; os avisos do provedor não têm regra (só o servidor)');
select ok(not has_table_privilege('authenticated', 'public.ticketeria_pedidos', 'insert') and not has_table_privilege('authenticated', 'public.ticketeria_pedidos', 'update')
          and not has_table_privilege('authenticated', 'public.ticketeria_partidas', 'insert') and not has_table_privilege('authenticated', 'public.ticketeria_notificacoes_provedor', 'select')
          and not has_table_privilege('anon', 'public.ticketeria_pedidos', 'select') and not has_table_privilege('anon', 'public.ticketeria_taxas', 'select'),
          'o navegador não grava pedido nem razão e não vê os avisos do provedor; o visitante não vê nada');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_reservar(uuid, jsonb, text, text, integer)', 'execute')
          and not has_function_privilege('anon', 'public.fn_ticketeria_reservar(uuid, jsonb, text, text, integer)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_confirmar_pagamento(uuid, text, text, bigint)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_taxa_vigente(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_ocupados(uuid, uuid, uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_reservar(uuid, jsonb, text, text, integer)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_confirmar_pagamento(uuid, text, text, bigint)', 'execute'),
          'reservar e confirmar só pelo servidor (chave de serviço)');
select ok((select tgconstraint <> 0 and tgdeferrable and tginitdeferred from pg_trigger where tgname = 'ticketeria_partidas_equilibrio'), 'o equilíbrio do razão é conferido no fim da transação');

-- ─── A taxa ─────────────────────────────────────────────────────────────────

select is(array[
            public.fn_ticketeria_taxa_do_ingresso(5000, 1000, 100, 'comprador'), public.fn_ticketeria_taxa_do_ingresso(5000, 0, 0, 'comprador'),
            public.fn_ticketeria_taxa_do_ingresso(0, 1000, 100, 'comprador'), public.fn_ticketeria_taxa_do_ingresso(333, 1000, 0, 'comprador'),
            public.fn_ticketeria_taxa_do_ingresso(335, 1000, 0, 'comprador'), public.fn_ticketeria_taxa_do_ingresso(100, 3000, 90, 'produtor'),
            public.fn_ticketeria_taxa_do_ingresso(5000, 1000, 100, 'produtor'), public.fn_ticketeria_taxa_do_ingresso(1, 3000, 10000, 'comprador')],
          array[600, 0, 0, 33, 34, 100, 600, 10000],
          'a taxa de um ingresso: porcentagem arredondada ao centavo + fixo; zero no ingresso de graça; o produtor nunca paga mais que o preço');
select is((select row(percentual_bps, fixo_centavos, quem_paga)::text from public.fn_ticketeria_taxa_vigente(tp.id('61'))), '(0,0,comprador)', 'sem regra nenhuma, a taxa é zero');
insert into public.ticketeria_taxas (loja_id, percentual_bps, fixo_centavos, quem_paga, vigente_desde) values (null, 1000, 100, 'comprador', now() - interval '1 day');
select is((select row(percentual_bps, fixo_centavos, quem_paga)::text from public.fn_ticketeria_taxa_vigente(tp.id('61'))), '(1000,100,comprador)', 'com a regra padrão, vale a padrão');
insert into public.ticketeria_taxas (loja_id, percentual_bps, fixo_centavos, quem_paga, vigente_desde) values (tp.id('61'), 2000, 0, 'produtor', now() + interval '1 day');
select is((select row(percentual_bps, fixo_centavos, quem_paga)::text from public.fn_ticketeria_taxa_vigente(tp.id('61'))), '(1000,100,comprador)', 'a regra da loja que ainda não entrou em vigor não vale');
insert into public.ticketeria_taxas (loja_id, percentual_bps, fixo_centavos, quem_paga, vigente_desde) values (tp.id('61'), 500, 50, 'comprador', now() - interval '1 hour');
select is((select row(percentual_bps, fixo_centavos, quem_paga)::text from public.fn_ticketeria_taxa_vigente(tp.id('61'))), '(500,50,comprador)', 'a regra da loja em vigor vale mais que a padrão');

-- ─── Reservar ───────────────────────────────────────────────────────────────

select is((select row(r ->> 'total_centavos', r ->> 'taxa_centavos', r ->> 'produtor_centavos', r ->> 'situacao')::text
           from tp.reservar('p1', '81', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000031", "quantidade": 3}]') r),
          '(19050,1050,18000,aguardando_pagamento)', '3 inteiras: 2 do 1º lote (R$ 50 + R$ 3 de taxa) e 1 do 2º (R$ 80 + R$ 4,50); total = produtor + taxa');
select is((select string_agg(l.nome || 'x' || i.quantidade || '@' || i.preco_centavos || '+' || i.taxa_centavos, ' ' order by l.ordem) from public.ticketeria_pedido_itens i join public.ticketeria_lotes l on l.id = i.lote_id where i.pedido_id = tp.pedido('p1')),
          '1º lotex2@5000+300 2º lotex1@8000+450', 'o pedido se divide entre os lotes, em sequência, com o preço e a taxa de cada um');
select is(tp.tenta($t$select public.fn_ticketeria_reservar('0d740000-0000-4000-8000-000000000081', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000031", "quantidade": 3}]', 'Rita', 'rita@teste.invalid', 15)$t$),
          '23514 esgotado', 'sobram 2 no 2º lote: 3 não cabem');
select public.fn_ticketeria_definir_meio(tp.pedido('p1'), 'pix', null);
update public.ticketeria_pedidos set reservado_ate = now() - interval '1 minute' where id = tp.pedido('p1');
select is((select row(r ->> 'total_centavos', r ->> 'taxa_centavos')::text from tp.reservar('p2', '81', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000031", "quantidade": 2}]') r),
          '(10600,600)', 'a reserva vencida libera os lugares: o 1º lote volta a ter 2');
select is((select row(r ->> 'total_centavos', r ->> 'situacao')::text from tp.reservar('g1', '81', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000033", "quantidade": 2}]') r)
          || (select count(*)::text from public.ticketeria_transacoes where pedido_id = tp.pedido('g1')),
          '(0,pago)0', 'o gratuito já nasce pago e não vai para o razão');
select is(array[
            tp.tenta($t$select public.fn_ticketeria_reservar('0d740000-0000-4000-8000-000000000082', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000031", "quantidade": 1}]', 'Rita', 'rita@teste.invalid', 15)$t$),
            tp.tenta($t$select public.fn_ticketeria_reservar('0d740000-0000-4000-8000-000000000083', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000031", "quantidade": 1}]', 'Rita', 'rita@teste.invalid', 15)$t$),
            tp.tenta($t$select public.fn_ticketeria_reservar('0d740000-0000-4000-8000-000000000084', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000031", "quantidade": 1}]', 'Rita', 'rita@teste.invalid', 15)$t$),
            tp.tenta($t$select public.fn_ticketeria_reservar('0d740000-0000-4000-8000-000000000081', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000032", "quantidade": 1}]', 'Rita', 'rita@teste.invalid', 15)$t$),
            tp.tenta($t$select public.fn_ticketeria_reservar('0d740000-0000-4000-8000-000000000081', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000035", "quantidade": 1}]', 'Rita', 'rita@teste.invalid', 15)$t$),
            tp.tenta($t$select public.fn_ticketeria_reservar('0d740000-0000-4000-8000-000000000081', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000033", "quantidade": 11}]', 'Rita', 'rita@teste.invalid', 15)$t$),
            tp.tenta($t$select public.fn_ticketeria_reservar('0d740000-0000-4000-8000-000000000081', '[]', 'Rita', 'rita@teste.invalid', 15)$t$),
            tp.tenta($t$select public.fn_ticketeria_reservar('0d740000-0000-4000-8000-000000000081', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000033", "quantidade": 1}, {"ingresso_id": "0d740000-0000-4000-8000-000000000033", "quantidade": 1}]', 'Rita', 'rita@teste.invalid', 15)$t$),
            tp.tenta($t$select public.fn_ticketeria_reservar('0d740000-0000-4000-8000-000000000081', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000033", "quantidade": 1}]', 'Rita', 'sem-arroba', 15)$t$),
            tp.tenta($t$select public.fn_ticketeria_reservar('0d740000-0000-4000-8000-000000000081', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000034", "quantidade": 1}]', 'Rita', 'rita@teste.invalid', 15)$t$),
            tp.tenta($t$select public.fn_ticketeria_reservar('0d740000-0000-4000-8000-000000000081', '[{"ingresso_id": "0d740000-0000-4000-8000-000000000033", "quantidade": 1}]', 'Rita', 'rita@teste.invalid', 0)$t$)],
          array['23514 sessao_indisponivel', '23514 sessao_indisponivel', '23514 evento_nao_publicado', '23514 ingresso_indisponivel', '23514 ingresso_de_outro_local',
                '23514 limite_por_pedido', '23514 itens_invalidos', '23514 itens_invalidos', '23514 comprador_invalido', '23514 esgotado', '23514 itens_invalidos'],
          'sessão cancelada ou passada; evento em rascunho; ingresso que não é público; de outro local; acima do limite; sem itens; repetido; e-mail ruim; lote que ainda não abriu segura a venda; prazo da reserva');

-- ─── Confirmar ──────────────────────────────────────────────────────────────

select is(tp.tenta(format('select public.fn_ticketeria_confirmar_pagamento(%L, %L, %L, 10600)', tp.pedido('p2'), 'mentira', 'ref-p2')), '23514 meio_nao_escolhido', 'sem o meio de pagamento escolhido, não se confirma');
select public.fn_ticketeria_definir_meio(tp.pedido('p2'), 'pix', null);
select is(tp.tenta(format('select public.fn_ticketeria_confirmar_pagamento(%L, %L, %L, 10599)', tp.pedido('p2'), 'mentira', 'ref-p2')), '23514 valor_divergente', 'o valor tem de ser o total do pedido (R$ 106,00)');
select is(array[public.fn_ticketeria_confirmar_pagamento(tp.pedido('p2'), 'mentira', 'ref-p2', 10600), public.fn_ticketeria_confirmar_pagamento(tp.pedido('p2'), 'mentira', 'ref-p2', 10600)],
          array['pago', 'ja_pago'], 'confirmar duas vezes paga uma vez só');
set constraints all immediate;
select is((select string_agg(p.conta || '=' || p.valor_centavos, ' ' order by p.conta) from public.ticketeria_partidas p join public.ticketeria_transacoes t on t.id = p.transacao_id where t.pedido_id = tp.pedido('p2'))
          || ' n=' || (select count(*) from public.ticketeria_transacoes where pedido_id = tp.pedido('p2')),
          'plataforma=-600 produtor=-9801 psp_a_receber=10401 n=1', 'o razão: o provedor recebeu o total e guardou o custo do Pix (R$ 1,99); é do produtor o preço menos o custo e do Jards a taxa; uma transação só');
select is((select row(situacao, provedor, provedor_ref, pago_em is not null)::text from public.ticketeria_pedidos where id = tp.pedido('p2')), '(pago,mentira,ref-p2,t)', 'o pedido fica pago, com o provedor e a referência');
select is(array[
            tp.tenta(format('select public.fn_ticketeria_confirmar_pagamento(%L, %L, %L, 19050)', tp.pedido('p1'), 'mentira', 'ref-p1')),
            tp.tenta(format('select public.fn_ticketeria_confirmar_pagamento(%L, %L, %L, 1)', tp.id('99'), 'mentira', 'x')),
            tp.tenta(format('update public.ticketeria_partidas set valor_centavos = 1 where transacao_id = (select id from public.ticketeria_transacoes where pedido_id = %L limit 1)', tp.pedido('p2'))),
            tp.tenta(format('delete from public.ticketeria_transacoes where pedido_id = %L', tp.pedido('p2'))),
            tp.tenta(format('with t as (insert into public.ticketeria_transacoes (organization_id, loja_id, tipo) values (%L, %L, %L) returning id) insert into public.ticketeria_partidas (organization_id, transacao_id, conta, valor_centavos) select %L, id, %L, 100 from t', tp.id('a0'), tp.id('61'), 'ajuste', tp.id('a0'), 'produtor')),
            tp.tenta($t$insert into public.ticketeria_notificacoes_provedor (provedor, id_externo, tipo, payload) values ('mentira', 'evt-1', 'pagamento', '{}'), ('mentira', 'evt-1', 'pagamento', '{}')$t$)],
          array['23514 reserva_expirada_sem_lugar', '23514 pedido_inexistente', '23514 razao_imutavel', '23514 razao_imutavel', '23514 razao_desequilibrado', '23505 ticketeria_notificacoes_provedor_key'],
          'reserva vencida cujo lugar já foi vendido não vira paga; pedido que não existe; o razão não muda, não se apaga nem aceita transação desequilibrada; o mesmo aviso do provedor entra uma vez só');

-- ─── Quem vê e quem grava ───────────────────────────────────────────────────

select tp.como('a2');
select is((select count(*)::text from public.ticketeria_pedidos where organization_id = tp.id('a0')) || '/' || (select count(*)::text from public.ticketeria_partidas where organization_id = tp.id('a0')), '3/3', 'quem edita a ticketeria vê os pedidos e o razão');
select ok(tp.tenta(format('select public.fn_ticketeria_reservar(%L, %L, %L, %L, 15)', tp.id('81'), '[]', 'x', 'x@x.com')) like '42501%', 'quem está logado não chama a reserva direto');
select ok(tp.tenta(format('insert into public.ticketeria_taxas (loja_id, percentual_bps) values (%L, 0)', tp.id('61'))) like '42501%', 'quem edita não grava a taxa (só o super admin)');
select is((select count(*)::text from public.ticketeria_taxas), '2', 'a loja vê as regras dela (a padrão, não)');
select tp.como('a3');
select is((select count(*)::text from public.ticketeria_pedidos) || '/' || (select count(*)::text from public.ticketeria_partidas), '0/0', 'o leitor não vê pedido (dado pessoal) nem razão (dinheiro)');
select tp.como('b1');
select is((select count(*)::text from public.ticketeria_pedidos), '0', 'outra organização não vê');
select tp.como(null);
select is(tp.efeito('select 1 from public.ticketeria_pedidos'), '', 'visitante não vê');
select tp.volta();

-- ─── Apagar (DELETE, cada um desfeito: pela CLI) ────────────────────────────

select is(array[
            tp.tenta(format('delete from public.ticketeria_pedidos where id = %L', tp.pedido('p2'))),
            tp.tenta(format('delete from public.ticketeria_lotes where id = %L', tp.id('21'))),
            tp.tenta(format('delete from public.organizations where id = %L', tp.id('a0')))],
          array['23514 razao_imutavel', '23503 ticketeria_pedido_itens_lote_id_fkey', 'aceito'],
          'pedido pago não se apaga (o razão segura); lote com venda não se apaga; a organização inteira, sim');

select * from finish();
rollback;
