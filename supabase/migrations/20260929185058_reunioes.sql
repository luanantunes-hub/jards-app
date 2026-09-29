-- Feature "Reuniões": bot (Vexa self-hosted) entra numa reunião de Google Meet ou
-- Microsoft Teams, grava e transcreve com timestamp. Consulta só depois da reunião
-- (sem visualização ao vivo) — ver planejamento na conversa com o time de produto.

create table if not exists public.reunioes (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  titulo             text not null,
  plataforma         text not null check (plataforma in ('google_meet', 'teams')),
  url_reuniao        text not null,

  -- vínculo opcional com o CRM (uma reunião pode não estar presa a nenhum dos dois)
  captacao_id        uuid references public.captacoes(id) on delete set null,
  empresa_crm_id     uuid references public.empresas_crm(id) on delete set null,

  status             text not null default 'agendada' check (status in (
                        'agendada', 'bot_entrando', 'gravando', 'processando',
                        'concluida', 'falhou'
                      )),
  erro               text,

  vexa_bot_id        text,
  gravacao_storage_path text,
  resumo_ia          text,

  agendada_para      timestamptz,
  iniciada_em        timestamptz,
  finalizada_em      timestamptz,

  created_by         uuid references auth.users(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_reunioes_org
  on public.reunioes(organization_id, created_at desc);
create index if not exists idx_reunioes_captacao
  on public.reunioes(captacao_id) where captacao_id is not null;
create index if not exists idx_reunioes_empresa_crm
  on public.reunioes(empresa_crm_id) where empresa_crm_id is not null;
create unique index if not exists uq_reunioes_vexa_bot_id
  on public.reunioes(vexa_bot_id) where vexa_bot_id is not null;


create table if not exists public.reuniao_transcricoes (
  id           uuid primary key default gen_random_uuid(),
  reuniao_id   uuid not null references public.reunioes(id) on delete cascade,
  falante      text,
  texto        text not null,
  inicio_ms    integer not null,
  fim_ms       integer,
  confianca    real,
  created_at   timestamptz not null default now()
);

create index if not exists idx_reuniao_transcricoes_reuniao
  on public.reuniao_transcricoes(reuniao_id, inicio_ms);

-- Busca full-text sobre o texto transcrito (português)
alter table public.reuniao_transcricoes
  add column if not exists texto_busca tsvector
  generated always as (to_tsvector('portuguese', coalesce(texto, ''))) stored;

create index if not exists idx_reuniao_transcricoes_busca
  on public.reuniao_transcricoes using gin (texto_busca);


create table if not exists public.reuniao_participantes (
  id           uuid primary key default gen_random_uuid(),
  reuniao_id   uuid not null references public.reunioes(id) on delete cascade,
  nome         text,
  email        text
);

create index if not exists idx_reuniao_participantes_reuniao
  on public.reuniao_participantes(reuniao_id);


create table if not exists public.reuniao_marcadores (
  id            uuid primary key default gen_random_uuid(),
  reuniao_id    uuid not null references public.reunioes(id) on delete cascade,
  tipo          text not null default 'destaque' check (tipo in ('destaque', 'acao')),
  texto         text not null,
  timestamp_ms  integer,
  created_at    timestamptz not null default now()
);

create index if not exists idx_reuniao_marcadores_reuniao
  on public.reuniao_marcadores(reuniao_id);


-- ─────────────────────────────────────────────
-- RLS — mesmo padrão de auth_org_ids() usado no resto do app.
-- reuniao_transcricoes/participantes/marcadores não têm organization_id próprio:
-- a política verifica a organização através da reunião pai.
-- ─────────────────────────────────────────────

alter table public.reunioes enable row level security;

drop policy if exists "reunioes: select org" on public.reunioes;
drop policy if exists "reunioes: insert org" on public.reunioes;
drop policy if exists "reunioes: update org" on public.reunioes;
drop policy if exists "reunioes: delete org" on public.reunioes;

create policy "reunioes: select org" on public.reunioes for select to authenticated
  using (organization_id = any(array(select public.auth_org_ids())));
create policy "reunioes: insert org" on public.reunioes for insert to authenticated
  with check (organization_id = any(array(select public.auth_org_ids())));
create policy "reunioes: update org" on public.reunioes for update to authenticated
  using (organization_id = any(array(select public.auth_org_ids())))
  with check (organization_id = any(array(select public.auth_org_ids())));
create policy "reunioes: delete org" on public.reunioes for delete to authenticated
  using (organization_id = any(array(select public.auth_org_ids())));


alter table public.reuniao_transcricoes enable row level security;
drop policy if exists "reuniao_transcricoes: select org" on public.reuniao_transcricoes;
create policy "reuniao_transcricoes: select org" on public.reuniao_transcricoes for select to authenticated
  using (exists (
    select 1 from public.reunioes r
    where r.id = reuniao_transcricoes.reuniao_id
      and r.organization_id = any(array(select public.auth_org_ids()))
  ));

alter table public.reuniao_participantes enable row level security;
drop policy if exists "reuniao_participantes: select org" on public.reuniao_participantes;
create policy "reuniao_participantes: select org" on public.reuniao_participantes for select to authenticated
  using (exists (
    select 1 from public.reunioes r
    where r.id = reuniao_participantes.reuniao_id
      and r.organization_id = any(array(select public.auth_org_ids()))
  ));

alter table public.reuniao_marcadores enable row level security;
drop policy if exists "reuniao_marcadores: select org" on public.reuniao_marcadores;
create policy "reuniao_marcadores: select org" on public.reuniao_marcadores for select to authenticated
  using (exists (
    select 1 from public.reunioes r
    where r.id = reuniao_marcadores.reuniao_id
      and r.organization_id = any(array(select public.auth_org_ids()))
  ));

-- Escrita nas tabelas de conteúdo (transcrição/participantes/marcadores) é feita
-- só pelo backend com a service role (webhook do Vexa), por isso não há políticas
-- de insert/update/delete "to authenticated" aqui — igual ao padrão já usado para
-- dados que só o servidor grava (ex: fn_process_stripe_billing_event via service_role).
