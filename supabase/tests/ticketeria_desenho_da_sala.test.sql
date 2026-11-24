-- Ticketeria: salvar o desenho da sala de uma vez (fn_ticketeria_salvar_desenho_da_sala): cada setor com blocos recebe o seu mapa e o seu layout, a sala recebe a planta, tudo numa transação só; setor de
-- outra sala e planta com setor de fora são recusados; quem não é da organização não salva; o grupo que vende inteiro continua marcado pelo gatilho do layout.
-- Ids 0d8b0000-0000-4000-8000-0000000000XX, ou tg.id('XX'). A (a0): administrador a1, loja 61, local 51, setor 41 (Plateia) na sala padrão, 42 (Balcão) e 43 (Pista) na mesma sala, 44 (Outra) noutra sala do
-- mesmo local. B (b0): administrador b1.
-- Rodar: com as migrations anteriores da Ticketeria na frente, a ticketeria_grupos_do_mapa e a ticketeria_salvar_desenho_da_sala, se ainda não estiverem aplicadas. Tudo roda numa transação que termina em rollback.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

create schema tg;
grant usage on schema tg to authenticated, anon;

create function tg.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d8b0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tg.id(s), 'tg-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'b1']) as s;
  insert into public.organizations (id, nome) values (tg.id('a0'), 'TL A'), (tg.id('b0'), 'TL B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tg.id('a0'), 'ticketeria', 'cortesia', 20), (tg.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values (tg.id('a0'), tg.id('a1'), 'admin', '{ticketeria}'::text[]), (tg.id('b0'), tg.id('b1'), 'admin', '{ticketeria}'::text[]);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tg.id('61'), tg.id('a0'), 'Loja A');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tg.id('51'), tg.id('a0'), tg.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares, arquivado) values (tg.id('41'), tg.id('a0'), tg.id('51'), 'Plateia', 100, false);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tg.id('71'), tg.id('a0'), tg.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (tg.id('81'), tg.id('a0'), tg.id('71'), tg.id('51'), now() + interval '10 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values (tg.id('31'), tg.id('a0'), tg.id('71'), tg.id('41'), 'Inteira', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values (tg.id('21'), tg.id('a0'), tg.id('31'), '1º lote', 0, 6000, 4);
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
create function tg.fileira(nome text) returns jsonb language sql immutable as $$
  select jsonb_build_object('nome', nome, 'assentos', (select jsonb_agg(jsonb_build_object('numero', n, 'bloqueado', false) order by n) from generate_series(1, 4) n))
$$;
-- O setor 41: a fileira A e o camarote C1 (vende inteiro); o 42: a fileira A.
create function tg.item41() returns jsonb language sql immutable as $$
  select jsonb_build_object('setor', tg.id('41')::text, 'corredor', true, 'fileiras', jsonb_build_array(tg.fileira('A'), tg.fileira('C1')),
    'layout', jsonb_build_object('versao', 1, 'palco', null, 'blocos', jsonb_build_array(tg.bloco('b1', 'A', 4), tg.bloco('b2', 'C1', 4, '{"forma": "camarote", "inteiro": true, "colunas": 2}', 20))))
$$;
create function tg.item42() returns jsonb language sql immutable as $$
  select jsonb_build_object('setor', tg.id('42')::text, 'corredor', true, 'fileiras', jsonb_build_array(tg.fileira('A')),
    'layout', jsonb_build_object('versao', 1, 'palco', null, 'blocos', jsonb_build_array(tg.bloco('b3', 'A', 4, null, 40))))
$$;
create function tg.planta(setores text[]) returns jsonb language sql stable as $$
  select jsonb_build_object('versao', 1, 'palco', jsonb_build_object('x', 0, 'y', -2.5, 'largura', 8, 'altura', 1.6, 'rotulo', 'Palco'), 'setores', (
    select jsonb_agg(case when s = '43' then jsonb_build_object('setor', tg.id(s), 'x', 0, 'y', 12, 'cor', '#2E8932', 'area', jsonb_build_object('largura', 20, 'altura', 6)) else jsonb_build_object('setor', tg.id(s), 'x', 0, 'y', 0, 'cor', '#6450D2') end order by i)
    from unnest(setores) with ordinality as t(s, i)))
$$;
create function tg.sala() returns uuid language sql stable as $$ select sala_id from public.ticketeria_setores where id = tg.id('41') $$;
create function tg.salvar(itens jsonb, planta jsonb) returns text language sql as $$
  select format($t$select public.fn_ticketeria_salvar_desenho_da_sala(%L, %L::jsonb, %L::jsonb)$t$, tg.sala(), itens, planta)
$$;

-- Os setores: 41, 42 e 43 na sala padrão; 44 numa segunda sala do mesmo local.
insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares, arquivado) values
  (tg.id('42'), tg.id('a0'), tg.id('51'), 'Balcão', 100, false), (tg.id('43'), tg.id('a0'), tg.id('51'), 'Pista', 800, false);
insert into public.ticketeria_salas (id, organization_id, local_id, nome, ordem) values (tg.id('91'), tg.id('a0'), tg.id('51'), 'Sala 2', 1);
insert into public.ticketeria_setores (id, organization_id, local_id, sala_id, nome, lugares, arquivado) values (tg.id('44'), tg.id('a0'), tg.id('51'), tg.id('91'), 'Outra', 50, false);

select tg.como('a1');

-- Tudo de uma vez: dois setores com blocos, uma pista e a planta.
select is(tg.tenta(tg.salvar(jsonb_build_array(tg.item41(), tg.item42()), tg.planta(array['43', '41', '42']))), 'aceito', 'o desenho com dois setores, uma pista e a planta é aceito');
select is((public.fn_ticketeria_salvar_desenho_da_sala(tg.sala(), jsonb_build_array(tg.item41(), tg.item42()), tg.planta(array['43', '41', '42']))), '{"setores": 2, "planta": true}'::jsonb, 'e devolve quantos setores e se há planta');
select is((select count(*)::int from public.ticketeria_assentos where setor_id = tg.id('41')), 8, 'a Plateia ficou com 8 lugares (a fileira A e o camarote C1)');
select is((select count(*)::int from public.ticketeria_assentos where setor_id = tg.id('42')), 4, 'o Balcão ficou com 4 lugares');
select ok((select numerado from public.ticketeria_setores where id = tg.id('41')) and (select numerado from public.ticketeria_setores where id = tg.id('42')) and not (select numerado from public.ticketeria_setores where id = tg.id('43')), 'os setores com blocos viram numerados; a pista não');
select is((select jsonb_array_length(layout -> 'blocos') from public.ticketeria_setores where id = tg.id('41')), 2, 'a Plateia guarda os seus dois blocos');
select is((select planta from public.ticketeria_salas where id = tg.sala()), tg.planta(array['43', '41', '42']), 'a sala guarda a planta como veio');
select is((select jsonb_agg(fileira order by fileira) from (select distinct fileira from public.ticketeria_assentos where setor_id = tg.id('41') and venda_em_grupo) x), '["C1"]'::jsonb, 'o camarote que vende inteiro ficou marcado (o gatilho do layout)');

-- Tudo ou nada.
select is(tg.tenta(tg.salvar(jsonb_build_array(jsonb_set(tg.item41(), '{fileiras}', jsonb_build_array(tg.fileira('A'), tg.fileira('C1'), tg.fileira('Z'))), jsonb_set(tg.item42(), '{layout,blocos,0,fileiras,0,lugares}', '9')), tg.planta(array['41', '42']))), '23514 layout_inconsistente', 'o segundo setor não bate com o layout dele: recusado');
select is((select count(*)::int from public.ticketeria_assentos where setor_id = tg.id('41')), 8, 'e o primeiro setor, que era válido, não mudou (nada vale pela metade)');
select is((select planta from public.ticketeria_salas where id = tg.sala()), tg.planta(array['43', '41', '42']), 'nem a planta');

-- Recusas.
select is(tg.tenta(tg.salvar(jsonb_build_array(jsonb_set(tg.item42(), '{setor}', to_jsonb(tg.id('44')::text))), tg.planta(array['41']))), '23514 setor_de_outra_sala', 'um setor de outra sala não entra');
select is(tg.tenta(tg.salvar('[]'::jsonb, tg.planta(array['41', '44']))), '23514 planta_invalida', 'a planta com um setor de outra sala é recusada');
select is(tg.tenta(tg.salvar('[]'::jsonb, '{"versao": 1, "setores": []}'::jsonb)), '23514 planta_invalida', 'a planta fora do formato é recusada');
select is(tg.tenta(tg.salvar('{"setor": "x"}'::jsonb, null)), '23514 desenho_invalido', 'a lista de setores tem de ser uma lista');
select is(tg.tenta(tg.salvar(jsonb_build_array('{"setor": "não é um id", "fileiras": []}'::jsonb), null)), '23514 desenho_invalido', 'o id do setor tem de ser um id');
select is(tg.tenta(format($t$select public.fn_ticketeria_salvar_desenho_da_sala(%L, '[]'::jsonb, null)$t$, tg.id('99'))), '23514 sala_nao_encontrada', 'sala que não existe');

-- Só planta, e tirar a planta.
select is(tg.tenta(tg.salvar('[]'::jsonb, tg.planta(array['43']))), 'aceito', 'dá para salvar só a planta, sem setores com blocos');
select is((public.fn_ticketeria_salvar_desenho_da_sala(tg.sala(), '[]'::jsonb, null)), '{"setores": 0, "planta": false}'::jsonb, 'planta nula tira o mapa da sala');
select is((select planta from public.ticketeria_salas where id = tg.sala()), null, 'e a sala fica sem planta');

-- Quem é de outra organização não salva.
select tg.volta();
select tg.como('b1');
select isnt(tg.tenta(tg.salvar(jsonb_build_array(tg.item41()), tg.planta(array['41']))), 'aceito', 'o administrador de outra organização não salva nesta sala');
select tg.volta();

-- Quem executa.
select ok(has_function_privilege('authenticated', 'public.fn_ticketeria_salvar_desenho_da_sala(uuid, jsonb, jsonb)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_salvar_desenho_da_sala(uuid, jsonb, jsonb)', 'execute'), 'logado sim, visitante não');

select * from finish();
rollback;
