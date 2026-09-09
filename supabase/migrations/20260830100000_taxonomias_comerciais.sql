-- Vocabulários comerciais personalizáveis por organização.
-- As chaves são estáveis para preservar histórico e métricas; os usuários editam
-- nome, cor, ícone, ordem e podem criar canais/origens/resultados próprios.

create table if not exists public.crm_taxonomia_opcoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  categoria text not null check (categoria in ('origem','canal','resultado')),
  chave text not null check (chave ~ '^[a-z0-9_]{2,60}$'),
  label text not null check (char_length(trim(label)) between 1 and 60),
  cor text not null default '#7259B5' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  icone text not null default 'Tag' check (char_length(icone) between 1 and 60),
  ordem integer not null default 0,
  ativo boolean not null default true,
  padrao boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, categoria, chave)
);

drop trigger if exists trg_crm_taxonomia_updated_at on public.crm_taxonomia_opcoes;
create trigger trg_crm_taxonomia_updated_at before update on public.crm_taxonomia_opcoes
for each row execute function public.update_updated_at();

create index if not exists crm_taxonomia_org_categoria_idx
  on public.crm_taxonomia_opcoes(organization_id, categoria, ativo, ordem);

alter table public.crm_taxonomia_opcoes enable row level security;
drop policy if exists "crm_taxonomia: membros leem" on public.crm_taxonomia_opcoes;
drop policy if exists "crm_taxonomia: admins inserem" on public.crm_taxonomia_opcoes;
drop policy if exists "crm_taxonomia: admins atualizam" on public.crm_taxonomia_opcoes;
drop policy if exists "crm_taxonomia: admins removem" on public.crm_taxonomia_opcoes;

create policy "crm_taxonomia: membros leem" on public.crm_taxonomia_opcoes
  for select to authenticated
  using (organization_id = any(array(select public.auth_org_ids())));
create policy "crm_taxonomia: admins inserem" on public.crm_taxonomia_opcoes
  for insert to authenticated
  with check (exists (
    select 1 from public.organization_members om
    where om.organization_id = crm_taxonomia_opcoes.organization_id
      and om.user_id = auth.uid() and om.papel = 'admin'
  ));
create policy "crm_taxonomia: admins atualizam" on public.crm_taxonomia_opcoes
  for update to authenticated
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = crm_taxonomia_opcoes.organization_id
      and om.user_id = auth.uid() and om.papel = 'admin'
  ))
  with check (exists (
    select 1 from public.organization_members om
    where om.organization_id = crm_taxonomia_opcoes.organization_id
      and om.user_id = auth.uid() and om.papel = 'admin'
  ));
create policy "crm_taxonomia: admins removem" on public.crm_taxonomia_opcoes
  for delete to authenticated
  using (exists (
    select 1 from public.organization_members om
    where om.organization_id = crm_taxonomia_opcoes.organization_id
      and om.user_id = auth.uid() and om.papel = 'admin'
  ));

grant select, insert, update, delete on public.crm_taxonomia_opcoes to authenticated;

-- As taxonomias passam a validar no nível da organização/UI, permitindo novas
-- chaves sem uma migration para cada canal criado pelo cliente.
alter table public.captacoes drop constraint if exists captacoes_origem_oportunidade_check;
alter table public.captacoes drop constraint if exists captacoes_canal_planejado_check;
alter table public.crm_interacoes drop constraint if exists crm_interacoes_canal_check;
alter table public.crm_interacoes drop constraint if exists crm_interacoes_resultado_check;
alter table public.crm_interacoes drop constraint if exists crm_interacoes_tipo_check;

-- Follow-ups também podem usar os canais personalizados.
alter table public.crm_followups drop constraint if exists crm_followups_canal_check;

insert into public.crm_taxonomia_opcoes
  (organization_id, categoria, chave, label, cor, icone, ordem, padrao)
select o.id, defaults.categoria, defaults.chave, defaults.label, defaults.cor, defaults.icone, defaults.ordem, true
from public.organizations o
cross join (values
  ('origem','prospeccao_ativa','Prospecção ativa','#7259B5','Search',10),
  ('origem','indicacao','Indicação','#2E8932','Users',20),
  ('origem','edital','Edital','#2D72B0','FileText',30),
  ('origem','evento','Evento','#B07A14','Calendar',40),
  ('origem','inbound','Inbound','#1A8B7A','ArrowDownToLine',50),
  ('origem','parceiro','Parceiro','#7259B5','Handshake',60),
  ('origem','base_propria','Base própria','#666666','Database',70),
  ('origem','outro','Outro','#888888','MoreHorizontal',80),
  ('canal','email','E-mail','#2D72B0','Mail',10),
  ('canal','telefone','Telefone','#1A8B7A','Phone',20),
  ('canal','linkedin','LinkedIn','#2D72B0','Send',30),
  ('canal','whatsapp','WhatsApp','#2E8932','MessageCircle',40),
  ('canal','videoconferencia','Videoconferência','#7259B5','Video',50),
  ('canal','presencial','Presencial','#B07A14','Users',60),
  ('canal','outro','Outro','#888888','MoreHorizontal',70),
  ('resultado','sem_resposta','Sem resposta','#888888','Clock',10),
  ('resultado','respondeu','Respondeu','#2D72B0','MessageSquare',20),
  ('resultado','reuniao_agendada','Reunião agendada','#7259B5','CalendarCheck',30),
  ('resultado','proposta_solicitada','Proposta solicitada','#B07A14','FileCheck',40),
  ('resultado','avancou','Avançou','#2E8932','TrendingUp',50),
  ('resultado','adiado','Adiado','#B07A14','Pause',60),
  ('resultado','recusou','Recusou','#D94E4E','XCircle',70)
) as defaults(categoria, chave, label, cor, icone, ordem)
on conflict (organization_id, categoria, chave) do nothing;
