-- Memória relacional independente da negociação.
-- captação é opcional: o relacionamento pertence à organização/empresa/contato.

create table if not exists public.crm_interacoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  empresa_crm_id uuid references public.empresas_crm(id) on delete cascade,
  contato_id uuid references public.contatos(id) on delete set null,
  captacao_id uuid references public.captacoes(id) on delete set null,
  tipo text not null check (tipo in ('email','telefone','linkedin','reuniao','mensagem','evento','outro')),
  assunto text not null,
  resumo text,
  resultado text check (resultado is null or resultado in ('sem_resposta','respondeu','avancou','adiado','recusou')),
  proximo_passo text,
  ocorreu_em timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_duvidas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  empresa_crm_id uuid references public.empresas_crm(id) on delete cascade,
  contato_id uuid references public.contatos(id) on delete set null,
  captacao_id uuid references public.captacoes(id) on delete set null,
  interacao_id uuid references public.crm_interacoes(id) on delete set null,
  tipo text not null default 'duvida' check (tipo in ('duvida','objecao')),
  titulo text not null,
  resposta text,
  status text not null default 'aberta' check (status in ('aberta','em_validacao','respondida')),
  responsavel_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  empresa_crm_id uuid references public.empresas_crm(id) on delete cascade,
  contato_id uuid references public.contatos(id) on delete set null,
  captacao_id uuid references public.captacoes(id) on delete set null,
  titulo text not null,
  motivo text,
  canal text not null default 'email' check (canal in ('email','telefone','linkedin','mensagem','reuniao','outro')),
  previsto_para timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente','concluido','cancelado')),
  resultado text,
  tentativa smallint not null default 1 check (tentativa > 0),
  workflow text check (workflow is null or workflow in ('sem_resposta','negociacao_esfriando','novo_contato','pos_reuniao','retomar_futuramente')),
  responsavel_id uuid references public.profiles(id) on delete set null,
  concluido_em timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_interacoes_empresa_idx on public.crm_interacoes(organization_id, empresa_crm_id, ocorreu_em desc);
create index if not exists crm_interacoes_captacao_idx on public.crm_interacoes(captacao_id, ocorreu_em desc);
create index if not exists crm_duvidas_empresa_idx on public.crm_duvidas(organization_id, empresa_crm_id, status);
create index if not exists crm_followups_agenda_idx on public.crm_followups(organization_id, status, previsto_para);
create index if not exists crm_followups_captacao_idx on public.crm_followups(captacao_id, previsto_para);

alter table public.crm_interacoes enable row level security;
alter table public.crm_duvidas enable row level security;
alter table public.crm_followups enable row level security;

do $$
declare tabela text;
begin
  foreach tabela in array array['crm_interacoes','crm_duvidas','crm_followups'] loop
    execute format('drop policy if exists %I on public.%I', tabela || '_org_select', tabela);
    execute format('drop policy if exists %I on public.%I', tabela || '_org_manage', tabela);
    execute format('create policy %I on public.%I for select using (exists (select 1 from public.organization_members om where om.organization_id = organization_id and om.user_id = auth.uid()))', tabela || '_org_select', tabela);
    execute format('create policy %I on public.%I for all using (exists (select 1 from public.organization_members om where om.organization_id = organization_id and om.user_id = auth.uid())) with check (exists (select 1 from public.organization_members om where om.organization_id = organization_id and om.user_id = auth.uid()))', tabela || '_org_manage', tabela);
  end loop;
end $$;

grant select, insert, update, delete on public.crm_interacoes, public.crm_duvidas, public.crm_followups to authenticated;

