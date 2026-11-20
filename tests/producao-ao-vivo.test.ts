import assert from "node:assert/strict";
import test from "node:test";
import { situacaoDoRoteiro, textoDoAtraso, type BlocoAoVivo } from "../lib/producao/ao-vivo";

const b = (id: string, ordem: number, inicio: string | null, fim: string | null, extra: Partial<BlocoAoVivo> = {}): BlocoAoVivo =>
  ({ id, ordem, inicio, fim, exibicao: "exata", iniciado_em: null, terminado_em: null, ...extra });

const dia = [
  b("ensaio", 0, "2026-12-05T17:00:00Z", "2026-12-05T18:00:00Z"),
  b("carga", 1, "2026-12-05T18:00:00Z", "2026-12-05T19:00:00Z"),
  b("show", 2, "2026-12-05T22:00:00Z", "2026-12-05T23:30:00Z"),
  b("a-definir", 3, null, null, { exibicao: "a_definir" }),
];

test("sem nada marcado: tudo pendente, sem atraso nem previsão", () => {
  const s = situacaoDoRoteiro(dia);
  assert.deepEqual([...s.values()].map(x => x.estado), ["pendente", "pendente", "pendente", "pendente"]);
  assert.ok([...s.values()].every(x => x.previstoPara === null && x.atrasoPropagadoMin === 0));
});

test("começou 10 minutos tarde: em andamento, atraso do começo e previsão dos seguintes com +10", () => {
  const s = situacaoDoRoteiro([{ ...dia[0], iniciado_em: "2026-12-05T17:10:00Z" }, ...dia.slice(1)]);
  assert.equal(s.get("ensaio")?.estado, "em_andamento");
  assert.equal(s.get("ensaio")?.atrasoDoComecoMin, 10);
  assert.equal(s.get("carga")?.atrasoPropagadoMin, 10);
  assert.equal(s.get("carga")?.previstoPara, "2026-12-05T18:10:00.000Z");
  assert.equal(s.get("show")?.previstoPara, "2026-12-05T22:10:00.000Z");
  assert.equal(s.get("a-definir")?.previstoPara, null, "o 'a definir' não recebe previsão");
});

test("terminou mais tarde ainda: o atraso corrente é o do último acontecimento", () => {
  const s = situacaoDoRoteiro([
    { ...dia[0], iniciado_em: "2026-12-05T17:10:00Z", terminado_em: "2026-12-05T18:25:00Z" }, ...dia.slice(1),
  ]);
  assert.equal(s.get("ensaio")?.estado, "concluido");
  assert.equal(s.get("carga")?.atrasoPropagadoMin, 25);
  assert.equal(s.get("show")?.previstoPara, "2026-12-05T22:25:00.000Z");
});

test("adiantar não puxa os seguintes; recuperar o atraso zera a previsão", () => {
  const adiantado = situacaoDoRoteiro([{ ...dia[0], iniciado_em: "2026-12-05T16:55:00Z" }, ...dia.slice(1)]);
  assert.equal(adiantado.get("ensaio")?.atrasoDoComecoMin, -5);
  assert.equal(adiantado.get("carga")?.previstoPara, null);
  const recuperou = situacaoDoRoteiro([
    { ...dia[0], iniciado_em: "2026-12-05T17:10:00Z", terminado_em: "2026-12-05T18:00:00Z" },
    { ...dia[1], iniciado_em: "2026-12-05T18:00:00Z" }, dia[2], dia[3],
  ]);
  assert.equal(recuperou.get("show")?.atrasoPropagadoMin, 0, "o último acontecimento (começo da carga) foi no horário");
});

test("blocos fora de ordem na entrada: a ordem do dia é a das horas; textos do atraso", () => {
  const s = situacaoDoRoteiro([dia[2], dia[1], { ...dia[0], iniciado_em: "2026-12-05T17:20:00Z" }]);
  assert.equal(s.get("show")?.previstoPara, "2026-12-05T22:20:00.000Z");
  assert.equal(textoDoAtraso(0), "no horário");
  assert.equal(textoDoAtraso(12), "+12 min");
  assert.equal(textoDoAtraso(-3), "3 min adiantado");
});
