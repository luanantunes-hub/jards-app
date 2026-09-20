import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("funis de negociação e inscrição sugerem etapas e preservam remoções por organização", async () => {
  const context = await readFile(path.join(root, "contexts/EtiquetasContext.tsx"), "utf8");
  assert.match(context, /DEFAULT_ETIQUETAS_CAPTACAO/);
  assert.match(context, /DEFAULT_ETIQUETAS_INSCRICAO/);
  assert.match(context, /funil_etapas_removidas/);
  assert.match(context, /hidden\.has\(`captacao:/);
  assert.match(context, /hidden\.has\(`inscricao:/);
});

test("exclusão de etapa transfere registros antes de removê-la em uma transação", async () => {
  const migration = await readFile(path.join(root, "supabase/migrations/20260920000002_funis_personalizaveis.sql"), "utf8");
  const config = await readFile(path.join(root, "components/EtiquetasConfig.tsx"), "utf8");
  assert.match(migration, /update public\.captacoes set status = p_target_key/);
  assert.match(migration, /update public\.empresas_crm set status = p_target_key/);
  assert.match(migration, /update public\.editais_user set status = p_target_key/);
  assert.match(migration, /update public\.editais_inscritos set status = p_target_key/);
  assert.match(migration, /insert into public\.funil_etapas_removidas/);
  assert.match(migration, /delete from public\.etiquetas/);
  assert.match(config, /rpc\("remover_etapa_funil"/);
  assert.match(config, /etiquetas\.length < 2/);
});
