import assert from "node:assert/strict";
import test from "node:test";
import { porcentoTotalDosCanais, razaoDoTotal, totalVale } from "../lib/ticketeria/efeito-total";
import { compararComOsLinks, lerResultadoDoModelo } from "../lib/ticketeria/modelo-resultado";

// O efeito total do anúncio (modelo/ESTUDO-DO-EFEITO-TOTAL.md).

const semanas = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02", "2026-02-09"];
// Uma sessão em 2026-02-14 (semana de 09/02) com 300 lugares; 40 ingressos por semana.
const sessoes = [{ dia: "2026-02-14", lugares: 300, vendas: semanas.map(s => ({ dia: s, quantidade: 40 })) }];
const ingressos = semanas.map(() => 40);

test("sem boca a boca nem urgência, não há total (é o próprio direto)", () => {
  assert.deepEqual(porcentoTotalDosCanais({ semanas, ingressos, sessoes, boca: 0, urgencia: 0, canais: [{ canal: "meta-ads", porSemana: semanas.map(() => 10) }] }), {});
});

test("com boca a boca, o total passa do direto; canal que não vende nada fica em 0", () => {
  const t = porcentoTotalDosCanais({ semanas, ingressos, sessoes, boca: 100, urgencia: 20, canais: [{ canal: "meta-ads", porSemana: semanas.map(() => 10) }, { canal: "nada", porSemana: semanas.map(() => 0) }] });
  assert.ok(t["meta-ads"] > 25, `o direto é 25% (10 de 40); o total ${t["meta-ads"]} passa disso`);
  assert.ok(t["meta-ads"] < 60, "e não explode");
  assert.equal(t.nada, 0);
  // Mais boca a boca, mais total.
  const mais = porcentoTotalDosCanais({ semanas, ingressos, sessoes, boca: 200, urgencia: 20, canais: [{ canal: "meta-ads", porSemana: semanas.map(() => 10) }] });
  assert.ok(mais["meta-ads"] > t["meta-ads"]);
  // Tamanho errado da lista: o canal fica de fora.
  assert.deepEqual(porcentoTotalDosCanais({ semanas, ingressos, sessoes, boca: 100, urgencia: 0, canais: [{ canal: "x", porSemana: [1, 2] }] }), {});
});

test("o total só vale com boca a boca ou urgência pesando; a razão multiplica a curva", () => {
  assert.equal(totalVale([{ chave: "boca", porcento: 9, baixo: 6 }]), true);
  assert.equal(totalVale([{ chave: "boca", porcento: 3, baixo: 1 }, { chave: "urgencia", porcento: 8, baixo: -1 }]), false);
  assert.equal(razaoDoTotal(20, 25), 1.25);
  assert.equal(razaoDoTotal(20, null), 1);
  assert.equal(razaoDoTotal(20, 18), 1, "total abaixo do direto não reduz");
});

test("o resultado do job traz as semanas e o que cada canal vendeu por semana; a comparação mostra o total e o custo no total", () => {
  const corpo = {
    motor: "pymc-marketing", versao_motor: "1.5.0", semanas: 26, diagnosticos: { r_hat_maximo: 1.004, divergencias: 0, ess_minimo: 900 },
    base: { porcento: 60, baixo: 55, alto: 65, partes: [{ chave: "nivel", porcento: 51, baixo: 45, alto: 57 }, { chave: "boca", porcento: 9, baixo: 6, alto: 12, efeito_por_unidade: 120.5 }] },
    canais: [{ canal: "meta-ads", porcento: 40, baixo: 35, alto: 45, ingressos: 400, gasto_centavos: 400000, custo_por_ingresso_centavos: 1000, saturacao_gasto_centavos: null, gasto_constante: false, curva: [], atraso: 0.4, por_semana: Array(26).fill(15) }],
    datas: Array.from({ length: 26 }, (_, i) => new Date(Date.UTC(2026, 0, 5 + 7 * i)).toISOString().slice(0, 10)), ingressos_por_semana: Array(26).fill(38),
  };
  const r = lerResultadoDoModelo(corpo);
  assert.ok(r.ok);
  assert.equal(r.resultado.datas?.length, 26);
  assert.equal(r.resultado.canais[0].por_semana?.length, 26);
  assert.equal(r.resultado.base.partes.find(p => p.chave === "boca")?.efeito_por_unidade, 120.5);
  // Lista de tamanho errado é ignorada (a rodada grava sem o total).
  const curto = lerResultadoDoModelo({ ...corpo, datas: ["2026-01-05"] });
  assert.ok(curto.ok && curto.resultado.datas === undefined);
  const c = compararComOsLinks([{ ...r.resultado.canais[0], porcento_total: 50 }], {});
  assert.deepEqual([c.linhas[0].total, c.linhas[0].custoNoTotalCentavos], [50, 800]);
  assert.equal(compararComOsLinks([{ ...r.resultado.canais[0], porcento_total: null }], {}).linhas[0].total, null);
});
