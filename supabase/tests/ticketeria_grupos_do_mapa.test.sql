-- Ticketeria: mesas e camarotes (ticketeria_assentos.venda_em_grupo, o gatilho do layout do setor, fn_ticketeria_layout_ok com `grupo`, fn_ticketeria_reservar_com_lugares com a regra "vende inteiro",
-- fn_ticketeria_mapa_da_sessao com o grupo todo ocupado): um grupo que vende inteiro só se compra completo, num pedido só; um lugar tomado ou bloqueado tira o grupo todo da venda; a mesa que não vende
-- inteira segue como os lugares de sempre. A marca vem do layout (nunca à mão) e o formato do `grupo` é conferido pelo banco.
-- Ids 0d8b0000-0000-4000-8000-0000000000XX, ou tg.id('XX'). A (a0): administrador a1, loja 61, local 51, evento 71 (publicado), sessão 81 (daqui a 10 dias), setor 41 (Salão), ingresso 31 (Inteira, lote de 12: cabe nos 15 lugares livres do mapa).
-- O mapa do Salão: A (4 lugares, fileira comum), C1 (camarote que vende inteiro), M1 (mesa que NÃO vende inteira), C2 (camarote que vende inteiro, com o lugar 3 bloqueado).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_grupos_do_mapa, se ainda não estiverem aplicadas. Tudo roda numa transação que termina em rollback.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

create schema tg;
grant usage on schema tg to authenticated, anon;

create function tg.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d8b0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tg.id(s), 'tg-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1']) as s;
  insert into public.organizations (id, nome) values (tg.id('a0'), 'TL A');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tg.id('a0'), 'ticketeria', 'cortesia', 20);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values (tg.id('a0'), tg.id('a1'), 'admin', '{ticketeria}'::text[]);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tg.id('61'), tg.id('a0'), 'Loja A');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tg.id('51'), tg.id('a0'), tg.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares, arquivado) values (tg.id('41'), tg.id('a0'), tg.id('51'), 'Plateia', 100, false);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tg.id('71'), tg.id('a0'), tg.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (tg.id('81'), tg.id('a0'), tg.id('71'), tg.id('51'), now() + interval '10 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values (tg.id('31'), tg.id('a0'), tg.id('71'), tg.id('41'), 'Inteira', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values (tg.id('21'), tg.id('a0'), tg.id('31'), '1º lote', 0, 6000, 12);
  delete from public.ticketeria_taxas;
  insert into public.ticketeria_taxas (loja_id, percentual_bps, fixo_centavos, quem_paga, vigente_desde) values (tg.id('61'), 250, 0, 'produtor', now() - interval '1 day');
end
$dados$;

create function tg.tenta(comando text) returns text language plpgsql as $$
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

create function tg.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', tg.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function tg.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

create function tg.bloco(id text, nome text, lugares int, grupo jsonb default null, x numeric default 0) returns jsonb language sql immutable as $$
  select jsonb_build_object('id', id, 'setor', null, 'x', x, 'y', 0, 'angulo', 0, 'raio', null, 'espacoFileira', 1.25, 'larguraCorredor', 1.2, 'numeracao', 'esq-dir', 'primeiroNumero', 1,
    'fileiras', jsonb_build_array(jsonb_build_object('nome', nome, 'lugares', lugares))) || case when grupo is null then '{}'::jsonb else jsonb_build_object('grupo', grupo) end
$$;
create function tg.layout(c2_inteiro boolean default true) returns jsonb language sql immutable as $$
  select jsonb_build_object('versao', 1, 'palco', null, 'blocos', jsonb_build_array(
    tg.bloco('b1', 'A', 4), tg.bloco('b2', 'C1', 4, '{"forma": "camarote", "inteiro": true, "colunas": 2}', 20), tg.bloco('b3', 'M1', 4, '{"forma": "mesa", "inteiro": false}', 40),
    tg.bloco('b4', 'C2', 4, jsonb_build_object('forma', 'camarote', 'inteiro', c2_inteiro, 'colunas', 2), 60)))
$$;
create function tg.fileira(nome text, bloqueado int default 0) returns jsonb language sql immutable as $$
  select jsonb_build_object('nome', nome, 'assentos', (select jsonb_agg(jsonb_build_object('numero', n, 'bloqueado', n = bloqueado) order by n) from generate_series(1, 4) n))
$$;
create function tg.mapa() returns jsonb language sql immutable as $$
  select jsonb_build_array(tg.fileira('A'), tg.fileira('C1'), tg.fileira('M1'), tg.fileira('C2', 3))
$$;
-- Os lugares ("C1:1 C1:2") do ingresso 31 e a compra deles, na sessão 81.
create function tg.lugares(lista text) returns jsonb language sql immutable as $$
  select jsonb_build_object('ingresso_id', tg.id('31'), 'assentos', (select jsonb_agg(jsonb_build_object('fileira', split_part(x, ':', 1), 'numero', split_part(x, ':', 2)::int)) from unnest(string_to_array(lista, ' ')) x))
$$;
create function tg.comprar(lista text) returns jsonb language sql as $$
  select public.fn_ticketeria_reservar_com_lugares(tg.id('81'), jsonb_build_array(jsonb_build_object('ingresso_id', tg.id('31'), 'quantidade', cardinality(string_to_array(lista, ' ')))), 'Rita Teste', 'rita@teste.invalid', 15, null, jsonb_build_array(tg.lugares(lista)))
$$;
create function tg.comando(lista text) returns text language sql as $$
  select format($t$select tg.comprar(%L)$t$, lista)
$$;
create function tg.estados(fileira text) returns jsonb language sql as $$
  select jsonb_agg(a ->> 'estado' order by (a ->> 'numero')::int)
  from jsonb_array_elements(public.fn_ticketeria_mapa_da_sessao(tg.id('81'), tg.id('31')) -> 'fileiras') f, jsonb_array_elements(f -> 'assentos') a where f ->> 'nome' = fileira
$$;
create function tg.marcados() returns jsonb language sql as $$
  select coalesce(jsonb_agg(distinct fileira order by fileira), '[]'::jsonb) from public.ticketeria_assentos where setor_id = tg.id('41') and venda_em_grupo
$$;

select tg.como('a1');

-- O formato do grupo.
select ok(public.fn_ticketeria_layout_ok(tg.layout()), 'um layout com camarotes e mesa serve');
select ok(not public.fn_ticketeria_layout_ok(jsonb_set(tg.layout(), '{blocos,1,grupo,forma}', '"piscina"')) and not public.fn_ticketeria_layout_ok(jsonb_set(tg.layout(), '{blocos,1,grupo,inteiro}', '"sim"')), 'forma que não existe, ou "inteiro" que não é verdadeiro ou falso');
select ok(not public.fn_ticketeria_layout_ok(jsonb_set(tg.layout(), '{blocos,2,fileiras,0,lugares}', '1')) and not public.fn_ticketeria_layout_ok(jsonb_set(tg.layout(), '{blocos,1,fileiras}', '[{"nome": "C1", "lugares": 2}, {"nome": "C9", "lugares": 2}]')), 'mesa de 1 lugar, ou camarote com duas fileiras');
select ok(not public.fn_ticketeria_layout_ok(jsonb_set(tg.layout(), '{blocos,2,grupo,colunas}', '3')) and not public.fn_ticketeria_layout_ok(jsonb_set(tg.layout(), '{blocos,1,grupo,colunas}', '13')), 'colunas numa mesa, ou mais de 12 colunas');
select ok(public.fn_ticketeria_layout_ok(jsonb_set(tg.layout(), '{blocos,1,grupo}', 'null')), 'grupo nulo é bloco de fileira comum');

-- A marca vem do layout.
select is((public.fn_ticketeria_salvar_mapa_com_layout(tg.id('41'), tg.mapa(), true, tg.layout()) ->> 'layout')::boolean, true, 'salva o mapa e o layout com grupos');
select is(tg.marcados(), '["C1", "C2"]'::jsonb, 'só os camarotes que vendem inteiro ficam marcados (a mesa e a fileira A não)');
select is((select count(*)::int from public.ticketeria_assentos where setor_id = tg.id('41') and venda_em_grupo), 8, 'oito lugares marcados: C1 e C2');
select is((public.fn_ticketeria_salvar_mapa_com_layout(tg.id('41'), tg.mapa(), true, tg.layout(false)) ->> 'layout')::boolean and tg.marcados() = '["C1"]'::jsonb, true, 'desligar o "vende inteiro" do C2 tira a marca dele');
select is((public.fn_ticketeria_salvar_mapa_com_layout(tg.id('41'), tg.mapa(), true, tg.layout()) ->> 'layout')::boolean and tg.marcados() = '["C1", "C2"]'::jsonb, true, 'e ligar de novo a põe de volta');
select is((public.fn_ticketeria_salvar_mapa_com_layout(tg.id('41'), tg.mapa(), true, null) ->> 'layout')::boolean is false and tg.marcados() = '[]'::jsonb, true, 'sem layout, nenhum lugar fica marcado');
select is((public.fn_ticketeria_salvar_mapa_com_layout(tg.id('41'), tg.mapa(), true, tg.layout()) ->> 'layout')::boolean and tg.marcados() = '["C1", "C2"]'::jsonb, true, 'com o layout de volta, as marcas voltam');

-- O mapa do comprador: um lugar bloqueado tira o grupo todo da venda.
select tg.volta();
select is(tg.estados('C2'), '["ocupado", "ocupado", "ocupado", "ocupado"]'::jsonb, 'o C2 tem o lugar 3 bloqueado: o camarote todo aparece ocupado');
select ok(tg.estados('C1') = '["livre", "livre", "livre", "livre"]'::jsonb and tg.estados('M1') = '["livre", "livre", "livre", "livre"]'::jsonb and tg.estados('A') = '["livre", "livre", "livre", "livre"]'::jsonb, 'o C1, a mesa e a fileira A seguem livres');

-- A reserva: o grupo que vende inteiro vai inteiro.
select is(tg.tenta(tg.comando('C1:1 C1:2 C1:3')), '23514 grupo_incompleto', 'três dos quatro lugares do C1: o pedido é recusado');
select is(tg.tenta(tg.comando('C2:1 C2:2 C2:4')), '23514 grupo_incompleto', 'os três lugares livres do C2: falta o bloqueado, então também não');
select is(tg.tenta(tg.comando('C2:1 C2:2 C2:3 C2:4')), '23514 lugar_indisponivel', 'o C2 inteiro: o lugar 3 está bloqueado');
select is(tg.tenta(tg.comando('C1:1 C1:2 C1:3 C1:4 A:1')), 'aceito', 'o C1 inteiro, com um lugar de fora junto: aceito');
select is(tg.tenta(tg.comando('M1:1 M1:2')), 'aceito', 'a mesa que não vende inteira: dois dos quatro lugares servem');
select is((tg.comprar('C1:1 C1:2 C1:3 C1:4') ->> 'pedido_id') is not null, true, 'o C1 inteiro é reservado');
select is((select count(*)::int from public.ticketeria_pedido_assentos where fileira = 'C1'), 4, 'com os quatro lugares do grupo no pedido');
select is(tg.estados('C1'), '["ocupado", "ocupado", "ocupado", "ocupado"]'::jsonb, 'e o camarote aparece ocupado para os outros');
select is(tg.tenta(tg.comando('C1:1 C1:2 C1:3 C1:4')), '23514 lugar_ocupado', 'outra pessoa tentando o mesmo camarote: ocupado');
select is((tg.comprar('M1:1 M1:2') ->> 'pedido_id') is not null and (tg.comprar('M1:3 M1:4') ->> 'pedido_id') is not null, true, 'a mesa se vende em dois pedidos, dois lugares para cada pessoa');

-- Quem executa.
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_setor_layout_grupos()', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_setor_layout_grupos()', 'execute'), 'o gatilho não é de ninguém');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_reservar_com_lugares(uuid, jsonb, text, text, integer, text, jsonb)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_reservar_com_lugares(uuid, jsonb, text, text, integer, text, jsonb)', 'execute'), 'a reserva segue só do servidor');

select * from finish();
rollback;
