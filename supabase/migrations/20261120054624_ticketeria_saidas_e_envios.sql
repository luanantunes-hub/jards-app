-- Ticketeria: as SAÍDAS DA LISTA e os ENVIOS de divulgação (segunda parte do "Público"). Quem recebe um e-mail de divulgação do produtor pode sair da lista por um link; a saída vale
-- para sempre, para aquela loja, e é conferida antes de qualquer envio.
--   - `ticketeria_saidas`: uma linha por pessoa (e-mail em minúsculas) que saiu da lista da loja; única por loja e e-mail;
--   - `ticketeria_envios`: um envio de divulgação (canal, assunto, mensagem, sessão e ação do link, quantas pessoas, quantas saíram e quantas falharam);
--   - `ticketeria_envio_destinatarios`: quem recebeu cada envio, com o `token` do link de sair da lista (UUID sorteado: é a prova de quem clicou);
--   - `fn_ticketeria_novidades_sair(token)`: grava a saída da pessoa na loja do envio e diz se gravou. Só do servidor.
-- As três tabelas só se leem por quem edita a Ticketeria da organização (tem e-mail de comprador); quem grava é o servidor. Expansão: tabelas novas e vazias, função nova. Aditiva e
-- reaplicável; sem DROP.

set local lock_timeout = '10s';

create table if not exists public.ticketeria_envios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  canal text not null default 'email',
  assunto text not null,
  mensagem text not null,
  sessao_id uuid references public.ticketeria_sessoes (id) on delete set null,
  acao text,
  segmento text not null,
  destinatarios integer not null default 0,
  enviados integer not null default 0,
  falhas integer not null default 0,
  situacao text not null default 'enviando',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  enviado_em timestamptz,
  constraint ticketeria_envios_canal_check check (canal in ('email')),
  constraint ticketeria_envios_situacao_check check (situacao in ('enviando', 'enviado', 'falhou')),
  constraint ticketeria_envios_assunto_check check (char_length(btrim(assunto)) between 1 and 150),
  constraint ticketeria_envios_mensagem_check check (char_length(btrim(mensagem)) between 1 and 5000),
  constraint ticketeria_envios_acao_check check (acao is null or acao ~ '^[a-z0-9_-]{1,60}$'),
  constraint ticketeria_envios_contagens_check check (destinatarios >= 0 and enviados >= 0 and falhas >= 0)
);

create index if not exists ticketeria_envios_loja_idx on public.ticketeria_envios (loja_id, created_at desc);
create index if not exists ticketeria_envios_org_idx on public.ticketeria_envios (organization_id);

create table if not exists public.ticketeria_envio_destinatarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  envio_id uuid not null references public.ticketeria_envios (id) on delete cascade,
  email text not null,
  nome text not null,
  token uuid not null default gen_random_uuid(),
  situacao text not null default 'pendente',
  provedor_id text,
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  constraint ticketeria_envio_destinatarios_email_check check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and email = lower(btrim(email))),
  constraint ticketeria_envio_destinatarios_situacao_check check (situacao in ('pendente', 'enviado', 'falhou')),
  constraint ticketeria_envio_destinatarios_token_key unique (token),
  constraint ticketeria_envio_destinatarios_pessoa_key unique (envio_id, email)
);

create index if not exists ticketeria_envio_destinatarios_org_idx on public.ticketeria_envio_destinatarios (organization_id);

create table if not exists public.ticketeria_saidas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  loja_id uuid not null references public.ticketeria_lojas (id) on delete cascade,
  email text not null,
  saiu_em timestamptz not null default now(),
  constraint ticketeria_saidas_email_check check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and email = lower(btrim(email))),
  constraint ticketeria_saidas_pessoa_key unique (loja_id, email)
);

create index if not exists ticketeria_saidas_org_idx on public.ticketeria_saidas (organization_id);

alter table public.ticketeria_envios enable row level security;
alter table public.ticketeria_envio_destinatarios enable row level security;
alter table public.ticketeria_saidas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_envios' and policyname = 'ticketeria_envios: le') then
    create policy "ticketeria_envios: le" on public.ticketeria_envios for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_envio_destinatarios' and policyname = 'ticketeria_envio_destinatarios: le') then
    create policy "ticketeria_envio_destinatarios: le" on public.ticketeria_envio_destinatarios for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ticketeria_saidas' and policyname = 'ticketeria_saidas: le') then
    create policy "ticketeria_saidas: le" on public.ticketeria_saidas for select to authenticated using (public.auth_ticketeria_pode(organization_id, 'editar'));
  end if;
end
$$;

revoke all on public.ticketeria_envios, public.ticketeria_envio_destinatarios, public.ticketeria_saidas from public, anon;
revoke insert, update, delete on public.ticketeria_envios, public.ticketeria_envio_destinatarios, public.ticketeria_saidas from authenticated;
grant select on public.ticketeria_envios, public.ticketeria_envio_destinatarios, public.ticketeria_saidas to authenticated;
grant all on public.ticketeria_envios, public.ticketeria_envio_destinatarios, public.ticketeria_saidas to service_role;

create or replace function public.fn_ticketeria_novidades_sair(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_destinatario public.ticketeria_envio_destinatarios%rowtype;
  v_loja uuid;
begin
  select * into v_destinatario from public.ticketeria_envio_destinatarios where token = p_token;
  if not found then
    return false;
  end if;
  select loja_id into v_loja from public.ticketeria_envios where id = v_destinatario.envio_id;
  if v_loja is null then
    return false;
  end if;
  insert into public.ticketeria_saidas (organization_id, loja_id, email)
  values (v_destinatario.organization_id, v_loja, v_destinatario.email)
  on conflict (loja_id, email) do nothing;
  return true;
end;
$$;

revoke execute on function public.fn_ticketeria_novidades_sair(uuid) from public, anon, authenticated;
grant execute on function public.fn_ticketeria_novidades_sair(uuid) to service_role;
