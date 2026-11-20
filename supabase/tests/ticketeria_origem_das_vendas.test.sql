-- Ticketeria: a origem das vendas (ticketeria_pedidos.origem_canal, origem_acao, origem_referencia e origem_utm; fn_ticketeria_registrar_origem): o pedido guarda de qual link de
-- divulgação a compra veio, uma vez só; o que chega é limpo (minúsculas, sem símbolos, tamanhos, só as cinco utm_*); sem nada, não grava; pedido que não existe é recusado;
-- só o servidor executa.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61, local 51, evento 71, sessões 81 e 82, ingresso 31 (R$ 60).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_origem_das_vendas, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

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






select tv.reservar('p1', '81', 1);
select tv.reservar('p2', '82', 1);
select is((select origem_canal is null and origem_acao is null and origem_referencia is null and origem_utm is null from public.ticketeria_pedidos where id = tv.pedido('p1')), true, 'o pedido novo ainda não tem origem');
select lives_ok(format($t$select public.fn_ticketeria_registrar_origem(%L, 'instagram', 'stories-do-lote-2', 'l.instagram.com', '{"utm_source":"ig","utm_campaign":"lote2"}')$t$, tv.pedido('p1')), 'registra a origem');
select is((select origem_canal || '|' || origem_acao || '|' || origem_referencia from public.ticketeria_pedidos where id = tv.pedido('p1')), 'instagram|stories-do-lote-2|l.instagram.com', 'guarda o canal, a ação e a referência');
select is((select origem_utm from public.ticketeria_pedidos where id = tv.pedido('p1')), '{"utm_source":"ig","utm_campaign":"lote2"}'::jsonb, 'e as utm');
select lives_ok(format($t$select public.fn_ticketeria_registrar_origem(%L, 'whatsapp', null, null, null)$t$, tv.pedido('p1')), 'registrar de novo não dá erro');
select is((select origem_canal from public.ticketeria_pedidos where id = tv.pedido('p1')), 'instagram', 'mas a origem de um pedido não muda depois');
select lives_ok(format($t$select public.fn_ticketeria_registrar_origem(%L, '  WhatsApp!! ', 'Promoção #1/Última', 'Site.COM/abc?x=1', '{"utm_source":"news\u0007x","gclid":"nao-entra","email":"a@b.c","utm_term":"  "}')$t$, tv.pedido('p2')), 'registra origem suja');
select is((select origem_canal || '|' || origem_acao || '|' || origem_referencia || '|' || origem_utm::text from public.ticketeria_pedidos where id = tv.pedido('p2')), 'whatsapp|promoo1ltima|site.comabcx1|{"utm_source": "newsx"}', 'limpa: minúsculas, sem símbolos, só as utm conhecidas e com valor, sem caractere de controle');
select tv.reservar('p3', '81', 1);
select lives_ok(format($t$select public.fn_ticketeria_registrar_origem(%L, null, '  ', '', '{}')$t$, tv.pedido('p3')), 'sem nada: não dá erro');
select is((select origem_canal is null and origem_acao is null and origem_referencia is null and origem_utm is null from public.ticketeria_pedidos where id = tv.pedido('p3')), true, 'e não grava nada');
select is(tv.tenta($t$select public.fn_ticketeria_registrar_origem('0d760000-0000-4000-8000-0000000000ff', 'instagram', null, null, null)$t$), '23514 pedido_inexistente', 'pedido que não existe: recusa');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_registrar_origem(uuid, text, text, text, jsonb)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_registrar_origem(uuid, text, text, text, jsonb)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_registrar_origem(uuid, text, text, text, jsonb)', 'execute'), 'só o servidor executa');

select * from finish();
rollback;
