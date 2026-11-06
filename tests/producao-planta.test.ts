import assert from "node:assert/strict";
import test from "node:test";
import { caixaOcupada, encaixar, girar, lerPlanta, manterDentro, objetoDoItem, pixelsParaMetros } from "../lib/producao/planta";

test("a planta lida tem o formato do banco, com vírgula decimal", () => {
  assert.deepEqual(lerPlanta({ nome: " Palco principal ", tipo: "palco", largura: "12,5", profundidade: "8" }), { ok: true, planta: { nome: "Palco principal", tipo: "palco", largura_m: 12.5, profundidade_m: 8 } });
  for (const mudanca of [{ nome: " " }, { tipo: "jardim" }, { largura: "0,4" }, { largura: "501" }, { profundidade: "" }, { profundidade: "abc" }]) {
    assert.equal(lerPlanta({ nome: "x", tipo: "palco", largura: "10", profundidade: "6", ...mudanca }).ok, false, JSON.stringify(mudanca));
  }
});

test("o encaixe vai ao décimo de metro mais perto", () => {
  assert.equal(encaixar(2.34), 2.3);
  assert.equal(encaixar(2.36), 2.4);
  assert.equal(encaixar(0.04), 0);
  assert.equal(encaixar(-0.26), -0.3);
});

test("girado em 90 graus, o objeto de 4 × 2 ocupa 2 × 4 em torno do mesmo centro", () => {
  const caixa = caixaOcupada({ x_m: 1, y_m: 1, largura_m: 4, profundidade_m: 2, rotacao_graus: 90 });
  assert.deepEqual([caixa.largura, caixa.profundidade].map(n => Math.round(n * 100) / 100), [2, 4]);
  assert.deepEqual([caixa.x, caixa.y].map(n => Math.round(n * 100) / 100), [2, 0]);
  assert.deepEqual(caixaOcupada({ x_m: 1, y_m: 1, largura_m: 4, profundidade_m: 2, rotacao_graus: 0 }), { x: 1, y: 1, largura: 4, profundidade: 2 });
});

test("manter dentro: encosta nas bordas, também depois de girar, e não explode se a planta for menor", () => {
  const planta = { largura_m: 10, profundidade_m: 6 };
  assert.deepEqual(manterDentro({ x_m: -3, y_m: 9, largura_m: 2, profundidade_m: 1, rotacao_graus: 0 }, planta), { x_m: 0, y_m: 5 });
  assert.deepEqual(manterDentro({ x_m: 20, y_m: 0, largura_m: 2, profundidade_m: 1, rotacao_graus: 0 }, planta), { x_m: 8, y_m: 0 });
  // 4 × 2 a 90° em (0, 0): a caixa 2 × 4 começa em (1, −1); só falta descer 1 m
  const girado = manterDentro({ x_m: 0, y_m: 0, largura_m: 4, profundidade_m: 2, rotacao_graus: 90 }, planta);
  assert.deepEqual(girado, { x_m: 0, y_m: 1 });
  assert.deepEqual(manterDentro({ x_m: 5, y_m: 5, largura_m: 20, profundidade_m: 20, rotacao_graus: 0 }, planta), { x_m: 0, y_m: 0 });
});

test("pixels para metros acompanha o viewBox (e não muda com o tamanho da tela)", () => {
  const viewBox = { x: -0.5, y: -0.5, largura: 13, altura: 9 };
  assert.deepEqual(pixelsParaMetros({ x: 100, y: 50 }, { left: 100, top: 50, width: 390, height: 270 }, viewBox), { x: -0.5, y: -0.5 });
  assert.deepEqual(pixelsParaMetros({ x: 490, y: 320 }, { left: 100, top: 50, width: 390, height: 270 }, viewBox), { x: 12.5, y: 8.5 });
  const pequeno = pixelsParaMetros({ x: 295, y: 185 }, { left: 100, top: 50, width: 390, height: 270 }, viewBox);
  const grande = pixelsParaMetros({ x: 1000, y: 650 }, { left: 0, top: 0, width: 2000, height: 1384.6153846 }, viewBox);
  assert.equal(Math.round(pequeno.x * 10) / 10, 6);
  assert.equal(Math.round(grande.x * 10) / 10, 6);
});

test("o item do inventário vira objeto com as medidas em metros, no centro; sem medidas vale 1 m", () => {
  const planta = { largura_m: 12, profundidade_m: 8 };
  assert.deepEqual(objetoDoItem({ nome: "Praticável 2x1", comprimento_cm: 200, largura_cm: 100 }, planta), { rotulo: "Praticável 2x1", largura_m: 2, profundidade_m: 1, x_m: 5, y_m: 3.5 });
  assert.deepEqual(objetoDoItem({ nome: "Caixa", comprimento_cm: null, largura_cm: null }, planta), { rotulo: "Caixa", largura_m: 1, profundidade_m: 1, x_m: 5.5, y_m: 3.5 });
});

test("girar volta ao zero e nunca é negativo", () => {
  assert.equal(girar(350, 15), 5);
  assert.equal(girar(5, -15), 350);
  assert.equal(girar(0, 90), 90);
});
