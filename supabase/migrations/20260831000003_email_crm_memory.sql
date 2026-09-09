-- Incorpora mensagens reconhecidas à memória relacional do CRM.
-- Mensagens sem contato conhecido continuam privadas e não são expostas à organização.

alter table public.emails
  add column if not exists internet_message_id text,
  add column if not exists cc_emails text[] not null default '{}',
  add column if not exists empresa_crm_id uuid references public.empresas_crm(id) on delete set null,
  add column if not exists captacao_id uuid references public.captacoes(id) on delete set null,
  add column if not exists visibility text not null default 'private';

alter table public.emails drop constraint if exists emails_visibility_check;
alter table public.emails add constraint emails_visibility_check
  check (visibility in ('private', 'organization'));

alter table public.crm_interacoes
  add column if not exists email_id uuid references public.emails(id) on delete set null;

create index if not exists idx_emails_org_empresa_sent
  on public.emails(organization_id, empresa_crm_id, sent_at desc)
  where visibility = 'organization' and empresa_crm_id is not null;
create index if not exists idx_emails_org_captacao_sent
  on public.emails(organization_id, captacao_id, sent_at desc)
  where visibility = 'organization' and captacao_id is not null;
create index if not exists idx_emails_internet_message
  on public.emails(organization_id, internet_message_id)
  where internet_message_id is not null;
create unique index if not exists crm_interacoes_email_unique_idx
  on public.crm_interacoes(email_id);

drop policy if exists "emails: select own" on public.emails;
drop policy if exists "emails: select own or crm organization" on public.emails;
create policy "emails: select own or crm organization"
  on public.emails for select to authenticated
  using (
    user_id = auth.uid()
    or (
      visibility = 'organization'
      and exists (
        select 1
        from public.organization_members om
        where om.organization_id = emails.organization_id
          and om.user_id = auth.uid()
      )
    )
  );

revoke all on public.emails from public, anon, authenticated;
grant select on public.emails to authenticated;

comment on column public.emails.visibility is
  'private: visível apenas ao dono; organization: mensagem reconhecida como interação do CRM.';
comment on column public.crm_interacoes.email_id is
  'Origem da interação quando ela foi criada por sincronização de e-mail.';
