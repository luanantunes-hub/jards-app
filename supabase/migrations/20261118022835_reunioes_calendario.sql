-- Reuniões pelo calendário: cada pessoa liga ou desliga (começa DESLIGADO) e, quando a reunião do Google Agenda ou do Outlook/Teams tem convidado de fora da instituição,
-- o robô entra sozinho na hora. A regra mora em lib/reunioes/regra-do-calendario.ts; o servidor lê os eventos a cada poucos minutos (rota /api/reunioes/calendario/sincronizar).

create table if not exists public.reunioes_calendario_config (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  ativo            boolean not null default false,
  ultima_leitura   timestamptz,
  erro             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.reunioes_calendario_config enable row level security;

create policy reunioes_calendario_config_dono on public.reunioes_calendario_config
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.organization_members m where m.organization_id = reunioes_calendario_config.organization_id and m.user_id = auth.uid())
  );

-- O que o servidor já decidiu sobre cada evento: evita mandar o robô duas vezes e guarda o "não entrar nesta" da pessoa.
create table if not exists public.reunioes_calendario_eventos (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  provider         text not null check (provider in ('google', 'microsoft')),
  evento_id        text not null,
  inicio           timestamptz not null,
  titulo           text,
  situacao         text not null check (situacao in ('enviando', 'enviada', 'ignorada', 'duplicada', 'limite', 'erro')),
  erro             text,
  reuniao_id       uuid references public.reunioes(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (user_id, provider, evento_id, inicio)
);

create index if not exists idx_reunioes_calendario_eventos_org on public.reunioes_calendario_eventos(organization_id, inicio desc);

alter table public.reunioes_calendario_eventos enable row level security;

create policy reunioes_calendario_eventos_leitura on public.reunioes_calendario_eventos
  for select to authenticated
  using (user_id = auth.uid());

-- Chama a rota de leitura a cada 3 minutos. O endereço e o segredo ficam no cofre (vault): reunioes_calendario_url e reunioes_calendario_segredo.
-- Sem eles a função não faz nada, então aplicar esta migration não liga nada sozinha.
create or replace function public.fn_reunioes_calendario_disparar()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'reunioes_calendario_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'reunioes_calendario_segredo';
  if v_url is null or v_url = '' or v_segredo is null or v_segredo = '' then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-reunioes-segredo', v_segredo),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.fn_reunioes_calendario_disparar() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('jards-reunioes-calendario', '*/3 * * * *', 'select public.fn_reunioes_calendario_disparar();');
  end if;
end;
$$;
