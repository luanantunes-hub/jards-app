-- Preço dinâmico por adesão da Ticketeria (plano, seção 11, fase P2a): ticketeria_preco_dinamico (a regra do evento), ticketeria_preco_dinamico_estado (o fator de cada sessão),
-- ticketeria_preco_dinamico_historico, fn_ticketeria_preco_dinamico_definir e _registrar (só o servidor) e fn_ticketeria_preco_do_lote com o fator.
--
-- Sem adesão ativa o fator é ignorado (o preço é o de antes); com adesão ativa, o preço é o da sessão (ou do lote) vezes o fator, a meia vale a metade do preço que vale da inteira e gratuito segue em zero;
-- a reserva cobra pelo preço que vale e guarda o base; desligar volta todos os fatores a 10000; o aceite é obrigatório; cada recusa; o histórico; quem vê e quem escreve (ninguém pelo navegador).
-- Ids 0d7c0000-0000-4000-8000-0000000000XX, ou pd.id('XX'). Desfeito no fim.
--   A (a0): loja 61; local 51 (setor 41 Plateia, 200 lugares, e setor 42 Camarote, 50); eventos 71 e 72 publicados; sessões 81 e 82 (do 71) e 85 (do 72), daqui a alguns dias. Ingressos do 71: 31 Inteira (lote 21: R$ 60,00, 50 lugares),
--   34 Meia (ligada à 31: o lote espelho nasce a R$ 30,00), 33 Gratuito (lote 23) e 35 Camarote (setor 42; lote 25: R$ 90,00). O fator é por sessão E setor. a1 admin, a2 leitor.   B (b0): b1 admin, sem nada.
-- Rodar: supabase/tests/README.md, com as migrations do preço por sessão e do preço dinâmico na frente se não estiverem aplicadas.
-- A seção "Apagar" usa DELETE (desfeito no fim): rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

create schema pd;
grant usage on schema pd to authenticated, anon;

create function pd.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7c0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

create table pd.pedidos (nome text primary key, resposta jsonb);
grant select on pd.pedidos to authenticated, anon;

create function pd.reservar(nome text, sessao text, itens jsonb) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  r := public.fn_ticketeria_reservar(pd.id(sessao), itens, 'Rita Teste', 'rita@teste.invalid', 15);
  insert into pd.pedidos values (nome, r);
  return r;
end;
$$;

create function pd.itens(nome text) returns text language sql as $$
  select string_agg(it.preco_centavos || '/' || coalesce(it.preco_base_centavos::text, '-') || 'x' || it.quantidade, ',' order by it.created_at, it.id)
  from public.ticketeria_pedido_itens it join pd.pedidos p on p.resposta ->> 'pedido_id' = it.pedido_id::text where p.nome = itens.nome;
$$;

create function pd.historico(sessao text, setor text) returns text language sql as $$
  select string_agg(h.fator_anterior_bps || '>' || h.fator_novo_bps || ' ' || h.direcao, ', ' order by h.quando, h.id)
  from public.ticketeria_preco_dinamico_historico h where h.sessao_id = pd.id(sessao) and h.setor_id = pd.id(setor);
$$;

create function pd.preco(lote uuid, sessao text) returns integer language sql as $$ select public.fn_ticketeria_preco_do_lote(lote, pd.id(sessao)); $$;
create function pd.meia() returns uuid language sql as $$ select id from public.ticketeria_lotes where espelho_de = pd.id('21'); $$;

create function pd.tenta(comando text) returns text language plpgsql as $$
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

create function pd.efeito(comando text) returns text language plpgsql as $$
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

create function pd.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', pd.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function pd.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select pd.id(s), 'pd-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'b1']) as s;
  insert into public.organizations (id, nome) values (pd.id('a0'), 'PD A'), (pd.id('b0'), 'PD B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (pd.id('a0'), 'ticketeria', 'cortesia', 20), (pd.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select pd.id(o), pd.id(p), papel, '{ticketeria}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (pd.id('61'), pd.id('a0'), 'Loja A');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (pd.id('51'), pd.id('a0'), pd.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (pd.id('41'), pd.id('a0'), pd.id('51'), 'Plateia', 200), (pd.id('42'), pd.id('a0'), pd.id('51'), 'Camarote', 50);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values
    (pd.id('71'), pd.id('a0'), pd.id('61'), 'Hamlet', 'publicado'), (pd.id('72'), pd.id('a0'), pd.id('61'), 'Macbeth', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio, cancelada_em) values
    (pd.id('81'), pd.id('a0'), pd.id('71'), pd.id('51'), now() + interval '10 days', null),
    (pd.id('82'), pd.id('a0'), pd.id('71'), pd.id('51'), now() + interval '11 days', null),
    (pd.id('85'), pd.id('a0'), pd.id('72'), pd.id('51'), now() + interval '12 days', null);
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria, publico) values
    (pd.id('31'), pd.id('a0'), pd.id('71'), pd.id('41'), 'Inteira', 'inteira', true),
    (pd.id('33'), pd.id('a0'), pd.id('71'), pd.id('41'), 'Gratuito', 'gratuito', true),
    (pd.id('35'), pd.id('a0'), pd.id('71'), pd.id('42'), 'Camarote', 'inteira', true);
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values
    (pd.id('21'), pd.id('a0'), pd.id('31'), '1º lote', 0, 6000, 50),
    (pd.id('23'), pd.id('a0'), pd.id('33'), 'Retirada', 0, 0, 10),
    (pd.id('25'), pd.id('a0'), pd.id('35'), 'Lote único', 0, 9000, 20);
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria, publico, meia_de) values
    (pd.id('34'), pd.id('a0'), pd.id('71'), pd.id('41'), 'Meia-entrada', 'meia', true, pd.id('31'));
end
$dados$;

-- ─── Sem adesão, o fator não conta ──────────────────────────────────────────

select is(pd.preco(pd.id('21'), '82'), 6000, 'sem nada, a inteira vale o preço do lote (R$ 60,00)');
select lives_ok($q$select public.fn_ticketeria_preco_dinamico_registrar('0d7c0000-0000-4000-8000-000000000082', '0d7c0000-0000-4000-8000-000000000041', 11000, 'subir', 'teste')$q$, 'o servidor registra o fator 11000 na sessão 82, setor Plateia');
select is(pd.preco(pd.id('21'), '82') || '/' || pd.preco(pd.meia(), '82'), '6000/3000', 'mas sem adesão ativa o fator é ignorado: o preço e a meia seguem como antes');

-- ─── Com adesão ativa ───────────────────────────────────────────────────────

select is((public.fn_ticketeria_preco_dinamico_definir(pd.id('71'), true, -2000, 3000, 1000, 360, 'rascunho-1', pd.id('a1')) ->> 'ativo')::boolean, true, 'o servidor liga a adesão do evento 71, com o aceite');
select is((select aceite_por = pd.id('a1') and aceite_versao = 'rascunho-1' and aceite_em is not null from public.ticketeria_preco_dinamico where evento_id = pd.id('71')), true, 'o aceite guarda quem aceitou, a versão do texto e quando');
select is(pd.preco(pd.id('21'), '82') || '/' || pd.preco(pd.id('21'), '81'), '6600/6000', 'a sessão 82 (fator 110%) cobra R$ 66,00; a 81, sem fator, segue em R$ 60,00');
select is(pd.preco(pd.meia(), '82'), 3300, 'a meia vale a metade do preço que vale da inteira (R$ 33,00)');
select is(pd.preco(pd.id('23'), '82'), 0, 'o gratuito segue em zero');
select is(pd.preco(pd.id('25'), '82'), 9000, 'o Camarote (outro setor) segue em R$ 90,00: o fator da Plateia não é dele');
select lives_ok($q$select public.fn_ticketeria_preco_dinamico_registrar('0d7c0000-0000-4000-8000-000000000082', '0d7c0000-0000-4000-8000-000000000042', 12000, 'subir', 'camarote')$q$, 'o servidor registra o fator 12000 só do Camarote na sessão 82');
select is(pd.preco(pd.id('25'), '82') || '/' || pd.preco(pd.id('21'), '82'), '10800/6600', 'cada setor tem o seu fator: o Camarote a R$ 108,00 e a Plateia a R$ 66,00');
select is((select pd.reservar('p1', '82', jsonb_build_array(jsonb_build_object('ingresso_id', pd.id('31'), 'quantidade', 1))) ->> 'pedido_id') is not null, true, 'a reserva na sessão 82');
select is(pd.itens('p1'), '6600/6000x1', 'o item cobra o preço com o fator (R$ 66,00) e guarda o preço-base (R$ 60,00)');

insert into public.ticketeria_precos_da_sessao (organization_id, sessao_id, lote_id, preco_centavos) values (pd.id('a0'), pd.id('82'), pd.id('21'), 8000);
select is(pd.preco(pd.id('21'), '82') || '/' || pd.preco(pd.meia(), '82'), '8800/4400', 'com preço próprio da sessão (R$ 80,00), o fator vale sobre ele (R$ 88,00) e a meia é a metade (R$ 44,00)');
delete from public.ticketeria_precos_da_sessao where sessao_id = pd.id('82');

select lives_ok($q$select public.fn_ticketeria_preco_dinamico_registrar('0d7c0000-0000-4000-8000-000000000082', '0d7c0000-0000-4000-8000-000000000041', 11000, 'manter', 'mesmo fator')$q$, 'registrar o mesmo fator de novo');
select lives_ok($q$select public.fn_ticketeria_preco_dinamico_registrar('0d7c0000-0000-4000-8000-000000000082', '0d7c0000-0000-4000-8000-000000000041', 12000, 'subir', 'segundo passo')$q$, 'e o fator 12000');
select is(pd.preco(pd.id('21'), '82'), 7200, 'o preço acompanha o novo fator (R$ 72,00)');
select is(pd.historico('82', '41'), '10000>11000 subir, 11000>12000 subir', 'o histórico da Plateia guarda só o que mudou (o mesmo fator de novo não cria linha)');

-- ─── Desligar volta ao preço-base ───────────────────────────────────────────

select is((public.fn_ticketeria_preco_dinamico_definir(pd.id('71'), false, -2000, 3000, 1000, 360, null, null) ->> 'ativo')::boolean, false, 'o servidor desliga a adesão');
select is(pd.preco(pd.id('21'), '82') || '/' || pd.preco(pd.meia(), '82') || '/' || pd.preco(pd.id('25'), '82'), '6000/3000/9000', 'desligada, o preço volta ao base em todos os setores (R$ 60,00, R$ 30,00 e R$ 90,00)');
select is((select fator_bps || ' ' || direcao from public.ticketeria_preco_dinamico_estado where sessao_id = pd.id('82') and setor_id = pd.id('41')) || ' | ' || pd.historico('82', '41') || ' | ' || pd.historico('82', '42'),
          '10000 desativado | 10000>11000 subir, 11000>12000 subir, 12000>10000 desativado | 10000>12000 subir, 12000>10000 desativado', 'o fator de cada setor voltou a 10000, e o histórico guarda a saída de cada um');

-- ─── O que não combina ──────────────────────────────────────────────────────

select is(array[
            pd.tenta(format('insert into public.ticketeria_preco_dinamico (organization_id, evento_id, ativo) values (%L, %L, true)', pd.id('a0'), pd.id('72'))),
            pd.tenta(format('insert into public.ticketeria_preco_dinamico (organization_id, evento_id, piso_bps) values (%L, %L, 500)', pd.id('a0'), pd.id('72'))),
            pd.tenta(format('insert into public.ticketeria_preco_dinamico (organization_id, evento_id, passo_bps) values (%L, %L, 50)', pd.id('a0'), pd.id('72'))),
            pd.tenta(format('insert into public.ticketeria_preco_dinamico (organization_id, evento_id, intervalo_minutos) values (%L, %L, 10)', pd.id('a0'), pd.id('72'))),
            pd.tenta(format('insert into public.ticketeria_preco_dinamico (organization_id, evento_id) values (%L, %L)', pd.id('b0'), pd.id('72'))),
            pd.tenta(format('insert into public.ticketeria_preco_dinamico_estado (organization_id, sessao_id, setor_id, fator_bps) values (%L, %L, %L, 500)', pd.id('a0'), pd.id('85'), pd.id('41'))),
            pd.tenta(format('select public.fn_ticketeria_preco_dinamico_definir(%L, true, -2000, 3000, 1000, 360, null, %L)', pd.id('72'), pd.id('a1'))),
            pd.tenta(format('select public.fn_ticketeria_preco_dinamico_definir(%L, true, -2000, 3000, 1000, 360, %L, %L)', pd.id('0'), 'v1', pd.id('a1'))),
            pd.tenta(format('select public.fn_ticketeria_preco_dinamico_registrar(%L, %L, 11000, %L, %L)', pd.id('82'), pd.id('0'), 'subir', 'x'))],
          array['23514 ticketeria_preco_dinamico_aceite_check', '23514 ticketeria_preco_dinamico_piso_check', '23514 ticketeria_preco_dinamico_passo_check', '23514 ticketeria_preco_dinamico_intervalo_check',
                '23514 preco_dinamico_de_outra_organizacao', '23514 ticketeria_preco_dinamico_estado_fator_check', '23514 aceite_obrigatorio', '23514 evento_nao_encontrado', '23514 setor_nao_encontrado'],
          'ativar exige o aceite; piso acima de zero, passo e intervalo fora dos limites, outra organização, fator fora da faixa; sem aceite, evento e setor inexistentes pela função');

-- ─── Quem vê e quem escreve ─────────────────────────────────────────────────

select pd.como('a2');
select is((select count(*)::text from public.ticketeria_preco_dinamico) || '/' || (select count(*)::text from public.ticketeria_preco_dinamico_estado) || '/' || (select count(*)::text from public.ticketeria_preco_dinamico_historico),
          '1/2/5', 'o leitor vê a regra, os fatores e o histórico (1 regra, 2 fatores, 5 mudanças)');
select is(pd.efeito(format('insert into public.ticketeria_preco_dinamico (organization_id, evento_id) values (%L, %L)', pd.id('a0'), pd.id('72'))) || '|'
          || pd.efeito(format('update public.ticketeria_preco_dinamico set ativo = false where evento_id = %L', pd.id('71'))) || '|'
          || pd.efeito(format('update public.ticketeria_preco_dinamico_estado set fator_bps = 12000 where sessao_id = %L', pd.id('82'))) || '|'
          || pd.efeito(format('delete from public.ticketeria_preco_dinamico_historico where sessao_id = %L', pd.id('82'))),
          '|||', 'ninguém escreve pelo navegador: nem regra, nem fator, nem histórico');
select pd.como('a1');
select is(pd.efeito(format('select public.fn_ticketeria_preco_dinamico_definir(%L, true, -2000, 3000, 1000, 360, %L, %L)', pd.id('71'), 'v1', pd.id('a1'))) || '|'
          || pd.efeito(format('select public.fn_ticketeria_preco_dinamico_registrar(%L, %L, 12000, %L, %L)', pd.id('82'), pd.id('41'), 'subir', 'x')), '|',
          'nem o administrador chama as funções (só o servidor)');
select pd.como('b1');
select is((select count(*)::text from public.ticketeria_preco_dinamico) || '/' || (select count(*)::text from public.ticketeria_preco_dinamico_estado) || '/' || (select count(*)::text from public.ticketeria_preco_dinamico_historico),
          '0/0/0', 'outra organização não vê nada');
select pd.como(null);
select is(pd.efeito('select 1 from public.ticketeria_preco_dinamico') || '/' || pd.efeito('select 1 from public.ticketeria_preco_dinamico_estado'), '/', 'visitante não vê');
select pd.volta();

select * from finish();
rollback;
