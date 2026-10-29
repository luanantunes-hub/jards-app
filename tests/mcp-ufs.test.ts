import assert from "node:assert/strict";
import test from "node:test";
import { UFS, normalizarUf, separarCidadeUf } from "../lib/mcp/ufs";

test("são 27 estados, todos com sigla de duas letras maiúsculas", () => {
  assert.equal(UFS.length, 27);
  assert.ok(UFS.every((uf) => /^[A-Z]{2}$/.test(uf)));
});

test("a sigla ou o nome do estado, em qualquer caixa e com ou sem acento, vira a sigla", () => {
  assert.equal(normalizarUf("pr"), "PR");
  assert.equal(normalizarUf(" SP "), "SP");
  assert.equal(normalizarUf("Paraná"), "PR");
  assert.equal(normalizarUf("PARANA"), "PR");
  assert.equal(normalizarUf("São Paulo"), "SP");
  assert.equal(normalizarUf("sao  paulo"), "SP");
  assert.equal(normalizarUf("Mato Grosso do Sul"), "MS");
  assert.equal(normalizarUf("Mato Grosso"), "MT");
  assert.equal(normalizarUf("Distrito Federal"), "DF");
  assert.equal(normalizarUf("Espírito Santo"), "ES");
});

test("o que não é um estado volta nulo", () => {
  for (const ruim of ["XX", "D", "", "   ", "Atlantida", "Curitiba", null, undefined]) assert.equal(normalizarUf(ruim), null, String(ruim));
});

test("Cidade-UF separa em cidade e estado, com qualquer separador usual", () => {
  assert.deepEqual(separarCidadeUf("São Paulo-SP"), { cidade: "São Paulo", estado: "SP" });
  assert.deepEqual(separarCidadeUf("Curitiba - PR"), { cidade: "Curitiba", estado: "PR" });
  assert.deepEqual(separarCidadeUf("Curitiba/pr"), { cidade: "Curitiba", estado: "PR" });
  assert.deepEqual(separarCidadeUf("Curitiba, PR"), { cidade: "Curitiba", estado: "PR" });
  assert.deepEqual(separarCidadeUf("Curitiba - Paraná"), { cidade: "Curitiba", estado: "PR" });
});

test("cidade com hífen no nome não é cortada no lugar errado", () => {
  assert.deepEqual(separarCidadeUf("Mogi-Guaçu-SP"), { cidade: "Mogi-Guaçu", estado: "SP" });
  assert.deepEqual(separarCidadeUf("Mogi-Guaçu - SP"), { cidade: "Mogi-Guaçu", estado: "SP" });
});

test("só a cidade vira cidade, só a sigla vira estado, e o malformado não vira nada", () => {
  assert.deepEqual(separarCidadeUf("Curitiba"), { cidade: "Curitiba", estado: null });
  assert.deepEqual(separarCidadeUf("PR"), { cidade: null, estado: "PR" });
  for (const ruim of ["d-D", "Curitiba-XX", "Mogi-Guaçu", "-PR", "x", "", "   ", null, undefined]) {
    assert.deepEqual(separarCidadeUf(ruim), { cidade: null, estado: null }, String(ruim));
  }
});
