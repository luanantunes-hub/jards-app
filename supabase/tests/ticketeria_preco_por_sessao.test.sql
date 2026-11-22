-- Preço por sessão da Ticketeria (plano, seção 11, fase P0): ticketeria_precos_da_sessao, ticketeria_precos_historico,
-- ticketeria_pedido_itens.preco_base_centavos, fn_ticketeria_preco_do_lote e fn_ticketeria_reservar (a mesma função, com o preço que vale).
--
-- Sem preço da sessão vale o do lote; com preço próprio, a sessão cobra o dela e as outras seguem como estavam; a meia vale a metade da inteira da
-- sessão; cada recusa (meia sem preço próprio, lote de outro evento, preço que não combina com a categoria, duplicado, outra organização, mudar de
-- lugar); o histórico (de quanto para quanto, e quem); quem vê e quem grava. Ids 0d7b0000-0000-4000-8000-0000000000XX, ou pp.id('XX'). Desfeito no fim.
--   A (a0): loja 61; local 51 (setor 41, 200 lugares); eventos 71 e 72 publicados; sessões 81 e 82 do evento 71 e 85 do 72 (todas daqui a alguns dias).
--   Ingressos do 71: 31 Inteira (lote 21: R$ 60,00, 50 lugares), 34 Meia (ligada à 31: o lote espelho nasce a R$ 30,00) e 33 Gratuito (lote 23). Do 72: 36
--   Inteira (lote 27). a1 admin, a2 leitor.   B (b0): b1 admin, sem nada.
-- Rodar: supabase/tests/README.md, com a migration 20261128100000_ticketeria_preco_por_sessao.sql na frente se não estiver aplicada.
-- A seção "Apagar" usa DELETE (desfeito no fim): rode pela CLI (`supabase db query --linked -f bloco.sql`).

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

create schema pp;
grant usage on schema pp to authenticated, anon;

create function pp.id(sufixo text) returns uuid language sql immutable as $$
  select ('0d7b0000-0000-4000-8000-' || lpad(sufixo, 12, '0'))::uuid;
$$;

create table pp.pedidos (nome text primary key, resposta jsonb);
grant select on pp.pedidos to authenticated, anon;

create function pp.reservar(nome text, sessao text, itens jsonb) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  r := public.fn_ticketeria_reservar(pp.id(sessao), itens, 'Rita Teste', 'rita@teste.invalid', 15);
  insert into pp.pedidos values (nome, r);
  return r;
end;
$$;

create function pp.itens(nome text) returns text language sql as $$
  select string_agg(it.preco_centavos || '/' || coalesce(it.preco_base_centavos::text, '-') || 'x' || it.quantidade, ',' order by it.created_at, it.id)
  from public.ticketeria_pedido_itens it join pp.pedidos p on p.resposta ->> 'pedido_id' = it.pedido_id::text where p.nome = itens.nome;
$$;

create function pp.historico(sessao text) returns text language sql as $$
  select string_agg(coalesce(h.preco_anterior_centavos::text, '-') || '>' || coalesce(h.preco_novo_centavos::text, '-'), ',' order by h.quando, h.id)
  from public.ticketeria_precos_historico h where h.sessao_id = pp.id(sessao);
$$;

create function pp.tenta(comando text) returns text language plpgsql as $$
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

create function pp.efeito(comando text) returns text language plpgsql as $$
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

create function pp.como(sufixo text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when sufixo is null then '{"role":"anon"}' else json_build_object('sub', pp.id(sufixo), 'role', 'authenticated')::text end, true);
  perform set_config('role', case when sufixo is null then 'anon' else 'authenticated' end, true);
  return 'como ' || coalesce(sufixo, 'visitante');
end;
$$;

create function pp.volta() returns text language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  return 'volta';
end;
$$;

do $dados$
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select pp.id(s), 'pp-' || s || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now() from unnest(array['a1', 'a2', 'b1']) as s;
  insert into public.organizations (id, nome) values (pp.id('a0'), 'PP A'), (pp.id('b0'), 'PP B');
  insert into public.organization_modulos (organization_id, modulo, status, vagas_cortesia) values
    (pp.id('a0'), 'ticketeria', 'cortesia', 20), (pp.id('b0'), 'ticketeria', 'cortesia', 5);
  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select pp.id(o), pp.id(p), papel, '{ticketeria}'::text[] from (values
    ('a0', 'a1', 'admin'), ('a0', 'a2', 'leitor'), ('b0', 'b1', 'admin')) as v(o, p, papel);
  insert into public.ticketeria_lojas (id, organization_id, nome) values (pp.id('61'), pp.id('a0'), 'Loja A');
  insert into public.ticketeria_locais (id, organization_id, loja_id, nome) values (pp.id('51'), pp.id('a0'), pp.id('61'), 'Teatro A');
  insert into public.ticketeria_setores (id, organization_id, local_id, nome, lugares) values (pp.id('41'), pp.id('a0'), pp.id('51'), 'Plateia', 200);
  insert into public.ticketeria_eventos (id, organization_id, loja_id, titulo, situacao) values
    (pp.id('71'), pp.id('a0'), pp.id('61'), 'Hamlet', 'publicado'), (pp.id('72'), pp.id('a0'), pp.id('61'), 'Macbeth', 'publicado');
  insert into public.ticketeria_sessoes (id, organization_id, evento_id, local_id, inicio, cancelada_em) values
    (pp.id('81'), pp.id('a0'), pp.id('71'), pp.id('51'), now() + interval '10 days', null),
    (pp.id('82'), pp.id('a0'), pp.id('71'), pp.id('51'), now() + interval '11 days', null),
    (pp.id('85'), pp.id('a0'), pp.id('72'), pp.id('51'), now() + interval '12 days', null);
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria, publico) values
    (pp.id('31'), pp.id('a0'), pp.id('71'), pp.id('41'), 'Inteira', 'inteira', true),
    (pp.id('33'), pp.id('a0'), pp.id('71'), pp.id('41'), 'Gratuito', 'gratuito', true),
    (pp.id('36'), pp.id('a0'), pp.id('72'), pp.id('41'), 'Inteira', 'inteira', true);
  insert into public.ticketeria_lotes (id, organization_id, ingresso_id, nome, ordem, preco_centavos, quantidade) values
    (pp.id('21'), pp.id('a0'), pp.id('31'), '1º lote', 0, 6000, 50),
    (pp.id('23'), pp.id('a0'), pp.id('33'), 'Retirada', 0, 0, 10),
    (pp.id('27'), pp.id('a0'), pp.id('36'), '1º lote', 0, 6000, 50);
  -- A meia, ligada à inteira: o lote dela nasce espelhado (R$ 30,00).
  insert into public.ticketeria_ingressos (id, organization_id, evento_id, setor_id, nome, categoria, publico, meia_de) values
    (pp.id('34'), pp.id('a0'), pp.id('71'), pp.id('41'), 'Meia-entrada', 'meia', true, pp.id('31'));
end
$dados$;

-- ─── Sem preço da sessão, vale o do lote ────────────────────────────────────

select is(public.fn_ticketeria_preco_do_lote(pp.id('21'), pp.id('81')), 6000, 'sem preço próprio da sessão, a inteira vale o do lote (R$ 60,00)');
select is(public.fn_ticketeria_preco_do_lote((select id from public.ticketeria_lotes where espelho_de = pp.id('21')), pp.id('81')), 3000, 'e a meia, o do lote espelho (R$ 30,00)');
select is((select pp.reservar('p1', '81', jsonb_build_array(jsonb_build_object('ingresso_id', pp.id('31'), 'quantidade', 2))) ->> 'pedido_id') is not null, true, 'a reserva sem preço da sessão funciona como antes');
select is(pp.itens('p1'), '6000/6000x2', 'o item saiu a R$ 60,00 e o preço-base gravado é o mesmo');

-- ─── Preço próprio da sessão ────────────────────────────────────────────────

insert into public.ticketeria_precos_da_sessao (organization_id, sessao_id, lote_id, preco_centavos) values (pp.id('a0'), pp.id('82'), pp.id('21'), 8000);
select is(public.fn_ticketeria_preco_do_lote(pp.id('21'), pp.id('82')) || '/' || public.fn_ticketeria_preco_do_lote(pp.id('21'), pp.id('81')), '8000/6000', 'a sessão 82 cobra R$ 80,00; a 81 segue em R$ 60,00');
select is(public.fn_ticketeria_preco_do_lote((select id from public.ticketeria_lotes where espelho_de = pp.id('21')), pp.id('82')) || '/'
          || public.fn_ticketeria_preco_do_lote((select id from public.ticketeria_lotes where espelho_de = pp.id('21')), pp.id('81')), '4000/3000', 'a meia vale a metade da inteira da sessão (R$ 40,00 na 82; R$ 30,00 na 81)');
select is((select pp.reservar('p2', '82', jsonb_build_array(jsonb_build_object('ingresso_id', pp.id('31'), 'quantidade', 1))) ->> 'pedido_id') is not null, true, 'a reserva na sessão 82');
select is(pp.itens('p2'), '8000/6000x1', 'o item cobra o preço da sessão (R$ 80,00) e guarda o preço-base do lote (R$ 60,00)');
select is((select pp.reservar('p3', '82', jsonb_build_array(jsonb_build_object('ingresso_id', pp.id('34'), 'quantidade', 1))) ->> 'pedido_id') is not null, true, 'a meia reserva na sessão 82');
select is(pp.itens('p3'), '4000/3000x1', 'a meia cobra a metade do preço da sessão (R$ 40,00) e guarda o base (R$ 30,00)');

-- ─── O que não combina ──────────────────────────────────────────────────────

select is(array[
            pp.tenta(format('insert into public.ticketeria_precos_da_sessao (organization_id, sessao_id, lote_id, preco_centavos) values (%L, %L, %L, 3500)', pp.id('a0'), pp.id('81'), (select id from public.ticketeria_lotes where espelho_de = pp.id('21')))),
            pp.tenta(format('insert into public.ticketeria_precos_da_sessao (organization_id, sessao_id, lote_id, preco_centavos) values (%L, %L, %L, 7000)', pp.id('a0'), pp.id('82'), pp.id('27'))),
            pp.tenta(format('insert into public.ticketeria_precos_da_sessao (organization_id, sessao_id, lote_id, preco_centavos) values (%L, %L, %L, 500)', pp.id('a0'), pp.id('82'), pp.id('23'))),
            pp.tenta(format('insert into public.ticketeria_precos_da_sessao (organization_id, sessao_id, lote_id, preco_centavos) values (%L, %L, %L, 0)', pp.id('a0'), pp.id('81'), pp.id('21'))),
            pp.tenta(format('insert into public.ticketeria_precos_da_sessao (organization_id, sessao_id, lote_id, preco_centavos) values (%L, %L, %L, -1)', pp.id('a0'), pp.id('81'), pp.id('21'))),
            pp.tenta(format('insert into public.ticketeria_precos_da_sessao (organization_id, sessao_id, lote_id, preco_centavos) values (%L, %L, %L, 9000)', pp.id('a0'), pp.id('82'), pp.id('21'))),
            pp.tenta(format('insert into public.ticketeria_precos_da_sessao (organization_id, sessao_id, lote_id, preco_centavos) values (%L, %L, %L, 9000)', pp.id('b0'), pp.id('81'), pp.id('21'))),
            pp.tenta(format('update public.ticketeria_precos_da_sessao set sessao_id = %L where sessao_id = %L and lote_id = %L', pp.id('81'), pp.id('82'), pp.id('21')))],
          array['23514 meia_acompanha_a_inteira', '23514 lote_de_outro_evento', '23514 preco_incoerente', '23514 preco_incoerente', '23514 preco_incoerente',
                '23505 ticketeria_precos_da_sessao_unico', '23514 preco_da_sessao_de_outra_organizacao', '23514 preco_da_sessao_nao_muda_de_lugar'],
          'a meia não tem preço próprio; lote de outro evento não entra; gratuito e pago têm de combinar com o preço (e nunca negativo); um por sessão e lote; é da mesma organização; não muda de lugar');

-- ─── O histórico ────────────────────────────────────────────────────────────

update public.ticketeria_precos_da_sessao set preco_centavos = 9000 where sessao_id = pp.id('82') and lote_id = pp.id('21');
update public.ticketeria_precos_da_sessao set preco_centavos = 9000 where sessao_id = pp.id('82') and lote_id = pp.id('21');
select is(pp.historico('82'), '->8000,8000>9000', 'cada mudança vira uma linha (de quanto, para quanto); gravar o mesmo valor de novo não cria linha');

-- ─── Quem vê e quem grava ───────────────────────────────────────────────────

select pp.como('a1');
insert into public.ticketeria_precos_da_sessao (organization_id, sessao_id, lote_id, preco_centavos) values (pp.id('a0'), pp.id('81'), pp.id('21'), 7000);
select is((select preco_centavos from public.ticketeria_precos_da_sessao where sessao_id = pp.id('81') and lote_id = pp.id('21')), 7000, 'quem edita a Ticketeria grava o preço da sessão, pelas regras de acesso');
select is((select por = pp.id('a1') from public.ticketeria_precos_historico where sessao_id = pp.id('81') order by quando desc limit 1), true, 'e o histórico guarda quem foi');
select pp.como('a2');
select is(pp.efeito(format('insert into public.ticketeria_precos_da_sessao (organization_id, sessao_id, lote_id, preco_centavos) values (%L, %L, %L, 7500)', pp.id('a0'), pp.id('85'), pp.id('27'))), '', 'o leitor não grava preço');
select is((select count(*)::text from public.ticketeria_precos_da_sessao) || '/' || (select count(*)::text from public.ticketeria_precos_historico) || '/'
          || pp.efeito(format('insert into public.ticketeria_precos_historico (organization_id, sessao_id, lote_id, motivo) values (%L, %L, %L, %L)', pp.id('a0'), pp.id('81'), pp.id('21'), 'manual')),
          '2/3/', 'o leitor vê os preços e o histórico, mas ninguém escreve no histórico pelo navegador');
select pp.como('b1');
select is((select count(*)::text from public.ticketeria_precos_da_sessao) || '/' || (select count(*)::text from public.ticketeria_precos_historico), '0/0', 'outra organização não vê nada');
select pp.como(null);
select is(pp.efeito('select 1 from public.ticketeria_precos_da_sessao') || '/' || pp.efeito(format('select public.fn_ticketeria_preco_do_lote(%L, %L)', pp.id('21'), pp.id('81'))), '/', 'visitante não vê o preço da sessão nem chama a função (só o servidor)');
select pp.volta();

-- ─── Apagar (DELETE, desfeito no fim: pela CLI) ─────────────────────────────

delete from public.ticketeria_precos_da_sessao where sessao_id = pp.id('82') and lote_id = pp.id('21');
select is(public.fn_ticketeria_preco_do_lote(pp.id('21'), pp.id('82')) || ' ' || pp.historico('82'), '6000 ->8000,8000>9000,9000>-', 'sem o preço da sessão volta o do lote, e o histórico guarda a saída (R$ 90,00 para o lote)');

select * from finish();
rollback;
