import assert from "node:assert/strict";
import test from "node:test";
import {
  linhasDeMesorregioes,
  linhasDeMunicipios,
  problemasDaCarga,
  type MesorregiaoIbge,
  type MunicipioIbge,
} from "../lib/ibge-mesorregioes";

const NORTE_MATOGROSSENSE: MesorregiaoIbge = { id: 5101, nome: "Norte Mato-grossense", UF: { sigla: "MT" } };
const NORDESTE_MATOGROSSENSE: MesorregiaoIbge = { id: 5102, nome: "Nordeste Mato-grossense", UF: { sigla: "MT" } };
const SUL_GOIANO: MesorregiaoIbge = { id: 5205, nome: "Sul Goiano", UF: { sigla: "GO" } };

function municipio(id: number, nome: string, meso: MesorregiaoIbge | null, regiaoImediata?: { id: number; nome: string; uf: string }): MunicipioIbge {
  return {
    id,
    nome,
    microrregiao: meso ? { mesorregiao: meso } : null,
    "regiao-imediata": regiaoImediata
      ? { id: regiaoImediata.id, nome: regiaoImediata.nome, "regiao-intermediaria": { UF: { sigla: regiaoImediata.uf } } }
      : null,
  };
}

const SORRISO = { id: 510008, nome: "Sorriso", uf: "MT" };

test("as mesorregiões viram linhas com a sigla do estado, em ordem de código", () => {
  assert.deepEqual(linhasDeMesorregioes([SUL_GOIANO, NORTE_MATOGROSSENSE]), [
    { id: 5101, nome: "Norte Mato-grossense", uf: "MT" },
    { id: 5205, nome: "Sul Goiano", uf: "GO" },
  ]);
});

test("município com microrregião herda a mesorregião dela", () => {
  const resultado = linhasDeMunicipios([municipio(5107925, "Sorriso", NORTE_MATOGROSSENSE, SORRISO)]);
  assert.deepEqual(resultado.municipios, [{ id: 5107925, nome: "Sorriso", uf: "MT", mesorregiao_id: 5101 }]);
  assert.deepEqual(resultado.derivados, []);
  assert.deepEqual(resultado.semMesorregiao, []);
});

test("município sem microrregião fica na mesorregião de toda a região imediata dele", () => {
  const resultado = linhasDeMunicipios([
    municipio(5107925, "Sorriso", NORTE_MATOGROSSENSE, SORRISO),
    municipio(5106422, "Nova Ubiratã", NORTE_MATOGROSSENSE, SORRISO),
    municipio(5101837, "Boa Esperança do Norte", null, SORRISO),
  ]);
  assert.deepEqual(resultado.municipios.find((m) => m.id === 5101837), { id: 5101837, nome: "Boa Esperança do Norte", uf: "MT", mesorregiao_id: 5101 });
  assert.deepEqual(resultado.derivados, [{ municipio: "Boa Esperança do Norte", uf: "MT", mesorregiao: "Norte Mato-grossense", regiaoImediata: "Sorriso" }]);
  assert.deepEqual(resultado.semMesorregiao, []);
});

test("região imediata dividida entre mesorregiões não resolve: sem chute", () => {
  const resultado = linhasDeMunicipios([
    municipio(1, "A", NORTE_MATOGROSSENSE, SORRISO),
    municipio(2, "B", NORDESTE_MATOGROSSENSE, SORRISO),
    municipio(3, "Novo", null, SORRISO),
  ]);
  assert.deepEqual(resultado.semMesorregiao, [{ id: 3, nome: "Novo", uf: "MT" }]);
  assert.equal(resultado.municipios.some((m) => m.id === 3), false);
});

test("região imediata sem nenhum vizinho com mesorregião, ou ausente, também não resolve", () => {
  const sozinho = linhasDeMunicipios([municipio(3, "Novo", null, SORRISO)]);
  assert.deepEqual(sozinho.semMesorregiao, [{ id: 3, nome: "Novo", uf: "MT" }]);
  const semRegiao = linhasDeMunicipios([municipio(4, "Perdido", null)]);
  assert.deepEqual(semRegiao.semMesorregiao, [{ id: 4, nome: "Perdido", uf: "" }]);
});

test("mesorregião de outro estado na mesma região imediata não é aceita", () => {
  const resultado = linhasDeMunicipios([
    municipio(1, "Vizinho", SUL_GOIANO, SORRISO),
    municipio(2, "Novo", null, SORRISO),
  ]);
  assert.deepEqual(resultado.semMesorregiao, [{ id: 2, nome: "Novo", uf: "MT" }]);
});

test("as linhas saem em ordem de código", () => {
  const resultado = linhasDeMunicipios([
    municipio(5107925, "Sorriso", NORTE_MATOGROSSENSE, SORRISO),
    municipio(5101837, "Boa Esperança do Norte", null, SORRISO),
    municipio(5106422, "Nova Ubiratã", NORTE_MATOGROSSENSE, SORRISO),
  ]);
  assert.deepEqual(resultado.municipios.map((m) => m.id), [5101837, 5106422, 5107925]);
});

test("a carga completa não tem problema; contagem errada, mesorregião sumida e estado trocado têm", () => {
  const mesorregioes = linhasDeMesorregioes([NORTE_MATOGROSSENSE, SUL_GOIANO]);
  const municipios = linhasDeMunicipios([municipio(5107925, "Sorriso", NORTE_MATOGROSSENSE, SORRISO), municipio(5218805, "Rio Verde", SUL_GOIANO)]).municipios;
  const esperado = { mesorregioes: 2, municipiosMinimo: 2 };
  assert.deepEqual(problemasDaCarga(mesorregioes, municipios, esperado), []);

  assert.match(problemasDaCarga(mesorregioes, municipios, { mesorregioes: 137, municipiosMinimo: 2 })[0], /2 mesorregiões; eram esperadas 137/);
  assert.match(problemasDaCarga(mesorregioes, municipios, { mesorregioes: 2, municipiosMinimo: 5570 })[0], /2 municípios/);
  assert.match(problemasDaCarga(mesorregioes, [{ id: 9, nome: "X", uf: "MT", mesorregiao_id: 7777 }], { mesorregioes: 2, municipiosMinimo: 1 })[0], /mesorregião 7777/);
  assert.match(problemasDaCarga(mesorregioes, [{ id: 9, nome: "X", uf: "MT", mesorregiao_id: 5205 }], { mesorregioes: 2, municipiosMinimo: 1 })[0], /mesorregião de GO/);
  assert.match(problemasDaCarga(mesorregioes, [municipios[0], municipios[0]], { mesorregioes: 2, municipiosMinimo: 1 })[0], /repetidos: 5107925/);
});
