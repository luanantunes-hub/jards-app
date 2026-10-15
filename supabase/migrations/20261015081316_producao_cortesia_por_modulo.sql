-- PD0.6: a rotina diária das cortesias avisa por módulo (prestação e produção).
--
-- A função continua sendo public.fn_prestacao_cortesias_diaria() e o job do
-- pg_cron continua sendo 'jards-prestacao-cortesias' (03:10, não é recriado
-- aqui): só o corpo muda. Definição anterior: 20261011110000, igual à vigente
-- no banco de produção em 15/10/2026 (md5 do corpo conferido em pg_proc).
--
-- O que muda:
--   aviso de 7 dias    deixa de olhar só a prestação e passa a olhar os módulos
--                      com contrato (prestacao e producao, como MODULOS_COM_CONTRATO
--                      em lib/equipe-modulos.ts). O título, o texto e o link vêm
--                      do módulo do contrato: a produção avisa "Cortesia da
--                      produção termina em breve" e leva a /producoes.
--   encerramento       o log de auditoria já servia a qualquer módulo e não muda.
--                      A cortesia da produção que acaba agora também avisa quem
--                      administra a organização, com o nome e o link da produção
--                      (evento modulo_cortesia_encerrada).
--
-- O que NÃO muda (conferido em supabase/tests/cortesia_por_modulo.test.sql, que
-- roda a definição antiga e a nova sobre os mesmos dados e compara):
--   a prestação      mesmos textos, mesmo link (/prestacoes e
--                    /meu-plano?assinar=prestacao), mesmos eventos
--                    (modulo_cortesia_fim, modulo_teste_fim, modulo_teste_encerrado),
--                    mesmas chaves de deduplicação, mesmo momento. A cortesia
--                    comum da prestação continua sem aviso de encerramento (só o
--                    teste grátis avisa): mudar isso é decisão do dono e fica fora
--                    desta entrega.
--   teste grátis     é só da prestação. Contrato de outro módulo marcado como
--                    teste (não existe hoje: a rota de admin sempre grava
--                    teste_gratis = false) recebe os textos da cortesia.
--   permissões       só o dono e a chave de serviço executam; create or replace
--                    preserva a ACL, e o revoke repete o que a migration original fez.
--
-- Fora desta entrega: a cobrança. fn_processar_cobranca_modulo continua
-- recusando módulo que não seja a prestação (PDL.1, depende de preço).
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
