-- Ticketeria: a lista de espera (ticketeria_espera, fn_ticketeria_livres, fn_ticketeria_espera_entrar, _sair, _avisar, _desfazer_aviso): só entra quem encontra o
-- ingresso esgotado, uma vez por e-mail, na ordem de chegada; o aviso marca quem saiu e devolve a vez se o e-mail não sai; quem lê (dado pessoal) e só o servidor executa.
-- Ids 0d780000-0000-4000-8000-0000000000XX, ou te.id('XX'). A (a0): loja 61, local 51, evento 71, sessão 81 (e 82 cancelada, 83 já passada), ingressos 31 (2 lugares) e 32 (10).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_lista_de_espera, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(35);

create schema te;
grant usage on schema te to authenticated, anon;

create function te.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d780000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select te.id(s), 'te-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a3', 'b1']) as s;
  insert into public.organizations (id, nome) values (te.id('a0'), 'TE A'), (te.id('b0'), 'TE B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (te.id('a0'), 'ticketeria', 'cortesia', 20), (te.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select te.id(o), te.id(p), papel, '{ticketeria}'::text[] from (values ('a0', 'a1', 'admin'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (te.id('61'), te.id('a0'), 'Loja A'), (te.id('6b'), te.id('b0'), 'Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (te.id('51'), te.id('a0'), te.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (te.id('41'), te.id('a0'), te.id('51'), 'Plateia', 200);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values
    (te.id('71'), te.id('a0'), te.id('61'), 'Hamlet', 'publicado'), (te.id('72'), te.id('a0'), te.id('61'), 'Rascunho', 'rascunho');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio, cancelada_em) values
    (te.id('81'), te.id('a0'), te.id('71'), te.id('51'), now() + interval '10 days', null),
    (te.id('82'), te.id('a0'), te.id('71'), te.id('51'), now() + interval '11 days', now()),
    (te.id('84'), te.id('a0'), te.id('72'), te.id('51'), now() + interval '12 days', null);
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria, publico, arquivado) values
    (te.id('31'), te.id('a0'), te.id('71'), te.id('41'), 'Inteira', 'inteira', true, false),
    (te.id('32'), te.id('a0'), te.id('71'), te.id('41'), 'Camarote', 'inteira', true, false),
    (te.id('33'), te.id('a0'), te.id('71'), te.id('41'), 'Velho', 'inteira', true, true);
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values
    (te.id('21'), te.id('a0'), te.id('31'), '1º lote', 0, 6000, 2), (te.id('22'), te.id('a0'), te.id('32'), '1º lote', 0, 10000, 10), (te.id('23'), te.id('a0'), te.id('33'), '1º lote', 0, 1000, 5);
  delete from public.ticketeria_taxas;
end
$dados$;

create table te.pedidos (nome text primary key, resposta jsonb);
create function te.reservar(nome text, ingresso text, qtd int) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  r := public.fn_ticketeria_reservar(te.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', te.id(ingresso), 'quantidade', qtd)), 'Rita Teste', 'rita@teste.invalid', 15);
  insert into te.pedidos values (nome, r);
  return r;
end;
$$;
create function te.entrar(nome text, email text, qtd int default 1, ingresso text default '31', sessao text default '81') returns text language sql as $$
  select public.fn_ticketeria_espera_entrar(te.id(sessao), te.id(ingresso), nome, email, qtd)
$$;

create function te.tenta(comando text) returns text language plpgsql as $$
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

create function te.efeito(comando text) returns text language plpgsql as $$
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

create function te.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', te.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function te.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- Lugares livres: o ingresso 31 tem 2 e o 32 tem 10.
select is(public.fn_ticketeria_livres(te.id('81'), te.id('31')) || '/' || public.fn_ticketeria_livres(te.id('81'), te.id('32')), '2/10', 'os lugares livres de cada ingresso na sessão');

-- Com lugar livre, não entra na lista: compre direto.
select is(te.tenta(format($t$select te.entrar('Marina Prado', 'marina@teste.invalid')$t$)), '23514 ainda_ha_lugar', 'com lugar livre não entra na lista');

-- Esgota o ingresso 31 (2 lugares reservados).
select te.reservar('esgota', '31', 2);
select is(public.fn_ticketeria_livres(te.id('81'), te.id('31')), 0::bigint, 'reservados os 2 lugares, não sobra nenhum');

-- Entrar, na ordem; o mesmo e-mail (em maiúsculas, com espaços) não entra de novo.
select is(te.entrar('Marina Prado', 'Marina@Teste.invalid', 2), 'entrou', 'esgotado: a pessoa entra na lista');
select is(te.entrar('Carlos Lima', 'carlos@teste.invalid', 1), 'entrou', 'a segunda pessoa também');
select is(te.entrar('Beatriz Nogueira', 'bia@teste.invalid', 4), 'entrou', 'e a terceira');
select is(te.entrar('Marina de novo', '  MARINA@teste.invalid ', 1), 'ja_na_lista', 'o mesmo e-mail (maiúsculas e espaços) não entra duas vezes');
select is((select count(*)::int from public.ticketeria_espera where sessao_id = te.id('81') and ingresso_id = te.id('31')), 3, 'três pessoas na lista');
select is((select email || '/' || quantidade || '/' || nome from public.ticketeria_espera where email = 'marina@teste.invalid'), 'marina@teste.invalid/2/Marina Prado', 'o e-mail é guardado em minúsculas, com a quantidade e o nome do primeiro pedido');
select is((select (avisado_em is null)::text || '/' || (token is not null)::text from public.ticketeria_espera where email = 'bia@teste.invalid'), 'true/true', 'entra sem aviso e com o token do link de sair');

-- O que se recusa.
select is(array[
  te.tenta($t$select te.entrar('X', 'x@teste.invalid', 0)$t$),
  te.tenta($t$select te.entrar('X', 'x@teste.invalid', 51)$t$),
  te.tenta($t$select te.entrar('', 'x@teste.invalid')$t$),
  te.tenta($t$select te.entrar('X', 'sem-arroba')$t$),
  te.tenta($t$select te.entrar('X', 'x@teste.invalid', 1, '33')$t$),
  te.tenta($t$select te.entrar('X', 'x@teste.invalid', 1, '31', '82')$t$),
  te.tenta($t$select te.entrar('X', 'x@teste.invalid', 1, '31', '84')$t$)
], array['23514 quantidade_invalida', '23514 quantidade_invalida', '23514 comprador_invalido', '23514 comprador_invalido', '23514 ingresso_indisponivel', '23514 sessao_indisponivel', '23514 evento_nao_publicado'],
  'quantidade fora de 1 a 50, nome vazio, e-mail ruim, ingresso arquivado, sessão cancelada e evento em rascunho: recusa');

-- Avisar: só com lugar livre, da loja certa, na ordem.
select is(te.tenta(format($t$select public.fn_ticketeria_espera_avisar(%L, %L, %L, 2)$t$, te.id('61'), te.id('81'), te.id('31'))), '23514 sem_lugar', 'esgotado: não há o que avisar');
update public.ticketeria_pedidos set reservado_ate = now() - interval '1 minute' where id = (select (resposta ->> 'pedido_id')::uuid from te.pedidos where nome = 'esgota');
select is(public.fn_ticketeria_livres(te.id('81'), te.id('31')), 2::bigint, 'a reserva venceu: os 2 lugares voltam');
select is(te.tenta(format($t$select public.fn_ticketeria_espera_avisar(%L, %L, %L, 2)$t$, te.id('6b'), te.id('81'), te.id('31'))), '23514 sessao_de_outra_loja', 'outra loja não avisa a lista desta');
select is(array[te.tenta(format($t$select public.fn_ticketeria_espera_avisar(%L, %L, %L, 0)$t$, te.id('61'), te.id('81'), te.id('31'))), te.tenta(format($t$select public.fn_ticketeria_espera_avisar(%L, %L, %L, 501)$t$, te.id('61'), te.id('81'), te.id('31')))], array['23514 quantas_invalido', '23514 quantas_invalido'], 'quantas fora de 1 a 500: recusa');
create table te.avisadas as select public.fn_ticketeria_espera_avisar(te.id('61'), te.id('81'), te.id('31'), 2) as r;
select is((select jsonb_array_length(r) || '/' || (r -> 0 ->> 'nome') || '/' || (r -> 1 ->> 'nome') from te.avisadas), '2/Marina Prado/Carlos Lima', 'avisa as 2 primeiras, na ordem de chegada');
select is((select (r -> 0 ->> 'email') || '/' || (r -> 0 ->> 'quantidade') || '/' || ((r -> 0 ->> 'token') is not null)::text from te.avisadas), 'marina@teste.invalid/2/true', 'devolve e-mail, quantidade e token para o e-mail');
select is((select count(*)::int from public.ticketeria_espera where avisado_em is not null), 2, 'as 2 ficam marcadas como avisadas');
select is(jsonb_array_length(public.fn_ticketeria_espera_avisar(te.id('61'), te.id('81'), te.id('31'), 5)), 1, 'um segundo aviso pega só quem ainda não foi avisado (Beatriz)');
select is(jsonb_array_length(public.fn_ticketeria_espera_avisar(te.id('61'), te.id('81'), te.id('31'), 5)), 0, 'e depois não resta ninguém');

-- Desfazer o aviso (o e-mail não saiu): a pessoa volta para a vez.
select is(public.fn_ticketeria_espera_desfazer_aviso(array[(select (r -> 0 ->> 'id')::uuid from te.avisadas)]), 1, 'desfaz o aviso de uma pessoa');
select is((select nome from public.ticketeria_espera where avisado_em is null), 'Marina Prado', 'ela volta a esperar');

-- Sair da lista pelo token do e-mail.
select is(public.fn_ticketeria_espera_sair((select token from public.ticketeria_espera where email = 'carlos@teste.invalid')), true, 'sair pelo token apaga a pessoa');
select is(public.fn_ticketeria_espera_sair((select token from public.ticketeria_espera where email = 'bia@teste.invalid')) and not public.fn_ticketeria_espera_sair(te.id('ff')), true, 'e um token que não existe não apaga nada');
select is((select count(*)::int from public.ticketeria_espera), 1, 'sobrou só quem não saiu');

-- Sessão que já passou há mais de 1 dia é limpa quando alguém entra na lista.
select te.reservar('esgota2', '31', 2);
do $limpeza$
begin
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (te.id('83'), te.id('a0'), te.id('71'), te.id('51'), now() - interval '3 days');
  insert into public.ticketeria_espera (organization_id, sessao_id, ingresso_id, nome, email, quantidade) values (te.id('a0'), te.id('83'), te.id('31'), 'Antiga', 'antiga@teste.invalid', 1);
end
$limpeza$;
select is((select count(*)::int from public.ticketeria_espera where sessao_id = te.id('83')), 1, 'a sessão antiga tem uma pessoa na lista');
select is(te.entrar('Zeca', 'zeca@teste.invalid'), 'entrou', 'entra mais uma na sessão de agora');
select is((select count(*)::int from public.ticketeria_espera where sessao_id = te.id('83')), 0, 'os dados da sessão antiga (mais de 1 dia) somem quando alguém entra na lista ou o produtor avisa');

-- Lista cheia: 500 por sessão (já há 2: Marina e Zeca).
insert into public.ticketeria_espera (organization_id, sessao_id, ingresso_id, nome, email, quantidade)
select te.id('a0'), te.id('81'), te.id('31'), 'Pessoa ' || n, 'p' || n || '@teste.invalid', 1 from generate_series(1, 498) as n;
select is(te.tenta($t$select te.entrar('Última', 'ultima@teste.invalid')$t$), '23514 lista_cheia', 'com 500 na sessão, a lista está cheia');

-- Quem lê (dado pessoal).
select te.como('a1');
select is((select count(*)::int > 0 from public.ticketeria_espera), true, 'quem edita a Ticketeria vê a lista');
select is(te.efeito(format($t$insert into public.ticketeria_espera (organization_id, sessao_id, ingresso_id, nome, email, quantidade) values (%L, %L, %L, 'N', 'n@teste.invalid', 1)$t$, te.id('a0'), te.id('81'), te.id('32'))), '', 'mas não grava direto: só o servidor grava');
select te.como('a3');
select is((select count(*)::int from public.ticketeria_espera), 0, 'o leitor não vê quem está na lista');
select te.como('b1');
select is((select count(*)::int from public.ticketeria_espera), 0, 'outra organização não vê');
select te.como(null);
select is(te.efeito('select 1 from public.ticketeria_espera'), '', 'visitante não lê a tabela');
select te.volta();

select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_espera_entrar(uuid, uuid, text, text, integer)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_espera_avisar(uuid, uuid, uuid, integer)', 'execute')
          and not has_function_privilege('anon', 'public.fn_ticketeria_espera_sair(uuid)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_livres(uuid, uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_espera_entrar(uuid, uuid, text, text, integer)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_espera_avisar(uuid, uuid, uuid, integer)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_espera_sair(uuid)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_espera_desfazer_aviso(uuid[])', 'execute'), 'só o servidor executa as funções da lista');

select * from finish();
rollback;
