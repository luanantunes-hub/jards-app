import assert from "node:assert/strict";
import test from "node:test";
import { formatarValorBRL, formatarValorCompleto, formatarValorCurto, lerValorBRL, mascararValorBRL } from "../lib/valor";

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
  assert.equal(formatarValorBRL("1500.5"), "1.500,50", "numeric do banco em texto");
  assert.equal(formatarValorBRL("abc"), "");
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

test("máscara do campo de valor: milhar e centavos enquanto digita", () => {
  const m = (texto: string, cursor?: number) => mascararValorBRL(texto, cursor);
  assert.deepEqual(m("1234"), { texto: "1.234", cursor: 5 });
  assert.deepEqual(m("1234567,8"), { texto: "1.234.567,8", cursor: 11 });
  assert.deepEqual(m("1.2345"), { texto: "12.345", cursor: 6 }, "o ponto é refeito a cada algarismo");
  assert.deepEqual(m("1.234,567"), { texto: "1.234,56", cursor: 8 }, "no máximo dois centavos");
  assert.deepEqual(m("1234,"), { texto: "1.234,", cursor: 6 });
  assert.deepEqual(m(",5"), { texto: "0,5", cursor: 3 });
  assert.deepEqual(m("0007"), { texto: "7", cursor: 1 });
  assert.deepEqual(m("12,3,4"), { texto: "12,34", cursor: 5 }, "só a primeira vírgula conta");
  assert.deepEqual(m("R$ 1.500"), { texto: "1.500", cursor: 5 });
  assert.deepEqual(m("abc"), { texto: "", cursor: 0 });
  assert.deepEqual(m(""), { texto: "", cursor: 0 });
  assert.equal(m("1234567890123456").texto, "123.456.789.012", "até R$ 999 bilhões");
});

test("máscara do campo de valor: o cursor fica onde a pessoa está editando", () => {
  // Digitou 9 depois de "1.23" em "1.234".
  assert.deepEqual(mascararValorBRL("1.2394", 5), { texto: "12.394", cursor: 5 });
  // Apagou o 2 de "1.234" (cursor logo depois do ponto).
  assert.deepEqual(mascararValorBRL("1.34", 2), { texto: "134", cursor: 1 });
  // Apagou o ponto de "12.345": nada muda.
  assert.deepEqual(mascararValorBRL("12345", 2), { texto: "12.345", cursor: 2 });
  // Cursor no começo.
  assert.deepEqual(mascararValorBRL("51.234", 1), { texto: "51.234", cursor: 1 });
});

test("o texto da máscara é lido de volta pelo mesmo valor", () => {
  for (const [texto, valor] of [["1.234", 1234], ["12.345", 12345], ["1.234.567,8", 1234567.8], ["0,5", 0.5], ["1.234,", 1234]] as const) {
    assert.deepEqual(lerValorBRL(mascararValorBRL(texto).texto), { valor, valido: true }, texto);
  }
});
