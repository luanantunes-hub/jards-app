import assert from "node:assert/strict";
import test from "node:test";
import { cargaDeEnergia, csvDaEnergia, csvDosCanais, listaDeCanais, type ObjetoDePalco } from "../lib/producao/palco";

const o = (id: string, rotulo: string, extra: Partial<ObjetoDePalco> = {}): ObjetoDePalco => ({
  id, rotulo, tipo: "instrumento", canais: null, canal_inicial: null, potencia_w: null, circuito: null, fase: null, ...extra,
});

// Um palco de banda de 5 integrantes (o aceite da PD2.5).
const banda: ObjetoDePalco[] = [
  o("bateria", "Bateria", { canais: 8, potencia_w: 0 }),
  o("baixo", "Baixo", { canais: 1, potencia_w: 600, circuito: "C1", fase: "R" }),
  o("guitarra", "Guitarra", { canais: 2, potencia_w: 800, circuito: "C1", fase: "R" }),
  o("teclado", "Teclado", { canais: 2, potencia_w: 400, circuito: "C2", fase: "S" }),
  o("voz", "Voz principal", { canais: 1, tipo: "microfone", potencia_w: 100, circuito: "C2", fase: "S" }),
  o("monitor", "Monitor 1", { tipo: "monitor", potencia_w: 1000, circuito: "C3", fase: "T" }),
  o("cenario", "Painel de fundo", { tipo: "cenario" }),
];

test("a lista de canais da banda: 14 canais, numerados na ordem em que os objetos entraram", () => {
  const lista = listaDeCanais(banda);
  assert.equal(lista.total, 14);
  assert.deepEqual(lista.conflitos, []);
  assert.deepEqual(lista.linhas.slice(0, 3).map(linha => [linha.canal, linha.fonte]), [[1, "Bateria (1/8)"], [2, "Bateria (2/8)"], [3, "Bateria (3/8)"]]);
  assert.deepEqual(lista.linhas.slice(8).map(linha => [linha.canal, linha.fonte]), [[9, "Baixo"], [10, "Guitarra (1/2)"], [11, "Guitarra (2/2)"], [12, "Teclado (1/2)"], [13, "Teclado (2/2)"], [14, "Voz principal"]]);
});

test("canal fixado fica onde foi fixado e os outros desviam; dois fixados no mesmo canal viram conflito", () => {
  // a Caixa (2 canais) não cabe nos livres 2 (o 3 é da Gaita): vai para 4 e 5
  const livre = listaDeCanais([o("a", "Voz", { canais: 1, canal_inicial: 1 }), o("b", "Caixa", { canais: 2 }), o("c", "Gaita", { canais: 1, canal_inicial: 3 })]);
  assert.deepEqual(livre.linhas.filter(linha => linha.rotulo === "Caixa").map(linha => linha.canal), [4, 5]);
  const conflito = listaDeCanais([o("a", "Voz", { canais: 1, canal_inicial: 2 }), o("b", "Gaita", { canais: 1, canal_inicial: 2 })]);
  assert.deepEqual(conflito.conflitos, [{ canal: 2, fontes: ["Voz", "Gaita"] }]);
  assert.equal(conflito.linhas.length, 2);
});

test("sem canais não há lista", () => {
  assert.deepEqual(listaDeCanais([o("a", "Cenário")]), { linhas: [], conflitos: [], total: 0 });
  assert.deepEqual(listaDeCanais([o("a", "Cenário", { canais: 0 })]).linhas, []);
});

test("a carga por circuito e fase: soma, corrente e desequilíbrio", () => {
  const carga = cargaDeEnergia(banda);
  assert.deepEqual(carga.linhas.map(linha => [linha.circuito, linha.fase, linha.objetos, linha.potenciaW, linha.correnteA]), [
    ["C1", "R", 2, 1400, 6.4], ["C2", "S", 2, 500, 2.3], ["C3", "T", 1, 1000, 4.5],
  ]);
  assert.equal(carga.totalW, 2900);
  assert.deepEqual(carga.porFase, { R: 1400, S: 500, T: 1000, sem: 0 });
  assert.equal(carga.desequilibrioPct, 64);
  assert.equal(cargaDeEnergia([o("a", "X", { potencia_w: 300, fase: "R", circuito: "C1" })]).desequilibrioPct, null);
});

test("o que tem potência e não tem circuito entra em \"Sem circuito\"; potência zero não entra", () => {
  const carga = cargaDeEnergia([o("a", "Refletor", { potencia_w: 500 }), o("b", "Cabo", { potencia_w: 0 })]);
  assert.deepEqual(carga.linhas.map(linha => [linha.circuito, linha.fase, linha.potenciaW]), [["Sem circuito", null, 500]]);
  assert.equal(carga.porFase.sem, 500);
});

test("a planilha: ponto e vírgula, BOM, vírgula decimal e aspas quando preciso", () => {
  const canais = csvDosCanais(listaDeCanais([o("a", 'Voz "A"; coro', { canais: 1 })]));
  assert.ok(canais.startsWith("﻿Canal;Fonte\r\n1;\"Voz \"\"A\"\"; coro\"\r\n"));
  const energia = csvDaEnergia(cargaDeEnergia(banda));
  assert.ok(energia.includes("C1;R;2;1400;6,4\r\n"));
  assert.ok(energia.endsWith("Total;;;2900;13,2\r\n"));
});
