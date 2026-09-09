-- =============================================================
--  JARDS — Row Level Security
--  Migração 002: Políticas de acesso
--
--  Regra geral:
--    Público  → SELECT aberto a qualquer usuário autenticado
--               INSERT/UPDATE/DELETE apenas via service_role (admin)
--    Privado  → CRUD completo apenas onde account_id = auth.uid()
-- =============================================================


-- ─────────────────────────────────────────────
--  CAMADA 1 — PÚBLICOS: leitura para todos logados
-- ─────────────────────────────────────────────

alter table empresas    enable row level security;
alter table editais     enable row level security;
alter table responsaveis enable row level security;

-- empresas: qualquer usuário logado pode ler
create policy "empresas: leitura pública autenticada"
  on empresas for select
  to authenticated
  using (true);

-- editais: qualquer usuário logado pode ler
create policy "editais: leitura pública autenticada"
  on editais for select
  to authenticated
  using (true);

-- responsaveis: qualquer usuário logado pode ler
create policy "responsaveis: leitura pública autenticada"
  on responsaveis for select
  to authenticated
  using (true);

-- Nota: INSERT/UPDATE/DELETE nas tabelas públicas
-- são feitos apenas via service_role key (painel admin / scripts de import).
-- Não adicionar políticas de escrita aqui — elas ficam bloqueadas por padrão.


-- ─────────────────────────────────────────────
--  CAMADA 2 — PRIVADOS: CRUD isolado por conta
-- ─────────────────────────────────────────────

alter table captacoes          enable row level security;
alter table editais_inscritos  enable row level security;
alter table contatos           enable row level security;
alter table tarefas            enable row level security;

-- ── captacoes ──
create policy "captacoes: select próprio"
  on captacoes for select
  to authenticated
  using (account_id = auth.uid());

create policy "captacoes: insert próprio"
  on captacoes for insert
  to authenticated
  with check (account_id = auth.uid());

create policy "captacoes: update próprio"
  on captacoes for update
  to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "captacoes: delete próprio"
  on captacoes for delete
  to authenticated
  using (account_id = auth.uid());

-- ── editais_inscritos ──
create policy "editais_inscritos: select próprio"
  on editais_inscritos for select
  to authenticated
  using (account_id = auth.uid());

create policy "editais_inscritos: insert próprio"
  on editais_inscritos for insert
  to authenticated
  with check (account_id = auth.uid());

create policy "editais_inscritos: update próprio"
  on editais_inscritos for update
  to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "editais_inscritos: delete próprio"
  on editais_inscritos for delete
  to authenticated
  using (account_id = auth.uid());

-- ── contatos ──
create policy "contatos: select próprio"
  on contatos for select
  to authenticated
  using (account_id = auth.uid());

create policy "contatos: insert próprio"
  on contatos for insert
  to authenticated
  with check (account_id = auth.uid());

create policy "contatos: update próprio"
  on contatos for update
  to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "contatos: delete próprio"
  on contatos for delete
  to authenticated
  using (account_id = auth.uid());

-- ── tarefas ──
create policy "tarefas: select próprio"
  on tarefas for select
  to authenticated
  using (account_id = auth.uid());

create policy "tarefas: insert próprio"
  on tarefas for insert
  to authenticated
  with check (account_id = auth.uid());

create policy "tarefas: update próprio"
  on tarefas for update
  to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

create policy "tarefas: delete próprio"
  on tarefas for delete
  to authenticated
  using (account_id = auth.uid());
