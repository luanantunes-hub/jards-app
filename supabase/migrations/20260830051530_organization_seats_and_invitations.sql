-- Assentos extras comprados em lote e convites de equipe.
-- A capacidade e reservada apenas pelas RPCs abaixo. Nao ha trigger global em
-- organization_members e o fluxo existente de cadastro nao e alterado.

create table if not exists public.organization_seats (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  billing_user_id uuid not null references auth.users(id) on delete restrict,
  purchased_seats integer not null default 0 check (purchased_seats >= 0),
  stripe_subscription_item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_seats enable row level security;
drop policy if exists "organization seats: membros leem" on public.organization_seats;
create policy "organization seats: membros leem"
  on public.organization_seats for select to authenticated
  using (organization_id = any(array(select public.auth_org_ids())));
revoke insert, update, delete on public.organization_seats from authenticated;

create table if not exists public.organization_seat_purchases (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  billing_user_id uuid not null references auth.users(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 100),
  previous_quantity integer not null check (previous_quantity >= 0),
  resulting_quantity integer not null check (resulting_quantity >= quantity),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Impede duas alteracoes simultaneas da quantidade da mesma assinatura.
create unique index if not exists organization_seat_purchases_one_pending_idx
  on public.organization_seat_purchases (organization_id)
  where status = 'pending';

alter table public.organization_seat_purchases enable row level security;
drop policy if exists "organization seat purchases: admins leem" on public.organization_seat_purchases;
create policy "organization seat purchases: admins leem"
  on public.organization_seat_purchases for select to authenticated
  using (
    exists (
      select 1 from public.organization_members member
      where member.organization_id = organization_seat_purchases.organization_id
        and member.user_id = auth.uid()
        and member.papel = 'admin'
    )
  );
revoke insert, update, delete on public.organization_seat_purchases from authenticated;

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'captador' check (role in ('admin', 'captador', 'visualizador')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  invited_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists organization_invitations_pending_email_key
  on public.organization_invitations (organization_id, lower(email))
  where status = 'pending';
create index if not exists organization_invitations_user_idx
  on public.organization_invitations(invited_user_id);

alter table public.organization_invitations enable row level security;
drop policy if exists "organization invitations: admins leem" on public.organization_invitations;
create policy "organization invitations: admins leem"
  on public.organization_invitations for select to authenticated
  using (
    exists (
      select 1 from public.organization_members member
      where member.organization_id = organization_invitations.organization_id
        and member.user_id = auth.uid()
        and member.papel = 'admin'
    )
    or invited_user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
  );
revoke insert, update, delete on public.organization_invitations from authenticated;

-- Adicao direta de usuario existente. O lock evita que duas requisicoes
-- consumam o ultimo assento ao mesmo tempo.
create or replace function public.add_organization_member_with_seat(
  target_org uuid,
  target_user uuid,
  target_role text default 'captador'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  member_id uuid;
  capacity integer;
  used_seats integer;
begin
  if target_role not in ('admin', 'captador', 'visualizador') then
    raise exception 'Papel de membro invalido.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_org::text, 0));

  if exists (
    select 1 from public.organization_members
    where organization_id = target_org and user_id = target_user
  ) then
    raise exception 'Este usuario ja faz parte da equipe.' using errcode = '23505';
  end if;

  select 1 + coalesce(seats.purchased_seats, 0)
    into capacity
  from (select 1) seed
  left join public.organization_seats seats on seats.organization_id = target_org;

  select
    (select count(*) from public.organization_members where organization_id = target_org)
    + (select count(*) from public.organization_invitations where organization_id = target_org and status = 'pending')
    into used_seats;

  if used_seats >= capacity then
    raise exception 'Nao ha assentos disponiveis nesta organizacao.' using errcode = 'check_violation';
  end if;

  insert into public.organization_members (organization_id, user_id, papel)
  values (target_org, target_user, target_role)
  returning id into member_id;
  return member_id;
end;
$$;

-- Reserva um assento antes de disparar o e-mail. Se o provedor falhar, a API
-- revoga a reserva usando service_role.
create or replace function public.reserve_organization_invitation(
  target_org uuid,
  target_email text,
  target_role text,
  inviter uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_id uuid;
  normalized_email text := lower(trim(target_email));
  capacity integer;
  used_seats integer;
begin
  if normalized_email = '' or position('@' in normalized_email) = 0 then
    raise exception 'E-mail invalido.' using errcode = '22023';
  end if;
  if target_role not in ('admin', 'captador', 'visualizador') then
    raise exception 'Papel de membro invalido.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_org::text, 0));

  if exists (
    select 1
    from public.organization_members member
    join public.profiles profile on profile.id = member.user_id
    where member.organization_id = target_org and lower(profile.email) = normalized_email
  ) then
    raise exception 'Este usuario ja faz parte da equipe.' using errcode = '23505';
  end if;

  select 1 + coalesce(seats.purchased_seats, 0)
    into capacity
  from (select 1) seed
  left join public.organization_seats seats on seats.organization_id = target_org;

  select
    (select count(*) from public.organization_members where organization_id = target_org)
    + (select count(*) from public.organization_invitations where organization_id = target_org and status = 'pending')
    into used_seats;

  if used_seats >= capacity then
    raise exception 'Nao ha assentos disponiveis nesta organizacao.' using errcode = 'check_violation';
  end if;

  insert into public.organization_invitations (organization_id, email, role, status, invited_by)
  values (target_org, normalized_email, target_role, 'pending', inviter)
  returning id into invitation_id;
  return invitation_id;
end;
$$;

-- O assento ja foi reservado. O aceite materializa a associacao e encerra a
-- reserva na mesma transacao.
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
    insert into public.organization_members (organization_id, user_id, papel)
    values (invitation.organization_id, auth.uid(), invitation.role)
    on conflict (organization_id, user_id) do nothing;

    update public.organization_invitations
    set status = 'accepted', invited_user_id = auth.uid(), accepted_at = coalesce(accepted_at, now())
    where id = invitation.id;
    affected := affected + 1;
  end loop;
  return affected;
end;
$$;

revoke all on function public.add_organization_member_with_seat(uuid, uuid, text) from public;
revoke all on function public.reserve_organization_invitation(uuid, text, text, uuid) from public;
revoke all on function public.accept_my_organization_invitations() from public;
grant execute on function public.add_organization_member_with_seat(uuid, uuid, text) to service_role;
grant execute on function public.reserve_organization_invitation(uuid, text, text, uuid) to service_role;
grant execute on function public.accept_my_organization_invitations() to authenticated;
