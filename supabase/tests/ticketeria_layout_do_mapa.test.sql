-- Ticketeria: o layout do mapa de assentos (ticketeria_setores.layout, fn_ticketeria_layout_ok, fn_ticketeria_layout_confere, fn_ticketeria_salvar_mapa_com_layout, fn_ticketeria_salvar_mapa,
-- fn_ticketeria_mapa_da_sessao): o layout (blocos, corredores, curva, ângulo, numeração, palco) é guardado junto com o mapa, só com formato válido e falando dos mesmos lugares; mudar os lugares
-- sem mandar layout o derruba, bloquear lugar ou mudar o tipo não; o mapa do comprador o traz quando há; só o servidor lê o mapa do comprador.
-- Ids 0d810000-0000-4000-8000-0000000000XX, ou tl.id('XX'). A (a0): administrador a1, loja 61, local 51, evento 71 (publicado), sessão 81 (daqui a 10 dias), setor 41 (Plateia), ingresso 31 (Inteira, no setor 41, 3 vagas).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_layout_do_mapa, se ainda não estiverem aplicadas. Tudo roda numa transação que termina em rollback.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(36);

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

-- O mapa: A com `a` lugares e B com `b` (todos livres).
create function tl.mapa(a int, b int) returns jsonb language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('nome', 'A', 'assentos', (select jsonb_agg(jsonb_build_object('numero', n, 'bloqueado', false) order by n) from generate_series(1, a) n)),
    jsonb_build_object('nome', 'B', 'assentos', (select jsonb_agg(jsonb_build_object('numero', n, 'bloqueado', false) order by n) from generate_series(1, b) n)))
$$;

-- Um bloco com as fileiras A (a lugares) e B (b lugares); `muda` troca campos do bloco.
create function tl.layout(a int, b int, muda jsonb default '{}') returns jsonb language sql immutable as $$
  select jsonb_build_object('versao', 1, 'palco', jsonb_build_object('x', 0, 'y', -2.5, 'largura', 8, 'altura', 1.6, 'rotulo', 'Palco'), 'blocos', jsonb_build_array(
    jsonb_build_object('id', 'b1', 'setor', null, 'x', 0, 'y', 0, 'angulo', 0, 'raio', null, 'espacoFileira', 1.25, 'larguraCorredor', 1.2, 'numeracao', 'esq-dir', 'primeiroNumero', 1,
      'fileiras', jsonb_build_array(jsonb_build_object('nome', 'A', 'lugares', a), jsonb_build_object('nome', 'B', 'lugares', b))) || muda))
$$;

create function tl.dois_blocos() returns jsonb language sql immutable as $$
  select jsonb_set(tl.layout(2, 2), '{blocos}', (tl.layout(2, 2) -> 'blocos') || jsonb_build_array(jsonb_build_object('id', 'b2', 'setor', null, 'x', 10, 'y', 0, 'angulo', 0, 'raio', null,
    'espacoFileira', 1.25, 'larguraCorredor', 1.2, 'numeracao', 'esq-dir', 'primeiroNumero', 3, 'fileiras', jsonb_build_array(jsonb_build_object('nome', 'A', 'lugares', 2)))))
$$;
select tl.como('a1');

-- Sem layout: nulo, e o mapa do comprador não traz a chave.
select is((select layout from public.ticketeria_setores where id = tl.id('41')), null, 'o setor nasce sem layout');

-- Guardar o layout junto com o mapa.
select is((public.fn_ticketeria_salvar_mapa_com_layout(tl.id('41'), tl.mapa(4, 2), true, tl.layout(4, 2))), '{"lugares": 6, "fileiras": 2, "bloqueados": 0, "layout": true}'::jsonb, 'salva o mapa e o layout na mesma chamada');
select is((select layout from public.ticketeria_setores where id = tl.id('41')), tl.layout(4, 2), 'o layout fica guardado como veio');
select is((select count(*)::int from public.ticketeria_assentos where setor_id = tl.id('41')), 6, 'os lugares do mapa são os de sempre: 6');

-- O mapa do comprador (função do servidor) traz o layout quando há, e a lista de fileiras segue igual.
select tl.volta();
select is((public.fn_ticketeria_mapa_da_sessao(tl.id('81'), tl.id('31')) -> 'layout'), tl.layout(4, 2), 'o mapa do comprador traz o layout');
select is(jsonb_array_length(public.fn_ticketeria_mapa_da_sessao(tl.id('81'), tl.id('31')) -> 'fileiras'), 2, 'e as fileiras, como sempre');
select tl.como('a1');

-- Formato inválido: recusado, e nada muda.
select is(tl.tenta(format($t$select public.fn_ticketeria_salvar_mapa_com_layout(%L, tl.mapa(4, 2), true, tl.layout(4, 2, '{"angulo": 400}'::jsonb))$t$, tl.id('41'))), '23514 layout_invalido', 'ângulo fora de -360 a 360');
select is(tl.tenta(format($t$select public.fn_ticketeria_salvar_mapa_com_layout(%L, tl.mapa(4, 2), true, jsonb_set(tl.layout(4, 2), '{versao}', '2'))$t$, tl.id('41'))), '23514 layout_invalido', 'versão que não é a 1');
select is(tl.tenta(format($t$select public.fn_ticketeria_salvar_mapa_com_layout(%L, tl.mapa(4, 2), true, tl.layout(4, 2, '{"numeracao": "x"}'::jsonb))$t$, tl.id('41'))), '23514 layout_invalido', 'regra de numeração que não existe');
select is(tl.tenta(format($t$select public.fn_ticketeria_salvar_mapa_com_layout(%L, tl.mapa(4, 2), true, tl.layout(4, 2, '{"raio": -3}'::jsonb))$t$, tl.id('41'))), '23514 layout_invalido', 'raio negativo');
select is(tl.tenta(format($t$select public.fn_ticketeria_salvar_mapa_com_layout(%L, tl.mapa(4, 2), true, tl.layout(4, 2, '{"x": "dez"}'::jsonb))$t$, tl.id('41'))), '23514 layout_invalido', 'posição que não é número (sem estourar a conversão)');
select is(tl.tenta(format($t$select public.fn_ticketeria_salvar_mapa_com_layout(%L, tl.mapa(4, 2), true, tl.layout(4, 2, '{"setor": "x"}'::jsonb))$t$, tl.id('41'))), '23514 layout_invalido', 'bloco com setor (o layout é de um setor só)');
select is(tl.tenta(format($t$select public.fn_ticketeria_salvar_mapa_com_layout(%L, tl.mapa(4, 2), true, tl.layout(4, 2, '{"corredores": [0]}'::jsonb))$t$, tl.id('41'))), '23514 layout_invalido', 'corredor depois de zero lugares');
select is(tl.tenta(format($t$select public.fn_ticketeria_salvar_mapa_com_layout(%L, tl.mapa(4, 2), true, tl.layout(4, 2, '{"primeiroNumero": 999}'::jsonb))$t$, tl.id('41'))), '23514 layout_invalido', 'numeração que passa de 999');
select is(tl.tenta(format($t$select public.fn_ticketeria_salvar_mapa_com_layout(%L, tl.mapa(4, 2), true, tl.layout(4, 2, '{"fileiras": [{"nome": "a", "lugares": 4}]}'::jsonb))$t$, tl.id('41'))), '23514 layout_invalido', 'nome de fileira em minúscula');
select is(tl.tenta(format($t$select public.fn_ticketeria_salvar_mapa_com_layout(%L, tl.mapa(4, 2), true, tl.layout(4, 2, '{"fileiras": [{"nome": "A", "lugares": 81}]}'::jsonb))$t$, tl.id('41'))), '23514 layout_invalido', 'mais de 80 lugares na fileira');
select is((select layout from public.ticketeria_setores where id = tl.id('41')), tl.layout(4, 2), 'o layout recusado não mudou o que estava guardado');

-- Layout que não fala dos mesmos lugares: recusado, e o mapa também não muda (a chamada é uma só).
select is(tl.tenta(format($t$select public.fn_ticketeria_salvar_mapa_com_layout(%L, tl.mapa(5, 2), true, tl.layout(4, 2))$t$, tl.id('41'))), '23514 layout_inconsistente', 'o layout diz 4 lugares na fileira A e o mapa 5');
select is((select count(*)::int from public.ticketeria_assentos where setor_id = tl.id('41')), 6, 'e o mapa recusado não mudou: segue com 6 lugares');
select is(tl.tenta(format($t$select public.fn_ticketeria_salvar_mapa_com_layout(%L, tl.mapa(4, 2), true, jsonb_set(tl.layout(4, 2), '{blocos,0,fileiras}', '[{"nome": "A", "lugares": 4}, {"nome": "C", "lugares": 2}]'::jsonb))$t$, tl.id('41'))), '23514 layout_inconsistente', 'o layout fala de uma fileira que o mapa não tem');

-- Uma fileira que passa por mais de um bloco: as quantidades somam (A: 2 + 2 = 4; B: 2).
select is((public.fn_ticketeria_salvar_mapa_com_layout(tl.id('41'), tl.mapa(4, 2), true, tl.dois_blocos()) ->> 'layout')::boolean, true, 'a fileira A passa por dois blocos de 2 lugares e vale 4');
select is((select jsonb_array_length(layout -> 'blocos') from public.ticketeria_setores where id = tl.id('41')), 2, 'os dois blocos ficam guardados');

-- Bloquear um lugar ou mudar o tipo, pela função de sempre, não derruba o layout.
select is((public.fn_ticketeria_salvar_mapa(tl.id('41'), jsonb_set(tl.mapa(4, 2), '{0,assentos,1,bloqueado}', 'true'), true) ->> 'bloqueados')::int, 1, 'salvar o mapa só bloqueando o A2');
select is((select jsonb_array_length(layout -> 'blocos') from public.ticketeria_setores where id = tl.id('41')), 2, 'bloquear um lugar não derruba o layout');
select is((public.fn_ticketeria_salvar_mapa(tl.id('41'), jsonb_set(tl.mapa(4, 2), '{0,assentos,0,tipo}', '"cadeira_rodas"'), true) ->> 'lugares')::int, 6, 'salvar o mapa mudando o tipo do A1');
select is((select jsonb_array_length(layout -> 'blocos') from public.ticketeria_setores where id = tl.id('41')), 2, 'mudar o tipo de um lugar não derruba o layout');

-- Mudar os lugares pela função de sempre (sem layout) derruba o layout: ele já não descreveria o mapa.
select is((public.fn_ticketeria_salvar_mapa(tl.id('41'), tl.mapa(5, 2), true) ->> 'lugares')::int, 7, 'salvar o mapa com um lugar a mais na fileira A');
select is((select layout from public.ticketeria_setores where id = tl.id('41')), null, 'o layout saiu, e o setor é de novo só a lista de fileiras');

-- Layout nulo (ou o JSON null) apaga o layout.
select is((public.fn_ticketeria_salvar_mapa_com_layout(tl.id('41'), tl.mapa(5, 2), true, tl.layout(5, 2)) ->> 'layout')::boolean, true, 'guarda de novo, agora para 5 e 2');
select is((public.fn_ticketeria_salvar_mapa_com_layout(tl.id('41'), tl.mapa(5, 2), true, null) ->> 'layout')::boolean, false, 'com layout nulo, o resultado diz que não há layout');
select is((select layout from public.ticketeria_setores where id = tl.id('41')), null, 'e o layout guardado saiu');
select public.fn_ticketeria_salvar_mapa_com_layout(tl.id('41'), tl.mapa(5, 2), true, tl.layout(5, 2));
select is((public.fn_ticketeria_salvar_mapa_com_layout(tl.id('41'), tl.mapa(5, 2), true, 'null'::jsonb) ->> 'layout')::boolean, false, 'o JSON null também apaga');

-- A trava da tabela vale para qualquer um que grave direto.
select is(tl.tenta(format($t$update public.ticketeria_setores set layout = '{"versao": 1, "blocos": []}'::jsonb where id = %L$t$, tl.id('41'))), '23514 ticketeria_setores_layout_check', 'a tabela recusa um layout sem blocos');
select is(tl.tenta(format($t$update public.ticketeria_setores set layout = '"texto"'::jsonb where id = %L$t$, tl.id('41'))), '23514 ticketeria_setores_layout_check', 'a tabela recusa um layout que não é objeto');

-- Quem executa.
select ok(has_function_privilege('authenticated', 'public.fn_ticketeria_salvar_mapa_com_layout(uuid, jsonb, boolean, jsonb)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_salvar_mapa_com_layout(uuid, jsonb, boolean, jsonb)', 'execute'), 'salvar com layout: o logado executa, o visitante não');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_mapa_da_sessao(uuid, uuid)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_mapa_da_sessao(uuid, uuid)', 'execute'), 'o mapa do comprador segue só do servidor');

select * from finish();
rollback;
