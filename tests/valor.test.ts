import assert from "node:assert/strict";
import test from "node:test";
import { formatarValorBRL, formatarValorCompleto, formatarValorCurto, lerValorBRL } from "../lib/valor";

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

// Intl separa "R$" do número com espaço não separável.
const semNbsp = (texto: string) => texto.replace(/\u00a0/g, " ");

test("valor curto: inteiro até 999 mil e abreviado a partir de 1 milhão", () => {
  assert.equal(semNbsp(formatarValorCurto(0)), "R$ 0");
  assert.equal(semNbsp(formatarValorCurto(23000)), "R$ 23.000");
  assert.equal(semNbsp(formatarValorCurto(400000)), "R$ 400.000");
  assert.equal(semNbsp(formatarValorCurto(999999.4)), "R$ 999.999");
  assert.equal(semNbsp(formatarValorCurto(1000000)), "R$ 1 mi");
  assert.equal(semNbsp(formatarValorCurto(1500000)), "R$ 1,5 mi");
  assert.equal(semNbsp(formatarValorCurto(12345678)), "R$ 12,3 mi");
  assert.equal(semNbsp(formatarValorCurto(12999000000)), "R$ 13 bi");
  assert.equal(formatarValorCurto(null), "—");
  assert.equal(formatarValorCurto(undefined), "—");
  assert.equal(formatarValorCurto(Number.NaN), "—");
});

test("valor completo mantém os centavos", () => {
  assert.equal(semNbsp(formatarValorCompleto(1250000)), "R$ 1.250.000,00");
  assert.equal(formatarValorCompleto(null), "—");
});
