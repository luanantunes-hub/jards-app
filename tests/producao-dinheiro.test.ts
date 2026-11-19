import assert from "node:assert/strict";
import test from "node:test";
import { emCentavos, formatarReais, lerValorEmReais } from "../lib/producao/dinheiro";

// As três funções de dinheiro da produção (vieram de lib/producao/bordero.ts, que saiu na T1 da Ticketeria).

test("centavos: sem erro de ponto flutuante", () => {
  assert.equal(emCentavos(19.9), 1990);
  assert.equal(emCentavos(0.1 + 0.2), 30);
});

test("reais: formato brasileiro", () => {
  assert.equal(formatarReais(123456), "R$ 1.234,56");
  assert.equal(formatarReais(0), "R$ 0,00");
  assert.equal(formatarReais(-2000), "-R$ 20,00");
});

test("valor em reais: formas que a pessoa digita", () => {
  assert.equal(lerValorEmReais("50"), 50);
  assert.equal(lerValorEmReais("50,5"), 50.5);
  assert.equal(lerValorEmReais("1.234,56"), 1234.56);
  assert.equal(lerValorEmReais("1234.56"), 1234.56);
  assert.equal(lerValorEmReais("R$ 25,00"), 25);
  assert.equal(lerValorEmReais("1.234"), 1234, "ponto com três dígitos depois é milhar");
  assert.equal(lerValorEmReais(""), null);
  assert.equal(lerValorEmReais("abc"), null);
  assert.equal(lerValorEmReais("-5"), null);
  assert.equal(lerValorEmReais("1,234"), null, "três casas decimais não vale");
});
