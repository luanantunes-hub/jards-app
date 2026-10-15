-- A cortesia comum da prestação que acaba também avisa quem administra a organização.
--
-- Até aqui a rotina diária (fn_prestacao_cortesias_diaria) avisava 7 dias antes do fim
-- da cortesia e, no encerramento, só o teste grátis da prestação e a cortesia da
-- produção (PD0.6, 20261015081316) avisavam. A cortesia comum da prestação acabava em
-- silêncio. O dono pediu o mesmo aviso (15/10/2026): agora quem administra a
-- organização recebe, no dia seguinte ao último dia, "A cortesia da prestação de
-- contas terminou", com o link de Meu plano (a prestação tem assinatura, como no
-- aviso de teste encerrado). Evento modulo_cortesia_encerrada, o mesmo da produção;
-- a chave de deduplicação inclui o contrato, a data final e a pessoa, então um prazo
-- novo avisa de novo e repetir a rotina no mesmo dia não duplica.
--
-- O que muda em quem existe hoje: a cortesia da organização be9c680a (até 31/12/2026)
-- passa a gerar esse aviso quando acabar. A outra, de 28/11/2026, é teste grátis e
-- segue com o aviso de teste encerrado, que não muda.
--
-- O que NÃO muda: o aviso de 7 dias, o teste grátis (aviso de 7 dias e de encerrado),
-- a produção, o log de auditoria, os módulos ativos e as permissões. Conferido em
-- 15/10/2026 numa transação desfeita, sobre os dados reais, em 11 cenários: nove saem
-- idênticos à função anterior e os dois em que uma cortesia comum termina trazem
-- exatamente um aviso a mais por administrador.
--
-- Sem DROP, reaplicável: create or replace e revoke repetem o mesmo resultado.

set local lock_timeout = '10s';

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
    where om.modulo in ('prestacao', 'producao')
      and om.status = 'cortesia'
      and om.cortesia_aviso_em is null
      and om.cortesia_ate between hoje and hoje + 7
  loop
    -- Como o módulo aparece no aviso: o nome e a página dele.
    v_nome := case contrato.modulo when 'prestacao' then 'prestação de contas' when 'producao' then 'produção' end;
    v_link := case contrato.modulo when 'prestacao' then '/prestacoes' when 'producao' then '/producoes' end;
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
    end if;
  end loop;

  perform public.fn_aplicar_modulo_ativo(om.organization_id, om.modulo,
    public.modulo_em_vigor(om.status, om.cortesia_ate, om.past_due_since))
  from public.organization_modulos om;

  return encerradas;
end;
$$;
revoke execute on function public.fn_prestacao_cortesias_diaria() from public, anon, authenticated;
