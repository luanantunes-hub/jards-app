import assert from "node:assert/strict";
import test from "node:test";
import { podeAbrirProducao, tituloSugeridoDaTemporada } from "../lib/producao/abrir";

test("a oferta aparece com venda registrada ou inscrição aprovada, e só então", () => {
  assert.equal(podeAbrirProducao({ vendas: 0, inscricoesAprovadas: 0 }), false);
  assert.equal(podeAbrirProducao({ vendas: 1, inscricoesAprovadas: 0 }), true);
  assert.equal(podeAbrirProducao({ vendas: 0, inscricoesAprovadas: 2 }), true);
});

test("o nome sugerido é o do projeto, aparado e dentro do limite do banco", () => {
  assert.equal(tituloSugeridoDaTemporada("  Festival Sul  "), "Festival Sul");
  assert.equal(tituloSugeridoDaTemporada("a".repeat(300)).length, 200);
});
