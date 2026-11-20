import assert from "node:assert/strict";
import test from "node:test";
import { apagarDoCelular, chaveDaData, falhaDeRede, lerDoCelular, salvarNoCelular, type ArmazenamentoSimples } from "../lib/producao/folha-cache";

// A folha sem internet (PD1.13): o que fica salvo no celular.

function armazenamentoDeMemoria(): ArmazenamentoSimples & { itens: Map<string, string> } {
  const itens = new Map<string, string>();
  return { itens, getItem: chave => itens.get(chave) ?? null, setItem: (chave, valor) => { itens.set(chave, valor); }, removeItem: chave => { itens.delete(chave); } };
}

test("o que é salvo volta com a hora, e é separado por usuário e por data", () => {
  const celular = armazenamentoDeMemoria();
  salvarNoCelular(celular, "ana", chaveDaData("d1"), { titulo: "Sábado" }, 1000);
  assert.deepEqual(lerDoCelular(celular, "ana", chaveDaData("d1")), { salvoEm: 1000, dados: { titulo: "Sábado" } });
  assert.equal(lerDoCelular(celular, "bia", chaveDaData("d1")), null, "outra conta no mesmo celular não vê o salvo da primeira");
  assert.equal(lerDoCelular(celular, "ana", chaveDaData("d2")), null);
  apagarDoCelular(celular, "ana", chaveDaData("d1"));
  assert.equal(lerDoCelular(celular, "ana", chaveDaData("d1")), null, "apagar tira do celular");
});

test("armazenamento corrompido, cheio ou bloqueado não derruba nada", () => {
  const celular = armazenamentoDeMemoria();
  celular.itens.set("jards:folha:ana:datas", "{isso não é json");
  assert.equal(lerDoCelular(celular, "ana", "datas"), null);
  celular.itens.set("jards:folha:ana:datas", JSON.stringify({ dados: [] }));
  assert.equal(lerDoCelular(celular, "ana", "datas"), null, "sem a hora não vale");
  const quebrado: ArmazenamentoSimples = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("cheio"); }, removeItem: () => { throw new Error("bloqueado"); } };
  assert.doesNotThrow(() => salvarNoCelular(quebrado, "ana", "datas", [], 1));
  assert.equal(lerDoCelular(quebrado, "ana", "datas"), null);
  assert.doesNotThrow(() => apagarDoCelular(quebrado, "ana", "datas"));
});

test("só falha de rede mostra o salvo: recusa do banco não", () => {
  assert.equal(falhaDeRede(null, true), false);
  assert.equal(falhaDeRede({ message: "TypeError: Failed to fetch" }, true), true);
  assert.equal(falhaDeRede({ message: "qualquer coisa" }, false), true, "sem internet no aparelho");
  assert.equal(falhaDeRede({ message: "permission denied for function", code: "42501" }, true), false);
});
