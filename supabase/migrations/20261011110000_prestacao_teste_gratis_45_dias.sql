-- Teste grátis de 45 dias da primeira versão da prestação de contas.
--
-- O convite de 20261011100000 deixava a prestação grátis por tempo
-- indeterminado. Agora o aceite do administrador começa um teste grátis de 45
-- dias para a equipe, sem cartão: o contrato continua sendo uma cortesia, com
-- data de fim, marcada como teste (organization_modulos.teste_gratis).
--
-- No fim do teste nada se perde: a rotina diária encerra a cortesia, o
-- módulo passa para organizations.modulos_leitura (20261009120000) e a equipe
-- continua lendo e exportando as prestações; para voltar a editar, a
-- organização assina em Meu plano. A rotina avisa os administradores 7 dias
-- antes e no dia em que o teste termina.
--
-- O teste é um só por organização: quem já teve qualquer contrato da
-- prestação segue pela assinatura. Assinar, ou o suporte liberar uma
-- cortesia, desmarca o teste. Idempotente.

alter table public.organization_modulos
  add column if not exists teste_gratis boolean not null default false;

comment on column public.organization_modulos.teste_gratis is
  'A cortesia é o teste grátis de 45 dias aceito no convite. Fica marcada depois que o teste termina sem assinatura; a assinatura e a cortesia do suporte desmarcam.';

-- ─── A assinatura encerra o teste ───────────────────────────────────────────
-- O webhook do Stripe grava a assinatura por cima do contrato do teste
-- (fn_processar_cobranca_modulo): a partir daí o contrato é a assinatura.

create or replace function public.fn_organization_modulos_fim_do_teste()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status in ('ativo', 'teste', 'atraso') then
    new.teste_gratis := false;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_organization_modulos_fim_do_teste'
                 and tgrelid = 'public.organization_modulos'::regclass) then
    create trigger trg_organization_modulos_fim_do_teste
      before update on public.organization_modulos
      for each row when (new.teste_gratis)
      execute function public.fn_organization_modulos_fim_do_teste();
  end if;
end
$$;

-- ─── Aceite do convite: começa o teste ──────────────────────────────────────
-- Mesmas regras de 20261011100000 (só o administrador, uma vez por
-- organização, vaga para a equipe e mais cinco, captadores e proponentes de
-- fora), com a cortesia indo até hoje + 45 dias, no horário de Brasília.
-- Devolve também o último dia do teste.

create or replace function public.fn_prestacao_aceitar_convite_gratuito(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
  v_ate date := (now() at time zone 'America/Sao_Paulo')::date + 45;
  v_membros integer;
  v_vagas integer;
  v_liberados integer;
  v_contrato uuid;
begin
  if v_usuario is null then
    raise exception 'nao_autenticado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organization_members
                 where organization_id = p_organization_id and user_id = v_usuario and papel = 'admin') then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;

  -- Dois aceites ao mesmo tempo não criam dois contratos.
  perform 1 from public.organizations where id = p_organization_id for update;
  if exists (select 1 from public.organization_modulos
             where organization_id = p_organization_id and modulo = 'prestacao') then
    raise exception 'ja_contratado' using errcode = 'P0001';
  end if;

  select count(*) into v_membros from public.organization_members
  where organization_id = p_organization_id and papel not in ('captador', 'proponente');
  v_vagas := greatest(v_membros, 1) + 5;

  insert into public.organization_modulos
    (organization_id, modulo, status, vagas_cortesia, cortesia_ate, cortesia_motivo, cortesia_por, teste_gratis)
  values
    (p_organization_id, 'prestacao', 'cortesia', v_vagas, v_ate,
     'Teste grátis de 45 dias da primeira versão, aceito pelo administrador', v_usuario, true)
  returning id into v_contrato;

  with liberados as (
    update public.organization_members
    set modulos_acesso = array_append(modulos_acesso, 'prestacao')
    where organization_id = p_organization_id
      and papel not in ('captador', 'proponente')
      and not ('prestacao' = any(modulos_acesso))
    returning 1
  )
  select count(*) into v_liberados from liberados;

  insert into public.admin_audit_logs (actor_user_id, organization_id, action, resource_type, resource_id, summary, metadata)
  values (v_usuario, p_organization_id, 'create', 'organizacao', v_contrato::text,
    'Administrador começou o teste grátis de 45 dias da prestação de contas, até ' || to_char(v_ate, 'DD/MM/YYYY'),
    jsonb_build_object('modulo', 'prestacao', 'origem', 'convite_gratuito', 'membros', v_liberados,
                       'vagas', v_vagas, 'teste_ate', v_ate));

  return jsonb_build_object('membros', v_liberados, 'vagas', v_vagas, 'ate', v_ate);
end;
$$;

revoke execute on function public.fn_prestacao_aceitar_convite_gratuito(uuid) from public, anon;
grant execute on function public.fn_prestacao_aceitar_convite_gratuito(uuid) to authenticated, service_role;

-- ─── Rotina diária ──────────────────────────────────────────────────────────
-- A mesma de 20261005120000, com o texto do teste quando a cortesia é o
-- teste grátis e um aviso aos administradores no dia em que o teste termina.

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
revoke execute on function public.fn_prestacao_cortesias_diaria() from public, anon, authenticated;
