-- Convite da primeira versão gratuita da prestação de contas.
--
-- Captação (o CRM) e prestação de contas são dois produtos. Nesta primeira
-- versão, a prestação é oferecida de graça e por tempo indeterminado a quem
-- usa o CRM: o seletor de módulos mostra a prestação com a etiqueta "Promo",
-- e o administrador da organização aceita o convite pela equipe. O aceite
-- cria o contrato do módulo como cortesia sem data de fim (o gatilho de
-- 20261005120000 põe o módulo em organizations.modulos_ativos), com vaga para
-- os membros de hoje e mais cinco, e libera o módulo para todos os membros,
-- menos captadores e proponentes. O aceite fica no log de auditoria.
--
-- Quem já tem contrato do módulo, em vigor ou não, segue pelo suporte e pela
-- assinatura: o convite é só para quem nunca teve a prestação. Erros:
-- nao_autenticado, sem_permissao, ja_contratado. Idempotente.

create or replace function public.fn_prestacao_aceitar_convite_gratuito(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_usuario uuid := auth.uid();
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
    (organization_id, modulo, status, vagas_cortesia, cortesia_ate, cortesia_motivo, cortesia_por)
  values
    (p_organization_id, 'prestacao', 'cortesia', v_vagas, null,
     'Convite da primeira versão gratuita, aceito pelo administrador', v_usuario)
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
    'Administrador aceitou o convite da primeira versão gratuita da prestação de contas',
    jsonb_build_object('modulo', 'prestacao', 'origem', 'convite_gratuito', 'membros', v_liberados, 'vagas', v_vagas));

  return jsonb_build_object('membros', v_liberados, 'vagas', v_vagas);
end;
$$;

revoke execute on function public.fn_prestacao_aceitar_convite_gratuito(uuid) from public, anon;
grant execute on function public.fn_prestacao_aceitar_convite_gratuito(uuid) to authenticated, service_role;
