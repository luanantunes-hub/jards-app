-- T0 (2 de 2): as funções que repetem a lista de módulos aceitam a ticketeria.
--
-- Sem DROP: só create or replace, com a mesma assinatura (nenhuma função
-- publicada ganha parâmetro novo: uma sobrecarga quebraria o PostgREST com
-- PGRST203). Aplique depois de 20261118222052_ticketeria_modulo_regras.sql.
-- Aplicada pelo conector em 18/11/2026, na versão 20261118222139; conferido em
-- pg_proc: uma versão de cada função, com os mesmos acessos de antes.
-- As listas são as de MODULOS em lib/modulos.ts, na mesma ordem
-- (tests/ticketeria-modulo-sql.test.ts confere).
--
-- O que muda (definições vigentes lidas em pg_proc, em 18/11/2026):
--   modulos_canonicos          a lista passa a ser captacao, prestacao, producao,
--                              ticketeria. Sem isso, quem pedia a ticketeria a
--                              perdia sem erro.
--   fn_conferir_modulos        aceita a ticketeria. Captador e proponente só
--                              podem ter a captação (captador_sem_modulo), regra
--                              que já vale para qualquer módulo que entre.
--   modulo_vagas_limite        ramo da ticketeria igual ao da produção: o contrato
--                              em vigor (cortesia usa vagas_cortesia; assinatura,
--                              1 mais as compradas). Sem contrato em vigor, 0 vaga.
--   fn_prestacao_cortesias_diaria
--                              a rotina diária também avisa o fim da cortesia da
--                              ticketeria (7 dias antes e quando termina), com o
--                              mesmo texto da produção: fale com o suporte. O
--                              link é /ingressos, a página do módulo no app
--                              (jards.com.br/ticketeria é a página pública).
--
-- O que já serve sem mudar: admin_definir_acesso_modulo, alterar_modulos_membro,
-- reservar_convite_com_modulos, adicionar_membro_com_modulos e
-- accept_my_organization_invitations passam por estas funções e passam a aceitar
-- a ticketeria; o gatilho de organizations.modulos_ativos vale para qualquer
-- módulo. A compra de vaga fica indisponível (409), como na produção: a cobrança
-- (fn_processar_cobranca_modulo) continua recusando módulo que não seja a
-- prestação. Não toca no Stripe.
--
-- Reaplicável: create or replace e revoke/grant repetem o mesmo resultado.

set local lock_timeout = '10s';

-- ─── Ordem fixa e sem repetição ─────────────────────────────────────────────
-- {ticketeria, captacao} vira {captacao, ticketeria}.

create or replace function public.modulos_canonicos(p_modulos text[])
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select array(select modulo from unnest(array['captacao', 'prestacao', 'producao', 'ticketeria']) modulo
               where modulo = any(coalesce(p_modulos, '{}')));
$$;

-- ─── Conferência dos módulos pedidos para um papel ──────────────────────────
-- `p_ja_tem` são os módulos que a pessoa já usa: não ocupam vaga nova. Quem
-- chama trava a organização antes.

create or replace function public.fn_conferir_modulos(
  p_org uuid, p_papel text, p_modulos text[], p_funcao text, p_ja_tem text[])
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  ativos text[];
  modulo text;
begin
  if cardinality(coalesce(p_modulos, '{}')) = 0 then
    raise exception 'ultimo_modulo' using errcode = 'P0001';
  end if;
  if not (p_modulos <@ array['captacao', 'prestacao', 'producao', 'ticketeria']::text[]) then
    raise exception 'modulo_invalido' using errcode = '22023';
  end if;
  if p_funcao is not null and p_funcao not in ('preparador', 'revisor', 'responsavel') then
    raise exception 'funcao_invalida' using errcode = '22023';
  end if;
  if p_papel in ('captador', 'proponente')
     and exists (select 1 from unnest(p_modulos) as pedido where pedido <> 'captacao') then
    raise exception 'captador_sem_modulo' using errcode = 'P0001';
  end if;

  select organizacao.modulos_ativos into ativos from public.organizations organizacao where organizacao.id = p_org;
  foreach modulo in array p_modulos loop
    continue when modulo = any(coalesce(p_ja_tem, '{}'));
    if not (modulo = any(coalesce(ativos, '{}'))) then
      raise exception 'modulo_inativo' using errcode = 'P0001';
    end if;
    if p_papel not in ('captador', 'proponente')
       and public.modulo_vagas_em_uso(p_org, modulo) >= public.modulo_vagas_limite(p_org, modulo) then
      raise exception 'sem_vaga_%', modulo using errcode = 'check_violation';
    end if;
  end loop;
end;
$$;

-- ─── Vagas por módulo ───────────────────────────────────────────────────────

create or replace function public.modulo_vagas_limite(p_org uuid, p_modulo text)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case p_modulo
    when 'captacao' then 1 + coalesce(
      (select seats.purchased_seats from public.organization_seats seats where seats.organization_id = p_org), 0)
    when 'prestacao' then coalesce(
      (select case when contrato.status = 'cortesia' then contrato.vagas_cortesia else 1 + contrato.vagas_compradas end
       from public.organization_modulos contrato
       where contrato.organization_id = p_org and contrato.modulo = 'prestacao'
         and public.modulo_em_vigor(contrato.status, contrato.cortesia_ate, contrato.past_due_since)), 0)
    when 'producao' then coalesce(
      (select case when contrato.status = 'cortesia' then contrato.vagas_cortesia else 1 + contrato.vagas_compradas end
       from public.organization_modulos contrato
       where contrato.organization_id = p_org and contrato.modulo = 'producao'
         and public.modulo_em_vigor(contrato.status, contrato.cortesia_ate, contrato.past_due_since)), 0)
    when 'ticketeria' then coalesce(
      (select case when contrato.status = 'cortesia' then contrato.vagas_cortesia else 1 + contrato.vagas_compradas end
       from public.organization_modulos contrato
       where contrato.organization_id = p_org and contrato.modulo = 'ticketeria'
         and public.modulo_em_vigor(contrato.status, contrato.cortesia_ate, contrato.past_due_since)), 0)
    else 0
  end;
$$;

-- ─── Rotina diária das cortesias ────────────────────────────────────────────

create or replace function public.fn_prestacao_cortesias_diaria()
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
  v_nome text;
  v_link text;
begin
  for contrato in
    select om.id, om.organization_id, om.modulo, om.cortesia_ate, om.teste_gratis
    from public.organization_modulos om
    where om.modulo in ('prestacao', 'producao', 'ticketeria')
      and om.status = 'cortesia'
      and om.cortesia_aviso_em is null
      and om.cortesia_ate between hoje and hoje + 7
  loop
    -- Como o módulo aparece no aviso: o nome e a página dele.
    v_nome := case contrato.modulo when 'prestacao' then 'prestação de contas' when 'producao' then 'produção' when 'ticketeria' then 'ticketeria' end;
    v_link := case contrato.modulo when 'prestacao' then '/prestacoes' when 'producao' then '/producoes' when 'ticketeria' then '/ingressos' end;
    for destinatario in
      select membro.user_id from public.organization_members membro
      where membro.organization_id = contrato.organization_id and membro.papel = 'admin'
    loop
      -- O teste grátis é só da prestação.
      if contrato.teste_gratis and contrato.modulo = 'prestacao' then
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
          'Cortesia da ' || v_nome || ' termina em breve',
          'O acesso de cortesia ao módulo de ' || v_nome || ' vai até '
            || to_char(contrato.cortesia_ate, 'DD/MM/YYYY')
            || '. Os dados continuam guardados depois disso.',
          v_link, 'sistema', 'alta', 'organization_modulo', contrato.id, null,
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
    elsif contrato.modulo = 'prestacao' then
      -- Cortesia comum da prestação que acabou (o teste grátis tem o aviso dele, acima).
      -- A prestação tem assinatura: o texto manda para Meu plano, como o do teste encerrado.
      for destinatario in
        select membro.user_id from public.organization_members membro
        where membro.organization_id = contrato.organization_id and membro.papel = 'admin'
      loop
        perform public.fn_emit_notification(
          'modulo_cortesia_encerrada', contrato.organization_id, destinatario.user_id,
          'A cortesia da prestação de contas terminou',
          'O acesso de cortesia ao módulo de prestação de contas terminou em '
            || to_char(contrato.cortesia_ate, 'DD/MM/YYYY')
            || '. Os dados continuam guardados para consulta e exportação. Para voltar a editar, assine em Meu plano.',
          '/meu-plano?assinar=prestacao', 'sistema', 'alta', 'organization_modulo', contrato.id, null,
          'modulo_cortesia_encerrada:' || contrato.id || ':' || contrato.cortesia_ate || ':' || destinatario.user_id,
          jsonb_build_object('cortesia_ate', contrato.cortesia_ate), null);
      end loop;
    elsif contrato.modulo = 'producao' then
      -- Ainda não há como assinar a produção sozinho (cobrança por módulo, PDL.1):
      -- por enquanto quem quer continuar fala com o suporte. Quando a assinatura
      -- existir, o texto passa a mandar para Meu plano, como o da prestação.
      for destinatario in
        select membro.user_id from public.organization_members membro
        where membro.organization_id = contrato.organization_id and membro.papel = 'admin'
      loop
        perform public.fn_emit_notification(
          'modulo_cortesia_encerrada', contrato.organization_id, destinatario.user_id,
          'A cortesia da produção terminou',
          'O acesso de cortesia ao módulo de produção terminou em '
            || to_char(contrato.cortesia_ate, 'DD/MM/YYYY')
            || '. Os dados continuam guardados. Para continuar, fale com o suporte do Jards.',
          '/producoes', 'sistema', 'alta', 'organization_modulo', contrato.id, null,
          'modulo_cortesia_encerrada:' || contrato.id || ':' || contrato.cortesia_ate || ':' || destinatario.user_id,
          jsonb_build_object('cortesia_ate', contrato.cortesia_ate), null);
      end loop;
    elsif contrato.modulo = 'ticketeria' then
      -- Como a produção: ainda não há como assinar a ticketeria sozinho; quem quer
      -- continuar fala com o suporte. Quando a assinatura existir, o texto passa a
      -- mandar para Meu plano, como o da prestação.
      for destinatario in
        select membro.user_id from public.organization_members membro
        where membro.organization_id = contrato.organization_id and membro.papel = 'admin'
      loop
        perform public.fn_emit_notification(
          'modulo_cortesia_encerrada', contrato.organization_id, destinatario.user_id,
          'A cortesia da ticketeria terminou',
          'O acesso de cortesia ao módulo de ticketeria terminou em '
            || to_char(contrato.cortesia_ate, 'DD/MM/YYYY')
            || '. Os dados continuam guardados. Para continuar, fale com o suporte do Jards.',
          '/ingressos', 'sistema', 'alta', 'organization_modulo', contrato.id, null,
          'modulo_cortesia_encerrada:' || contrato.id || ':' || contrato.cortesia_ate || ':' || destinatario.user_id,
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

-- ─── Quem executa ───────────────────────────────────────────────────────────
-- Mesmos acessos de hoje (conferidos em pg_proc em 18/11/2026): as três funções
-- que leem tabelas só a chave de serviço chama; modulos_canonicos não lê tabela
-- e segue como está para quem está logado. O visitante não executa nenhuma.

revoke execute on function public.modulos_canonicos(text[]) from public, anon;
revoke execute on function public.fn_conferir_modulos(uuid, text, text[], text, text[]) from public, anon, authenticated;
revoke execute on function public.modulo_vagas_limite(uuid, text) from public, anon, authenticated;
grant execute on function public.modulo_vagas_limite(uuid, text) to service_role;
revoke execute on function public.fn_prestacao_cortesias_diaria() from public, anon, authenticated;
