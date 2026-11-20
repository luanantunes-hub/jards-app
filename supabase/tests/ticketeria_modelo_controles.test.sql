-- Ticketeria: os controles do modelo de marketing (ticketeria_datas_de_pico e as partes da base em ticketeria_mmm_execucoes.base_partes): a data de pico tem o nome aparado, limites de nome, um
-- registro por loja e dia, a loja tem de ser da organização, só quem edita a Ticketeria lê, cria e apaga (o leitor, outra organização e o visitante não); e gravar o resultado do modelo guarda as
-- partes da base (ou uma lista vazia), recusa partes que não são lista, e a coluna só aceita lista.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61. B (b0): loja 6b.
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_modelo_resultado e a ticketeria_modelo_controles, se ainda não estiverem aplicadas.

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






create function tv.resultado(partes jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object('motor', 'pymc-marketing', 'versao_motor', '1.5.0', 'semanas', 58, 'confianca', 'media',
    'diagnosticos', jsonb_build_object('r_hat_maximo', 1.01, 'divergencias', 0, 'ess_minimo', 700),
    'base', case when partes is null then jsonb_build_object('porcento', 41, 'baixo', 33, 'alto', 49) else jsonb_build_object('porcento', 41, 'baixo', 33, 'alto', 49, 'partes', partes) end,
    'canais', jsonb_build_array(jsonb_build_object('canal', 'meta-ads', 'porcento', 27, 'baixo', 16, 'alto', 38, 'ingressos', 100, 'gasto_centavos', 1000)));
$$;

select lives_ok(format($t$insert into public.ticketeria_datas_de_pico (id, organization_id, loja_id, dia, nome) values (tv.id('d1'), %L, %L, '2026-09-14', '  Festa   da cidade ')$t$, tv.id('a0'), tv.id('61')), 'a data de pico é aceita');
select is((select nome from public.ticketeria_datas_de_pico where id = tv.id('d1')), 'Festa da cidade', 'o nome é aparado e os espaços repetidos viram um');
select is(array[
  tv.tenta(format($t$insert into public.ticketeria_datas_de_pico (organization_id, loja_id, dia, nome) values (%L, %L, '2026-09-15', 'A')$t$, tv.id('a0'), tv.id('61'))),
  tv.tenta(format($t$insert into public.ticketeria_datas_de_pico (organization_id, loja_id, dia, nome) values (%L, %L, '2026-09-14', 'Outra festa')$t$, tv.id('a0'), tv.id('61')))
], array['23514 ticketeria_datas_de_pico_nome_check', '23505 ticketeria_datas_de_pico_loja_dia_key'], 'nome curto demais e dois registros no mesmo dia da mesma loja: recusa');
select is(tv.tenta(format($t$insert into public.ticketeria_datas_de_pico (organization_id, loja_id, dia, nome) values (%L, %L, '2026-10-01', 'Ok')$t$, tv.id('b0'), tv.id('61'))), '23514 data_de_outra_organizacao', 'loja de outra organização: recusa');

select tv.como('a1');
select is(tv.ve('ticketeria_datas_de_pico', 'a'), '1', 'quem edita a Ticketeria vê as datas da organização');
select is(tv.efeito(format($t$insert into public.ticketeria_datas_de_pico (organization_id, loja_id, dia, nome) values (%L, %L, '2026-10-20', 'Semana do teatro')$t$, tv.id('a0'), tv.id('61'))), 'sim', 'quem edita acrescenta uma data');
select tv.como('a3');
select is((select count(*)::int from public.ticketeria_datas_de_pico) || '/' || tv.efeito(format($t$insert into public.ticketeria_datas_de_pico (organization_id, loja_id, dia, nome) values (%L, %L, '2026-11-01', 'Nao')$t$, tv.id('a0'), tv.id('61'))) || '/' || tv.efeito($t$delete from public.ticketeria_datas_de_pico$t$), '0//', 'o leitor não vê, não cria e não apaga');
select tv.como('b1');
select is((select count(*)::int from public.ticketeria_datas_de_pico), 0, 'outra organização não vê');
select tv.como(null);
select is(tv.efeito('select 1 from public.ticketeria_datas_de_pico'), '', 'visitante não lê a tabela');
select tv.como('a1');
select is(tv.efeito($t$delete from public.ticketeria_datas_de_pico where nome = 'Festa da cidade'$t$), 'sim', 'quem edita apaga a data');
select tv.volta();

create table tv.ids (nome text primary key, id uuid);
insert into tv.ids select 'com', public.fn_ticketeria_mmm_gravar(tv.id('61'),
  tv.resultado('[{"chave":"nivel","porcento":30,"baixo":25,"alto":35},{"chave":"proximidade","porcento":11,"baixo":8,"alto":14}]'::jsonb));
insert into tv.ids select 'sem', public.fn_ticketeria_mmm_gravar(tv.id('61'), tv.resultado(null));
select is((select jsonb_array_length(base_partes) from public.ticketeria_mmm_execucoes where id = (select id from tv.ids where nome = 'com')), 2, 'gravar guarda as partes da base');
select is((select base_partes::text from public.ticketeria_mmm_execucoes where id = (select id from tv.ids where nome = 'sem')), '[]', 'sem partes a coluna fica com a lista vazia');
select is(tv.tenta(format($t$select public.fn_ticketeria_mmm_gravar(%L, tv.resultado('{"nivel": 41}'::jsonb))$t$, tv.id('61'))), '23514 resultado_invalido', 'partes que não são lista: recusa, e nada fica gravado');
select is(tv.tenta($t$update public.ticketeria_mmm_execucoes set base_partes = '{}'::jsonb$t$), '23514 ticketeria_mmm_execucoes_partes_check', 'a coluna só aceita lista');

select * from finish(true);
rollback;
