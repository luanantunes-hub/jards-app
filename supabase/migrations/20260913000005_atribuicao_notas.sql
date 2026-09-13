-- EXPERIMENTAL — acompanhamento das atribuições do captador. Não reaproveita
-- `atividades`: aquela tabela é travada por `account_id = auth.uid()` (select
-- próprio), então uma nota criada pelo captador nunca apareceria pro admin.
-- Aqui a visibilidade segue o mesmo padrão de `atribuicoes`: qualquer membro
-- da organização (captador incluso) vê e escreve, escopado por organization_id.

create table public.atribuicao_notas (
  id uuid primary key default gen_random_uuid(),
  atribuicao_id uuid not null references public.atribuicoes(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  autor_id uuid not null references auth.users(id),
  autor_email text not null,
  nota text not null,
  created_at timestamptz not null default now()
);

create index atribuicao_notas_atribuicao_id_idx on public.atribuicao_notas(atribuicao_id);

alter table public.atribuicao_notas enable row level security;

create policy "atribuicao_notas: all org" on public.atribuicao_notas
  for all
  using (organization_id = any (array(select auth_org_ids())))
  with check (organization_id = any (array(select auth_org_ids())));
