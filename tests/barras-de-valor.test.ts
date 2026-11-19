import assert from "node:assert/strict";
import test from "node:test";
import { barrasAcesas, blocosPorSegmento } from "../lib/barras-de-valor";

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

test("blocos por segmento: a soma bate com o acumulado e nunca passa do total", () => {
  assert.deepEqual(blocosPorSegmento([45, 20], 20), [9, 4]);
  assert.deepEqual(blocosPorSegmento([100], 20), [20]);
  assert.deepEqual(blocosPorSegmento([50, 50], 20), [10, 10]);
  assert.equal(blocosPorSegmento([33, 33, 34], 20).reduce((a, b) => a + b, 0), 20);
});

test("blocos por segmento: qualquer segmento acima de zero ganha pelo menos um bloco, e zero não ganha", () => {
  assert.deepEqual(blocosPorSegmento([0.5], 20), [1]);
  assert.deepEqual(blocosPorSegmento([0, 0], 20), [0, 0]);
  assert.deepEqual(blocosPorSegmento([1, 1], 20), [1, 1]);
  assert.deepEqual(blocosPorSegmento([100, 5], 20), [20, 0], "sem lugar sobrando, o segundo não passa do total");
  assert.deepEqual(blocosPorSegmento([Number.NaN, -3, 40], 20), [0, 0, 8]);
});
