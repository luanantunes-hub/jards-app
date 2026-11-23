-- Ticketeria: o mapa da sala inteira (ticketeria_salas.planta, fn_ticketeria_planta_ok, fn_ticketeria_mapa_da_sessao): a sala guarda onde cada setor fica e a cor dele, só com formato
-- válido; o mapa do comprador traz a sala (a planta e os setores desenhados em blocos que estão à venda no evento) quando há planta, e o de antes quando não há; só o servidor lê o mapa do comprador.
-- Ids 0d810000-0000-4000-8000-0000000000XX, ou tl.id('XX'). A (a0): administrador a1, loja 61, local 51, evento 71 (publicado), sessão 81 (daqui a 10 dias), setor 41 (Plateia), ingresso 31.
-- Rodar: com as migrations anteriores da Ticketeria na frente, a ticketeria_layout_do_mapa e a ticketeria_planta_da_sala, se ainda não estiverem aplicadas. Tudo roda numa transação que termina em rollback.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

create schema tl;
grant usage on schema tl to authenticated, anon;

create function tl.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d810000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tl.id(s), 'tl-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1']) as s;
  insert into public.organizations (id, nome) values (tl.id('a0'), 'TL A');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tl.id('a0'), 'ticketeria', 'cortesia', 20);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values (tl.id('a0'), tl.id('a1'), 'admin', '{ticketeria}'::text[]);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tl.id('61'), tl.id('a0'), 'Loja A');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tl.id('51'), tl.id('a0'), tl.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares, arquivado) values (tl.id('41'), tl.id('a0'), tl.id('51'), 'Plateia', 100, false);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tl.id('71'), tl.id('a0'), tl.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (tl.id('81'), tl.id('a0'), tl.id('71'), tl.id('51'), now() + interval '10 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values (tl.id('31'), tl.id('a0'), tl.id('71'), tl.id('41'), 'Inteira', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values (tl.id('21'), tl.id('a0'), tl.id('31'), '1º lote', 0, 6000, 3);
  delete from public.ticketeria_taxas;
end
$dados$;

create function tl.tenta(comando text) returns text language plpgsql as $$
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

create function tl.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', tl.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function tl.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- Um mapa de uma fileira A com `a` lugares, e o layout de um bloco só para ele.
create function tl.mapa(a int) returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('nome', 'A', 'assentos', (select jsonb_agg(jsonb_build_object('numero', n, 'bloqueado', false) order by n) from generate_series(1, a) n)))
$$;
create function tl.layout(a int) returns jsonb language sql immutable as $$
  select jsonb_build_object('versao', 1, 'palco', null, 'blocos', jsonb_build_array(
    jsonb_build_object('id', 'b1', 'setor', null, 'x', 0, 'y', 0, 'angulo', 0, 'raio', null, 'espacoFileira', 1.25, 'larguraCorredor', 1.2, 'numeracao', 'esq-dir', 'primeiroNumero', 1,
      'fileiras', jsonb_build_array(jsonb_build_object('nome', 'A', 'lugares', a)))))
$$;
create function tl.sala() returns uuid language sql stable as $$
  select sala_id from public.ticketeria_setores where id = tl.id('41')
$$;
-- A planta com os setores dados (ids de tl.id) um embaixo do outro.
create function tl.planta(ids text[]) returns jsonb language sql stable as $$
  select jsonb_build_object('versao', 1, 'palco', jsonb_build_object('x', 0, 'y', -2.5, 'largura', 8, 'altura', 1.6, 'rotulo', 'Palco'), 'setores', (
    select jsonb_agg(jsonb_build_object('setor', tl.id(s), 'x', 0, 'y', (i - 1) * 6, 'cor', '#6450D2') order by i) from unnest(ids) with ordinality as t(s, i)))
$$;

select tl.como('a1');

-- Os setores: 41 Plateia e 42 Balcão (desenhados e à venda), 43 Interno (desenhado, sem ingresso), 44 Lista (numerado sem desenho, à venda).
insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares, arquivado) values
  (tl.id('42'), tl.id('a0'), tl.id('51'), 'Balcão', 100, false), (tl.id('43'), tl.id('a0'), tl.id('51'), 'Interno', 100, false), (tl.id('44'), tl.id('a0'), tl.id('51'), 'Lista', 100, false);
select public.fn_ticketeria_salvar_mapa_com_layout(tl.id(s), tl.mapa(4), true, tl.layout(4)) from unnest(array['41', '42', '43']) as s;
select public.fn_ticketeria_salvar_mapa(tl.id('44'), tl.mapa(4), true);
insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values
  (tl.id('32'), tl.id('a0'), tl.id('71'), tl.id('42'), 'Inteira', 'inteira'), (tl.id('34'), tl.id('a0'), tl.id('71'), tl.id('44'), 'Inteira', 'inteira');

-- O formato da planta.
select ok(public.fn_ticketeria_planta_ok(null), 'sem planta serve');
select ok(public.fn_ticketeria_planta_ok(tl.planta(array['41', '42'])), 'uma planta com dois setores serve');
select ok(public.fn_ticketeria_planta_ok(jsonb_set(tl.planta(array['41']), '{palco}', 'null')), 'o palco pode ser nulo');
select ok(not public.fn_ticketeria_planta_ok(jsonb_set(tl.planta(array['41']), '{versao}', '2')), 'versão que não é a 1');
select ok(not public.fn_ticketeria_planta_ok(jsonb_set(tl.planta(array['41']), '{setores}', '[]')), 'sem nenhum setor');
select ok(not public.fn_ticketeria_planta_ok(jsonb_set(tl.planta(array['41']), '{setores}', (tl.planta(array['41']) -> 'setores') || (tl.planta(array['41']) -> 'setores'))), 'o mesmo setor duas vezes');
select ok(not public.fn_ticketeria_planta_ok(jsonb_set(tl.planta(array['41']), '{setores,0,setor}', '"plateia"')), 'setor que não é um id');
select ok(not public.fn_ticketeria_planta_ok(jsonb_set(tl.planta(array['41']), '{setores,0,x}', '3000')), 'posição fora do limite');
select ok(not public.fn_ticketeria_planta_ok(jsonb_set(tl.planta(array['41']), '{setores,0,x}', '"dez"')), 'posição que não é número (sem estourar a conversão)');
select ok(not public.fn_ticketeria_planta_ok(jsonb_set(tl.planta(array['41']), '{setores,0,cor}', '"azul"')), 'cor que não é #RRGGBB');
select ok(not public.fn_ticketeria_planta_ok(jsonb_set(tl.planta(array['41']), '{palco,largura}', '0')), 'palco sem largura');

-- A trava da tabela, e quem edita a sala grava.
select is(tl.tenta(format($t$update public.ticketeria_salas set planta = '{"versao": 1, "setores": []}'::jsonb where id = %L$t$, tl.sala())), '23514 ticketeria_salas_planta_check', 'a tabela recusa uma planta que não serve');
select is(tl.tenta(format($t$update public.ticketeria_salas set planta = %L::jsonb where id = %L$t$, tl.planta(array['41', '42', '43', '44']), tl.sala())), 'aceito', 'a tabela aceita uma planta que serve');
-- `tl.tenta` desfaz o que executa: grava de verdade para conferir que fica.
update public.ticketeria_salas set planta = tl.planta(array['41', '42', '43', '44']) where id = tl.sala();
select is((select planta from public.ticketeria_salas where id = tl.sala()), tl.planta(array['41', '42', '43', '44']), 'e ela fica guardada como veio');
update public.ticketeria_salas set planta = null where id = tl.sala();

-- O mapa do comprador (função do servidor): sem planta é o de antes; com planta traz a sala.
select tl.volta();
select is((public.fn_ticketeria_mapa_da_sessao(tl.id('81'), tl.id('31')) ? 'sala'), false, 'sem planta, o mapa do comprador não traz a sala');
update public.ticketeria_salas set planta = tl.planta(array['41', '42', '43', '44']) where id = tl.sala();
select is(public.fn_ticketeria_mapa_da_sessao(tl.id('81'), tl.id('31')) -> 'sala' ->> 'atual', tl.id('41')::text, 'com planta, traz a sala e o setor da compra');
select is(public.fn_ticketeria_mapa_da_sessao(tl.id('81'), tl.id('31')) -> 'sala' -> 'planta', tl.planta(array['41', '42', '43', '44']), 'a planta como foi guardada');
select is((select jsonb_agg(x ->> 'id') from jsonb_array_elements(public.fn_ticketeria_mapa_da_sessao(tl.id('81'), tl.id('31')) -> 'sala' -> 'setores') x), jsonb_build_array(tl.id('42')::text, tl.id('41')::text), 'só os setores desenhados e à venda neste evento (Balcão e Plateia, por nome); o Interno e a Lista ficam de fora');
select is(public.fn_ticketeria_mapa_da_sessao(tl.id('81'), tl.id('31')) -> 'sala' -> 'setores' -> 0 -> 'layout', tl.layout(4), 'cada setor com o seu layout');
select is(jsonb_array_length(public.fn_ticketeria_mapa_da_sessao(tl.id('81'), tl.id('31')) -> 'fileiras'), 1, 'e o mapa do setor segue como sempre');

-- O fundo da planta (migration ticketeria_planta_fundo): uma imagem da biblioteca da loja, nunca um endereço de fora.
create function tl.fundo(muda jsonb default '{}') returns jsonb language sql stable as $$
  select jsonb_set(tl.planta(array['41']), '{fundo}', jsonb_build_object('caminho', tl.id('a0')::text || '/' || tl.id('b1')::text || '.webp', 'x', -5, 'y', -3.5, 'largura', 60, 'altura', 40, 'opacidade', 40) || muda)
$$;
select ok(public.fn_ticketeria_planta_ok(tl.fundo()), 'uma planta com fundo serve');
select ok(public.fn_ticketeria_planta_ok(jsonb_set(tl.planta(array['41']), '{fundo}', 'null')), 'o fundo pode ser nulo');
select ok(not public.fn_ticketeria_planta_ok(tl.fundo('{"caminho": "https://exemplo.com/planta.png"}')), 'endereço de fora não serve');
select ok(not public.fn_ticketeria_planta_ok(tl.fundo('{"opacidade": 5}')) and not public.fn_ticketeria_planta_ok(tl.fundo('{"opacidade": 40.5}')), 'opacidade fora de 10 a 100, ou fracionada');
select ok(not public.fn_ticketeria_planta_ok(tl.fundo('{"largura": 0}')) and not public.fn_ticketeria_planta_ok(tl.fundo('{"altura": 5000}')) and not public.fn_ticketeria_planta_ok(tl.fundo('{"x": "dez"}')), 'tamanho ou posição fora do limite, ou que não é número');
select is(tl.tenta(format($t$update public.ticketeria_salas set planta = %L::jsonb where id = %L$t$, tl.fundo('{"caminho": "../x.webp"}'), tl.sala())), '23514 ticketeria_salas_planta_check', 'a tabela recusa o fundo que não serve');

-- Quem executa.
select ok(has_function_privilege('authenticated', 'public.fn_ticketeria_planta_ok(jsonb)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_planta_ok(jsonb)', 'execute'), 'a conferência do formato: logado sim, visitante não');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_mapa_da_sessao(uuid, uuid)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_mapa_da_sessao(uuid, uuid)', 'execute'), 'o mapa do comprador é só do servidor');

select * from finish();
rollback;
