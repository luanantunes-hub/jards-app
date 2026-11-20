-- Ticketeria: o histórico importado de planilha (ticketeria_importacoes, ticketeria_historico_vendas, ticketeria_historico_gasto; fn_ticketeria_historico_importar e _desfazer): importar grava
-- a importação e todas as linhas juntas, com período e totais certos; vendas e gasto têm cada um a sua tabela; o mesmo dia e canal duas vezes e o formato torto são recusados (e nada
-- fica gravado); desfazer apaga a importação e as linhas; desfazer a importação de outra loja não vale; só o servidor mexe.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61. B (b0): loja 6b.
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_historico_importado.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

create schema tv;
grant usage on schema tv to authenticated, anon;

create function tv.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d760000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tv.id(s), 'tv-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a3', 'b1']) as s;
  insert into public.organizations (id, nome) values (tv.id('a0'), 'TV A'), (tv.id('b0'), 'TV B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tv.id('a0'), 'ticketeria', 'cortesia', 20), (tv.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tv.id(o), tv.id(p), papel, '{ticketeria}'::text[] from (values ('a0', 'a1', 'admin'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tv.id('61'), tv.id('a0'), 'Loja A'), (tv.id('6b'), tv.id('b0'), 'Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tv.id('51'), tv.id('a0'), tv.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (tv.id('41'), tv.id('a0'), tv.id('51'), 'Plateia', 100);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tv.id('71'), tv.id('a0'), tv.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values
    (tv.id('81'), tv.id('a0'), tv.id('71'), tv.id('51'), now() + interval '10 days'),
    (tv.id('82'), tv.id('a0'), tv.id('71'), tv.id('51'), now() + interval '10 days'),
    (tv.id('83'), tv.id('a0'), tv.id('71'), tv.id('51'), now() + interval '10 days'),
    (tv.id('84'), tv.id('a0'), tv.id('71'), tv.id('51'), now() + interval '30 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values (tv.id('31'), tv.id('a0'), tv.id('71'), tv.id('41'), 'Inteira', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values (tv.id('21'), tv.id('a0'), tv.id('31'), '1º lote', 0, 6000, 10);
  -- A subconta da Loja A: o titular tem este CPF.
  insert into public.ticketeria_contas_asaas (organization_id, loja_id, asaas_account_id, wallet_id, cpf_cnpj, situacao, banco_codigo, agencia, conta, conta_digito)
  values (tv.id('a0'), tv.id('61'), 'conta-asaas-a', 'carteira-a', '12345678909', 'aprovada', '001', '0001', '123456', '7');
end
$dados$;

create table tv.pedidos (nome text primary key, resposta jsonb);
grant select on tv.pedidos to authenticated, anon;
create function tv.reservar(nome text, sessao text, qtd int) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  r := public.fn_ticketeria_reservar(tv.id(sessao), jsonb_build_array(jsonb_build_object('ingresso_id', tv.id('31'), 'quantidade', qtd)), 'Rita Teste', 'rita@teste.invalid', 15);
  insert into tv.pedidos values (nome, r);
  return r;
end;
$$;
create function tv.pedido(nome text) returns uuid language sql as $$ select (resposta ->> 'pedido_id')::uuid from tv.pedidos where pedidos.nome = pedido.nome $$;

-- O aviso de saque do Asaas, no formato que vimos no teste de verdade: o CPF vem MASCARADO; o que vem inteiro é a conta de destino.
create function tv.p(banco text, agencia text, conta text, digito text) returns jsonb language sql immutable as $$
  select jsonb_build_object('type', 'TRANSFER', 'transfer', jsonb_build_object('type', 'BANK_ACCOUNT', 'bankAccount',
    jsonb_build_object('bank', jsonb_build_object('code', banco), 'agency', agencia, 'account', conta, 'accountDigit', digito, 'cpfCnpj', '***.456.789-**')));
$$;

create function tv.tenta(comando text) returns text language plpgsql as $$
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

create function tv.efeito(comando text) returns text language plpgsql as $$
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

create function tv.ve(tabela text, o text) returns text language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from public.%I where organization_id = $1', tabela) into n using tv.id(o || '0');
  return n::text;
end;
$$;

create function tv.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tv.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tv.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;






create table tv.ids (nome text primary key, id uuid);
insert into tv.ids select 'v', public.fn_ticketeria_historico_importar(tv.id('61'), 'vendas', '  sympla-2025.csv ', '[{"dia":"2025-03-03","canal":"instagram","ingressos":5,"valor_centavos":30000},{"dia":"2025-03-03","canal":"sem-origem","ingressos":2,"valor_centavos":12000},{"dia":"2025-03-04","canal":"whatsapp","ingressos":7,"valor_centavos":42000}]'::jsonb);
insert into tv.ids select 'g', public.fn_ticketeria_historico_importar(tv.id('61'), 'gasto', 'gastos.csv', '[{"dia":"2025-05-01","canal":"meta","gasto_centavos":15050},{"dia":"2025-05-02","canal":"outro","gasto_centavos":9550}]'::jsonb);
select is((select tipo || '|' || arquivo || '|' || periodo_inicio || '|' || periodo_fim || '|' || linhas || '|' || total_ingressos || '|' || total_valor_centavos from public.ticketeria_importacoes where id = (select id from tv.ids where nome = 'v')), 'vendas|sympla-2025.csv|2025-03-03|2025-03-04|3|14|84000', 'a importação de vendas guarda período, linhas e totais (e apara o nome)');
select is((select tipo || '|' || periodo_inicio || '|' || periodo_fim || '|' || linhas || '|' || total_ingressos || '|' || total_valor_centavos from public.ticketeria_importacoes where id = (select id from tv.ids where nome = 'g')), 'gasto|2025-05-01|2025-05-02|2|0|24600', 'a de gasto guarda o total em centavos e nenhum ingresso');
select is((select count(*)::int from public.ticketeria_historico_vendas where importacao_id = (select id from tv.ids where nome = 'v')), 3, 'as três linhas de vendas ficaram');
select is((select count(*)::int from public.ticketeria_historico_gasto where importacao_id = (select id from tv.ids where nome = 'g')), 2, 'e as duas de gasto, na outra tabela');
select is((select organization_id from public.ticketeria_importacoes where id = (select id from tv.ids where nome = 'v')), tv.id('a0'), 'a importação é da organização da loja');
select is(array[
  tv.tenta($t$select public.fn_ticketeria_historico_importar('0d760000-0000-4000-8000-0000000000ff', 'vendas', 'x.csv', '[{"dia":"2025-03-03","canal":"x","ingressos":1,"valor_centavos":0}]'::jsonb)$t$),
  tv.tenta(format($t$select public.fn_ticketeria_historico_importar(%L, 'estoque', 'x.csv', '[{"dia":"2025-03-03","canal":"x"}]'::jsonb)$t$, tv.id('61'))),
  tv.tenta(format($t$select public.fn_ticketeria_historico_importar(%L, 'vendas', 'x.csv', '[]'::jsonb)$t$, tv.id('61'))),
  tv.tenta(format($t$select public.fn_ticketeria_historico_importar(%L, 'vendas', 'x.csv', '{}'::jsonb)$t$, tv.id('61'))),
  tv.tenta(format($t$select public.fn_ticketeria_historico_importar(%L, 'vendas', '   ', '[{"dia":"2025-03-03","canal":"x","ingressos":1,"valor_centavos":0}]'::jsonb)$t$, tv.id('61')))
], array['23514 loja_inexistente', '23514 tipo_invalido', '23514 linhas_invalidas', '23514 linhas_invalidas', '23514 ticketeria_importacoes_arquivo_check'], 'loja que não existe, tipo torto, lista vazia ou não lista e arquivo sem nome: recusa');
select is(array[
  tv.tenta(format($t$select public.fn_ticketeria_historico_importar(%L, 'vendas', 'x.csv', '[{"dia":"2025-03-03","canal":"x","ingressos":1,"valor_centavos":0},{"dia":"2025-03-03","canal":"x","ingressos":2,"valor_centavos":0}]'::jsonb)$t$, tv.id('61'))),
  tv.tenta(format($t$select public.fn_ticketeria_historico_importar(%L, 'vendas', 'x.csv', '[{"dia":"2025-03-03","canal":"Canal Torto!","ingressos":1,"valor_centavos":0}]'::jsonb)$t$, tv.id('61'))),
  tv.tenta(format($t$select public.fn_ticketeria_historico_importar(%L, 'gasto', 'x.csv', '[{"dia":"2025-03-03","canal":"x","gasto_centavos":-5}]'::jsonb)$t$, tv.id('61')))
], array['23505 ticketeria_historico_vendas_importacao_dia_canal_key', '23514 ticketeria_historico_vendas_canal_check', '23514 ticketeria_historico_gasto_valor_check'], 'o mesmo dia e canal duas vezes, canal fora do formato e gasto negativo: recusa');
select is((select count(*)::int from public.ticketeria_importacoes where loja_id = tv.id('61')), 2, 'e recusar não deixa importação pela metade');
select is(tv.tenta(format($t$select public.fn_ticketeria_historico_desfazer(%L, %L)$t$, (select id from tv.ids where nome = 'v'), tv.id('6b'))), '23514 importacao_inexistente', 'desfazer pela loja errada não vale');
select is((select count(*)::int from public.ticketeria_historico_vendas where loja_id = tv.id('61')), 3, 'e não apaga nada');
select lives_ok(format($t$select public.fn_ticketeria_historico_desfazer(%L, %L)$t$, (select id from tv.ids where nome = 'v'), tv.id('61')), 'desfaz a importação de vendas');
select is((select count(*)::int from public.ticketeria_historico_vendas where loja_id = tv.id('61')), 0, 'as linhas dela somem junto');
select is((select count(*)::int from public.ticketeria_importacoes where loja_id = tv.id('61')) || '|' || (select count(*)::int from public.ticketeria_historico_gasto where loja_id = tv.id('61')), '1|2', 'a de gasto continua');
select ok(not has_table_privilege('authenticated', 'public.ticketeria_importacoes', 'select') and not has_table_privilege('anon', 'public.ticketeria_historico_vendas', 'select') and not has_table_privilege('authenticated', 'public.ticketeria_historico_gasto', 'select') and has_table_privilege('service_role', 'public.ticketeria_historico_gasto', 'insert')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_historico_importar(uuid, text, text, jsonb)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_historico_desfazer(uuid, uuid)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_historico_importar(uuid, text, text, jsonb)', 'execute'), 'só o servidor lê e grava: o navegador não vê as tabelas nem chama as funções');

select * from finish(true);
rollback;
