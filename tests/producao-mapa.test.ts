import assert from "node:assert/strict";
import test from "node:test";
import { paradasDaTurne, projetar, TAMANHO_DO_MAPA, totalDeKm, tracoDoPais, type DataComLugar } from "../lib/producao/mapa";

const sp = { chave: "sp", nome: "São Paulo", latitude: -23.55, longitude: -46.63 };
const rj = { chave: "rj", nome: "Rio de Janeiro", latitude: -22.91, longitude: -43.17 };
const d = (id: string, data: string, lugar: typeof sp): DataComLugar => ({ id, data, ...lugar });

test("o desenho: o norte fica no alto, o leste à direita e os extremos do país cabem", () => {
  const manaus = projetar(-3.12, -60.02), recife = projetar(-8.05, -34.9), poa = projetar(-30.03, -51.23);
  assert.ok(manaus.y < poa.y, "norte acima do sul");
  assert.ok(recife.x > manaus.x, "leste à direita");
  for (const ponto of [manaus, recife, poa, projetar(5.27, -60.2), projetar(-33.75, -53.4)]) {
    assert.ok(ponto.x >= 0 && ponto.x <= TAMANHO_DO_MAPA.largura && ponto.y >= 0 && ponto.y <= TAMANHO_DO_MAPA.altura);
  }
});

test("o traço do país tem um ponto por município", () => {
  assert.equal(tracoDoPais([["1", "A", "SP", -23.5, -46.6], ["2", "B", "RJ", -22.9, -43.2]] as const).split("M").length - 1, 2);
});

test("as paradas seguem a data; seguidas no mesmo lugar viram uma; voltar ao lugar é parada nova", () => {
  const paradas = paradasDaTurne([d("c", "2026-11-12", sp), d("a", "2026-11-05", sp), d("b", "2026-11-06", sp), d("e", "2026-11-09", rj)]);
  assert.deepEqual(paradas.map(p => [p.chave, p.datas]), [["sp", ["2026-11-05", "2026-11-06"]], ["rj", ["2026-11-09"]], ["sp", ["2026-11-12"]]]);
  assert.equal(paradas[0].kmDaAnterior, null);
  assert.ok(paradas[1].kmDaAnterior! > 340 && paradas[1].kmDaAnterior! < 370, "São Paulo–Rio fica perto de 360 km em linha reta");
  assert.equal(totalDeKm(paradas), paradas[1].kmDaAnterior! + paradas[2].kmDaAnterior!);
});

test("sem datas, sem paradas", () => {
  assert.deepEqual(paradasDaTurne([]), []);
  assert.equal(totalDeKm([]), 0);
});
