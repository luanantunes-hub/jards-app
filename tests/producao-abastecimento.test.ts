import assert from "node:assert/strict";
import test from "node:test";
import { lerAbastecimento, resumoDosAbastecimentos } from "../lib/producao/abastecimento";
import { lerValorEmReais } from "../lib/producao/dinheiro";

const base = { litros: "45,3", combustivel: "diesel_s10", posto: "  Posto Estrela ", valor: "280,50" };

test("abastecimento: litros, combustível, posto e valor como o banco aceita", () => {
  const leitura = lerAbastecimento(base, lerValorEmReais);
  assert.ok(leitura.ok);
  assert.deepEqual(leitura.abastecimento, { litros: 45.3, combustivel: "diesel_s10", posto: "Posto Estrela", valor: 280.5 });
  const sem = lerAbastecimento({ ...base, posto: " ", valor: "" }, lerValorEmReais);
  assert.ok(sem.ok && sem.abastecimento.posto === null && sem.abastecimento.valor === null);
});

test("abastecimento: o que o banco recusaria é recusado antes, em texto", () => {
  const erro = (mudanca: Partial<typeof base>) => { const l = lerAbastecimento({ ...base, ...mudanca }, lerValorEmReais); return l.ok ? null : l.erro; };
  assert.match(erro({ litros: "" }) ?? "", /litros/);
  assert.match(erro({ litros: "0" }) ?? "", /litros/);
  assert.match(erro({ litros: "10000" }) ?? "", /litros/);
  assert.match(erro({ combustivel: "agua" }) ?? "", /combustível/);
  assert.match(erro({ posto: "x".repeat(201) }) ?? "", /posto/);
  assert.match(erro({ valor: "abc" }) ?? "", /valor/);
  assert.match(erro({ valor: "100000" }) ?? "", /valor/);
});

test("resumo: litros, total e preço médio do litro; sem valor fica fora da média e é contado", () => {
  const resumo = resumoDosAbastecimentos([{ litros: 40, valor: 240 }, { litros: 10, valor: 70 }, { litros: 5, valor: null }]);
  assert.equal(resumo.quantidade, 3);
  assert.equal(resumo.litros, 55);
  assert.equal(resumo.valorCentavos, 31000);
  assert.equal(resumo.precoDoLitroCentavos, 620);
  assert.equal(resumo.semValor, 1);
  const vazio = resumoDosAbastecimentos([]);
  assert.deepEqual([vazio.litros, vazio.valorCentavos, vazio.precoDoLitroCentavos], [0, 0, null]);
  assert.equal(resumoDosAbastecimentos([{ litros: 5, valor: null }]).precoDoLitroCentavos, null);
});
