import assert from "node:assert/strict";
import test from "node:test";
import { efeitoDaMarcacao, fraseDoEfeito, fraseDoPico, picoSemExplicacao, resumoPorVeiculo, somarDias, veiculosConhecidos } from "../lib/ticketeria/imprensa";

// A imprensa medida pelas vendas de cada casa e o pico sem explicação.

const serie = (de: string, valores: number[]) => new Map(valores.map((v, i) => [somarDias(de, i), v]));
const HOJE = "2026-03-30";

test("efeito da marcação: 3 dias depois contra os 7 de antes", () => {
  // 7 dias de ~5 por dia, depois 20, 18, 12 (esperado 15, vendeu 50 → 35 a mais).
  const vendas = serie("2026-03-07", [5, 4, 6, 5, 5, 6, 4, 20, 18, 12]);
  assert.deepEqual(efeitoDaMarcacao("2026-03-14", vendas, new Map(), HOJE), { tipo: "efeito", ingressos: 35 });
  assert.match(fraseDoEfeito({ tipo: "efeito", ingressos: 35 }), /cerca de 35 a mais/);
  // Sem diferença: depois igual a antes.
  assert.deepEqual(efeitoDaMarcacao("2026-03-14", serie("2026-03-07", [5, 4, 6, 5, 5, 6, 4, 6, 5, 4]), new Map(), HOJE), { tipo: "sem_diferenca" });
  // O anúncio subiu junto: não dá para separar.
  const gasto = serie("2026-03-07", [1000, 1000, 1000, 1000, 1000, 1000, 1000, 9000, 9000, 9000]);
  assert.deepEqual(efeitoDaMarcacao("2026-03-14", vendas, gasto, HOJE), { tipo: "anuncio_mudou" });
  // O evento ainda não vendia; e ainda medindo.
  assert.deepEqual(efeitoDaMarcacao("2026-03-14", serie("2026-03-14", [30, 20, 10]), new Map(), HOJE), { tipo: "pouco_dado" });
  assert.deepEqual(efeitoDaMarcacao("2026-03-29", vendas, new Map(), HOJE), { tipo: "medindo" });
});

test("veículos conhecidos e o resumo por veículo, sem lista universal", () => {
  const acoes = [{ canal: "imprensa", veiculo: "TV Tem" }, { canal: "imprensa", veiculo: "tv  tem" }, { canal: "imprensa", veiculo: "Folha de S.Paulo" }, { canal: "instagram", veiculo: null }];
  assert.deepEqual(veiculosConhecidos(acoes), [{ nome: "TV Tem", vezes: 2 }, { nome: "Folha de S.Paulo", vezes: 1 }]);
  const r = resumoPorVeiculo([
    { veiculo: "TV Tem", efeito: { tipo: "efeito", ingressos: 40 } }, { veiculo: "TV Tem", efeito: { tipo: "sem_diferenca" } },
    { veiculo: "Folha de S.Paulo", efeito: { tipo: "anuncio_mudou" } },
  ]);
  assert.deepEqual(r, [{ veiculo: "TV Tem", vezes: 2, medidas: 2, media: 20 }, { veiculo: "Folha de S.Paulo", vezes: 1, medidas: 0, media: null }]);
});

test("pico sem explicação: 3 vezes o normal, sem anúncio a mais, sem marcação perto e sem ter sido descartado", () => {
  const vendas = serie("2026-03-01", [...Array(13).fill(5), 20, 5, 5]); // 14/03 vendeu 20, o normal é 5
  const ev = [{ eventoId: "h", evento: "o Hamlet", vendas }];
  const p = picoSemExplicacao(ev, new Map(), [], new Set(), "2026-03-17");
  assert.deepEqual(p, { eventoId: "h", evento: "o Hamlet", dia: "2026-03-14", vendidos: 20, vezes: 4 });
  assert.equal(fraseDoPico(p!), "No sábado, 14/3, o Hamlet vendeu 20 ingressos, quatro vezes o normal, e o gasto em anúncio ficou igual. Saiu algo na imprensa?");
  assert.equal(picoSemExplicacao(ev, new Map(), [{ dia: "2026-03-13", eventoId: "h" }], new Set(), "2026-03-17"), null, "matéria marcada na véspera explica");
  assert.equal(picoSemExplicacao(ev, new Map(), [{ dia: "2026-03-14", eventoId: null }], new Set(), "2026-03-17"), null, "matéria da casa toda também explica");
  assert.equal(picoSemExplicacao(ev, new Map(), [], new Set(["h|2026-03-14"]), "2026-03-17"), null, "descartado não volta");
  assert.equal(picoSemExplicacao(ev, serie("2026-03-01", [...Array(13).fill(1000), 20000]), [], new Set(), "2026-03-17"), null, "anúncio a mais explica");
  assert.equal(picoSemExplicacao([{ eventoId: "h", evento: "o Hamlet", vendas: serie("2026-03-01", [...Array(13).fill(5), 9]) }], new Map(), [], new Set(), "2026-03-17"), null, "menos de 10 no dia não conta");
});
