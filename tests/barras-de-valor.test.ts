import assert from "node:assert/strict";
import test from "node:test";
import { barrasAcesas } from "../lib/barras-de-valor";

test("o maior valor acende todas as barras e a metade acende metade", () => {
  assert.equal(barrasAcesas(100, 100, 24), 24);
  assert.equal(barrasAcesas(50, 100, 24), 12);
  assert.equal(barrasAcesas(25, 100, 20), 5);
});

test("qualquer valor acima de zero acende pelo menos uma barra; zero não acende nenhuma", () => {
  assert.equal(barrasAcesas(1, 1_000_000, 24), 1);
  assert.equal(barrasAcesas(0, 100, 24), 0);
  assert.equal(barrasAcesas(-5, 100, 24), 0);
});

test("sem maior valor ou sem barras, nada acende; e nunca passa do total", () => {
  assert.equal(barrasAcesas(10, 0, 24), 0);
  assert.equal(barrasAcesas(10, 100, 0), 0);
  assert.equal(barrasAcesas(300, 100, 24), 24, "valor acima do máximo não estoura");
  assert.equal(barrasAcesas(Number.NaN, 100, 24), 0);
});
