-- Ticketeria: os cupons de desconto (ticketeria_cupons, fn_ticketeria_reservar_com_cupom, fn_ticketeria_aplicar_cupom, fn_ticketeria_cupom_conferir): o desconto em
-- porcentagem e em valor por ingresso, a taxa do Jards sobre o preço COM desconto, o cupom de 100% (pedido pago, ingressos emitidos), o cupom de um ingresso só, o
-- limite de usos, a validade, o código sem diferença de maiúsculas, quem lê e quem grava, e só o servidor executa as funções.
-- Ids 0d770000-0000-4000-8000-0000000000XX, ou tc.id('XX'). A (a0): loja 61, local 51, evento 71, sessão 81, ingressos 31 (R$ 60) e 32 (R$ 100). Taxa de A: 2,5% pagos pelo produtor.
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_cupons, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(29);

create schema tc;
grant usage on schema tc to authenticated, anon;

create function tc.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d770000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tc.id(s), 'tc-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a3', 'b1']) as s;
  insert into public.organizations (id, nome) values (tc.id('a0'), 'TC A'), (tc.id('b0'), 'TC B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (tc.id('a0'), 'ticketeria', 'cortesia', 20), (tc.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select tc.id(o), tc.id(p), papel, '{ticketeria}'::text[] from (values ('a0', 'a1', 'admin'), ('a0', 'a3', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tc.id('61'), tc.id('a0'), 'Loja A'), (tc.id('6b'), tc.id('b0'), 'Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tc.id('51'), tc.id('a0'), tc.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (tc.id('41'), tc.id('a0'), tc.id('51'), 'Plateia', 200);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tc.id('71'), tc.id('a0'), tc.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (tc.id('81'), tc.id('a0'), tc.id('71'), tc.id('51'), now() + interval '10 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values
    (tc.id('31'), tc.id('a0'), tc.id('71'), tc.id('41'), 'Inteira', 'inteira'), (tc.id('32'), tc.id('a0'), tc.id('71'), tc.id('41'), 'Camarote', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values
    (tc.id('21'), tc.id('a0'), tc.id('31'), '1º lote', 0, 6000, 50), (tc.id('22'), tc.id('a0'), tc.id('32'), '1º lote', 0, 10000, 50);
  delete from public.ticketeria_taxas;
  insert into public.ticketeria_taxas (loja_id, percentual_bps, fixo_centavos, quem_paga, vigente_desde) values (tc.id('61'), 250, 0, 'produtor', now() - interval '1 day');
  insert into public.ticketeria_cupons (id, organization_id, evento_id, ingresso_id, codigo, tipo, valor, limite_usos, valido_ate, ativo) values
    (tc.id('c1'), tc.id('a0'), tc.id('71'), null, 'AMIGOS20', 'percentual', 20, null, null, true),
    (tc.id('c2'), tc.id('a0'), tc.id('71'), null, 'DEZ', 'valor', 1000, null, null, true),
    (tc.id('c3'), tc.id('a0'), tc.id('71'), null, 'GRATIS', 'percentual', 100, null, null, true),
    (tc.id('c4'), tc.id('a0'), tc.id('71'), tc.id('31'), 'SOINTEIRA', 'percentual', 50, null, null, true),
    (tc.id('c5'), tc.id('a0'), tc.id('71'), null, 'UMSO', 'percentual', 10, 1, null, true),
    (tc.id('c6'), tc.id('a0'), tc.id('71'), null, 'VELHO', 'percentual', 10, null, now() - interval '1 hour', true),
    (tc.id('c7'), tc.id('a0'), tc.id('71'), null, 'PARADO', 'percentual', 10, null, null, false),
    (tc.id('c8'), tc.id('a0'), tc.id('71'), null, 'GRANDE', 'valor', 999999, null, null, true);
end
$dados$;

create table tc.pedidos (nome text primary key, resposta jsonb);
grant select on tc.pedidos to authenticated, anon;
-- Reserva com cupom: itens = lista de [ingresso, quantidade].
create function tc.comprar(nome text, codigo text, itens jsonb) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  r := public.fn_ticketeria_reservar_com_cupom(tc.id('81'), itens, 'Rita Teste', 'rita@teste.invalid', 15, codigo);
  insert into tc.pedidos values (nome, r);
  return r;
end;
$$;
create function tc.pedido(nome text) returns uuid language sql as $$ select (resposta ->> 'pedido_id')::uuid from tc.pedidos where pedidos.nome = pedido.nome $$;
create function tc.um(ingresso text, qtd int) returns jsonb language sql immutable as $$ select jsonb_build_array(jsonb_build_object('ingresso_id', tc.id(ingresso), 'quantidade', qtd)) $$;

create function tc.tenta(comando text) returns text language plpgsql as $$
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

create function tc.efeito(comando text) returns text language plpgsql as $$
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

create function tc.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', tc.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function tc.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- Porcentagem: 20% de R$ 60 = R$ 12 de desconto; paga R$ 48; a taxa de 2,5% vai sobre os R$ 48 (R$ 1,20) e sai do produtor.
select tc.comprar('p20', 'AMIGOS20', tc.um('31', 1));
select is((select (resposta ->> 'total_centavos') || '/' || (resposta ->> 'taxa_centavos') || '/' || (resposta ->> 'produtor_centavos') || '/' || (resposta ->> 'desconto_centavos') from tc.pedidos where nome = 'p20'), '4800/120/4680/1200', '20%: paga R$ 48, taxa sobre o valor com desconto, o desconto vai na resposta');
select is((select preco_centavos || '/' || desconto_centavos || '/' || taxa_centavos from public.ticketeria_pedido_itens where pedido_id = tc.pedido('p20')), '4800/1200/120', 'o item guarda o preço pago, o desconto e a taxa por ingresso');
select is((select cupom_codigo || '/' || desconto_centavos || '/' || (cupom_id = tc.id('c1'))::text || '/' || situacao from public.ticketeria_pedidos where id = tc.pedido('p20')), 'AMIGOS20/1200/true/aguardando_pagamento', 'o pedido guarda o cupom e o desconto, e segue aguardando o pagamento');

-- Valor fixo: R$ 10 por ingresso, em 2 ingressos de R$ 60: paga R$ 100, desconto R$ 20.
select tc.comprar('pvalor', 'DEZ', tc.um('31', 2));
select is((select (resposta ->> 'total_centavos') || '/' || (resposta ->> 'desconto_centavos') from tc.pedidos where nome = 'pvalor'), '10000/2000', 'R$ 10 por ingresso, em 2 ingressos: R$ 20 de desconto');
-- Desconto em valor maior que o preço: nunca passa do preço (o ingresso sai de graça).
select tc.comprar('pgrande', 'GRANDE', tc.um('31', 1));
select is((select (resposta ->> 'total_centavos') || '/' || (resposta ->> 'situacao') from tc.pedidos where nome = 'pgrande'), '0/pago', 'valor maior que o preço: desconta só o preço, o pedido nasce pago');

-- 100%: pedido pago, sem cobrança, e os ingressos são emitidos.
select tc.comprar('pgratis', 'gratis', tc.um('31', 2));
select is((select (resposta ->> 'total_centavos') || '/' || (resposta ->> 'taxa_centavos') || '/' || (resposta ->> 'situacao') || '/' || (resposta ->> 'desconto_centavos') from tc.pedidos where nome = 'pgratis'), '0/0/pago/12000', 'cupom de 100%: total zero, sem taxa, pago');
select is((select (situacao = 'pago' and pago_em is not null)::text from public.ticketeria_pedidos where id = tc.pedido('pgratis')), 'true', 'o pedido está pago de verdade (com a hora)');
select is((select count(*)::int from public.ticketeria_ingressos_emitidos where pedido_id = tc.pedido('pgratis')), 2, 'os 2 ingressos foram emitidos');
select is((select count(*)::int from public.ticketeria_transacoes where pedido_id = tc.pedido('pgratis')), 0, 'e não há razão (não houve dinheiro)');

-- Cupom de um ingresso só: desconta o ingresso 31 e deixa o 32 no preço cheio.
select tc.comprar('pmisto', 'SOINTEIRA', jsonb_build_array(jsonb_build_object('ingresso_id', tc.id('31'), 'quantidade', 1), jsonb_build_object('ingresso_id', tc.id('32'), 'quantidade', 1)));
select is((select (resposta ->> 'total_centavos') || '/' || (resposta ->> 'desconto_centavos') from tc.pedidos where nome = 'pmisto'), '13000/3000', 'cupom do ingresso 31 (50%): R$ 30 de desconto, o ingresso 32 fica em R$ 100');
select is(tc.tenta(format($t$select public.fn_ticketeria_reservar_com_cupom(%L, %L::jsonb, 'Rita', 'rita@teste.invalid', 15, 'SOINTEIRA')$t$, tc.id('81'), tc.um('32', 1))), '23514 cupom_nao_vale', 'cupom do ingresso 31 numa compra só do 32: não vale');

-- O código: maiúsculas, minúsculas e espaços não importam; código errado, desativado ou vencido, sim.
select is((select (public.fn_ticketeria_reservar_com_cupom(tc.id('81'), tc.um('31', 1), 'Rita', 'rita@teste.invalid', 15, '  amigos20 ') ->> 'total_centavos')), '4800', 'o código vale em minúsculas e com espaços');
select is(array[
  tc.tenta(format($t$select public.fn_ticketeria_reservar_com_cupom(%L, %L::jsonb, 'Rita', 'rita@teste.invalid', 15, 'NAOEXISTE')$t$, tc.id('81'), tc.um('31', 1))),
  tc.tenta(format($t$select public.fn_ticketeria_reservar_com_cupom(%L, %L::jsonb, 'Rita', 'rita@teste.invalid', 15, 'PARADO')$t$, tc.id('81'), tc.um('31', 1))),
  tc.tenta(format($t$select public.fn_ticketeria_reservar_com_cupom(%L, %L::jsonb, 'Rita', 'rita@teste.invalid', 15, 'VELHO')$t$, tc.id('81'), tc.um('31', 1)))
], array['23514 cupom_invalido', '23514 cupom_invalido', '23514 cupom_vencido'], 'código que não existe, cupom desativado: inválido; vencido: vencido');
select is((select (public.fn_ticketeria_reservar_com_cupom(tc.id('81'), tc.um('31', 1), 'Rita', 'rita@teste.invalid', 15, null) ->> 'total_centavos') || '/' || (public.fn_ticketeria_reservar_com_cupom(tc.id('81'), tc.um('31', 1), 'Rita', 'rita@teste.invalid', 15, '') ->> 'desconto_centavos')), '6000/0', 'sem código (nulo ou vazio): reserva no preço cheio, sem desconto');

-- Falhou o cupom, a reserva não fica: os lugares do lote não mudam.
create table tc.antes as select public.fn_ticketeria_ocupados(tc.id('81'), tc.id('21')) as n;
select tc.tenta(format($t$select public.fn_ticketeria_reservar_com_cupom(%L, %L::jsonb, 'Rita', 'rita@teste.invalid', 15, 'NAOEXISTE')$t$, tc.id('81'), tc.um('31', 3)));
select is(public.fn_ticketeria_ocupados(tc.id('81'), tc.id('21')), (select n from tc.antes), 'cupom recusado: nenhum lugar fica reservado');

-- Limite de usos: UMSO vale uma vez (a reserva no prazo já conta).
select tc.comprar('pumso', 'UMSO', tc.um('31', 1));
select is(tc.tenta(format($t$select public.fn_ticketeria_reservar_com_cupom(%L, %L::jsonb, 'Rita', 'rita@teste.invalid', 15, 'UMSO')$t$, tc.id('81'), tc.um('31', 1))), '23514 cupom_esgotado', 'limite de 1 uso: o segundo pedido é recusado');
update public.ticketeria_pedidos set reservado_ate = now() - interval '1 minute' where id = tc.pedido('pumso');
select is((select (public.fn_ticketeria_reservar_com_cupom(tc.id('81'), tc.um('31', 1), 'Rita', 'rita@teste.invalid', 15, 'UMSO') ->> 'desconto_centavos')), '600', 'reserva vencida sem pagar devolve o uso do cupom');

-- Aplicar duas vezes no mesmo pedido não vale.
select is(tc.tenta(format($t$select public.fn_ticketeria_aplicar_cupom(%L, 'DEZ')$t$, tc.pedido('p20'))), '23514 cupom_nao_vale', 'um pedido não leva dois cupons');
select is(tc.tenta($t$select public.fn_ticketeria_aplicar_cupom('0d770000-0000-4000-8000-0000000000ff', 'DEZ')$t$), '23514 pedido_inexistente', 'pedido que não existe: recusa');

-- O pagamento confere o valor com desconto.
select public.fn_ticketeria_definir_meio(tc.pedido('p20'), 'pix', null);
select is(public.fn_ticketeria_confirmar_pagamento(tc.pedido('p20'), 'teste', 'ref-1', 4800), 'pago', 'o pagamento do valor com desconto é aceito');
select is((select sum(valor_centavos)::text || '/' || sum(valor_centavos) filter (where conta = 'plataforma') from public.ticketeria_partidas p join public.ticketeria_transacoes t on t.id = p.transacao_id where t.pedido_id = tc.pedido('p20')), '0/-120', 'o razão fecha em zero e a parte do Jards é R$ 1,20 (2,5% de R$ 48)');

-- Regras da tabela.
select is(array[
  tc.tenta(format($t$insert into public.ticketeria_cupons (organization_id, evento_id, codigo, tipo, valor) values (%L, %L, 'amigos20', 'valor', 100)$t$, tc.id('a0'), tc.id('71'))),
  tc.tenta(format($t$insert into public.ticketeria_cupons (organization_id, evento_id, codigo, tipo, valor) values (%L, %L, 'NOVO1', 'percentual', 101)$t$, tc.id('a0'), tc.id('71'))),
  tc.tenta(format($t$insert into public.ticketeria_cupons (organization_id, evento_id, codigo, tipo, valor) values (%L, %L, 'A B', 'percentual', 10)$t$, tc.id('a0'), tc.id('71'))),
  tc.tenta(format($t$insert into public.ticketeria_cupons (organization_id, evento_id, codigo, tipo, valor) values (%L, %L, 'NOVO2', 'percentual', 10)$t$, tc.id('b0'), tc.id('71')))
], array['23505 ticketeria_cupons_evento_codigo_key', '23514 ticketeria_cupons_valor_check', '23514 ticketeria_cupons_codigo_check', '23514 cupom_de_outra_organizacao'], 'regras: código repetido no evento (mesmo em minúsculas), porcentagem acima de 100, código com espaço e evento de outra organização são recusados');

-- Quem lê e quem grava.
select tc.como('a1');
select is((select count(*)::int from public.ticketeria_cupons), 8, 'quem edita a Ticketeria vê os cupons da organização');
select is(tc.efeito(format($t$insert into public.ticketeria_cupons (organization_id, evento_id, codigo, tipo, valor) values (%L, %L, 'NOVO3', 'percentual', 15)$t$, tc.id('a0'), tc.id('71'))), 'sim', 'e cria cupom');
select is(tc.efeito($t$update public.ticketeria_cupons set ativo = false where codigo = 'DEZ'$t$), 'sim', 'e desativa cupom');
select tc.como('a3');
select is((select count(*)::int from public.ticketeria_cupons) || '/' || tc.efeito($t$update public.ticketeria_cupons set ativo = false where codigo = 'GRATIS'$t$), '0/', 'o leitor não vê nem altera os cupons');
select tc.como('b1');
select is((select count(*)::int from public.ticketeria_cupons), 0, 'outra organização não vê os cupons');
select tc.como(null);
select is(tc.efeito('select 1 from public.ticketeria_cupons'), '', 'visitante não lê a tabela');
select tc.volta();

select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_reservar_com_cupom(uuid, jsonb, text, text, integer, text)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_aplicar_cupom(uuid, text)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_reservar_com_cupom(uuid, jsonb, text, text, integer, text)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_aplicar_cupom(uuid, text)', 'execute'), 'só o servidor executa as funções do cupom');

select * from finish();
rollback;
