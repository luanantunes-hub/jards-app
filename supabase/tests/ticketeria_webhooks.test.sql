-- Ticketeria: os webhooks de saída (ticketeria_webhooks, ticketeria_webhook_entregas, os gatilhos de pedido pago, reembolso, ingresso lido e sessão cancelada, e as funções fn_ticketeria_webhook_*
-- e fn_ticketeria_webhooks_*): cadastro com validação e limite, o que entra na fila (e o que não entra), repetição com espera, teste, mudança, giro do segredo, limpeza e permissões.
-- Ids 0d7d0000-0000-4000-8000-0000000000XX, ou te.id('XX'). Loja A (61, org a0): evento 71, sessão 81, ingresso 33 (Pista, lote 23 a R$ 20,00); loja B (6b, org b0).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_webhooks, se ainda não estiverem aplicadas.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(47);

create schema te;
grant usage on schema te to authenticated, anon;

create function te.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7d0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;
create function te.erro(comando text) returns text language plpgsql as $$
begin
  execute comando;
  return 'aceito';
exception when others then return sqlerrm;
end;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at) values (te.id('a1'), 'te-a1@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now());
  insert into public.organizations (id, nome) values (te.id('a0'), 'TE A'), (te.id('b0'), 'TE B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (te.id('a0'), 'ticketeria', 'cortesia', 20), (te.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values (te.id('a0'), te.id('a1'), 'admin', '{ticketeria}'::text[]);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (te.id('61'), te.id('a0'), 'Loja A'), (te.id('6b'), te.id('b0'), 'Loja B');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (te.id('51'), te.id('a0'), te.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (te.id('42'), te.id('a0'), te.id('51'), 'Pista', 100);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (te.id('71'), te.id('a0'), te.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (te.id('81'), te.id('a0'), te.id('71'), te.id('51'), now() + interval '10 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values (te.id('33'), te.id('a0'), te.id('71'), te.id('42'), 'Pista', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values (te.id('23'), te.id('a0'), te.id('33'), '1º lote', 0, 2000, 40);
  delete from public.ticketeria_taxas;
  insert into public.ticketeria_cupons (organization_id, evento_id, codigo, tipo, valor) values (te.id('a0'), te.id('71'), 'GRATIS', 'percentual', 100);
end
$dados$;

-- Cadastro e validação.
create table te.w1 as select public.fn_ticketeria_webhook_criar(te.id('61'), '  https://exemplo.com.br/hooks/jards  ', array['pedido.pago', 'ingresso.lido', 'pedido.pago'], te.id('a1')) as r;
select is((select r ->> 'segredo' ~ '^whsec_[a-f0-9]{48}$' from te.w1), true, 'o segredo é whsec_ e 48 letras e números');
select is((select url from public.ticketeria_webhooks where id = (select (r ->> 'id')::uuid from te.w1)), 'https://exemplo.com.br/hooks/jards', 'o endereço é aparado');
select is((select eventos from public.ticketeria_webhooks where id = (select (r ->> 'id')::uuid from te.w1)), array['ingresso.lido', 'pedido.pago'], 'os eventos saem sem repetição e em ordem');
select is(array[
  te.erro(format($t$select public.fn_ticketeria_webhook_criar(%L, 'http://exemplo.com/x', array['pedido.pago'], null)$t$, te.id('61'))),
  te.erro(format($t$select public.fn_ticketeria_webhook_criar(%L, 'https://user:senha@exemplo.com/x', array['pedido.pago'], null)$t$, te.id('61'))),
  te.erro(format($t$select public.fn_ticketeria_webhook_criar(%L, 'javascript:alert(1)', array['pedido.pago'], null)$t$, te.id('61'))),
  te.erro(format($t$select public.fn_ticketeria_webhook_criar(%L, null, array['pedido.pago'], null)$t$, te.id('61')))
], array_fill('url_invalida'::text, array[4]), 'só https, sem usuário e senha no endereço');
select is(array[
  te.erro(format($t$select public.fn_ticketeria_webhook_criar(%L, 'https://exemplo.com/x', array['teste'], null)$t$, te.id('61'))),
  te.erro(format($t$select public.fn_ticketeria_webhook_criar(%L, 'https://exemplo.com/x', array[]::text[], null)$t$, te.id('61'))),
  te.erro(format($t$select public.fn_ticketeria_webhook_criar(%L, 'https://exemplo.com/x', null, null)$t$, te.id('61')))
], array_fill('eventos_invalidos'::text, array[3]), 'evento fora da lista, vazio ou nulo: eventos_invalidos');
select is(te.erro(format($t$select public.fn_ticketeria_webhook_criar(%L, 'https://exemplo.com/x', array['pedido.pago'], null)$t$, te.id('ff'))), 'loja_inexistente', 'loja que não existe');

-- Outros endereços: um desligado, um que só quer reembolso, e a loja B.
create table te.w2 as select public.fn_ticketeria_webhook_criar(te.id('61'), 'https://segundo.exemplo.com/h', array['pedido.pago'], null) as r;
create table te.w3 as select public.fn_ticketeria_webhook_criar(te.id('61'), 'https://reembolso.exemplo.com/h', array['pedido.reembolsado'], null) as r;
create table te.wb as select public.fn_ticketeria_webhook_criar(te.id('6b'), 'https://loja-b.exemplo.com/h', array['pedido.pago', 'ingresso.lido', 'sessao.cancelada', 'pedido.reembolsado'], null) as r;
select is(public.fn_ticketeria_webhook_mudar(te.id('61'), (select (r ->> 'id')::uuid from te.w2), null, null, false), true, 'desligar um endereço');
select is((select count(*)::int from public.ticketeria_webhooks where loja_id = te.id('61')), 3, 'a loja A tem três endereços');
select public.fn_ticketeria_webhook_criar(te.id('61'), 'https://quarto.exemplo.com/h', array['pedido.pago'], null);
select public.fn_ticketeria_webhook_criar(te.id('61'), 'https://quinto.exemplo.com/h', array['pedido.pago'], null);
select is(te.erro(format($t$select public.fn_ticketeria_webhook_criar(%L, 'https://sexto.exemplo.com/h', array['pedido.pago'], null)$t$, te.id('61'))), 'limite_de_webhooks', 'o sexto endereço da loja: limite_de_webhooks');
select public.fn_ticketeria_webhook_apagar(te.id('61'), w.id) from public.ticketeria_webhooks w where w.url in ('https://quarto.exemplo.com/h', 'https://quinto.exemplo.com/h');

-- Venda gratuita (cupom de 100%): o pedido já nasce pago; o gatilho é adiado para o fim da transação.
create function te.comprar(nome text) returns void language plpgsql as $$
begin
  perform public.fn_ticketeria_reservar_com_lugares(te.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', te.id('33'), 'quantidade', 2)), nome, 'marina@teste.invalid', 15, 'GRATIS', '[]'::jsonb);
end;
$$;
select te.comprar('Marina Prado');
select is((select count(*)::int from public.ticketeria_webhook_entregas), 0, 'antes do fim da transação, nada entrou na fila (o gatilho é adiado)');
set constraints ticketeria_webhooks_pedido immediate;
set constraints ticketeria_webhooks_pedido deferred;
select is((select count(*)::int from public.ticketeria_webhook_entregas where tipo = 'pedido.pago' and webhook_id = (select (r ->> 'id')::uuid from te.w1)), 1, 'o endereço que quer pedido.pago recebeu um aviso');
select is((select count(*)::int from public.ticketeria_webhook_entregas), 1, 'e só ele: o desligado, o que só quer reembolso e o da outra loja não receberam');
create table te.pago as select dados from public.ticketeria_webhook_entregas where tipo = 'pedido.pago';
select is((select dados -> 'comprador' ->> 'nome' from te.pago) || '|' || (select dados -> 'evento' ->> 'titulo' from te.pago) || '|' || (select dados -> 'pedido' ->> 'total_centavos' from te.pago), 'Marina Prado|Hamlet|0', 'o aviso traz comprador, evento e total');
select is((select jsonb_array_length(dados -> 'itens') || '/' || (dados -> 'itens' -> 0 ->> 'nome') || '/' || (dados -> 'itens' -> 0 ->> 'quantidade') from te.pago), '1/Pista/2', 'e os itens, já existentes no fim da transação');
select is((select dados -> 'pedido' ->> 'codigo' ~ '^[A-HJ-NP-Z2-9]{8}$' from te.pago), true, 'com o código do pedido');

-- Ingresso lido e sessão cancelada.
update public.ticketeria_ingressos_emitidos set usado_em = now() where id = (select id from public.ticketeria_ingressos_emitidos where sessao_id = te.id('81') order by codigo limit 1);
select is((select dados -> 'ingresso' ->> 'nome' from public.ticketeria_webhook_entregas where tipo = 'ingresso.lido'), 'Pista', 'ingresso lido na porta entra na fila');
update public.ticketeria_ingressos_emitidos set usado_em = now() where id = (select id from public.ticketeria_ingressos_emitidos where sessao_id = te.id('81') order by codigo limit 1);
select is((select count(*)::int from public.ticketeria_webhook_entregas where tipo = 'ingresso.lido'), 1, 'gravar o mesmo ingresso de novo não repete o aviso (só a passagem de nulo para lido)');
update public.ticketeria_sessoes set cancelada_em = now() where id = te.id('81');
select is((select count(*)::int from public.ticketeria_webhook_entregas where tipo = 'sessao.cancelada'), 0, 'ninguém da loja A quis sessao.cancelada');
update public.ticketeria_webhooks set eventos = array['sessao.cancelada'] where id = (select (r ->> 'id')::uuid from te.w2);
update public.ticketeria_webhooks set ativo = true where id = (select (r ->> 'id')::uuid from te.w2);
update public.ticketeria_sessoes set cancelada_em = null where id = te.id('81');
update public.ticketeria_sessoes set cancelada_em = now() where id = te.id('81');
select is((select count(*)::int from public.ticketeria_webhook_entregas where tipo = 'sessao.cancelada' and webhook_id = (select (r ->> 'id')::uuid from te.w2)), 1, 'cancelar a sessão avisa quem quer sessao.cancelada');

-- Reembolso.
update public.ticketeria_pedidos set reembolsado_em = now() where sessao_id = te.id('81');
set constraints ticketeria_webhooks_pedido immediate;
set constraints ticketeria_webhooks_pedido deferred;
select is((select dados -> 'pedido' ->> 'codigo' is not null from public.ticketeria_webhook_entregas where tipo = 'pedido.reembolsado' and webhook_id = (select (r ->> 'id')::uuid from te.w3)), true, 'o reembolso avisa quem quer pedido.reembolsado');

-- Enviar: reivindicar, registrar, repetir.
update public.ticketeria_webhook_entregas set estado = 'enviada', enviada_em = now() where tipo <> 'pedido.pago';
create table te.rv as select public.fn_ticketeria_webhooks_reivindicar(10) as r;
select is((select jsonb_array_length(r) from te.rv), 1, 'a entrega devida é reivindicada');
select is((select r -> 0 ->> 'url' from te.rv) || '|' || (select r -> 0 ->> 'tipo' from te.rv) || '|' || (select r -> 0 ->> 'tentativa' from te.rv), 'https://exemplo.com.br/hooks/jards|pedido.pago|1', 'com o endereço, o tipo e a tentativa contada');
select is((select r -> 0 ->> 'segredo' from te.rv), (select r ->> 'segredo' from te.w1), 'e o segredo, para assinar');
select is(jsonb_array_length(public.fn_ticketeria_webhooks_reivindicar(10)), 0, 'enquanto está "enviando", ninguém a reivindica de novo');
select is(public.fn_ticketeria_webhooks_registrar((select (r -> 0 ->> 'entrega')::uuid from te.rv), false, 500, 'erro do servidor'), 'pendente', 'falha: volta a pendente');
select is((select proxima_tentativa > now() + interval '30 seconds' and proxima_tentativa < now() + interval '2 minutes' from public.ticketeria_webhook_entregas where tipo = 'pedido.pago'), true, 'a próxima tentativa fica daqui a 1 minuto');
select is(jsonb_array_length(public.fn_ticketeria_webhooks_reivindicar(10)), 0, 'antes da hora, nada é devido');
update public.ticketeria_webhook_entregas set proxima_tentativa = now() where tipo = 'pedido.pago';
select is((public.fn_ticketeria_webhooks_reivindicar(10) -> 0 ->> 'tentativa'), '2', 'na hora, é reivindicada de novo, na tentativa 2');
select is(public.fn_ticketeria_webhooks_registrar((select id from public.ticketeria_webhook_entregas where tipo = 'pedido.pago'), true, 200, null), 'enviada', '2xx: enviada');
select is(public.fn_ticketeria_webhooks_registrar((select id from public.ticketeria_webhook_entregas where tipo = 'pedido.pago'), false, 500, 'x'), null, 'registrar de novo (sem estar enviando) não faz nada');
-- Seis falhas seguidas: desiste.
update public.ticketeria_webhook_entregas set estado = 'enviando', tentativas = 6 where tipo = 'pedido.pago';
select is(public.fn_ticketeria_webhooks_registrar((select id from public.ticketeria_webhook_entregas where tipo = 'pedido.pago'), false, null, repeat('x', 500)), 'falhou', 'na sexta falha, desiste');
select is((select char_length(ultimo_erro) from public.ticketeria_webhook_entregas where tipo = 'pedido.pago'), 300, 'e o erro guardado tem no máximo 300 letras');
-- "Enviando" há mais de 5 minutos (o servidor caiu): reivindicada de novo.
update public.ticketeria_webhook_entregas set estado = 'enviando', tentativas = 1, atualizada_em = now() - interval '6 minutes' where tipo = 'pedido.pago';
select is(jsonb_array_length(public.fn_ticketeria_webhooks_reivindicar(10)), 1, 'entrega presa em "enviando" por mais de 5 minutos é retomada');

-- Teste, mudar, girar, apagar, limpar.
select is((select count(*)::int from public.ticketeria_webhook_entregas where tipo = 'teste'), 0, 'sem teste na fila ainda');
select isnt(public.fn_ticketeria_webhook_teste(te.id('61'), (select (r ->> 'id')::uuid from te.w3)), null, 'pedir um teste devolve o id da entrega');
select is(public.fn_ticketeria_webhook_teste(te.id('6b'), (select (r ->> 'id')::uuid from te.w3)), null, 'o endereço de outra loja não tem teste');
select is(public.fn_ticketeria_webhook_mudar(te.id('6b'), (select (r ->> 'id')::uuid from te.w3), 'https://x.exemplo.com/h', null, null), false, 'outra loja não muda o endereço');
select is(public.fn_ticketeria_webhook_mudar(te.id('61'), (select (r ->> 'id')::uuid from te.w3), 'https://novo.exemplo.com/h', array['ingresso.lido'], null), true, 'a dona muda o endereço e os eventos');
select is(te.erro(format($t$select public.fn_ticketeria_webhook_mudar(%L, %L, 'http://x.com', null, null)$t$, te.id('61'), (select (r ->> 'id')::uuid from te.w3))), 'url_invalida', 'e continua só https');
select isnt(public.fn_ticketeria_webhook_girar(te.id('61'), (select (r ->> 'id')::uuid from te.w3)) ->> 'segredo', (select r ->> 'segredo' from te.w3), 'girar sorteia outro segredo');
select is(public.fn_ticketeria_webhook_girar(te.id('6b'), (select (r ->> 'id')::uuid from te.w3)), null, 'e só a dona gira');
select is(public.fn_ticketeria_webhook_apagar(te.id('61'), (select (r ->> 'id')::uuid from te.w3)), true, 'apagar o endereço');
select is((select count(*)::int from public.ticketeria_webhook_entregas where webhook_id = (select (r ->> 'id')::uuid from te.w3)), 0, 'e a fila dele vai junto');
select is(public.fn_ticketeria_webhooks_limpar(30), 0, 'limpar não apaga o que é novo');

-- Permissões.
select ok(not has_column_privilege('authenticated', 'public.ticketeria_webhooks', 'segredo', 'select') and has_column_privilege('authenticated', 'public.ticketeria_webhooks', 'url', 'select')
          and not has_table_privilege('authenticated', 'public.ticketeria_webhooks', 'insert') and not has_table_privilege('authenticated', 'public.ticketeria_webhooks', 'update') and not has_table_privilege('anon', 'public.ticketeria_webhooks', 'select'), 'o segredo nunca sai pelo navegador; o resto, só leitura para quem edita');
select ok(has_table_privilege('authenticated', 'public.ticketeria_webhook_entregas', 'select') and not has_table_privilege('authenticated', 'public.ticketeria_webhook_entregas', 'insert') and not has_table_privilege('anon', 'public.ticketeria_webhook_entregas', 'select'), 'as entregas: só leitura para quem edita');
select ok(not has_function_privilege('anon', 'public.fn_ticketeria_webhooks_reivindicar(integer)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_webhook_criar(uuid, text, text[], uuid)', 'execute')
          and not has_function_privilege('authenticated', 'public.fn_ticketeria_webhooks_enfileirar(uuid, text, jsonb)', 'execute') and not has_function_privilege('authenticated', 'public.fn_ticketeria_webhooks_disparar()', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_webhooks_reivindicar(integer)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_webhook_criar(uuid, text, text[], uuid)', 'execute')
          and has_function_privilege('service_role', 'public.fn_ticketeria_webhooks_registrar(uuid, boolean, integer, text)', 'execute'), 'só o servidor executa');

select * from finish();
rollback;
