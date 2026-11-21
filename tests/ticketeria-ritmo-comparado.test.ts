import assert from "node:assert/strict";
import test from "node:test";
import { DIAS_DA_CURVA, FATOR_DA_FAIXA, candidatosDoEvento, parecidoCom, preverPorComparacao, vendidoNoFim, type CurvaDoEvento } from "../lib/ticketeria/ritmo-comparado";

// Um evento de 200 lugares que vende a fração final `final`, com a curva (1 - (d/60)^k).
const curva = (id: string, final: number, k = 1.6, extra: Partial<CurvaDoEvento> = {}): CurvaDoEvento => ({
  id, nome: id, quando: "mar/2025", local: "Teatro Municipal", localId: "L1", precoMedioCentavos: 6000, lugares: 200,
  acumulado: Array.from({ length: DIAS_DA_CURVA + 1 }, (_, d) => Math.round(200 * final * (1 - (d / DIAS_DA_CURVA) ** k))), ...extra,
});
const ATUAL = { id: "atual", localId: "L1", precoMedioCentavos: 6200 };

test("parecido: mesmo local, preço na faixa e que vendeu pelo menos 20% da lotação; senão, o motivo", () => {
  assert.deepEqual(parecidoCom(ATUAL, curva("a", 0.9)), { parecido: true });
  assert.deepEqual(parecidoCom(ATUAL, curva("atual", 0.9)), { parecido: false, motivo: "é o próprio evento" });
  assert.deepEqual(parecidoCom(ATUAL, curva("b", 0.9, 1.6, { localId: "L2" })), { parecido: false, motivo: "outro local" });
  assert.deepEqual(parecidoCom(ATUAL, curva("c", 0.9, 1.6, { precoMedioCentavos: 12000 })), { parecido: false, motivo: "outro preço" });
  assert.deepEqual(parecidoCom(ATUAL, curva("d", 0.9, 1.6, { precoMedioCentavos: 3000 })), { parecido: false, motivo: "outro preço" });
  assert.deepEqual(parecidoCom(ATUAL, curva("e", 0.1)), { parecido: false, motivo: "vendeu pouco" });
  assert.equal(parecidoCom(ATUAL, curva("f", 0.9, 1.6, { precoMedioCentavos: 0 })).parecido, true, "sem preço conhecido, o preço não exclui");
});

test("os candidatos: a sugestão vem do veredito e a escolha do produtor vale mais", () => {
  const todos = [curva("a", 0.9), curva("b", 0.9, 1.6, { localId: "L2" }), curva("atual", 0.5)];
  const c = candidatosDoEvento(ATUAL, todos);
  assert.deepEqual(c.map(x => [x.curva.id, x.usado]), [["a", true], ["b", false]], "o próprio evento nunca é candidato");
  const escolhido = candidatosDoEvento(ATUAL, todos, { a: false, b: true });
  assert.deepEqual(escolhido.map(x => x.usado), [false, true]);
});

test("a previsão: se o evento está igual ao parecido no mesmo ponto, termina igual ao parecido", () => {
  const p = curva("a", 0.9);
  const hoje18 = p.acumulado[18];
  const r = preverPorComparacao({ vendidos: hoje18, lugares: 200, diasAteASessao: 18, parecidos: [p] })!;
  assert.equal(r.n, 1);
  assert.equal(Math.round(r.ingressos), vendidoNoFim(p), "180");
  assert.equal(r.baixo, null, "com um parecido só não há faixa");
  assert.equal(r.selo, "muito_impreciso");
});

test("a previsão ajusta pela razão: o evento tem metade do que o parecido tinha no mesmo ponto, termina com metade", () => {
  const p = curva("a", 0.9);
  const r = preverPorComparacao({ vendidos: Math.round(p.acumulado[18] / 2), lugares: 200, diasAteASessao: 18, parecidos: [p] })!;
  assert.ok(Math.abs(r.ingressos - vendidoNoFim(p) / 2) <= 2);
  assert.ok(r.noMesmoPonto.min > 0 && r.noMesmoPonto.min === r.noMesmoPonto.max);
});

test("a previsão com vários parecidos: mediana, faixa de 80% pelo t de Student alargada e selo pelo número de parecidos", () => {
  const ps = [curva("a", 0.8), curva("b", 0.9), curva("c", 1.0), curva("d", 0.85)];
  const vendidos = 110;
  const r = preverPorComparacao({ vendidos, lugares: 200, diasAteASessao: 18, parecidos: ps })!;
  const proj = ps.map(p => Math.min(1, (vendidos / 200 / (p.acumulado[18] / 200)) * (vendidoNoFim(p) / 200)));
  const ord = [...proj].sort((a, b) => a - b);
  assert.ok(Math.abs(r.ingressos - ((ord[1] + ord[2]) / 2) * 200) < 1e-9, "a mediana");
  const logs = proj.map(Math.log); const m = logs.reduce((s, x) => s + x, 0) / 4; const s = Math.sqrt(logs.reduce((a, x) => a + (x - m) ** 2, 0) / 3);
  const meia = 1.638 * s * Math.sqrt(1.25) * FATOR_DA_FAIXA; // t de Student 80% com 3 graus de liberdade (4 parecidos)
  assert.ok(Math.abs((r.baixo as number) - Math.exp(m - meia) * 200) < 1e-9);
  assert.ok((r.baixo as number) < r.ingressos && r.ingressos <= (r.alto as number) && (r.alto as number) <= 200);
  assert.equal(r.selo, "impreciso");
  assert.equal(preverPorComparacao({ vendidos, lugares: 200, diasAteASessao: 18, parecidos: ps.slice(0, 2) })!.selo, "muito_impreciso");
  assert.equal(r.faixa.length, DIAS_DA_CURVA + 1);
  assert.deepEqual([r.faixa[0].d, r.faixa.at(-1)!.d], [60, 0]);
  assert.ok(r.faixa.every(f => f.min <= f.max));
});

test("a previsão não passa da lotação e a faixa alta também não", () => {
  const ps = [curva("a", 1), curva("b", 1), curva("c", 1)];
  const r = preverPorComparacao({ vendidos: 190, lugares: 200, diasAteASessao: 18, parecidos: ps })!;
  assert.ok(r.ingressos <= 200 && (r.alto as number) <= 200);
});

test("sem previsão: sem parecido com venda no ponto, sem lotação, sessão passada, mais de 60 dias ou nada vendido", () => {
  const p = curva("a", 0.9);
  const base = { vendidos: 100, lugares: 200, diasAteASessao: 18, parecidos: [p] };
  assert.ok(preverPorComparacao(base));
  assert.equal(preverPorComparacao({ ...base, parecidos: [] }), null);
  assert.equal(preverPorComparacao({ ...base, lugares: 0 }), null);
  assert.equal(preverPorComparacao({ ...base, diasAteASessao: -1 }), null);
  assert.equal(preverPorComparacao({ ...base, diasAteASessao: 61 }), null);
  assert.equal(preverPorComparacao({ ...base, vendidos: 0 }), null);
  assert.equal(preverPorComparacao({ ...base, parecidos: [curva("z", 0.9, 1.6, { acumulado: Array(61).fill(0) })] }), null, "parecido sem venda nenhuma não conta");
  assert.ok(preverPorComparacao({ ...base, diasAteASessao: 59 }), "perto do limite da curva ainda calcula");
  assert.equal(preverPorComparacao({ ...base, diasAteASessao: 60, parecidos: [p] }), null, "no dia 60 a curva sintética ainda está em zero");
});

import { acumuladoDaSessao } from "../lib/ticketeria/ritmo-comparado";

test("o acumulado de uma sessão: ingressos vendidos até d dias antes; o de mais de 60 dias entra no 60; depois da sessão não entra", () => {
  const a = acumuladoDaSessao("2026-12-08", { "2026-12-08": 5, "2026-12-07": 3, "2026-11-20": 10, "2026-08-01": 4, "2026-12-09": 99 });
  assert.equal(a.length, DIAS_DA_CURVA + 1);
  assert.equal(a[0], 5 + 3 + 10 + 4, "tudo o que vendeu até o dia da sessão (a venda do dia seguinte fica de fora)");
  assert.equal(a[1], 3 + 10 + 4, "até 1 dia antes");
  assert.equal(a[18], 10 + 4, "o dia 20/11 está a 18 dias da sessão");
  assert.equal(a[19], 4, "a venda de 20/11 não estava feita 19 dias antes");
  assert.equal(a[60], 4, "a de agosto (mais de 60 dias) entra no 60");
  assert.ok(a.every((v, d) => d === 0 || v <= a[d - 1]), "só diminui quanto mais longe da sessão");
  assert.deepEqual(acumuladoDaSessao("2026-12-08", {}), new Array(61).fill(0));
});
