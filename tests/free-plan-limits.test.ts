import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("plano gratuito limita as seis entidades operacionais por organização", async () => {
  const migration = await readFile(
    path.join(root, "supabase/migrations/20260908000002_limites_plano_gratuito.sql"),
    "utf8",
  );

  const limits: Array<[string, number]> = [
    ["projetos_crm", 1],
    ["atividades", 5],
    ["editais_user", 5],
    ["captadores", 1],
    ["proponentes", 1],
    ["contas_patrocinio", 5],
  ];

  assert.match(migration, /member\.papel = 'admin'/);
  assert.match(migration, /profile\.plano::text <> 'gratuito'/);
  assert.match(migration, /pg_advisory_xact_lock/);

  for (const [table, limit] of limits) {
    assert.match(migration, new RegExp(`when '${table}' then[\\s\\S]*?v_limit := ${limit};`));
    assert.match(migration, new RegExp(`on public\\.${table}`));
  }
});

test("tela Meu Plano comunica o freemium e mantém os limites de uso", async () => {
  const page = await readFile(path.join(root, "app/(dashboard)/meu-plano/page.tsx"), "utf8");

  for (const feature of [
    "Negociações, empresas e contatos sem limite",
    "Incentivadores, editais e histórico de aportes",
    "1 projeto ativo e 1 usuário",
    "Comparativo com até 15 empresas",
  ]) {
    assert.match(page, new RegExp(`"${feature}"`));
  }

  assert.match(page, /limites: \{ projetos: 1, atividades: 5, inscricoes: 5, captadores: 1, proponentes: 1, clientes: 5 \}/);
  assert.doesNotMatch(page, /Suporte prioritário/);
});
