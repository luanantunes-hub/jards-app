-- Ticketeria: as ações de divulgação (ticketeria_acoes_divulgacao): o nome é aparado, o canal e o gasto e o período têm limites, a loja tem de ser da organização e o evento da mesma
-- loja, só quem edita a Ticketeria lê e escreve (o leitor, outra organização e o visitante não), e a ação se apaga.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61, local 51, evento 71. B (b0): loja 6b, evento 7b.
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_acoes_de_divulgacao, se ainda não estiverem aplicadas.

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






insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tv.id('7b'), tv.id('b0'), tv.id('6b'), 'Evento B', 'publicado');

select lives_ok(format($t$insert into public.ticketeria_acoes_divulgacao (id, organization_id, loja_id, nome, canal, inicio, fim, gasto_centavos) values (tv.id('c1'), %L, %L, '  Stories   do lote 2 ', 'instagram', '2026-11-18', '2026-11-20', 15000)$t$, tv.id('a0'), tv.id('61')), 'registra uma ação');
select is((select nome from public.ticketeria_acoes_divulgacao where id = tv.id('c1')), 'Stories do lote 2', 'o nome é aparado e os espaços repetidos viram um');
select lives_ok(format($t$insert into public.ticketeria_acoes_divulgacao (organization_id, loja_id, evento_id, nome, canal, inicio, fim) values (%L, %L, %L, 'E-mail de lançamento', 'email', '2026-11-03', '2026-11-03')$t$, tv.id('a0'), tv.id('61'), tv.id('71')), 'ação sem gasto e de um dia, ligada a um evento da loja');
select is((select gasto_centavos from public.ticketeria_acoes_divulgacao where nome = 'E-mail de lançamento'), 0, 'o gasto começa em zero');
select is(array[
  tv.tenta(format($t$insert into public.ticketeria_acoes_divulgacao (organization_id, loja_id, nome, canal, inicio, fim) values (%L, %L, 'Ok', 'Instagram!', '2026-11-18', '2026-11-18')$t$, tv.id('a0'), tv.id('61'))),
  tv.tenta(format($t$insert into public.ticketeria_acoes_divulgacao (organization_id, loja_id, nome, canal, inicio, fim) values (%L, %L, 'Ok', 'instagram', '2026-11-20', '2026-11-18')$t$, tv.id('a0'), tv.id('61'))),
  tv.tenta(format($t$insert into public.ticketeria_acoes_divulgacao (organization_id, loja_id, nome, canal, inicio, fim, gasto_centavos) values (%L, %L, 'Ok', 'instagram', '2026-11-18', '2026-11-18', -1)$t$, tv.id('a0'), tv.id('61'))),
  tv.tenta(format($t$insert into public.ticketeria_acoes_divulgacao (organization_id, loja_id, nome, canal, inicio, fim) values (%L, %L, 'A', 'instagram', '2026-11-18', '2026-11-18')$t$, tv.id('a0'), tv.id('61')))
], array['23514 ticketeria_acoes_divulgacao_canal_check', '23514 ticketeria_acoes_divulgacao_periodo_check', '23514 ticketeria_acoes_divulgacao_gasto_check', '23514 ticketeria_acoes_divulgacao_nome_check'], 'canal fora do formato, fim antes do início, gasto negativo e nome curto: recusa');
select is(array[
  tv.tenta(format($t$insert into public.ticketeria_acoes_divulgacao (organization_id, loja_id, nome, canal, inicio, fim) values (%L, %L, 'Ok', 'instagram', '2026-11-18', '2026-11-18')$t$, tv.id('b0'), tv.id('61'))),
  tv.tenta(format($t$insert into public.ticketeria_acoes_divulgacao (organization_id, loja_id, evento_id, nome, canal, inicio, fim) values (%L, %L, %L, 'Ok', 'instagram', '2026-11-18', '2026-11-18')$t$, tv.id('a0'), tv.id('61'), tv.id('7b')))
], array['23514 acao_de_outra_organizacao', '23514 acao_com_evento_de_outra_loja'], 'loja de outra organização e evento de outra loja: recusa');

select tv.como('a1');
select is(tv.ve('ticketeria_acoes_divulgacao', 'a'), '2', 'quem edita a Ticketeria vê as ações da organização');
select is(tv.efeito(format($t$insert into public.ticketeria_acoes_divulgacao (organization_id, loja_id, nome, canal, inicio, fim, gasto_centavos) values (%L, %L, 'Anúncios no Meta', 'anuncio-pago', '2026-11-10', '2026-11-24', 120000)$t$, tv.id('a0'), tv.id('61'))), 'sim', 'cria ação');
select is(tv.efeito($t$update public.ticketeria_acoes_divulgacao set gasto_centavos = 20000 where nome = 'Stories do lote 2'$t$), 'sim', 'muda a ação');
select tv.como('a3');
select is((select count(*)::int from public.ticketeria_acoes_divulgacao) || '/' || tv.efeito($t$update public.ticketeria_acoes_divulgacao set gasto_centavos = 1$t$) || '/' || tv.efeito($t$delete from public.ticketeria_acoes_divulgacao$t$), '0//', 'o leitor não vê, não muda e não apaga');
select tv.como('b1');
select is((select count(*)::int from public.ticketeria_acoes_divulgacao), 0, 'outra organização não vê');
select tv.como(null);
select is(tv.efeito('select 1 from public.ticketeria_acoes_divulgacao'), '', 'visitante não lê a tabela');
select tv.como('a1');
select is(tv.efeito($t$delete from public.ticketeria_acoes_divulgacao where nome = 'Stories do lote 2'$t$), 'sim', 'quem edita apaga a ação');
select tv.volta();

select * from finish(true);
rollback;
