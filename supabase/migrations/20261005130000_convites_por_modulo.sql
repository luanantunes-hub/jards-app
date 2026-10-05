-- P0.6: convite e equipe por módulo.
--
-- Cada módulo tem a própria franquia de vagas:
--   captação: 1 incluída + organization_seats.purchased_seats (como antes),
--             contando só quem tem a captação;
--   prestação: o contrato de organization_modulos (P0.9), em vigor.
-- Captador e proponente não ocupam vaga e usam só a captação.
-- O convite guarda os módulos e a função na prestação, e o aceite os copia
-- para o vínculo. As funções antigas viram atalhos para "só captação", para o
-- app publicado continuar funcionando. Idempotente; sem DROP.
-- A regra de papéis dos convites precisa de DROP CONSTRAINT e está em
-- 20261005130100_convites_papeis.sql.

-- ─── Colunas ────────────────────────────────────────────────────────────────

alter table public.organization_members
  add column if not exists prestacao_funcao text;

alter table public.organization_invitations
  add column if not exists modulos_acesso text[] not null default '{captacao}',
  add column if not exists prestacao_funcao text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organization_members_prestacao_funcao_check') then
    alter table public.organization_members add constraint organization_members_prestacao_funcao_check
      check (prestacao_funcao is null or prestacao_funcao in ('preparador', 'revisor', 'responsavel'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organization_members_modulos_acesso_check') then
    alter table public.organization_members add constraint organization_members_modulos_acesso_check
      check (cardinality(modulos_acesso) > 0 and modulos_acesso <@ array['captacao', 'prestacao']::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organization_invitations_prestacao_funcao_check') then
    alter table public.organization_invitations add constraint organization_invitations_prestacao_funcao_check
      check (prestacao_funcao is null or prestacao_funcao in ('preparador', 'revisor', 'responsavel'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organization_invitations_modulos_acesso_check') then
    alter table public.organization_invitations add constraint organization_invitations_modulos_acesso_check
      check (cardinality(modulos_acesso) > 0 and modulos_acesso <@ array['captacao', 'prestacao']::text[]);
  end if;
end
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
    else 0
  end;
$$;

-- Vínculos e convites pendentes com o módulo, sem captador e proponente.
create or replace function public.modulo_vagas_em_uso(p_org uuid, p_modulo text)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (
    (select count(*) from public.organization_members membro
     where membro.organization_id = p_org
       and p_modulo = any(membro.modulos_acesso)
       and membro.papel not in ('captador', 'proponente'))
    +
    (select count(*) from public.organization_invitations convite
     where convite.organization_id = p_org
       and convite.status = 'pending'
       and p_modulo = any(convite.modulos_acesso)
       and convite.role not in ('captador', 'proponente'))
  )::integer;
$$;

revoke execute on function public.modulo_vagas_limite(uuid, text) from public, anon, authenticated;
revoke execute on function public.modulo_vagas_em_uso(uuid, text) from public, anon, authenticated;
grant execute on function public.modulo_vagas_limite(uuid, text) to service_role;
grant execute on function public.modulo_vagas_em_uso(uuid, text) to service_role;

-- Ordem fixa e sem repetição: {prestacao, captacao} vira {captacao, prestacao}.
create or replace function public.modulos_canonicos(p_modulos text[])
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select array(select modulo from unnest(array['captacao', 'prestacao']) modulo
               where modulo = any(coalesce(p_modulos, '{}')));
$$;

-- Confere os módulos pedidos para um papel. `p_ja_tem` são os módulos que a
-- pessoa já usa: não ocupam vaga nova. Quem chama trava a organização antes.
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
  if not (p_modulos <@ array['captacao', 'prestacao']::text[]) then
    raise exception 'modulo_invalido' using errcode = '22023';
  end if;
  if p_funcao is not null and p_funcao not in ('preparador', 'revisor', 'responsavel') then
    raise exception 'funcao_invalida' using errcode = '22023';
  end if;
  if p_papel in ('captador', 'proponente') and 'prestacao' = any(p_modulos) then
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
revoke execute on function public.fn_conferir_modulos(uuid, text, text[], text, text[]) from public, anon, authenticated;

-- ─── Convite e adição com módulos ───────────────────────────────────────────
-- Só a chave de serviço chama: as rotas conferem antes que quem pede é admin.

create or replace function public.reservar_convite_com_modulos(
  target_org uuid, target_email text, target_role text, inviter uuid,
  target_modulos text[], target_funcao text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  convite_id uuid;
  email_normalizado text := lower(trim(target_email));
  modulos text[] := public.modulos_canonicos(target_modulos);
begin
  if email_normalizado = '' or position('@' in email_normalizado) = 0 then
    raise exception 'E-mail invalido.' using errcode = '22023';
  end if;
  if target_role not in ('admin', 'colaborador', 'leitor', 'captador', 'proponente') then
    raise exception 'Papel de membro invalido.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_org::text, 0));

  if exists (
    select 1 from public.organization_members membro
    join public.profiles perfil on perfil.id = membro.user_id
    where membro.organization_id = target_org and lower(perfil.email) = email_normalizado
  ) then
    raise exception 'Este usuario ja faz parte da equipe.' using errcode = '23505';
  end if;

  perform public.fn_conferir_modulos(target_org, target_role, modulos, target_funcao, '{}');

  insert into public.organization_invitations
    (organization_id, email, role, status, invited_by, modulos_acesso, prestacao_funcao)
  values (target_org, email_normalizado, target_role, 'pending', inviter, modulos,
    case when 'prestacao' = any(modulos) then target_funcao end)
  returning id into convite_id;
  return convite_id;
end;
$$;

create or replace function public.adicionar_membro_com_modulos(
  target_org uuid, target_user uuid, target_role text,
  target_modulos text[], target_funcao text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  membro_id uuid;
  modulos text[] := public.modulos_canonicos(target_modulos);
begin
  if target_role not in ('admin', 'colaborador', 'leitor', 'captador', 'proponente') then
    raise exception 'Papel de membro invalido.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_org::text, 0));

  if exists (select 1 from public.organization_members
             where organization_id = target_org and user_id = target_user) then
    raise exception 'Este usuario ja faz parte da equipe.' using errcode = '23505';
  end if;

  perform public.fn_conferir_modulos(target_org, target_role, modulos, target_funcao, '{}');

  insert into public.organization_members (organization_id, user_id, papel, modulos_acesso, prestacao_funcao)
  values (target_org, target_user, target_role, modulos,
    case when 'prestacao' = any(modulos) then target_funcao end)
  returning id into membro_id;
  return membro_id;
end;
$$;

-- Troca os módulos e a função de quem já é membro. Só os módulos novos
-- ocupam vaga; tirar libera.
create or replace function public.alterar_modulos_membro(
  p_org uuid, p_user uuid, p_modulos text[], p_funcao text)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  membro public.organization_members%rowtype;
  modulos text[] := public.modulos_canonicos(p_modulos);
  resultado text[];
begin
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 0));

  select * into membro from public.organization_members
  where organization_id = p_org and user_id = p_user
  for update;
  if not found then
    raise exception 'membro_inexistente' using errcode = 'P0002';
  end if;

  perform public.fn_conferir_modulos(p_org, membro.papel, modulos, p_funcao, membro.modulos_acesso);

  update public.organization_members
  set modulos_acesso = modulos,
      prestacao_funcao = case when 'prestacao' = any(modulos) then p_funcao end
  where id = membro.id
  returning modulos_acesso into resultado;
  return resultado;
end;
$$;

revoke execute on function public.reservar_convite_com_modulos(uuid, text, text, uuid, text[], text) from public, anon, authenticated;
revoke execute on function public.adicionar_membro_com_modulos(uuid, uuid, text, text[], text) from public, anon, authenticated;
revoke execute on function public.alterar_modulos_membro(uuid, uuid, text[], text) from public, anon, authenticated;
grant execute on function public.reservar_convite_com_modulos(uuid, text, text, uuid, text[], text) to service_role;
grant execute on function public.adicionar_membro_com_modulos(uuid, uuid, text, text[], text) to service_role;
grant execute on function public.alterar_modulos_membro(uuid, uuid, text[], text) to service_role;

-- ─── Funções antigas: só captação ───────────────────────────────────────────
-- Mesma assinatura e mesmos códigos de erro (23514 sem vaga, 23505 já
-- membro), agora contando só quem tem a captação.

create or replace function public.add_organization_member_with_seat(
  target_org uuid, target_user uuid, target_role text default 'captador')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.adicionar_membro_com_modulos(target_org, target_user, target_role, array['captacao'], null);
end;
$$;

create or replace function public.reserve_organization_invitation(
  target_org uuid, target_email text, target_role text, inviter uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.reservar_convite_com_modulos(target_org, target_email, target_role, inviter, array['captacao'], null);
end;
$$;

-- A cortesia do admin (P0.9) passa a usar a mesma conferência, que também
-- conta os convites pendentes da prestação.
create or replace function public.admin_definir_acesso_modulo(
  p_org uuid, p_user uuid, p_modulo text, p_ativo boolean)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  atual text[];
  funcao text;
begin
  select modulos_acesso, prestacao_funcao into atual, funcao from public.organization_members
  where organization_id = p_org and user_id = p_user;
  if not found then
    raise exception 'membro_inexistente' using errcode = 'P0002';
  end if;
  if (p_modulo = any(atual)) = p_ativo then
    return atual;
  end if;
  return public.alterar_modulos_membro(p_org, p_user,
    case when p_ativo then array_append(atual, p_modulo) else array_remove(atual, p_modulo) end,
    funcao);
end;
$$;

-- ─── Aceite do convite copia módulos e função ──────────────────────────────

create or replace function public.accept_my_organization_invitations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation record;
  affected integer := 0;
  current_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if auth.uid() is null then return 0; end if;

  for invitation in
    select * from public.organization_invitations
    where status = 'pending'
      and (invited_user_id = auth.uid() or lower(email) = current_email)
    for update
  loop
    insert into public.organization_members (organization_id, user_id, papel, modulos_acesso, prestacao_funcao)
    values (invitation.organization_id, auth.uid(), invitation.role,
      public.modulos_canonicos(coalesce(nullif(invitation.modulos_acesso, '{}'), array['captacao'])),
      invitation.prestacao_funcao)
    on conflict (organization_id, user_id) do nothing;

    update public.organization_invitations
    set status = 'accepted', invited_user_id = auth.uid(), accepted_at = coalesce(accepted_at, now())
    where id = invitation.id;
    affected := affected + 1;
  end loop;
  return affected;
end;
$$;
