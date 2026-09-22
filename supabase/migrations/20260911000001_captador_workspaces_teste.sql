-- EXPERIMENTAL — tabelas do workspace de captador (autoatendimento pra evitar
-- que o captador externo aborde uma empresa/edital que já está em andamento).
-- Ainda em prototipagem: só é aplicado localmente, não faz parte do fluxo
-- normal de deploy até a feature ser validada.

create table if not exists public.captador_workspaces (
  id              uuid primary key default gen_random_uuid(),
  captador_id     uuid not null references public.captadores(id) on delete cascade unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_captador_workspaces_org on public.captador_workspaces(organization_id);

create table if not exists public.captador_workspace_escopos (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.captador_workspaces(id) on delete cascade,
  tipo          text not null check (tipo in ('empresas', 'negociacoes', 'inscricoes')),
  habilitado    boolean not null default false,
  -- pedido: pede acesso e espera aprovação de um admin.
  -- consulta: checa um item específico; se estiver livre, libera na hora, mas só mostra esse item.
  -- ver_tudo: lista completa do tipo, sem precisar perguntar item por item.
  modo          text not null default 'consulta' check (modo in ('pedido', 'consulta', 'ver_tudo')),
  unique(workspace_id, tipo)
);

-- Pedidos feitos pelo captador no modo "pedido" — fica pendente até um admin decidir.
create table if not exists public.captador_workspace_pedidos (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.captador_workspaces(id) on delete cascade,
  tipo            text not null check (tipo in ('empresas', 'negociacoes', 'inscricoes')),
  empresa_pub_id  uuid references public.empresas(id) on delete set null,
  edital_pub_id   uuid references public.editais(id) on delete set null,
  mensagem        text,
  status          text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  decidido_por    uuid references auth.users(id) on delete set null,
  decidido_em     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_captador_pedidos_workspace on public.captador_workspace_pedidos(workspace_id, status);

alter table public.captador_workspaces enable row level security;
alter table public.captador_workspace_escopos enable row level security;
alter table public.captador_workspace_pedidos enable row level security;

-- Admin da organização gerencia o workspace inteiro.
create policy "captador_workspaces: admin gerencia" on public.captador_workspaces
  for all using (
    exists (select 1 from public.organization_members m where m.organization_id = captador_workspaces.organization_id and m.user_id = auth.uid() and m.papel = 'admin')
  ) with check (
    exists (select 1 from public.organization_members m where m.organization_id = captador_workspaces.organization_id and m.user_id = auth.uid() and m.papel = 'admin')
  );

-- O próprio captador (vinculado via captadores.user_id) lê o workspace dele.
create policy "captador_workspaces: captador le o proprio" on public.captador_workspaces
  for select using (
    exists (select 1 from public.captadores c where c.id = captador_workspaces.captador_id and c.user_id = auth.uid())
  );

create policy "captador_workspace_escopos: admin gerencia" on public.captador_workspace_escopos
  for all using (
    exists (
      select 1 from public.captador_workspaces w
      join public.organization_members m on m.organization_id = w.organization_id
      where w.id = captador_workspace_escopos.workspace_id and m.user_id = auth.uid() and m.papel = 'admin'
    )
  ) with check (
    exists (
      select 1 from public.captador_workspaces w
      join public.organization_members m on m.organization_id = w.organization_id
      where w.id = captador_workspace_escopos.workspace_id and m.user_id = auth.uid() and m.papel = 'admin'
    )
  );

create policy "captador_workspace_escopos: captador le o proprio" on public.captador_workspace_escopos
  for select using (
    exists (
      select 1 from public.captador_workspaces w
      join public.captadores c on c.id = w.captador_id
      where w.id = captador_workspace_escopos.workspace_id and c.user_id = auth.uid()
    )
  );

create policy "captador_workspace_pedidos: admin gerencia" on public.captador_workspace_pedidos
  for all using (
    exists (
      select 1 from public.captador_workspaces w
      join public.organization_members m on m.organization_id = w.organization_id
      where w.id = captador_workspace_pedidos.workspace_id and m.user_id = auth.uid() and m.papel = 'admin'
    )
  ) with check (
    exists (
      select 1 from public.captador_workspaces w
      join public.organization_members m on m.organization_id = w.organization_id
      where w.id = captador_workspace_pedidos.workspace_id and m.user_id = auth.uid() and m.papel = 'admin'
    )
  );

-- O captador le os proprios pedidos e cria pedidos novos (nao pode editar status ou decidir por si).
create policy "captador_workspace_pedidos: captador le e cria" on public.captador_workspace_pedidos
  for select using (
    exists (
      select 1 from public.captador_workspaces w
      join public.captadores c on c.id = w.captador_id
      where w.id = captador_workspace_pedidos.workspace_id and c.user_id = auth.uid()
    )
  );

create policy "captador_workspace_pedidos: captador insere" on public.captador_workspace_pedidos
  for insert with check (
    status = 'pendente' and decidido_por is null and decidido_em is null and
    exists (
      select 1 from public.captador_workspaces w
      join public.captadores c on c.id = w.captador_id
      where w.id = captador_workspace_pedidos.workspace_id and c.user_id = auth.uid()
    )
  );

grant all on public.captador_workspaces to authenticated;
grant all on public.captador_workspace_escopos to authenticated;
grant all on public.captador_workspace_pedidos to authenticated;

comment on table public.captador_workspaces is 'EXPERIMENTAL: workspace de autoatendimento de um captador externo dentro de uma organização.';
