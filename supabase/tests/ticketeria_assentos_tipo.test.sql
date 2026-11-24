-- Ticketeria: o tipo de cada lugar do mapa (ticketeria_assentos.tipo, fn_ticketeria_salvar_mapa, fn_ticketeria_mapa_do_setor, fn_ticketeria_mapa_da_sessao).
-- O tipo é só uma marca (cadeira de rodas, acompanhante, mobilidade reduzida, pessoa obesa): lugar sem tipo é comum; o editor de antes (que não manda `tipo`) não apaga o que está gravado;
-- tipo fora dos cinco é mapa inválido; o mapa do setor e o do comprador trazem o tipo só quando não é comum (o JSON de quem não tem tipo é o de antes).
-- Ids 0d800000-0000-4000-8000-0000000000XX, ou tt.id('XX'). A (a0): administrador a1, loja 61, local 51, evento 71 (publicado), sessão 81 (daqui a 10 dias), setor 41 (Plateia), ingresso 31 (Inteira, no setor 41, 3 vagas).
-- Rodar: com as migrations anteriores da Ticketeria na frente e a ticketeria_assentos_tipo, se ainda não estiverem aplicadas. Tudo roda numa transação que termina em rollback.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

create schema tt;
grant usage on schema tt to authenticated, anon;

create function tt.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d800000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select tt.id(s), 'tt-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1']) as s;
  insert into public.organizations (id, nome) values (tt.id('a0'), 'TT A');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values (tt.id('a0'), 'ticketeria', 'cortesia', 20);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso) values (tt.id('a0'), tt.id('a1'), 'admin', '{ticketeria}'::text[]);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (tt.id('61'), tt.id('a0'), 'Loja A');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (tt.id('51'), tt.id('a0'), tt.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares, arquivado) values (tt.id('41'), tt.id('a0'), tt.id('51'), 'Plateia', 100, false);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values (tt.id('71'), tt.id('a0'), tt.id('61'), 'Hamlet', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio) values (tt.id('81'), tt.id('a0'), tt.id('71'), tt.id('51'), now() + interval '10 days');
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria) values (tt.id('31'), tt.id('a0'), tt.id('71'), tt.id('41'), 'Inteira', 'inteira');
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values (tt.id('21'), tt.id('a0'), tt.id('31'), '1º lote', 0, 6000, 3);
  delete from public.ticketeria_taxas;
end
$dados$;

create function tt.tenta(comando text) returns text language plpgsql as $$
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

create function tt.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', tt.id(sufixo), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  return 'como ' || sufixo;
end;
$$;

create function tt.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

-- O mapa: A com 4 lugares e B com 2. `tipos` é um mapa 'A1' => 'cadeira_rodas'; o lugar que não está nele não manda `tipo`.
create function tt.mapa(tipos jsonb default '{}', bloqueados text[] default '{}') returns jsonb language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('nome', 'A', 'assentos', (select jsonb_agg(jsonb_build_object('numero', n, 'bloqueado', ('A' || n) = any(bloqueados)) || coalesce(jsonb_build_object('tipo', tipos -> ('A' || n)), '{}'::jsonb) order by n)
      from generate_series(1, 4) n)),
    jsonb_build_object('nome', 'B', 'assentos', (select jsonb_agg(jsonb_build_object('numero', n, 'bloqueado', ('B' || n) = any(bloqueados)) || coalesce(jsonb_build_object('tipo', tipos -> ('B' || n)), '{}'::jsonb) order by n)
      from generate_series(1, 2) n)))
$$;

create function tt.tipos() returns text language sql stable as $$
  select coalesce(string_agg(fileira || numero || '=' || tipo, ' ' order by fileira, numero), '') from public.ticketeria_assentos where setor_id = tt.id('41') and tipo <> 'comum';
$$;

select tt.como('a1');

-- Sem tipo nenhum: tudo comum, e o JSON do mapa é o de antes.
select is((public.fn_ticketeria_salvar_mapa(tt.id('41'), tt.mapa(), true)), '{"lugares": 6, "fileiras": 2, "bloqueados": 0}'::jsonb, 'grava o mapa sem tipo: 2 fileiras, 6 lugares');
select is(tt.tipos(), '', 'sem tipo, todo lugar é comum');
select is((select count(*)::int from public.ticketeria_assentos where setor_id = tt.id('41') and tipo = 'comum'), 6, 'os seis lugares são comuns');
select is((public.fn_ticketeria_mapa_do_setor(tt.id('41')) -> 0 -> 'assentos' -> 0), '{"numero": 1, "bloqueado": false}'::jsonb, 'o mapa do setor, sem tipo, não traz a chave tipo');

-- Com tipos.
select is((public.fn_ticketeria_salvar_mapa(tt.id('41'), tt.mapa('{"A1": "cadeira_rodas", "A2": "obeso", "B1": "acompanhante", "B2": "mobilidade_reduzida"}'::jsonb), true) ->> 'lugares')::int, 6, 'grava o mapa com tipos');
select is(tt.tipos(), 'A1=cadeira_rodas A2=obeso B1=acompanhante B2=mobilidade_reduzida', 'os quatro tipos ficam gravados nos lugares certos');
select is((public.fn_ticketeria_mapa_do_setor(tt.id('41')) -> 0 -> 'assentos' -> 0), '{"numero": 1, "bloqueado": false, "tipo": "cadeira_rodas"}'::jsonb, 'o mapa do setor traz o tipo do lugar que não é comum');
select is((public.fn_ticketeria_mapa_do_setor(tt.id('41')) -> 0 -> 'assentos' -> 2), '{"numero": 3, "bloqueado": false}'::jsonb, 'e não traz nada no que é comum');

-- O editor de antes não manda `tipo`: nada se apaga.
select is((public.fn_ticketeria_salvar_mapa(tt.id('41'), tt.mapa('{}'::jsonb, array['A4']), true) ->> 'bloqueados')::int, 1, 'salvar sem mandar tipo (bloqueando o A4) funciona');
select is(tt.tipos(), 'A1=cadeira_rodas A2=obeso B1=acompanhante B2=mobilidade_reduzida', 'quem não manda tipo não apaga o tipo gravado');

-- Voltar a comum e trocar de tipo se faz dizendo.
select public.fn_ticketeria_salvar_mapa(tt.id('41'), tt.mapa('{"A1": "comum", "A2": "mobilidade_reduzida"}'::jsonb), true);
select is(tt.tipos(), 'A2=mobilidade_reduzida B1=acompanhante B2=mobilidade_reduzida', '"comum" tira o tipo e um tipo novo troca o anterior');

-- Tipo fora dos cinco, ou de formato errado: mapa inválido (e nada muda).
select is(tt.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, tt.mapa('{"A1": "vip"}'::jsonb))$t$, tt.id('41'))), '23514 mapa_invalido', 'tipo "vip" não existe');
select is(tt.tenta(format($t$select public.fn_ticketeria_salvar_mapa(%L, tt.mapa('{"A1": 7}'::jsonb))$t$, tt.id('41'))), '23514 mapa_invalido', 'tipo que não é texto');
select is(tt.tipos(), 'A2=mobilidade_reduzida B1=acompanhante B2=mobilidade_reduzida', 'o mapa recusado não mudou nada');
select is(tt.tenta(format($t$update public.ticketeria_assentos set tipo = 'vip' where setor_id = %L and fileira = 'A' and numero = 1$t$, tt.id('41'))), '23514 ticketeria_assentos_tipo_check', 'e a coluna tem a sua própria trava no banco');

-- O mapa do comprador (a função do servidor) traz o tipo, e o lugar bloqueado continua "ocupado", com o tipo.
select tt.volta();
select public.fn_ticketeria_salvar_mapa(tt.id('41'), tt.mapa('{"A1": "cadeira_rodas", "A4": "mobilidade_reduzida"}'::jsonb, array['A4']), true);
select is((public.fn_ticketeria_mapa_da_sessao(tt.id('81'), tt.id('31')) -> 'fileiras' -> 0 -> 'assentos' -> 0), '{"numero": 1, "estado": "livre", "tipo": "cadeira_rodas"}'::jsonb, 'o mapa do comprador traz o tipo do lugar de acessibilidade');
select is((public.fn_ticketeria_mapa_da_sessao(tt.id('81'), tt.id('31')) -> 'fileiras' -> 0 -> 'assentos' -> 2), '{"numero": 3, "estado": "livre"}'::jsonb, 'e nada no lugar comum');
select is((public.fn_ticketeria_mapa_da_sessao(tt.id('81'), tt.id('31')) -> 'fileiras' -> 0 -> 'assentos' -> 3), '{"numero": 4, "estado": "ocupado", "tipo": "mobilidade_reduzida"}'::jsonb, 'o lugar bloqueado aparece como ocupado e mantém o tipo');

-- Quem executa continua o mesmo.
select ok(has_function_privilege('authenticated', 'public.fn_ticketeria_salvar_mapa(uuid, jsonb, boolean)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_salvar_mapa(uuid, jsonb, boolean)', 'execute'), 'salvar o mapa: o logado executa, o visitante não');
select ok(not has_function_privilege('authenticated', 'public.fn_ticketeria_mapa_da_sessao(uuid, uuid)', 'execute') and not has_function_privilege('anon', 'public.fn_ticketeria_mapa_da_sessao(uuid, uuid)', 'execute') and has_function_privilege('service_role', 'public.fn_ticketeria_mapa_da_sessao(uuid, uuid)', 'execute'), 'o mapa do comprador segue só do servidor');

select * from finish();
rollback;
