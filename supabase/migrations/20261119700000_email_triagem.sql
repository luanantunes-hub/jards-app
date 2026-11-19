-- Triagem de e-mails de quem ainda não é contato.
-- A sincronização guarda, só para a pessoa (visibilidade "private"), os e-mails recentes de remetentes que não estão
-- nos contatos. Esta tabela diz em que passo está cada remetente: "pendente" aparece na triagem; "registrado" já teve
-- a conversa levada ao histórico da empresa; "dispensado" a pessoa mandou ignorar e a sincronização não traz de volta.
-- Cada pessoa só enxerga e muda as próprias linhas.

create table if not exists public.email_triagem (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  endereco text not null check (endereco = lower(endereco)),
  nome text,
  estado text not null default 'pendente' check (estado in ('pendente', 'registrado', 'dispensado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, organization_id, endereco)
);

create index if not exists email_triagem_pendentes_idx
  on public.email_triagem (user_id, organization_id)
  where estado = 'pendente';

alter table public.email_triagem enable row level security;

drop policy if exists "email_triagem: so a propria pessoa" on public.email_triagem;
create policy "email_triagem: so a propria pessoa" on public.email_triagem
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
