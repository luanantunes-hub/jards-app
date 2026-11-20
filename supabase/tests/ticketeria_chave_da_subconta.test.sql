-- Ticketeria: o cadastro da subconta (ticketeria_contas_asaas.chave_secret_id; fn_ticketeria_registrar_conta_asaas, fn_ticketeria_chave_da_conta_asaas
-- e fn_ticketeria_situacao_da_conta_asaas): a chave da subconta vai para o Vault, a tabela só guarda o id do segredo, e só o servidor a lê.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61. B (b0): loja 6b.
-- Rodar: com as migrations da T2, da T3, ticketeria_pagamentos, ticketeria_custo_do_meio, ticketeria_custo_real_do_pagamento e
-- ticketeria_validacao_de_saque na frente, e a ticketeria_chave_da_subconta, se ainda não estiverem aplicadas.

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



select is(public.fn_ticketeria_registrar_conta_asaas(tv.id('61'), 'conta-a', 'carteira-a', '12345678909', 'chave-falsa-da-subconta-0123456789', 'pendente') is not null, true, 'cadastra a subconta da loja e devolve o id');
select is((select row(asaas_account_id, wallet_id, cpf_cnpj, situacao, chave_secret_id is not null)::text from public.ticketeria_contas_asaas where loja_id = tv.id('61')), '(conta-a,carteira-a,12345678909,pendente,t)', 'a tabela guarda a conta, a carteira, o CPF, a situação e o id do segredo');
select is(public.fn_ticketeria_chave_da_conta_asaas(tv.id('61')), 'chave-falsa-da-subconta-0123456789', 'o servidor lê a chave decifrada');
select is((select count(*)::int from vault.secrets where name = 'ticketeria_asaas_' || tv.id('61')::text), 1, 'a chave está no Vault, com o nome da loja');
select is((select count(*)::int from public.ticketeria_contas_asaas c where c.chave_secret_id is not null and to_jsonb(c)::text like '%chave-falsa%'), 0, 'a chave não aparece em nenhuma coluna da tabela');
select is(public.fn_ticketeria_chave_da_conta_asaas(tv.id('6b')), null, 'loja sem subconta: sem chave');
select is(array[
            tv.tenta($t$select public.fn_ticketeria_registrar_conta_asaas('0d760000-0000-4000-8000-000000000061', 'x', 'y', '12345678909', 'chave-falsa-da-subconta-0123456789')$t$),
            tv.tenta($t$select public.fn_ticketeria_registrar_conta_asaas('0d760000-0000-4000-8000-0000000000ff', 'x', 'y', '12345678909', 'chave-falsa-da-subconta-0123456789')$t$),
            tv.tenta($t$select public.fn_ticketeria_registrar_conta_asaas('0d760000-0000-4000-8000-00000000006b', 'x', 'y2', '12345678909', 'curta')$t$),
            tv.tenta($t$select public.fn_ticketeria_registrar_conta_asaas('0d760000-0000-4000-8000-00000000006b', 'x', 'y2', '123', 'chave-falsa-da-subconta-0123456789')$t$),
            tv.tenta($t$select public.fn_ticketeria_registrar_conta_asaas('0d760000-0000-4000-8000-00000000006b', 'x', 'carteira-a', '12345678909', 'chave-falsa-da-subconta-0123456789')$t$)],
          array['23514 conta_ja_cadastrada', '23514 loja_inexistente', '23514 chave_invalida', '23514 ticketeria_contas_asaas_cpf_cnpj_check', '23505 ticketeria_contas_asaas_wallet_id_key'],
          'uma subconta por loja; loja que não existe; chave curta; CPF/CNPJ inválido; carteira repetida: tudo recusado');
select is((select count(*)::int from vault.secrets where name like 'ticketeria_asaas_%'), 1, 'o cadastro que falhou não deixou chave solta no Vault (a transação desfaz)');
select public.fn_ticketeria_situacao_da_conta_asaas(tv.id('61'), 'aprovada');
select is((select situacao from public.ticketeria_contas_asaas where loja_id = tv.id('61')), 'aprovada', 'a situação muda');
select is(array[tv.tenta($t$select public.fn_ticketeria_situacao_da_conta_asaas('0d760000-0000-4000-8000-00000000006b', 'aprovada')$t$), tv.tenta($t$select public.fn_ticketeria_situacao_da_conta_asaas('0d760000-0000-4000-8000-000000000061', 'inventada')$t$)],
          array['23514 conta_inexistente', '23514 ticketeria_contas_asaas_situacao_check'], 'loja sem subconta; situação que não existe');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_registrar_conta_asaas(uuid, text, text, text, text, text)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_chave_da_conta_asaas(uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_chave_da_conta_asaas(uuid)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_situacao_da_conta_asaas(uuid, text)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_registrar_conta_asaas(uuid, text, text, text, text, text)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_chave_da_conta_asaas(uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_situacao_da_conta_asaas(uuid, text)', 'execute'), 'as funções só pelo servidor');
select tv.como('a1');
select is(tv.efeito('select 1 from vault.decrypted_secrets') || tv.efeito('select 1 from vault.secrets'), '', 'quem está logado não lê o Vault, nem decifrado nem cifrado');
select is(tv.efeito('select chave_secret_id from public.ticketeria_contas_asaas') , 'sim', 'quem edita vê a linha da subconta da organização (o id do segredo, que não abre nada)');
select tv.volta();

select * from finish();
rollback;
