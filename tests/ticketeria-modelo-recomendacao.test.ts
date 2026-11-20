import assert from "node:assert/strict";
import test from "node:test";
import { FATOR_DA_CURVA, canaisComCurva, dividirOrcamento, ingressosNoGasto, ingressosPorCemReais, limiteDaCurva, linhasDeInvestimento, maiorGastoTestado, orcamentoMaximo, preverDivisao, recomendar, type CanalComCurva } from "../lib/ticketeria/modelo-recomendacao";
import type { CanalDoResultado } from "../lib/ticketeria/modelo-resultado";

// Uma curva que satura: ingressos = beta * (1 - exp(-lam * gasto / escala)), até 1,5 vez o maior gasto testado, em 16 pontos (como o cálculo em Python).
const curva = (beta: number, lam: number, maiorTestado: number) => Array.from({ length: 16 }, (_, i) => {
  const g = Math.round((i / 15) * FATOR_DA_CURVA * maiorTestado);
  return { gasto_centavos: g, ingressos: Math.round(beta * (1 - Math.exp((-lam * g) / maiorTestado)) * 100) / 100 };
});
const canal = (nome: string, beta: number, lam: number, testado: number, extra: Partial<CanalDoResultado> = {}): CanalDoResultado => ({
  canal: nome, porcento: 20, baixo: 15, alto: 26, ingressos: 100, gasto_centavos: 100000, custo_por_ingresso_centavos: 1000, saturacao_gasto_centavos: null, margem_grande: false, gasto_constante: false, curva: curva(beta, lam, testado), ...extra,
});
// Meta: grande e já muito gasto (satura cedo); Google: menor mas ainda no começo da curva.
const META = canal("meta-ads", 40, 3, 30000, { saturacao_gasto_centavos: 18000 });
const GOOGLE = canal("google-ads", 20, 1, 15000, { porcento: 10, baixo: 8, alto: 14 });
const canais = (): CanalComCurva[] => canaisComCurva([META, GOOGLE]);

test("canaisComCurva: só entram os canais com curva que sobe; poucos pontos ou curva plana ficam de fora", () => {
  const ruim = [canal("sem-curva", 10, 1, 1000, { curva: [] }), canal("poucos", 10, 1, 1000, { curva: curva(10, 1, 1000).slice(0, 3) }), canal("plana", 0, 1, 1000)];
  assert.deepEqual(canaisComCurva([META, ...ruim, GOOGLE]).map(c => c.canal), ["meta-ads", "google-ads"]);
});

test("a curva: reta entre os pontos, zero no zero e o último ponto acima do fim", () => {
  const [meta] = canais();
  assert.equal(ingressosNoGasto(meta, 0), 0);
  assert.equal(ingressosNoGasto(meta, -50), 0);
  const fim = limiteDaCurva(meta);
  assert.equal(fim, Math.round(FATOR_DA_CURVA * 30000));
  assert.equal(ingressosNoGasto(meta, fim), meta.curva.at(-1)!.ingressos);
  assert.equal(ingressosNoGasto(meta, fim * 10), meta.curva.at(-1)!.ingressos, "acima da curva vale o último ponto (conservador)");
  assert.equal(maiorGastoTestado(meta), 30000);
  const meio = (meta.curva[3].gasto_centavos + meta.curva[4].gasto_centavos) / 2;
  assert.ok(Math.abs(ingressosNoGasto(meta, meio) - (meta.curva[3].ingressos + meta.curva[4].ingressos) / 2) < 0.01, "no meio de dois pontos, a média deles");
});

test("o retorno de R$ 100 a mais cai conforme o gasto sobe (a curva satura)", () => {
  const [meta] = canais();
  const a = ingressosPorCemReais(meta, 2000), b = ingressosPorCemReais(meta, 15000), c = ingressosPorCemReais(meta, 40000);
  assert.ok(a > b && b > c && c >= 0, `${a} > ${b} > ${c}`);
});

test("onde investir: o canal em que o próximo real rende mais vem primeiro, com o custo do ingresso extra e se está perto do limite", () => {
  const linhas = linhasDeInvestimento(canais(), { "meta-ads": 20000, "google-ads": 4000 });
  assert.deepEqual(linhas.map(l => l.canal), ["google-ads", "meta-ads"]);
  const [google, meta] = linhas;
  assert.ok(google.ingressosPorCem > meta.ingressosPorCem);
  assert.equal(google.custoDoExtraCentavos, Math.round(10000 / ingressosPorCemReais(canais()[1], 4000)));
  assert.equal(meta.estado, "limite", "20.000 passa de 80% do ponto de saturação (18.000)");
  assert.equal(google.estado, "espaco", "sem ponto de saturação sempre há espaço");
  assert.equal(google.limite, null);
  assert.equal(meta.limite, Math.round((18000 / limiteDaCurva(canais()[0])) * 100));
  assert.ok(meta.posicao > 0 && meta.posicao <= 100);
  assert.equal(meta.foraDaFaixa, false);
  assert.equal(linhasDeInvestimento(canais(), { "meta-ads": 50000, "google-ads": 4000 }).find(l => l.canal === "meta-ads")!.foraDaFaixa, true, "50.000 passa do maior gasto testado (30.000)");
});

test("a recomendação: o canal que mais rende, o segundo para comparar, e 'sem espaço' quando todos estão no limite", () => {
  const linhas = linhasDeInvestimento(canais(), { "meta-ads": 20000, "google-ads": 4000 });
  const r = recomendar(linhas);
  assert.deepEqual([r.tipo, r.canal, r.segundo], ["canal", "google-ads", "meta-ads"]);
  assert.ok(r.ingressosPorCem > (r.ingressosPorCemDoSegundo as number));
  const todos = recomendar(linhasDeInvestimento(canaisComCurva([META, canal("outro", 20, 1, 15000, { saturacao_gasto_centavos: 5000 })]), { "meta-ads": 20000, outro: 9000 }));
  assert.equal(todos.tipo, "sem_espaco");
  assert.equal(recomendar(linhasDeInvestimento(canais(), {})).tipo, "sem_dados");
});

test("dividir o orçamento: gasta tudo (em degraus de R$ 5), respeita o fim da curva e supera dividir de qualquer outro jeito", () => {
  const cs = canais();
  const d = dividirOrcamento(cs, 25000);
  assert.equal(d.totalCentavos, 25000);
  assert.equal(Object.values(d.porCanal).reduce((s, n) => s + n, 0), 25000);
  assert.ok(Object.values(d.porCanal).every(g => g % 500 === 0));
  const otimo = preverDivisao(cs, d.porCanal).ingressos;
  for (let m = 0; m <= 25000; m += 2500) assert.ok(otimo + 0.01 >= preverDivisao(cs, { "meta-ads": m, "google-ads": 25000 - m }).ingressos, `a divisão ótima não perde para ${m} no Meta`);
  const grande = dividirOrcamento(cs, 10_000_000);
  assert.equal(grande.totalCentavos, orcamentoMaximo(cs), "acima do que a curva cobre, só gasta o que cabe nela");
  assert.equal(dividirOrcamento(cs, 0).totalCentavos, 0);
  assert.equal(dividirOrcamento(cs, 499).totalCentavos, 0);
});

test("prever uma divisão: ingressos, faixa pela incerteza do modelo, custo por ingresso e canais fora do que já foi testado", () => {
  const cs = canais();
  const p = preverDivisao(cs, { "meta-ads": 20000, "google-ads": 4000 });
  const esperado = ingressosNoGasto(cs[0], 20000) + ingressosNoGasto(cs[1], 4000);
  assert.ok(Math.abs(p.ingressos - esperado) < 0.06);
  assert.ok(p.baixo < p.ingressos && p.ingressos < p.alto);
  assert.equal(p.custoPorIngressoCentavos, Math.round(24000 / esperado));
  assert.deepEqual(p.foraDaFaixa, []);
  assert.deepEqual(preverDivisao(cs, { "meta-ads": 20000, "google-ads": 22000 }).foraDaFaixa, ["google-ads"], "22.000 passa do maior gasto testado do Google (15.000)");
  assert.equal(preverDivisao(cs, { "meta-ads": 0, "google-ads": 0 }).custoPorIngressoCentavos, null);
});
