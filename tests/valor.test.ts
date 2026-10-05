import assert from "node:assert/strict";
import test from "node:test";
import { formatarValorBRL, lerValorBRL } from "../lib/valor";

test("lê valores em reais nos formatos que as pessoas digitam", () => {
  assert.deepEqual(lerValorBRL("150.000,00"), { valor: 150000, valido: true });
  assert.deepEqual(lerValorBRL("R$ 150.000"), { valor: 150000, valido: true });
  assert.deepEqual(lerValorBRL("150000"), { valor: 150000, valido: true });
  assert.deepEqual(lerValorBRL("1.500.000"), { valor: 1500000, valido: true });
  assert.deepEqual(lerValorBRL("1500,5"), { valor: 1500.5, valido: true });
  assert.deepEqual(lerValorBRL("99.90"), { valor: 99.9, valido: true });
});

test("campo vazio é válido e sem valor; texto estranho é inválido", () => {
  assert.deepEqual(lerValorBRL("  "), { valor: null, valido: true });
  assert.equal(lerValorBRL("cem mil").valido, false);
  assert.equal(lerValorBRL("-10").valido, false);
  assert.equal(lerValorBRL("1,2,3").valido, false);
});

test("formata para exibir no campo", () => {
  assert.equal(formatarValorBRL(150000), "150.000,00");
  assert.equal(formatarValorBRL(null), "");
});
