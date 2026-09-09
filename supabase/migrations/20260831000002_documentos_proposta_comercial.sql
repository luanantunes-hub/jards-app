-- Separa o repositório de documentos do projeto da proposta comercial.
-- Idempotente para instalações que já aplicaram planos_ativacao_patrocinio.

alter table public.documentos
  add column if not exists projeto_id uuid references public.projetos_crm(id) on delete set null,
  add column if not exists edital_user_id uuid references public.editais_user(id) on delete set null,
  add column if not exists arquivo_nome text,
  add column if not exists descricao text,
  add column if not exists categoria text not null default 'outro';

create index if not exists idx_documentos_projeto
  on public.documentos(projeto_id, created_at desc)
  where projeto_id is not null;

create index if not exists idx_documentos_edital_user
  on public.documentos(edital_user_id, created_at desc)
  where edital_user_id is not null;

alter table public.documentos
  drop constraint if exists documentos_contexto_check;
alter table public.documentos
  add constraint documentos_contexto_check
  check (num_nonnulls(captacao_id, edital_user_id) <= 1) not valid;

alter table public.propostas
  add column if not exists cota_id uuid references public.cotas_patrocinio(id) on delete set null,
  add column if not exists edital_user_id uuid references public.editais_user(id) on delete set null,
  add column if not exists valor_proposto numeric(15,2),
  add column if not exists contrapartidas text[] not null default '{}',
  add column if not exists observacoes_comerciais text;

-- Cada adaptação deve representar um caso concreto: negociação ou inscrição.
-- Registros legados continuam válidos para não destruir histórico existente.
alter table public.propostas
  drop constraint if exists propostas_caso_concreto_check;
alter table public.propostas
  add constraint propostas_caso_concreto_check
  check (num_nonnulls(captacao_id, edital_user_id) <= 1) not valid;

create index if not exists idx_propostas_captacao
  on public.propostas(captacao_id)
  where captacao_id is not null;

create index if not exists idx_propostas_cota
  on public.propostas(cota_id)
  where cota_id is not null;

create index if not exists idx_propostas_edital_user
  on public.propostas(edital_user_id)
  where edital_user_id is not null;
