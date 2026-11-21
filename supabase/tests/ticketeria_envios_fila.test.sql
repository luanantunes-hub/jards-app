-- Ticketeria: a fila dos envios de e-mail (fn_ticketeria_reivindicar_destinatarios, fn_ticketeria_marcar_destinatarios, fn_ticketeria_atualizar_envio; estado "enviando" e coluna reivindicado_em):
-- a rodada reivindica um lote e ninguém mais pega as mesmas pessoas; marca enviada ou falhada de uma vez; quem ficou "enviando" por mais de 5 minutos volta para a fila; as contagens do envio
-- se refazem e o envio conclui sozinho quando não sobra ninguém ("falhou" só se todas falharam); quantidade fora de 1 a 200 e lista torta são recusadas; só o servidor executa.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61.
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_envios_fila, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

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






insert into public.ticketeria_envios (id, organization_id, loja_id, assunto, mensagem, segmento, destinatarios) values (tv.id('e1'), tv.id('a0'), tv.id('61'), 'Fila', 'Oi', 'aceitaram', 5);
insert into public.ticketeria_envio_destinatarios (id, organization_id, envio_id, email, nome, created_at)
  select tv.id('d' || i), tv.id('a0'), tv.id('e1'), 'p' || i || '@teste.invalid', 'Pessoa ' || i, now() + (i || ' seconds')::interval from generate_series(1, 5) as i;
create table tv.lote as select * from public.fn_ticketeria_reivindicar_destinatarios(tv.id('e1'), 3);
create function tv.situacoes() returns text language sql as $$ select string_agg(situacao, ',' order by email) from public.ticketeria_envio_destinatarios where envio_id = tv.id('e1') $$;

select is((select count(*) from tv.lote), 3::bigint, 'reivindica o lote pedido');
select is((select string_agg(email, ',' order by email) from tv.lote), 'p1@teste.invalid,p2@teste.invalid,p3@teste.invalid', 'na ordem em que as pessoas entraram');
select is(tv.situacoes(), 'enviando,enviando,enviando,pendente,pendente', 'e as marca como "enviando"');
select is((select count(*) from public.fn_ticketeria_reivindicar_destinatarios(tv.id('e1'), 10)), 2::bigint, 'a rodada seguinte pega só as que sobraram, nunca as já reivindicadas');
select is((select count(*) from public.fn_ticketeria_reivindicar_destinatarios(tv.id('e1'), 10)), 0::bigint, 'e depois não sobra ninguém');
select is(public.fn_ticketeria_marcar_destinatarios(jsonb_build_array(jsonb_build_object('id', tv.id('d1'), 'ok', true, 'provedor_id', 're_1'), jsonb_build_object('id', tv.id('d2'), 'ok', false), jsonb_build_object('id', tv.id('d3'), 'ok', true, 'provedor_id', 're_3'))), 3, 'marca várias de uma vez');
select is(tv.situacoes(), 'enviado,falhou,enviado,enviando,enviando', 'enviada ou falhada');
select is((select provedor_id from public.ticketeria_envio_destinatarios where id = tv.id('d1')), 're_1', 'a enviada guarda o id do e-mail no Resend (que depois recebe os avisos de abriu e clicou)');
select is(public.fn_ticketeria_atualizar_envio(tv.id('e1')), 2, 'a atualização diz quantas faltam');
select is((select enviados || '/' || falhas || '/' || situacao from public.ticketeria_envios where id = tv.id('e1')), '2/1/enviando', 'e refaz as contagens do envio, que segue "enviando"');
update public.ticketeria_envio_destinatarios set reivindicado_em = now() - interval '6 minutes' where id = tv.id('d4');
select is((select count(*) from public.fn_ticketeria_reivindicar_destinatarios(tv.id('e1'), 10)), 1::bigint, 'quem ficou "enviando" por mais de 5 minutos (a rodada caiu) volta para a fila; quem acabou de ser reivindicada, não');
select is(public.fn_ticketeria_marcar_destinatarios(jsonb_build_array(jsonb_build_object('id', tv.id('d4'), 'ok', true, 'provedor_id', 're_4'), jsonb_build_object('id', tv.id('d5'), 'ok', true, 'provedor_id', 're_5'), jsonb_build_object('id', tv.id('d1'), 'ok', false))), 2, 'só marca quem está "enviando" (a que já tinha sido enviada não muda)');
select is(public.fn_ticketeria_atualizar_envio(tv.id('e1')), 0, 'sem ninguém na fila, a atualização diz que não falta ninguém');
select is((select enviados || '/' || falhas || '/' || situacao || '/' || (enviado_em is not null)::text from public.ticketeria_envios where id = tv.id('e1')), '4/1/enviado/true', 'e o envio conclui sozinho');
select is(array[tv.tenta($t$select * from public.fn_ticketeria_reivindicar_destinatarios('0d760000-0000-4000-8000-0000000000e1', 0)$t$), tv.tenta($t$select * from public.fn_ticketeria_reivindicar_destinatarios('0d760000-0000-4000-8000-0000000000e1', 201)$t$), tv.tenta($t$select public.fn_ticketeria_marcar_destinatarios('{"a": 1}'::jsonb)$t$)], array['23514 quantidade_invalida', '23514 quantidade_invalida', '23514 itens_invalidos'], 'quantidade fora de 1 a 200 e lista torta: recusa');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_reivindicar_destinatarios(uuid, integer)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_marcar_destinatarios(jsonb)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_atualizar_envio(uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_reivindicar_destinatarios(uuid, integer)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_marcar_destinatarios(jsonb)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_atualizar_envio(uuid)', 'execute'), 'só o servidor executa');

select * from finish();
rollback;
