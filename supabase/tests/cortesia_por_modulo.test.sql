-- PD0.6: a rotina diária das cortesias avisa por módulo (prestação e produção).
--
-- Confere a migration producao_cortesia_por_modulo sobre os mesmos dados que a
-- definição anterior da rotina (20261011110000, colada aqui como
-- pg_temp.cortesias_antiga). Em cada cenário da prestação a rotina antiga e a nova
-- rodam sobre o mesmo ponto de partida (cada rodada é desfeita por um ponto de
-- salvamento) e o teste compara tudo o que elas deixam: contratos, eventos e
-- notificações (texto, link, chave de deduplicação), log de auditoria e módulos
-- da organização. Depois a nova roda de verdade nos cenários da produção.
--
-- Cenário, criado e desfeito dentro da transação (nada fica gravado). Cada
-- organização n tem 1 colaborador e o número de administradores indicado; os
-- ids são 0d060000-0000-4000-8000-… (organizações, cm_teste.org(n)) e
-- 0d060000-0000-4000-8001-… (pessoas, cm_teste.usr(n)). Fim = dias até o último
-- dia da cortesia, contados de hoje em Brasília.
--   prestação (grupo P, tem de sair igual à rotina antiga):
--     1 cortesia a 7 dias, 2 administradores     2 teste grátis a 7 dias
--     3 cortesia a 3 dias                        4 cortesia a 8 dias (fora da janela)
--     5 cortesia que termina hoje                6 cortesia a 2 dias, já avisada
--     7 cortesia encerrada ontem                 8 teste grátis encerrado ontem
--     9 assinatura ativa                         10 cortesia a 5 dias, sem administrador
--   produção (grupo Q, só a rotina nova avisa):
--     11 produção a 7 dias e prestação a 7 dias na mesma organização
--     12 produção encerrada ontem, 2 administradores
--     13 produção a 4 dias marcada como teste grátis (não existe; recebe o texto da cortesia)
--     14 produção com assinatura ativa           15 produção a 2 dias, já avisada
--
-- Hoje o banco tem duas cortesias reais da prestação, fora da janela de aviso; as
-- rodadas também passam por elas, mas só os dados deste cenário entram na conta.
--
-- Rodar: supabase/tests/README.md, com a migration producao_cortesia_por_modulo
-- na frente.

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(38);

-- ─── Rotina antiga (20261011110000), só para comparar ──────────────────────

create function pg_temp.cortesias_antiga()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  contrato record;
  destinatario record;
  encerradas integer := 0;
begin
  for contrato in
    select om.id, om.organization_id, om.cortesia_ate, om.teste_gratis
    from public.organization_modulos om
    where om.modulo = 'prestacao'
      and om.status = 'cortesia'
      and om.cortesia_aviso_em is null
      and om.cortesia_ate between hoje and hoje + 7
  loop
    for destinatario in
      select membro.user_id from public.organization_members membro
      where membro.organization_id = contrato.organization_id and membro.papel = 'admin'
    loop
      if contrato.teste_gratis then
        perform public.fn_emit_notification(
          'modulo_teste_fim', contrato.organization_id, destinatario.user_id,
          'O teste grátis da prestação de contas termina em breve',
          'O teste vai até ' || to_char(contrato.cortesia_ate, 'DD/MM/YYYY')
            || '. Para continuar editando depois disso, assine em Meu plano. Sem assinatura, nada se perde: '
            || 'as prestações ficam guardadas para consulta e exportação.',
          '/meu-plano?assinar=prestacao', 'sistema', 'alta', 'organization_modulo', contrato.id, null,
          'modulo_teste_fim:' || contrato.id || ':' || contrato.cortesia_ate || ':' || destinatario.user_id,
          jsonb_build_object('cortesia_ate', contrato.cortesia_ate), null);
      else
        perform public.fn_emit_notification(
          'modulo_cortesia_fim', contrato.organization_id, destinatario.user_id,
          'Cortesia da prestação de contas termina em breve',
          'O acesso de cortesia ao módulo de prestação de contas vai até '
            || to_char(contrato.cortesia_ate, 'DD/MM/YYYY')
            || '. Os dados continuam guardados depois disso.',
          '/prestacoes', 'sistema', 'alta', 'organization_modulo', contrato.id, null,
          'modulo_cortesia_fim:' || contrato.id || ':' || contrato.cortesia_ate || ':' || destinatario.user_id,
          jsonb_build_object('cortesia_ate', contrato.cortesia_ate), null);
      end if;
    end loop;
    update public.organization_modulos set cortesia_aviso_em = now() where id = contrato.id;
  end loop;

  for contrato in
    update public.organization_modulos
    set status = 'cancelado', encerrado_em = now()
    where status = 'cortesia' and cortesia_ate < hoje
    returning id, organization_id, modulo, cortesia_ate, teste_gratis
  loop
    encerradas := encerradas + 1;
    insert into public.admin_audit_logs (actor_user_id, organization_id, action, resource_type, resource_id, summary, metadata)
    values (null, contrato.organization_id, 'update', 'organizacao', contrato.id::text,
      case when contrato.teste_gratis
        then 'Rotina diária encerrou o teste grátis do módulo ' || contrato.modulo || ' (terminou em '
        else 'Rotina diária encerrou a cortesia do módulo ' || contrato.modulo || ' (vencida em '
      end || to_char(contrato.cortesia_ate, 'DD/MM/YYYY') || ')',
      jsonb_build_object('modulo', contrato.modulo, 'cortesia_ate', contrato.cortesia_ate, 'origem', 'rotina',
                         'teste_gratis', contrato.teste_gratis));

    if contrato.teste_gratis and contrato.modulo = 'prestacao' then
      for destinatario in
        select membro.user_id from public.organization_members membro
        where membro.organization_id = contrato.organization_id and membro.papel = 'admin'
      loop
        perform public.fn_emit_notification(
          'modulo_teste_encerrado', contrato.organization_id, destinatario.user_id,
          'O teste grátis da prestação de contas terminou',
          'As prestações, os comprovantes e os arquivos continuam guardados para consulta e exportação. '
            || 'Assine em Meu plano para voltar a editar.',
          '/meu-plano?assinar=prestacao', 'sistema', 'alta', 'organization_modulo', contrato.id, null,
          'modulo_teste_encerrado:' || contrato.id || ':' || destinatario.user_id,
          jsonb_build_object('cortesia_ate', contrato.cortesia_ate), null);
      end loop;
    end if;
  end loop;

  perform public.fn_aplicar_modulo_ativo(om.organization_id, om.modulo,
    public.modulo_em_vigor(om.status, om.cortesia_ate, om.past_due_since))
  from public.organization_modulos om;

  return encerradas;
end;
$$;

-- ─── Ajudantes ──────────────────────────────────────────────────────────────

create schema cm_teste;

create function cm_teste.org(n integer) returns uuid language sql immutable as $$
  select ('0d060000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid;
$$;
create function cm_teste.usr(n integer) returns uuid language sql immutable as $$
  select ('0d060000-0000-4000-8001-' || lpad(to_hex(n), 12, '0'))::uuid;
$$;
create function cm_teste.hoje() returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Tudo o que a rotina deixa para as organizações pedidas. Sem ids nem horas
-- sorteados: as duas rodadas têm de dar o mesmo resultado.
create function cm_teste.foto(p_orgs integer[]) returns jsonb language sql as $$
  select jsonb_build_object(
    'contratos', coalesce((select jsonb_agg(jsonb_build_object(
        'org', om.organization_id, 'modulo', om.modulo, 'status', om.status,
        'avisado', om.cortesia_aviso_em is not null, 'encerrado', om.encerrado_em is not null)
        order by om.organization_id, om.modulo)
      from public.organization_modulos om
      where om.organization_id in (select cm_teste.org(n) from unnest(p_orgs) n)), '[]'),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object(
        'org', e.organization_id, 'evento', e.event_key, 'entidade', e.entity_type, 'entidade_id', e.entity_id,
        'dedupe', e.dedupe_key, 'estado', e.status, 'conteudo', e.payload) order by e.dedupe_key)
      from public.notification_events e
      where e.organization_id in (select cm_teste.org(n) from unnest(p_orgs) n)), '[]'),
    'notificacoes', coalesce((select jsonb_agg(jsonb_build_object(
        'org', x.organization_id, 'pessoa', x.user_id, 'tipo', x.tipo, 'titulo', x.titulo, 'mensagem', x.mensagem,
        'link', x.link, 'categoria', x.categoria, 'prioridade', x.prioridade, 'entidade_id', x.entity_id,
        'dedupe', x.dedupe_key, 'dados', x.dados) order by x.user_id, x.dedupe_key)
      from public.notificacoes x
      where x.organization_id in (select cm_teste.org(n) from unnest(p_orgs) n)), '[]'),
    'auditoria', coalesce((select jsonb_agg(jsonb_build_object(
        'org', a.organization_id, 'ator', a.actor_user_id, 'acao', a.action, 'tipo', a.resource_type,
        'recurso', a.resource_id, 'resumo', a.summary, 'metadata', a.metadata)
        order by a.organization_id, a.resource_id, a.summary)
      from public.admin_audit_logs a
      where a.organization_id in (select cm_teste.org(n) from unnest(p_orgs) n)), '[]'),
    'organizacoes', coalesce((select jsonb_agg(jsonb_build_object(
        'org', o.id, 'ativos', o.modulos_ativos, 'leitura', o.modulos_leitura) order by o.id)
      from public.organizations o
      where o.id in (select cm_teste.org(n) from unnest(p_orgs) n)), '[]'));
$$;

-- Roda uma das rotinas, guarda o que ela devolveu e deixou, e desfaz tudo: a
-- próxima rodada começa do mesmo ponto. O erro CM001 é só o jeito de voltar ao
-- ponto de salvamento; qualquer outro erro derruba o teste.
create function cm_teste.rodar(p_funcao text, p_orgs integer[]) returns jsonb language plpgsql as $$
declare
  retorno integer;
  resultado jsonb;
begin
  begin
    execute 'select ' || p_funcao || '()' into retorno;
    resultado := jsonb_build_object('retorno', retorno, 'depois', cm_teste.foto(p_orgs));
    raise exception 'desfazer a rodada' using errcode = 'CM001';
  exception when sqlstate 'CM001' then
    null;
  end;
  return resultado;
end;
$$;

-- ─── Cenário ────────────────────────────────────────────────────────────────

create table cm_teste.cenario (
  org integer not null, modulo text not null, status text not null, fim integer,
  teste boolean not null default false, avisado boolean not null default false,
  admins integer not null default 1, primary key (org, modulo));

insert into cm_teste.cenario (org, modulo, status, fim, teste, avisado, admins) values
  (1,  'prestacao', 'cortesia', 7,    false, false, 2),
  (2,  'prestacao', 'cortesia', 7,    true,  false, 1),
  (3,  'prestacao', 'cortesia', 3,    false, false, 1),
  (4,  'prestacao', 'cortesia', 8,    false, false, 1),
  (5,  'prestacao', 'cortesia', 0,    false, false, 1),
  (6,  'prestacao', 'cortesia', 2,    false, true,  1),
  (7,  'prestacao', 'cortesia', -1,   false, false, 1),
  (8,  'prestacao', 'cortesia', -1,   true,  false, 1),
  (9,  'prestacao', 'ativo',    null, false, false, 1),
  (10, 'prestacao', 'cortesia', 5,    false, false, 0),
  (11, 'producao',  'cortesia', 7,    false, false, 1),
  (11, 'prestacao', 'cortesia', 7,    false, false, 1),
  (12, 'producao',  'cortesia', -1,   false, false, 2),
  (13, 'producao',  'cortesia', 4,    true,  false, 1),
  (14, 'producao',  'ativo',    null, false, false, 1),
  (15, 'producao',  'cortesia', 2,    false, true,  1);

do $cenario$
begin
  -- Pessoas: n*10+1 e n*10+2 são administradores (conforme o cenário), n*10+3 é colaborador.
  insert into auth.users (id, email, aud, role, raw_user_meta_data, email_confirmed_at)
  select cm_teste.usr(org * 10 + k), 'cm-' || (org * 10 + k) || '@teste.invalid', 'authenticated', 'authenticated', '{}'::jsonb, now()
  from (select distinct org, admins from cm_teste.cenario) c
  cross join lateral generate_series(1, 3) k
  where k = 3 or k <= c.admins;

  insert into public.organizations (id, nome)
  select distinct cm_teste.org(org), 'CM organização ' || org from cm_teste.cenario;

  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso)
  select cm_teste.org(org), cm_teste.usr(org * 10 + k), case when k = 3 then 'colaborador' else 'admin' end, '{captacao}'
  from (select distinct org, admins from cm_teste.cenario) c
  cross join lateral generate_series(1, 3) k
  where k = 3 or k <= c.admins;

  insert into public.organization_modulos
    (organization_id, modulo, status, vagas_cortesia, cortesia_ate, cortesia_motivo, teste_gratis, cortesia_aviso_em)
  select cm_teste.org(org), modulo, status, 3,
         case when status = 'cortesia' then cm_teste.hoje() + fim end,
         case when status = 'cortesia' then 'CM ensaio' end,
         teste, case when avisado then now() end
  from cm_teste.cenario;
end
$cenario$;

create function cm_teste.contrato(n integer, m text) returns uuid language sql stable as $$
  select id from public.organization_modulos where organization_id = cm_teste.org(n) and modulo = m;
$$;

-- ─── Rodadas desfeitas: a rotina antiga e a nova sobre o mesmo cenário ──────
-- P: as dez organizações da prestação. Q: as cinco da produção. Cada rodada
-- volta ao ponto de partida; nada do que elas gravam fica.

create table cm_teste.rodadas (grupo text, rotina text, resultado jsonb);
insert into cm_teste.rodadas values ('P', 'antiga', cm_teste.rodar('pg_temp.cortesias_antiga', array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
insert into cm_teste.rodadas values ('P', 'nova', cm_teste.rodar('public.fn_prestacao_cortesias_diaria', array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
insert into cm_teste.rodadas values ('Q', 'antiga', cm_teste.rodar('pg_temp.cortesias_antiga', array[11, 12, 13, 14, 15]));
insert into cm_teste.rodadas values ('Q', 'nova', cm_teste.rodar('public.fn_prestacao_cortesias_diaria', array[11, 12, 13, 14, 15]));

create function cm_teste.rodada(g text, r text) returns jsonb language sql stable as $$
  select resultado from cm_teste.rodadas where grupo = g and rotina = r;
$$;

-- ─── A prestação não muda ───────────────────────────────────────────────────

select is(cm_teste.rodada('P', 'nova') -> 'depois', cm_teste.rodada('P', 'antiga') -> 'depois',
  'prestação: a rotina nova deixa o mesmo que a antiga (contratos, eventos, notificações, auditoria e módulos)');

select is(cm_teste.rodada('P', 'nova') -> 'retorno', cm_teste.rodada('P', 'antiga') -> 'retorno',
  'prestação: devolve o mesmo número de cortesias encerradas');

select is((select array_agg(e ->> 'evento' order by e ->> 'evento')
           from jsonb_array_elements(cm_teste.rodada('P', 'antiga') -> 'depois' -> 'eventos') e),
  array['modulo_cortesia_fim', 'modulo_cortesia_fim', 'modulo_cortesia_fim', 'modulo_cortesia_fim',
        'modulo_teste_encerrado', 'modulo_teste_fim'],
  'prestação: a comparação não é vazia, a rotina antiga avisa 4 cortesias, 1 teste a 7 dias e 1 teste encerrado');

select is(array[jsonb_array_length(cm_teste.rodada('P', 'antiga') -> 'depois' -> 'notificacoes'),
                jsonb_array_length(cm_teste.rodada('P', 'antiga') -> 'depois' -> 'auditoria')],
  array[6, 2], 'prestação: 6 notificações para os administradores e 2 linhas de auditoria nas encerradas');

select is((select array[count(*) filter (where (c ->> 'avisado')::boolean), count(*) filter (where c ->> 'status' = 'cancelado')]
           from jsonb_array_elements(cm_teste.rodada('P', 'antiga') -> 'depois' -> 'contratos') c),
  array[6::bigint, 2], 'prestação: 6 contratos ficam avisados (5 agora e 1 de antes) e 2 encerrados');

select is((select count(*)::integer from jsonb_array_elements(cm_teste.rodada('P', 'antiga') -> 'depois' -> 'notificacoes') n
           where (n ->> 'pessoa')::uuid in (select user_id from public.organization_members
                                            where papel = 'colaborador' and organization_id in (select cm_teste.org(g) from generate_series(1, 15) g))),
  0, 'prestação: colaborador não recebe aviso');

-- ─── A produção ao lado: o log de auditoria é o de sempre ───────────────────

select is((select jsonb_agg(c - 'avisado' order by c ->> 'org', c ->> 'modulo')
           from jsonb_array_elements(cm_teste.rodada('Q', 'nova') -> 'depois' -> 'contratos') c),
  (select jsonb_agg(c - 'avisado' order by c ->> 'org', c ->> 'modulo')
   from jsonb_array_elements(cm_teste.rodada('Q', 'antiga') -> 'depois' -> 'contratos') c),
  'produção: os encerramentos são os mesmos que a rotina antiga fazia');

select is((select array_agg((c ->> 'org')::uuid order by c ->> 'org')
           from jsonb_array_elements(cm_teste.rodada('Q', 'nova') -> 'depois' -> 'contratos') c
           where c ->> 'modulo' = 'producao' and (c ->> 'avisado')::boolean),
  array[cm_teste.org(11), cm_teste.org(13), cm_teste.org(15)],
  'produção: a rotina nova marca como avisados os contratos que avisou (organizações 11 e 13), além do 15, que já estava');

select is(cm_teste.rodada('Q', 'nova') -> 'depois' -> 'auditoria', cm_teste.rodada('Q', 'antiga') -> 'depois' -> 'auditoria',
  'produção: o log de auditoria do encerramento é o mesmo que a rotina antiga gravava');

select is(cm_teste.rodada('Q', 'nova') -> 'depois' -> 'organizacoes', cm_teste.rodada('Q', 'antiga') -> 'depois' -> 'organizacoes',
  'produção: os módulos das organizações ficam iguais');

select is(jsonb_array_length(cm_teste.rodada('Q', 'antiga') -> 'depois' -> 'eventos'), 1,
  'produção: a rotina antiga só avisava a prestação (1 evento, o da organização 11)');

select is(jsonb_array_length(cm_teste.rodada('Q', 'nova') -> 'depois' -> 'eventos'), 5,
  'produção: a rotina nova avisa também a produção (5 eventos: 2 da organização 11, 2 do encerramento e 1 da organização 13)');

select is((select e from jsonb_array_elements(cm_teste.rodada('Q', 'nova') -> 'depois' -> 'eventos') e
           where (e ->> 'entidade_id')::uuid = cm_teste.contrato(11, 'prestacao')),
  (select e from jsonb_array_elements(cm_teste.rodada('Q', 'antiga') -> 'depois' -> 'eventos') e
   where (e ->> 'entidade_id')::uuid = cm_teste.contrato(11, 'prestacao')),
  'produção: o aviso da prestação na mesma organização sai igual ao de antes');

-- ─── A nova roda de verdade ─────────────────────────────────────────────────

create table cm_teste.esperado as
  select count(*)::integer as vencidas from public.organization_modulos
  where status = 'cortesia' and cortesia_ate < cm_teste.hoje();

select is(public.fn_prestacao_cortesias_diaria(), (select vencidas from cm_teste.esperado),
  'a rotina devolve quantas cortesias encerrou');

-- Aviso de 7 dias da produção (organização 11), com o nome e o link dela.
select is((select array[n.tipo, n.titulo, n.mensagem, n.link, n.categoria, n.prioridade]
           from public.notificacoes n
           where n.user_id = cm_teste.usr(111) and n.entity_id = cm_teste.contrato(11, 'producao')),
  array['modulo_cortesia_fim', 'Cortesia da produção termina em breve',
        'O acesso de cortesia ao módulo de produção vai até ' || to_char(cm_teste.hoje() + 7, 'DD/MM/YYYY')
          || '. Os dados continuam guardados depois disso.',
        '/producoes', 'sistema', 'alta'],
  'produção: o aviso de 7 dias leva o nome e o link da produção');

select is((select array[n.dedupe_key, n.dados::text] from public.notificacoes n
           where n.user_id = cm_teste.usr(111) and n.entity_id = cm_teste.contrato(11, 'producao')),
  array['modulo_cortesia_fim:' || cm_teste.contrato(11, 'producao') || ':' || (cm_teste.hoje() + 7) || ':' || cm_teste.usr(111),
        '{"cortesia_ate": "' || (cm_teste.hoje() + 7) || '"}'],
  'produção: a chave de deduplicação é a do contrato, da data final e da pessoa');

select is((select count(*)::integer from public.notificacoes where user_id in (cm_teste.usr(113), cm_teste.usr(133), cm_teste.usr(123))),
  0, 'produção: o colaborador não recebe aviso nenhum');

-- A prestação na mesma organização, com os textos de sempre.
select is((select array[n.tipo, n.titulo, n.mensagem, n.link]
           from public.notificacoes n
           where n.user_id = cm_teste.usr(111) and n.entity_id = cm_teste.contrato(11, 'prestacao')),
  array['modulo_cortesia_fim', 'Cortesia da prestação de contas termina em breve',
        'O acesso de cortesia ao módulo de prestação de contas vai até ' || to_char(cm_teste.hoje() + 7, 'DD/MM/YYYY')
          || '. Os dados continuam guardados depois disso.',
        '/prestacoes'],
  'prestação: o aviso de 7 dias continua com o texto e o link de sempre');

-- Teste grátis só existe na prestação: a produção marcada como teste recebe o texto da cortesia.
select is((select array[n.tipo, n.titulo, n.link] from public.notificacoes n
           where n.organization_id = cm_teste.org(13) and n.user_id = cm_teste.usr(131)),
  array['modulo_cortesia_fim', 'Cortesia da produção termina em breve', '/producoes'],
  'produção marcada como teste grátis: recebe o aviso da cortesia, nunca o do teste');

-- Encerramento da produção (organização 12): quem administra é avisado.
select is((select array_agg(n.user_id order by n.user_id) from public.notificacoes n
           where n.organization_id = cm_teste.org(12) and n.tipo = 'modulo_cortesia_encerrada'),
  array[cm_teste.usr(121), cm_teste.usr(122)],
  'produção encerrada: os dois administradores são avisados e o colaborador não');

select is((select array[n.titulo, n.mensagem, n.link, n.prioridade] from public.notificacoes n
           where n.user_id = cm_teste.usr(121) and n.tipo = 'modulo_cortesia_encerrada'),
  array['A cortesia da produção terminou',
        'O acesso de cortesia ao módulo de produção terminou em ' || to_char(cm_teste.hoje() - 1, 'DD/MM/YYYY')
          || '. Os dados continuam guardados. Para continuar, fale com o suporte do Jards.',
        '/producoes', 'alta'],
  'produção encerrada: o aviso leva o nome e o link da produção');

select is((select n.dedupe_key from public.notificacoes n
           where n.user_id = cm_teste.usr(122) and n.tipo = 'modulo_cortesia_encerrada'),
  'modulo_cortesia_encerrada:' || cm_teste.contrato(12, 'producao') || ':' || (cm_teste.hoje() - 1) || ':' || cm_teste.usr(122),
  'produção encerrada: a chave de deduplicação inclui o contrato, a data final e a pessoa');

select is((select array[a.summary, a.metadata ->> 'modulo', a.metadata ->> 'origem', (a.actor_user_id is null)::text, a.action, a.resource_type]
           from public.admin_audit_logs a where a.organization_id = cm_teste.org(12)),
  array['Rotina diária encerrou a cortesia do módulo producao (vencida em ' || to_char(cm_teste.hoje() - 1, 'DD/MM/YYYY') || ')',
        'producao', 'rotina', 'true', 'update', 'organizacao'],
  'produção encerrada: o encerramento fica no log de auditoria, feito pela rotina');

select is((select array[status, (encerrado_em is not null)::text] from public.organization_modulos
           where id = cm_teste.contrato(12, 'producao')),
  array['cancelado', 'true'], 'produção encerrada: o contrato passa a cancelado');

select is((select array['producao' = any(modulos_ativos), 'producao' = any(modulos_leitura)] from public.organizations where id = cm_teste.org(12)),
  array[false, true], 'produção encerrada: sai dos módulos ativos e fica só para leitura');

select is((select 'producao' = any(modulos_ativos) from public.organizations where id = cm_teste.org(11)),
  true, 'produção a 7 dias: continua ativa até o último dia');

select is((select count(*)::integer from public.notification_events where organization_id in (cm_teste.org(14), cm_teste.org(15))),
  0, 'produção com assinatura ou já avisada: nenhum aviso novo');

select is((select status from public.organization_modulos where id = cm_teste.contrato(14, 'producao')),
  'ativo', 'produção com assinatura: o contrato fica como está');

-- ─── Repetir não duplica ────────────────────────────────────────────────────

create table cm_teste.contagem as
  select (select count(*) from public.notification_events where organization_id in (select cm_teste.org(n) from generate_series(1, 15) n)) as eventos,
         (select count(*) from public.notificacoes where organization_id in (select cm_teste.org(n) from generate_series(1, 15) n)) as notificacoes,
         (select count(*) from public.admin_audit_logs where organization_id in (select cm_teste.org(n) from generate_series(1, 15) n)) as auditoria;

select lives_ok($t$select public.fn_prestacao_cortesias_diaria()$t$, 'a rotina roda de novo sem erro');
select is((select array[(select count(*) from public.notification_events where organization_id in (select cm_teste.org(n) from generate_series(1, 15) n)),
                        (select count(*) from public.notificacoes where organization_id in (select cm_teste.org(n) from generate_series(1, 15) n)),
                        (select count(*) from public.admin_audit_logs where organization_id in (select cm_teste.org(n) from generate_series(1, 15) n))]),
  (select array[eventos, notificacoes, auditoria] from cm_teste.contagem),
  'segunda rodada no mesmo dia: nada de novo (avisos, notificações e auditoria)');

-- Se o aviso for reaberto sem mudar a data, a chave de deduplicação segura.
update public.organization_modulos set cortesia_aviso_em = null where organization_id = cm_teste.org(11);
select lives_ok($t$select public.fn_prestacao_cortesias_diaria()$t$, 'a rotina roda de novo sem erro');
select is((select array[(select count(*) from public.notification_events where organization_id in (select cm_teste.org(n) from generate_series(1, 15) n)),
                        (select count(*) from public.notificacoes where organization_id in (select cm_teste.org(n) from generate_series(1, 15) n))]),
  (select array[eventos, notificacoes] from cm_teste.contagem),
  'aviso reaberto com a mesma data final: não duplica');

select is((select count(*)::integer from public.organization_modulos
           where organization_id = cm_teste.org(11) and cortesia_aviso_em is not null),
  2, 'aviso reaberto: os dois contratos da organização voltam a ficar marcados como avisados');

-- Data final nova (a rota de admin zera o aviso quando o prazo muda): avisa de novo, com a data nova.
update public.organization_modulos set cortesia_ate = cm_teste.hoje() + 6, cortesia_aviso_em = null
where id = cm_teste.contrato(11, 'producao');
select lives_ok($t$select public.fn_prestacao_cortesias_diaria()$t$, 'a rotina roda de novo sem erro');
select is((select array_agg(n.dedupe_key order by n.dedupe_key) from public.notificacoes n
           where n.user_id = cm_teste.usr(111) and n.entity_id = cm_teste.contrato(11, 'producao')),
  array['modulo_cortesia_fim:' || cm_teste.contrato(11, 'producao') || ':' || (cm_teste.hoje() + 6) || ':' || cm_teste.usr(111),
        'modulo_cortesia_fim:' || cm_teste.contrato(11, 'producao') || ':' || (cm_teste.hoje() + 7) || ':' || cm_teste.usr(111)],
  'prazo novo, aviso novo: a produção avisa de novo, com a data nova');

-- ─── Quem executa e o job ───────────────────────────────────────────────────

select is((select array[has_function_privilege('public', f, 'execute'), has_function_privilege('anon', f, 'execute'),
                        has_function_privilege('authenticated', f, 'execute'), has_function_privilege('service_role', f, 'execute')]
           from (select 'public.fn_prestacao_cortesias_diaria()'::regprocedure as f) x),
  array[false, false, false, true], 'a rotina só roda pelo dono e pela chave de serviço, como antes');

select is((select array[prosecdef::text, proconfig::text] from pg_proc where oid = 'public.fn_prestacao_cortesias_diaria()'::regprocedure),
  array['true', '{"search_path=public, pg_temp"}'], 'continua security definer, com o caminho de busca fixo');

select is((select array[schedule, command] from cron.job where jobname = 'jards-prestacao-cortesias'),
  array['10 3 * * *', 'select public.fn_prestacao_cortesias_diaria();'],
  'o job do pg_cron continua o mesmo: nome, horário (03:10) e comando');

select * from finish();
rollback;
