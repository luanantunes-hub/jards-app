import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("captador só move para etapas do funil real da organização, não um enum fixo", async () => {
  const migration = await readFile(path.join(root, "supabase/migrations/20260921021843_captador_kanban_funil_real.sql"), "utf8");
  assert.match(migration, /fn_workspace_papel\(p_atribuicao_id\) <> 'captador'/);
  assert.match(migration, /v_status <> 'ativa'/);
  assert.match(migration, /from public\.captador_workspace_pedidos/);
  assert.match(migration, /from public\.etiquetas where organization_id = v_org/);
  assert.match(migration, /from public\.funil_etapas_removidas where organization_id = v_org/);
  assert.doesNotMatch(migration, /workspace_etapa in \('a_iniciar', 'em_andamento', 'aguardando_retorno'\)/);
});

test("somente o captador move uma atribuição ativa", async () => {
  const migration = await readFile(path.join(root, "supabase/migrations/20260921011410_captador_kanban.sql"), "utf8");
  assert.match(migration, /fn_workspace_papel\(p_atribuicao_id\) <> 'captador'/);
  assert.match(migration, /v_status <> 'ativa'/);
});

test("pedidos aparecem em Atividades sem duplicar atividades do CRM", async () => {
  const page = await readFile(path.join(root, "app/(dashboard)/atividades/page.tsx"), "utf8");
  assert.match(page, /from\("workspace_acoes"\)/);
  assert.match(page, /source_kind: "workspace" as const/);
  assert.match(page, /\/captadores\/\$\{row\.atribuicao\.captador_user_id\}\?workspace=/);
  assert.doesNotMatch(page, /from\("atividades"\)\.insert\([^)]*workspace/);
});
