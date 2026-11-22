import { test } from "node:test";
import assert from "node:assert/strict";
import { LOTACAO_PARA_BAIXAR, LOTACAO_PARA_SUBIR, referenciaDePreco, sugestaoDePreco } from "@/lib/ticketeria/precificacao";
import type { CurvaDoEvento, PrevisaoPorComparacao } from "@/lib/ticketeria/ritmo-comparado";

// O quadro de precificação (plano da Ticketeria, seção 11, P1): a direção do preço por comparação e a referência de preço.

const LUGARES = 200;
const previsao = (baixo: number | null, alto: number | null, meio = 100): PrevisaoPorComparacao => ({
  n: baixo === null ? 1 : 3, ingressos: meio, porcento: Math.round((meio / LUGARES) * 100), baixo, alto, noMesmoPonto: { min: 0.1, max: 0.2 }, selo: "impreciso", faixa: [],
});
const sug = (p: PrevisaoPorComparacao | null, vendidos = 20) => sugestaoDePreco({ vendidos, lugares: LUGARES, previsao: p });

test("sem lotação conhecida, sem vendas, sem parecido ou com um parecido só: não sugere", () => {
  assert.equal(sugestaoDePreco({ vendidos: 5, lugares: 0, previsao: previsao(10, 20) }).direcao, "sem_comparacao");
  assert.match(sug(previsao(150, 200), 0).motivo, /sem vendas/i);
  assert.match(sug(null).motivo, /Sem eventos parecidos/);
  assert.match(sug(previsao(null, null)).motivo, /Só um evento parecido/);
  for (const s of [sug(null), sug(previsao(null, null)), sug(previsao(150, 200), 0)]) assert.equal(s.direcao, "sem_comparacao");
});

test("mesmo no cenário mais fraco chega a 90% da lotação ou mais: há espaço para subir", () => {
  const s = sug(previsao(LUGARES * LOTACAO_PARA_SUBIR, LUGARES));
  assert.equal(s.direcao, "subir");
  assert.match(s.motivo, /90% a 100% da lotação/);
  assert.match(s.motivo, /mesmo no cenário mais fraco/);
});

test("mesmo no cenário mais forte fica abaixo de 60%: vale considerar baixar", () => {
  const s = sug(previsao(40, LUGARES * LOTACAO_PARA_BAIXAR - 1));
  assert.equal(s.direcao, "baixar");
  assert.match(s.motivo, /mesmo no cenário mais forte/);
});

test("no meio, mantém; e a fronteira de 90% pertence ao subir, a de 60% ao manter", () => {
  assert.equal(sug(previsao(100, 190)).direcao, "manter");
  assert.equal(sug(previsao(LUGARES * LOTACAO_PARA_SUBIR - 1, LUGARES)).direcao, "manter", "89,5% no cenário fraco ainda é manter");
  assert.equal(sug(previsao(40, LUGARES * LOTACAO_PARA_BAIXAR)).direcao, "manter", "60% no cenário forte ainda é manter");
});

const curva = (precoMedioCentavos: number, vendidosNoFim: number, lugares = 200): CurvaDoEvento => ({ id: String(precoMedioCentavos) + vendidosNoFim, nome: "x", quando: "nov/2026", local: "L", localId: "l", precoMedioCentavos, lugares, acumulado: [vendidosNoFim] });

test("a referência é o preço médio dos parecidos que lotaram, com quantos foram", () => {
  const r = referenciaDePreco([curva(5000, 190), curva(7000, 200), curva(9000, 100), curva(0, 200)]);
  assert.deepEqual(r, { mediaCentavos: 6000, n: 2 });
});

test("sem parecido que tenha lotado, não há referência", () => {
  assert.equal(referenciaDePreco([curva(5000, 100), curva(7000, 150)]), null);
  assert.equal(referenciaDePreco([]), null);
});
