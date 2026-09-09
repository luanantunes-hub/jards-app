-- Profiles: plan + Stripe data per user
create type plano_tipo as enum ('gratuito', 'starter', 'pro');

create table profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  plano                 plano_tipo not null default 'gratuito',
  stripe_customer_id    text unique,
  stripe_subscription_id text unique,
  stripe_price_id       text,
  periodo_fim           timestamptz,
  desbloqueios_mes      int not null default 0,
  desbloqueios_mes_reset date not null default current_date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Auto-create profile on sign-up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS
alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Webhook service role can update profiles
create policy "Service role can update profiles"
  on profiles for all
  using (auth.role() = 'service_role');
