import assert from "node:assert/strict";
import test from "node:test";
import { agruparTransfers, camposDoTransfer, dataDoTransfer, hotelDoDia, MARCADOR_DE_CHEGADA, MARCADOR_DE_SAIDA, rotuloDoGrupo, transferJaCriado } from "../lib/producao/transfers";

const e = (id: string, nome: string, dia: string | null, hora: string | null) => ({ pessoa_id: id, nome, dia, hora });

test("agrupa por dia e por janela de 60 minutos a partir do primeiro; nomes em ordem; sem hora à parte; sem dia fora", () => {
  const grupos = agruparTransfers([
    e("p3", "Carla", "2026-11-22", "15:10"), e("p1", "Ana", "2026-11-22", "14:30"), e("p2", "Bruno", "2026-11-22", "14:45"),
    e("p4", "Davi", "2026-11-22", "16:00"), e("p5", "Eva", "2026-11-23", "09:00"), e("p6", "Fabio", "2026-11-22", null), e("p7", "Gil", null, "10:00"),
  ], "chegada");
  assert.deepEqual(grupos.map(g => [g.dia, g.de, g.ate, g.pessoas.map(p => p.nome)]), [
    ["2026-11-22", "14:30", "15:10", ["Ana", "Bruno", "Carla"]],
    ["2026-11-22", "16:00", "16:00", ["Davi"]],
    ["2026-11-22", null, null, ["Fabio"]],
    ["2026-11-23", "09:00", "09:00", ["Eva"]],
  ]);
});

test("a janela conta do primeiro do grupo, não de um em um (a fila não se estica)", () => {
  const grupos = agruparTransfers([e("a", "A", "2026-11-22", "10:00"), e("b", "B", "2026-11-22", "10:50"), e("c", "C", "2026-11-22", "11:40")], "saida");
  assert.deepEqual(grupos.map(g => g.pessoas.map(p => p.nome)), [["A", "B"], ["C"]]);
  assert.equal(agruparTransfers([e("a", "A", "2026-11-22", "10:00"), e("b", "B", "2026-11-22", "10:20")], "saida", 15).length, 2);
  assert.deepEqual(agruparTransfers([], "chegada"), []);
});

test("data do transfer: a do mesmo dia, senão a mais próxima (a anterior vence o empate); sem datas, nada", () => {
  const datas = [{ id: "d1", data: "2026-11-20" }, { id: "d2", data: "2026-11-24" }];
  assert.equal(dataDoTransfer("2026-11-24", datas)?.id, "d2");
  assert.equal(dataDoTransfer("2026-11-23", datas)?.id, "d2");
  assert.equal(dataDoTransfer("2026-11-22", datas)?.id, "d1", "empate: a anterior");
  assert.equal(dataDoTransfer("2026-11-22", []), null);
});

test("hotel do dia e campos do transfer", () => {
  const hospedagens = [{ hotel: "Hotel A", entrada: "2026-11-20", saida: "2026-11-21" }, { hotel: "Hotel B", entrada: "2026-11-22", saida: "2026-11-25" }];
  assert.equal(hotelDoDia("2026-11-23", hospedagens), "Hotel B");
  assert.equal(hotelDoDia("2026-12-30", hospedagens), "Hotel A", "nenhum cobre o dia: o primeiro");
  assert.equal(hotelDoDia("2026-11-23", []), null);
  const chegada = { tipo: "chegada" as const, dia: "2026-11-22", de: "14:30", ate: "15:10", pessoas: [{ id: "p1", nome: "Ana" }] };
  assert.deepEqual(camposDoTransfer(chegada, "Hotel B"), { origem: MARCADOR_DE_CHEGADA, destino: "Hotel B", hora: "14:30" });
  assert.deepEqual(camposDoTransfer({ ...chegada, tipo: "saida" }, "Hotel B"), { origem: "Hotel B", destino: MARCADOR_DE_SAIDA, hora: "14:30" });
  assert.deepEqual(camposDoTransfer({ ...chegada, tipo: "saida" }, null), { origem: "Hotel", destino: MARCADOR_DE_SAIDA, hora: "14:30" });
});

test("já criado: um transfer do mesmo tipo (pelo marcador) que leva todas as pessoas do grupo", () => {
  const grupo = { tipo: "chegada" as const, dia: "2026-11-22", de: "14:30", ate: "15:10", pessoas: [{ id: "p1", nome: "Ana" }, { id: "p2", nome: "Bruno" }] };
  const deslocamentos = [{ id: "x1", origem: MARCADOR_DE_CHEGADA, destino: "Hotel" }, { id: "x2", origem: "São Paulo", destino: "Campinas" }];
  assert.equal(transferJaCriado(grupo, deslocamentos, new Map([["x1", ["p1", "p2", "p3"]]])), true);
  assert.equal(transferJaCriado(grupo, deslocamentos, new Map([["x1", ["p1"]]])), false, "falta uma pessoa");
  assert.equal(transferJaCriado(grupo, deslocamentos, new Map([["x2", ["p1", "p2"]]])), false, "deslocamento sem o marcador não conta");
  assert.equal(transferJaCriado({ ...grupo, tipo: "saida" }, deslocamentos, new Map([["x1", ["p1", "p2"]]])), false, "outro tipo");
});

test("rótulo do grupo", () => {
  assert.equal(rotuloDoGrupo({ tipo: "chegada", dia: "2026-11-22", de: "14:30", ate: "15:10", pessoas: [{ id: "a", nome: "A" }, { id: "b", nome: "B" }] }), "Chegada · 22/11 · 14:30 a 15:10 · 2 pessoas");
  assert.equal(rotuloDoGrupo({ tipo: "saida", dia: "2026-11-25", de: "10:00", ate: "10:00", pessoas: [{ id: "a", nome: "A" }] }), "Saída · 25/11 · 10:00 · 1 pessoa");
  assert.equal(rotuloDoGrupo({ tipo: "saida", dia: "2026-11-25", de: null, ate: null, pessoas: [{ id: "a", nome: "A" }] }), "Saída · 25/11 · sem horário · 1 pessoa");
});
