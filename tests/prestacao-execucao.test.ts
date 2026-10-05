import assert from "node:assert/strict";
import test from "node:test";
import {
  executadoPorItem,
  executadoSemRubrica,
  percentualExecutado,
  totalExecutado,
} from "../lib/prestacao/execucao";

const comprovantes = [
  { no_id: "a", status: "aceito", valor_extraido: 1000 },
  { no_id: "a", status: "aceito", valor_extraido: 250.5 },
  { no_id: "a", status: "pendente", valor_extraido: 999 },
  { no_id: "b", status: "rejeitado", valor_extraido: 500 },
  { no_id: "b", status: "aceito", valor_extraido: null },
  { no_id: null, status: "aceito", valor_extraido: 300 },
];

test("só comprovantes aceitos entram no executado do item", () => {
  const mapa = executadoPorItem(comprovantes);
  assert.equal(mapa.get("a"), 1250.5);
  assert.equal(mapa.get("b"), 0);
  assert.equal(mapa.has("c"), false);
});

test("total inclui aceitos sem rubrica, que também aparecem à parte", () => {
  assert.equal(totalExecutado(comprovantes), 1550.5);
  assert.equal(executadoSemRubrica(comprovantes), 300);
});

test("percentual sem valor aprovado é nulo", () => {
  assert.equal(percentualExecutado(100, 0), null);
  assert.equal(percentualExecutado(50, 200), 25);
  assert.equal(percentualExecutado(250, 200), 125);
});
