-- Ticketeria: as conexões de mídia (ticketeria_conexoes_midia, ticketeria_midia_diaria e as funções fn_ticketeria_midia_*): o token vai para o Vault e a conexão nasce em "escolher
-- conta"; entrar de novo troca o token sem criar outra conexão; só conta em real; trocar de conta apaga o gasto da conta anterior; gravar os dias refaz o mesmo dia; erro de token
-- põe a conexão em "erro"; desconectar apaga o token e guarda o histórico; só o servidor mexe (nenhuma regra de acesso para o navegador).
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61.
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_conexoes_de_midia, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

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
grant select on tv.ids to authenticated, anon;
insert into tv.ids select 'c1', public.fn_ticketeria_midia_guardar_conexao(tv.id('61'), 'meta', 'EAAB-token-de-teste-0123456789', now() + interval '60 days');
select is((select situacao from public.ticketeria_conexoes_midia where id = (select id from tv.ids where nome = 'c1')), 'escolher_conta', 'a conexão nasce em escolher conta');
select is((select token_secret_id is not null from public.ticketeria_conexoes_midia where id = (select id from tv.ids where nome = 'c1')), true, 'o token foi para o Vault');
select is(public.fn_ticketeria_midia_token((select id from tv.ids where nome = 'c1')), 'EAAB-token-de-teste-0123456789', 'o servidor lê o token de volta');
select is((select organization_id from public.ticketeria_conexoes_midia where loja_id = tv.id('61')), tv.id('a0'), 'a conexão é da organização da loja');
create table tv.segredos as select token_secret_id as s from public.ticketeria_conexoes_midia where loja_id = tv.id('61');
select is(public.fn_ticketeria_midia_guardar_conexao(tv.id('61'), 'meta', 'EAAB-token-novo-0123456789-abcdef', now() + interval '60 days'), (select id from tv.ids where nome = 'c1'), 'entrar de novo devolve a mesma conexão');
select is((select count(*)::int from public.ticketeria_conexoes_midia where loja_id = tv.id('61')), 1, 'e não cria outra');
select is(public.fn_ticketeria_midia_token((select id from tv.ids where nome = 'c1')), 'EAAB-token-novo-0123456789-abcdef', 'o token foi trocado');
select is((select token_secret_id = (select s from tv.segredos) from public.ticketeria_conexoes_midia where loja_id = tv.id('61')), true, 'no mesmo segredo do Vault');
select is(array[
  tv.tenta($t$select public.fn_ticketeria_midia_guardar_conexao('0d760000-0000-4000-8000-0000000000ff', 'meta', 'EAAB-token-de-teste-0123456789', now())$t$),
  tv.tenta(format($t$select public.fn_ticketeria_midia_guardar_conexao(%L, 'google', 'EAAB-token-de-teste-0123456789', now())$t$, tv.id('61'))),
  tv.tenta(format($t$select public.fn_ticketeria_midia_guardar_conexao(%L, 'meta', 'curto', now())$t$, tv.id('61')))
], array['23514 loja_inexistente', '23514 provedor_invalido', '23514 token_invalido'], 'loja que não existe, provedor desconhecido e token curto: recusa');
select is(array[
  tv.tenta(format($t$select public.fn_ticketeria_midia_escolher_conta(%L, '1048771', 'Conta em dólar', 'USD')$t$, (select id from tv.ids where nome = 'c1'))),
  tv.tenta(format($t$select public.fn_ticketeria_midia_escolher_conta(%L, 'abc', 'Conta', 'BRL')$t$, (select id from tv.ids where nome = 'c1')))
], array['23514 moeda_nao_suportada', '23514 conta_invalida'], 'só real, e o id da conta é número');
select lives_ok(format($t$select public.fn_ticketeria_midia_escolher_conta(%L, '1048771', '  Cia Atores de Mar ', 'brl')$t$, (select id from tv.ids where nome = 'c1')), 'escolhe a conta em real');
select is((select situacao || '|' || conta_nome || '|' || moeda from public.ticketeria_conexoes_midia where loja_id = tv.id('61')), 'ativa|Cia Atores de Mar|BRL', 'a conexão fica ativa, com o nome aparado');
select is(public.fn_ticketeria_midia_gravar_dias((select id from tv.ids where nome = 'c1'), '[{"dia":"2026-11-18","gasto_centavos":8000,"impressoes":5000,"alcance":0,"cliques":40},{"dia":"2026-11-19","gasto_centavos":12050,"impressoes":9000,"alcance":7000,"cliques":130}]'::jsonb), 2, 'grava dois dias');
select is(public.fn_ticketeria_midia_gravar_dias((select id from tv.ids where nome = 'c1'), '[{"dia":"2026-11-19","gasto_centavos":13000,"impressoes":9500,"alcance":7100,"cliques":140}]'::jsonb), 1, 'refaz o mesmo dia');
select is((select count(*)::int || '|' || sum(gasto_centavos)::int from public.ticketeria_midia_diaria where loja_id = tv.id('61')), '2|21000', 'sem duplicar: o dia refeito vale o novo número');
select is((select canal from public.ticketeria_midia_diaria where dia = '2026-11-18'), 'meta-ads', 'o canal do Meta é meta-ads');
select public.fn_ticketeria_midia_marcar((select id from tv.ids where nome = 'c1'), false, 'O acesso ao Meta venceu ou foi retirado. Conecte de novo.', true, null);
select is((select situacao from public.ticketeria_conexoes_midia where loja_id = tv.id('61')), 'erro', 'erro de token põe a conexão em erro');
select is(public.fn_ticketeria_midia_token((select id from tv.ids where nome = 'c1')), null, 'e o token não é mais entregue');
select public.fn_ticketeria_midia_desconectar((select id from tv.ids where nome = 'c1'));
select is((select situacao || '|' || (token_secret_id is null)::text from public.ticketeria_conexoes_midia where loja_id = tv.id('61')) || '|' || (select count(*)::text from vault.secrets where id = (select s from tv.segredos)) || '|' || (select count(*)::text from public.ticketeria_midia_diaria where loja_id = tv.id('61')), 'desconectada|true|0|2', 'desconectar apaga o token do Vault e guarda o histórico');
select ok(not has_table_privilege('authenticated', 'public.ticketeria_conexoes_midia', 'select') and not has_table_privilege('anon', 'public.ticketeria_midia_diaria', 'select') and has_table_privilege('service_role', 'public.ticketeria_midia_diaria', 'insert')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_midia_token(uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_midia_guardar_conexao(uuid, text, text, timestamptz)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_midia_token(uuid)', 'execute'), 'só o servidor mexe: o navegador não lê as tabelas nem chama as funções');

select * from finish(true);
rollback;
