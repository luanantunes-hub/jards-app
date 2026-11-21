-- Ticketeria: o que aconteceu com cada e-mail de divulgação (fn_ticketeria_registrar_evento_envio; colunas aberto_em, clicou_em, entregue_em, devolvido_em e reclamou_em dos destinatários e
-- contadores abertos, cliques e devolvidos do envio): cada pessoa conta uma vez por evento; clicar conta como abrir; devolução permanente e reclamação de spam cortam a pessoa da lista da
-- loja; id desconhecido e tipo torto são tratados; só o servidor executa.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61.
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_envios_eventos, se ainda não estiverem aplicadas.

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






insert into public.ticketeria_envios (id, organization_id, loja_id, assunto, mensagem, segmento, destinatarios, enviados) values (tv.id('e1'), tv.id('a0'), tv.id('61'), 'Últimas vagas', 'Oi', 'aceitaram', 2, 2);
insert into public.ticketeria_envio_destinatarios (organization_id, envio_id, email, nome, provedor_id, situacao) values
  (tv.id('a0'), tv.id('e1'), 'rita@teste.invalid', 'Rita', 're_1', 'enviado'),
  (tv.id('a0'), tv.id('e1'), 'bia@teste.invalid', 'Bia', 're_2', 'enviado');
create function tv.envio() returns text language sql as $$ select abertos || '/' || cliques || '/' || devolvidos from public.ticketeria_envios where id = tv.id('e1') $$;
create function tv.pessoa(provedor text, coluna text) returns boolean language plpgsql as $$ declare r boolean; begin execute format('select %I is not null from public.ticketeria_envio_destinatarios where provedor_id = $1', coluna) into r using provedor; return r; end $$;

select is(public.fn_ticketeria_registrar_evento_envio('re_1', 'aberto', '2026-11-21T12:00:00Z', false), 'ok', 'a primeira abertura é registrada');
select is(array[tv.envio(), tv.pessoa('re_1', 'aberto_em')::text], array['1/0/0', 'true'], 'e soma no envio');
select is(public.fn_ticketeria_registrar_evento_envio('re_1', 'aberto', '2026-11-21T13:00:00Z', false), 'ja_registrado', 'a segunda abertura da mesma pessoa não conta de novo');
select is(public.fn_ticketeria_registrar_evento_envio('re_2', 'clicou', null, false), 'ok', 'clicar sem ter aberto é registrado');
select is(array[tv.envio(), tv.pessoa('re_2', 'aberto_em')::text, tv.pessoa('re_2', 'clicou_em')::text], array['2/1/0', 'true', 'true'], 'e conta também como abrir');
select is(public.fn_ticketeria_registrar_evento_envio('re_1', 'clicou', '2026-11-21T14:00:00Z', false) || ' ' || tv.envio(), 'ok 2/2/0', 'quem já tinha aberto e clica: soma só o clique');
select is(public.fn_ticketeria_registrar_evento_envio('re_2', 'devolvido', null, false), 'ok', 'a devolução passageira é registrada');
select is(tv.envio() || ' ' || (select count(*) from public.ticketeria_saidas where email = 'bia@teste.invalid'), '2/2/1 0', 'conta no envio, mas não corta a pessoa da lista');
select is(public.fn_ticketeria_registrar_evento_envio('re_2', 'devolvido', null, true), 'ja_registrado', 'a devolução permanente da mesma pessoa não conta de novo');
select is((select count(*) from public.ticketeria_saidas where email = 'bia@teste.invalid'), 1::bigint, 'mas corta a pessoa da lista da loja');
select is(public.fn_ticketeria_registrar_evento_envio('re_1', 'reclamou', null, false), 'ok', 'a reclamação de spam é registrada');
select is((select count(*) from public.ticketeria_saidas where email = 'rita@teste.invalid' and loja_id = tv.id('61')), 1::bigint, 'e corta a pessoa da lista da loja');
select is(array[public.fn_ticketeria_registrar_evento_envio('re_1', 'entregue', null, false), public.fn_ticketeria_registrar_evento_envio('nao_existe', 'aberto', null, false), public.fn_ticketeria_registrar_evento_envio('', 'aberto', null, false), tv.tenta($t$select public.fn_ticketeria_registrar_evento_envio('re_1', 'comprou', null, false)$t$)], array['ok', 'nao_encontrado', 'nao_encontrado', '23514 tipo_invalido'], 'entregue; id desconhecido ou vazio; tipo torto recusa');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_registrar_evento_envio(text, text, timestamptz, boolean)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_registrar_evento_envio(text, text, timestamptz, boolean)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_registrar_evento_envio(text, text, timestamptz, boolean)', 'execute'), 'só o servidor executa');

select * from finish();
rollback;
