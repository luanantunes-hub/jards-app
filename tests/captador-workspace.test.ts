import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { WORKSPACE_ETAPAS, workspaceEtapaLabel } from "../components/captadores/WorkspaceStages";

const root = process.cwd();

test("kanban do captador tem três etapas operacionais", () => {
  assert.deepEqual(WORKSPACE_ETAPAS.map(etapa => etapa.id), ["a_iniciar", "em_andamento", "aguardando_retorno"]);
  assert.equal(workspaceEtapaLabel("em_andamento"), "Em andamento");
  assert.equal(workspaceEtapaLabel(null), "A iniciar");
});

test("somente o captador move uma atribuição ativa", async () => {
  const migration = await readFile(path.join(root, "supabase/migrations/20260920000009_captador_kanban.sql"), "utf8");
  assert.match(migration, /fn_workspace_papel\(p_atribuicao_id\) <> 'captador'/);
  assert.match(migration, /v_status <> 'ativa'/);
  assert.match(migration, /workspace_etapa in \('a_iniciar', 'em_andamento', 'aguardando_retorno'\)/);
});

test("pedidos aparecem em Atividades sem duplicar atividades do CRM", async () => {
  const page = await readFile(path.join(root, "app/(dashboard)/atividades/page.tsx"), "utf8");
  assert.match(page, /from\("workspace_acoes"\)/);
  assert.match(page, /source_kind: "workspace" as const/);
  assert.match(page, /\/captadores\/\$\{row\.atribuicao\.captador_user_id\}\?workspace=/);
  assert.doesNotMatch(page, /from\("atividades"\)\.insert\([^)]*workspace/);
});
