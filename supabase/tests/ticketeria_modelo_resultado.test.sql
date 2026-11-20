-- Ticketeria: o resultado do modelo de marketing (ticketeria_mmm_execucoes, ticketeria_mmm_canais; fn_ticketeria_mmm_gravar e fn_ticketeria_mmm_falhou): gravar guarda a rodada e todos os
-- canais juntos; o canal repetido, as porcentagens fora de 0 a 100, o intervalo desordenado e a lista vazia são recusados (e nada fica gravado); a rodada que falhou guarda só a frase; as
-- rodadas ficam em ordem; só o servidor mexe.
-- Ids 0d760000-0000-4000-8000-0000000000XX, ou tv.id('XX'). A (a0): loja 61.
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_modelo_resultado.

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
insert into tv.ids select 'a', public.fn_ticketeria_mmm_gravar(tv.id('61'), $j${"motor":"pymc-marketing","versao_motor":"1.5.0","semanas":59,"confianca":"media","diagnosticos":{"r_hat_maximo":1.01,"divergencias":0,"ess_minimo":650},"base":{"porcento":41.23,"baixo":33,"alto":49.5},"canais":[{"canal":"meta-ads","porcento":27,"baixo":16.1,"alto":38.4,"ingressos":612,"gasto_centavos":780000,"custo_por_ingresso_centavos":1275,"saturacao_gasto_centavos":30000,"margem_grande":false,"gasto_constante":false,"curva":[{"gasto_centavos":0,"ingressos":0},{"gasto_centavos":15000,"ingressos":9.5}]},{"canal":"google-ads","porcento":9,"baixo":0.5,"alto":18,"ingressos":204,"gasto_centavos":210000,"custo_por_ingresso_centavos":null,"saturacao_gasto_centavos":null,"margem_grande":true,"gasto_constante":true,"curva":[]}]}$j$::jsonb);
select is((select situacao || '|' || motor || '|' || semanas || '|' || confianca || '|' || r_hat_maximo || '|' || divergencias || '|' || ess_minimo || '|' || base_porcento from public.ticketeria_mmm_execucoes where id = (select id from tv.ids where nome = 'a')), 'ok|pymc-marketing|59|media|1.0100|0|650|41.23', 'a rodada boa guarda o motor, as semanas, a confiança, os diagnósticos e a base');
select is((select count(*)::int from public.ticketeria_mmm_canais where execucao_id = (select id from tv.ids where nome = 'a')), 2, 'e os dois canais');
select is((select porcento || '|' || intervalo_baixo || '|' || intervalo_alto || '|' || ingressos || '|' || gasto_centavos || '|' || custo_por_ingresso_centavos || '|' || saturacao_gasto_centavos || '|' || margem_grande || '|' || gasto_constante || '|' || jsonb_array_length(curva) from public.ticketeria_mmm_canais where canal = 'meta-ads'), '27.00|16.10|38.40|612|780000|1275|30000|false|false|2', 'o canal guarda a contribuição, o intervalo, o custo, a saturação e a curva');
select is((select custo_por_ingresso_centavos is null and saturacao_gasto_centavos is null and margem_grande and gasto_constante from public.ticketeria_mmm_canais where canal = 'google-ads'), true, 'custo e saturação vazios e os avisos ligados valem');
select is((select organization_id from public.ticketeria_mmm_execucoes limit 1), tv.id('a0'), 'a rodada é da organização da loja');
select is(array[
  tv.tenta($t$select public.fn_ticketeria_mmm_gravar('0d760000-0000-4000-8000-0000000000ff', '{"canais":[{"canal":"x"}]}'::jsonb)$t$),
  tv.tenta(format($t$select public.fn_ticketeria_mmm_gravar(%L, '{"canais":[]}'::jsonb)$t$, tv.id('61'))),
  tv.tenta(format($t$select public.fn_ticketeria_mmm_gravar(%L, '[]'::jsonb)$t$, tv.id('61'))),
  tv.tenta(format($t$select public.fn_ticketeria_mmm_gravar(%L, '{"motor":"x","semanas":30,"confianca":"alta","base":{"porcento":50,"baixo":40,"alto":60},"canais":[{"canal":"a","porcento":50,"baixo":40,"alto":60}]}'::jsonb)$t$, tv.id('61'))),
  tv.tenta(format($t$select public.fn_ticketeria_mmm_gravar(%L, '{"motor":"x","semanas":30,"confianca":"media","diagnosticos":{},"base":{"porcento":50,"baixo":40,"alto":60},"canais":[{"canal":"a","porcento":50,"baixo":40,"alto":60},{"canal":"a","porcento":0,"baixo":0,"alto":1}]}'::jsonb)$t$, tv.id('61'))),
  tv.tenta(format($t$select public.fn_ticketeria_mmm_gravar(%L, '{"motor":"x","semanas":30,"confianca":"media","diagnosticos":{},"base":{"porcento":50,"baixo":40,"alto":60},"canais":[{"canal":"a","porcento":120,"baixo":40,"alto":60}]}'::jsonb)$t$, tv.id('61'))),
  tv.tenta(format($t$select public.fn_ticketeria_mmm_gravar(%L, '{"motor":"x","semanas":30,"confianca":"media","diagnosticos":{},"base":{"porcento":50,"baixo":40,"alto":60},"canais":[{"canal":"a","porcento":50,"baixo":60,"alto":40}]}'::jsonb)$t$, tv.id('61')))
], array['23514 loja_inexistente', '23514 resultado_invalido', '23514 resultado_invalido', '23514 ticketeria_mmm_execucoes_confianca_check', '23505 ticketeria_mmm_canais_execucao_canal_key', '23514 ticketeria_mmm_canais_porcento_check', '23514 ticketeria_mmm_canais_porcento_check'], 'loja inexistente, lista vazia, formato torto, confiança fora da lista, canal repetido, porcentagem fora de 0 a 100 e intervalo desordenado: recusa');
select is((select count(*)::int from public.ticketeria_mmm_execucoes where loja_id = tv.id('61')), 1, 'e recusar não deixa rodada pela metade');
insert into tv.ids select 'f', public.fn_ticketeria_mmm_falhou(tv.id('61'), '  Só há 20 semanas.  ');
select is((select situacao || '|' || motivo || '|' || (motor is null)::text || '|' || (semanas is null)::text from public.ticketeria_mmm_execucoes where id = (select id from tv.ids where nome = 'f')), 'falhou|Só há 20 semanas.|true|true', 'a rodada que falhou guarda só a frase (aparada)');
select is((select count(*)::int from public.ticketeria_mmm_canais where execucao_id = (select id from tv.ids where nome = 'f')), 0, 'e nenhum canal');
select is(tv.tenta($t$select public.fn_ticketeria_mmm_falhou('0d760000-0000-4000-8000-0000000000ff', 'x')$t$), '23514 loja_inexistente', 'falha de loja que não existe: recusa');
-- Na mesma transação o relógio não anda: a rodada que falhou é posta um segundo depois, como seria numa segunda-feira seguinte.
update public.ticketeria_mmm_execucoes set created_at = created_at + interval '1 second' where id = (select id from tv.ids where nome = 'f');
select is(array(select situacao from public.ticketeria_mmm_execucoes where loja_id = tv.id('61') order by created_at, id), array['ok', 'falhou'], 'as rodadas ficam em ordem');
select lives_ok(format($t$delete from public.ticketeria_mmm_execucoes where id = %L$t$, (select id from tv.ids where nome = 'a')), 'apagar a rodada');
select is((select count(*)::int from public.ticketeria_mmm_canais where loja_id = tv.id('61')), 0, 'apaga os canais junto (em cascata)');
select ok(not has_table_privilege('authenticated', 'public.ticketeria_mmm_execucoes', 'select') and not has_table_privilege('anon', 'public.ticketeria_mmm_canais', 'select') and has_table_privilege('service_role', 'public.ticketeria_mmm_canais', 'insert')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_mmm_gravar(uuid, jsonb)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_mmm_falhou(uuid, text)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_mmm_gravar(uuid, jsonb)', 'execute'), 'só o servidor lê e grava: o navegador não vê as tabelas nem chama as funções');

select * from finish(true);
rollback;
