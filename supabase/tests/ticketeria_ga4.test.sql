-- Ticketeria: o GA4 como terceiro provedor de mídia (migration ticketeria_ga4 sobre as de conexões de mídia e Google Ads): a lista de provedores aceita 'ga4'; a propriedade (sem
-- moeda) se escolhe sem ser em real, o que continua valendo para anúncios; as visitas por dia e origem se gravam e se refazem; só o GA4 grava visitas e só os anúncios gravam gasto;
-- trocar de propriedade apaga as visitas da anterior; só o servidor mexe.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61.
-- Rodar: com as migrations anteriores da Ticketeria na frente, a ticketeria_conexoes_de_midia, a ticketeria_google_ads e a ticketeria_ga4.

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
insert into tv.ids select 'ga4', public.fn_ticketeria_midia_guardar_conexao(tv.id('61'), 'ga4', '1//0g-token-de-renovacao-de-teste-0123456789', null);
insert into tv.ids select 'ads', public.fn_ticketeria_midia_guardar_conexao(tv.id('61'), 'google_ads', '1//0g-token-de-renovacao-de-ads-0123456789', null);
select is((select count(*)::int from public.ticketeria_conexoes_midia where loja_id = tv.id('61')), 2, 'a loja tem a conexão do GA4 e a do Google Ads');
select is(array[
  tv.tenta(format($t$select public.fn_ticketeria_midia_guardar_conexao(%L, 'tiktok', 'EAAB-token-de-teste-0123456789', now())$t$, tv.id('61'))),
  tv.tenta(format($t$select public.fn_ticketeria_midia_escolher_conta(%L, '1111111111', 'Conta em dólar', 'USD')$t$, (select id from tv.ids where nome = 'ads')))
], array['23514 provedor_invalido', '23514 moeda_nao_suportada'], 'provedor fora da lista e anúncio em outra moeda: recusa');
select lives_ok(format($t$select public.fn_ticketeria_midia_escolher_conta(%L, '338100094', 'Cia Atores de Mar · Site', null)$t$, (select id from tv.ids where nome = 'ga4')), 'o GA4 escolhe a propriedade sem moeda');
select is((select situacao || '|' || conta_externa_id || '|' || coalesce(moeda, 'sem moeda') from public.ticketeria_conexoes_midia where id = (select id from tv.ids where nome = 'ga4')), 'ativa|338100094|sem moeda', 'a conexão fica ativa e sem moeda');
select is(public.fn_ticketeria_midia_gravar_visitas((select id from tv.ids where nome = 'ga4'), '[{"dia":"2026-11-18","origem":"instagram / social","canal":"instagram","sessoes":12,"usuarios":10},{"dia":"2026-11-18","origem":"(direct) / (none)","canal":"direto","sessoes":30,"usuarios":25}]'::jsonb), 2, 'grava as visitas de dois origens');
select is(public.fn_ticketeria_midia_gravar_visitas((select id from tv.ids where nome = 'ga4'), '[{"dia":"2026-11-18","origem":"instagram / social","canal":"instagram","sessoes":15,"usuarios":12}]'::jsonb), 1, 'refaz o mesmo dia e origem');
select is((select count(*)::int || '|' || sum(sessoes)::int from public.ticketeria_visitas_diarias where loja_id = tv.id('61')), '2|45', 'sem duplicar: a origem refeita vale o novo número');
select is((select organization_id from public.ticketeria_visitas_diarias limit 1), tv.id('a0'), 'as visitas são da organização da loja');
select is(array[
  tv.tenta(format($t$select public.fn_ticketeria_midia_gravar_visitas(%L, '[{"dia":"2026-11-18","origem":"x","canal":"direto","sessoes":1,"usuarios":1}]'::jsonb)$t$, (select id from tv.ids where nome = 'ads'))),
  tv.tenta(format($t$select public.fn_ticketeria_midia_gravar_dias(%L, '[{"dia":"2026-11-18","gasto_centavos":1}]'::jsonb)$t$, (select id from tv.ids where nome = 'ga4'))),
  tv.tenta(format($t$select public.fn_ticketeria_midia_gravar_visitas(%L, '{}'::jsonb)$t$, (select id from tv.ids where nome = 'ga4'))),
  tv.tenta(format($t$select public.fn_ticketeria_midia_gravar_visitas(%L, '[{"dia":"2026-11-18","origem":"x","canal":"Canal Torto!","sessoes":1,"usuarios":1}]'::jsonb)$t$, (select id from tv.ids where nome = 'ga4')))
], array['23514 provedor_sem_visitas', '23514 provedor_sem_gasto', '23514 visitas_invalidas', '23514 ticketeria_visitas_diarias_canal_check'], 'só o GA4 grava visitas, só anúncio grava gasto, lista e canal fora do formato: recusa');
select lives_ok(format($t$select public.fn_ticketeria_midia_escolher_conta(%L, '338100094', 'Cia Atores de Mar · Site', null)$t$, (select id from tv.ids where nome = 'ga4')), 'escolher a mesma propriedade de novo');
select is((select count(*)::int from public.ticketeria_visitas_diarias where loja_id = tv.id('61')), 2, 'não apaga nada');
select lives_ok(format($t$select public.fn_ticketeria_midia_escolher_conta(%L, '771200', 'Teatro', null)$t$, (select id from tv.ids where nome = 'ga4')), 'trocar de propriedade');
select is((select count(*)::int from public.ticketeria_visitas_diarias where loja_id = tv.id('61')), 0, 'apaga as visitas da propriedade anterior');
select ok(not has_table_privilege('authenticated', 'public.ticketeria_visitas_diarias', 'select') and not has_table_privilege('anon', 'public.ticketeria_visitas_diarias', 'select') and has_table_privilege('service_role', 'public.ticketeria_visitas_diarias', 'insert')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_midia_gravar_visitas(uuid, jsonb)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_midia_gravar_visitas(uuid, jsonb)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_midia_gravar_visitas(uuid, jsonb)', 'execute'), 'só o servidor lê e grava as visitas');

select * from finish(true);
rollback;
