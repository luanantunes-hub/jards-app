-- Ticketeria: o Google Ads como segundo provedor de mídia (migration ticketeria_google_ads sobre a de conexões de mídia): a lista de provedores aceita 'google_ads' e recusa o resto; a
-- loja pode ter uma conexão de cada provedor; o token de renovação do Google entra sem vencimento; a conta gerente (MCC) se grava, se limpa e se confere; o canal do gasto é o do
-- provedor ('meta-ads', 'google-ads'); entrar de novo limpa a conta gerente.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61.
-- Rodar: com as migrations anteriores da Ticketeria na frente, a ticketeria_conexoes_de_midia e a ticketeria_google_ads.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

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
insert into tv.ids select 'meta', public.fn_ticketeria_midia_guardar_conexao(tv.id('61'), 'meta', 'EAAB-token-de-teste-0123456789', now() + interval '60 days');
insert into tv.ids select 'google', public.fn_ticketeria_midia_guardar_conexao(tv.id('61'), 'google_ads', '1//0g-token-de-renovacao-de-teste-0123456789', null);
select is((select count(*)::int from public.ticketeria_conexoes_midia where loja_id = tv.id('61')), 2, 'a loja tem uma conexão de cada provedor');
select is((select provedor || '|' || situacao || '|' || (token_expira_em is null)::text from public.ticketeria_conexoes_midia where id = (select id from tv.ids where nome = 'google')), 'google_ads|escolher_conta|true', 'o Google nasce em escolher conta, sem vencimento');
select is(public.fn_ticketeria_midia_token((select id from tv.ids where nome = 'google')), '1//0g-token-de-renovacao-de-teste-0123456789', 'o servidor lê o token de renovação de volta');
select is(array[
  tv.tenta(format($t$select public.fn_ticketeria_midia_guardar_conexao(%L, 'tiktok', 'EAAB-token-de-teste-0123456789', now())$t$, tv.id('61'))),
  tv.tenta(format($t$insert into public.ticketeria_conexoes_midia (organization_id, loja_id, provedor) values (%L, %L, 'tiktok')$t$, tv.id('a0'), tv.id('61')))
], array['23514 provedor_invalido', '23514 ticketeria_conexoes_midia_provedor_check'], 'provedor fora da lista: recusa (na função e na tabela)');
select lives_ok(format($t$select public.fn_ticketeria_midia_escolher_conta(%L, '1111111111', 'Cia Atores de Mar', 'BRL')$t$, (select id from tv.ids where nome = 'google')), 'escolhe a conta do Google');
select lives_ok(format($t$select public.fn_ticketeria_midia_definir_gerente(%L, '2222222222')$t$, (select id from tv.ids where nome = 'google')), 'grava a conta gerente');
select is((select conta_gerente_id from public.ticketeria_conexoes_midia where id = (select id from tv.ids where nome = 'google')), '2222222222', 'a conta gerente fica na conexão');
select is(array[
  tv.tenta(format($t$select public.fn_ticketeria_midia_definir_gerente(%L, '22-22')$t$, (select id from tv.ids where nome = 'google'))),
  tv.tenta($t$select public.fn_ticketeria_midia_definir_gerente('0d760000-0000-4000-8000-0000000000ff', '2222222222')$t$)
], array['23514 gerente_invalido', '23514 conexao_inexistente'], 'gerente torto e conexão que não existe: recusa');
select public.fn_ticketeria_midia_gravar_dias((select id from tv.ids where nome = 'google'), '[{"dia":"2026-11-18","gasto_centavos":8000,"impressoes":5000,"alcance":0,"cliques":40}]'::jsonb);
select lives_ok(format($t$select public.fn_ticketeria_midia_escolher_conta(%L, '1048771', 'Cia Atores de Mar', 'BRL')$t$, (select id from tv.ids where nome = 'meta')), 'escolhe a conta do Meta');
select public.fn_ticketeria_midia_gravar_dias((select id from tv.ids where nome = 'meta'), '[{"dia":"2026-11-18","gasto_centavos":1500,"impressoes":900,"alcance":700,"cliques":12}]'::jsonb);
select is((select string_agg(canal || ':' || gasto_centavos, ',' order by canal) from public.ticketeria_midia_diaria where loja_id = tv.id('61')), 'google-ads:8000,meta-ads:1500', 'o canal do gasto é o do provedor (e o mesmo dia de duas contas não se mistura)');
select is(public.fn_ticketeria_midia_guardar_conexao(tv.id('61'), 'google_ads', '1//0g-token-novo-de-renovacao-0123456789-abc', null), (select id from tv.ids where nome = 'google'), 'entrar de novo devolve a mesma conexão do Google');
select is((select situacao || '|' || coalesce(conta_gerente_id, 'sem') || '|' || coalesce(conta_externa_id, 'sem') from public.ticketeria_conexoes_midia where id = (select id from tv.ids where nome = 'google')), 'escolher_conta|sem|sem', 'e limpa a conta e a conta gerente');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_midia_definir_gerente(uuid, text)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_midia_definir_gerente(uuid, text)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_midia_definir_gerente(uuid, text)', 'execute'), 'só o servidor define a conta gerente');

select * from finish(true);
rollback;
