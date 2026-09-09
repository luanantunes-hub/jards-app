import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateWeightedScore } from "../components/relationship/DecisionScorecard";

test("scorecard calcula média ponderada apenas dos critérios avaliados", () => {
  assert.equal(calculateWeightedScore([
    { peso: 3, nota: 5 },
    { peso: 1, nota: 1 },
    { peso: 3, nota: null },
  ]), 4);
  assert.equal(calculateWeightedScore([{ peso: 2, nota: null }]), null);
});

test("migration restringe pesos, notas, organização e duplicidade de critérios", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260906000002_proponente_scorecard_criterios.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /peso between 1 and 3/i);
  assert.match(migration, /nota between 1 and 5/i);
  assert.match(migration, /auth_can_write_org/i);
  assert.match(migration, /idx_proponente_score_criterios_nome_unico/i);
});
