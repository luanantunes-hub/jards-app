import assert from "node:assert/strict";
import test from "node:test";
import { lerItem, lerNumero, pesoTotalKg, totaisDoInventario, valorTotalDoItem, volumeM3, type CamposDoItem } from "../lib/producao/inventario";

const base: CamposDoItem = {
  nome: " Praticável 2x1 ", categoria: "praticavel", dono: "producao", espacoId: "", fornecedor: "", locacaoInicio: "", locacaoFim: "", quantidade: "4",
  comprimento: "200", largura: "100", altura: "40", peso: "18,5", serie: "", potencia: "", canais: "", notas: "", valorUnitario: "1.200,00", valorLocacao: "",
};

test("números digitados: vírgula decimal, ponto de milhar, vazio e lixo", () => {
  assert.equal(lerNumero("1.250,5"), 1250.5);
  assert.equal(lerNumero("40"), 40);
  assert.equal(lerNumero("0,75"), 0.75);
  assert.equal(lerNumero("  "), null);
  assert.equal(lerNumero("-3"), "invalido");
  assert.equal(lerNumero("abc"), "invalido");
});

test("o item lido tem o formato do banco", () => {
  const leitura = lerItem(base);
  assert.ok(leitura.ok);
  assert.deepEqual(leitura.item, {
    nome: "Praticável 2x1", categoria: "praticavel", dono: "producao", espaco_id: null, fornecedor: null, locacao_inicio: null, locacao_fim: null, quantidade: 4,
    comprimento_cm: 200, largura_cm: 100, altura_cm: 40, peso_kg: 18.5, serie: null, potencia_w: null, canais: null, notas: null,
  });
  assert.equal(leitura.valor_unitario, 1200);
  assert.equal(leitura.valor_locacao, null);
});

test("fornecedor e período só valem para o locado; espaço só para o de um espaço", () => {
  const produzido = lerItem({ ...base, fornecedor: "Som & Luz", locacaoInicio: "2026-12-01", espacoId: "e1", valorLocacao: "300" });
  assert.ok(produzido.ok);
  assert.equal(produzido.item.fornecedor, null);
  assert.equal(produzido.item.locacao_inicio, null);
  assert.equal(produzido.item.espaco_id, null);
  assert.equal(produzido.valor_locacao, null);
  const locado = lerItem({ ...base, dono: "locado", fornecedor: "Som & Luz", locacaoInicio: "2026-12-01", locacaoFim: "2026-12-10", valorLocacao: "3.500,00" });
  assert.ok(locado.ok);
  assert.deepEqual([locado.item.fornecedor, locado.item.locacao_fim, locado.valor_locacao], ["Som & Luz", "2026-12-10", 3500]);
  const noEspaco = lerItem({ ...base, dono: "espaco", espacoId: "e1" });
  assert.ok(noEspaco.ok && noEspaco.item.espaco_id === "e1");
});

test("o que o banco recusaria a tela recusa antes", () => {
  for (const mudanca of [
    { nome: " " }, { nome: "a".repeat(201) }, { categoria: "x" }, { dono: "x" }, { quantidade: "0" }, { quantidade: "2,5" }, { quantidade: "100000" },
    { altura: "-1" }, { peso: "abc" }, { canais: "513" }, { canais: "2,5" }, { potencia: "10,5" }, { valorUnitario: "-1" },
    { dono: "locado", locacaoInicio: "2026-12-10", locacaoFim: "2026-12-01" }, { notas: "a".repeat(2001) },
  ]) assert.equal(lerItem({ ...base, ...mudanca }).ok, false, JSON.stringify(mudanca));
});

test("volume em m³ e peso total, com o que falta contado à parte", () => {
  const praticavel = { quantidade: 4, comprimento_cm: 200, largura_cm: 100, altura_cm: 40, peso_kg: 18.5, dono: "producao" as const };
  assert.equal(volumeM3(praticavel), 3.2);
  assert.equal(pesoTotalKg(praticavel), 74);
  assert.equal(volumeM3({ ...praticavel, altura_cm: null }), null);
  const totais = totaisDoInventario([praticavel, { ...praticavel, quantidade: 1, altura_cm: null }, { ...praticavel, quantidade: 2, peso_kg: null }]);
  assert.deepEqual(totais, { itens: 3, unidades: 7, volumeM3: 4.8, pesoKg: 92.5, semMedidas: 2 });
});

test("o valor do item: unidade × quantidade mais a locação; sem valores é zero", () => {
  assert.equal(valorTotalDoItem(4, { valor_unitario: 1200, valor_locacao: null }), 4800);
  assert.equal(valorTotalDoItem(1, { valor_unitario: 10, valor_locacao: 3500 }), 3510);
  assert.equal(valorTotalDoItem(3, null), 0);
});
