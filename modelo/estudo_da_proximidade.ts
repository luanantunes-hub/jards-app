// Estudo da proximidade: e se o anúncio rende MAIS perto da data da sessão (Kang, International Journal of Market Research, 2019), e não igual em toda semana, como o nosso modelo supõe?
// Quanto o calendário de divulgação (lib/ticketeria/modelo-calendario.ts) perde nesse mundo, comparado com o melhor calendário possível e com os jeitos simples (igual toda semana, tudo no fim)?
//
// Mundo inventado: os três canais de modelo/dados_sinteticos.py (tamanho, atraso e saturação conhecidos). Num mundo com força k, a venda que o anúncio traz na semana t é a da curva vezes
// (1 + k · proximidade_t) / média, com a proximidade igual à do modelo (1 na semana da sessão, caindo até 0 oito semanas antes). k = 0 é o mundo que o modelo supõe.
// A média normaliza: o efeito médio é o mesmo em todo k (o que o modelo aditivo aprenderia é a mesma curva), só muda QUANDO ele acontece. O calendário é o do produto, com as curvas
// verdadeiras: é o melhor caso (o modelo acertou tudo), então a perda medida é só a da suposição.
//
// Uso: npx tsx modelo/estudo_da_proximidade.ts   (grava modelo/estudo_da_proximidade.csv e imprime o resumo)

import { writeFileSync } from "node:fs";
import { montarCalendario, pesosDoAtraso, PRUDENCIA_DA_PROXIMIDADE, SEMANAS_DO_ATRASO } from "../lib/ticketeria/modelo-calendario";
import { ingressosNoGasto, type CanalComCurva } from "../lib/ticketeria/modelo-recomendacao";

const VERDADE: Record<string, { beta: number; adstock: number; escala: number; lam: number }> = {
  "meta-ads": { beta: 60, adstock: 0.5, escala: 300, lam: 2.0 },
  "google-ads": { beta: 25, adstock: 0.3, escala: 120, lam: 2.5 },
  instagram: { beta: 18, adstock: 0.4, escala: 150, lam: 1.5 },
};
const HORIZONTE = 8;

/** A curva de gasto semanal constante (em centavos) → ingressos por semana, até 1,5 vez um gasto alto, como o modelo grava. */
function canal(nome: string, saturacao: number): CanalComCurva {
  const v = { ...VERDADE[nome], escala: VERDADE[nome].escala * saturacao };
  const fim = 1.5 * 3 * v.escala * 100;
  const curva = Array.from({ length: 16 }, (_, i) => {
    const g = Math.round((fim * i) / 15);
    return { gasto_centavos: g, ingressos: v.beta * (1 - Math.exp((-v.lam * (g / 100)) / ((1 - v.adstock) * v.escala))) };
  });
  return { canal: nome, curva, saturacaoCentavos: null, porcento: 20, baixo: 20, alto: 20, margemGrande: false, atraso: v.adstock };
}
let CANAIS = Object.keys(VERDADE).map(n => canal(n, 1));

const proximidade = (t: number, S: number) => { const d = S - 1 - t; return d <= HORIZONTE ? 1 - d / (HORIZONTE + 1) : 0; };
/** O multiplicador de cada semana no mundo k, normalizado para ter média 1 nas S semanas. */
function multiplicadores(S: number, k: number): number[] {
  const m = Array.from({ length: S }, (_, t) => 1 + k * proximidade(t, S));
  const media = m.reduce((s, x) => s + x, 0) / S;
  return m.map(x => x / media);
}

/** Os ingressos até a sessão no mundo k, com estes gastos (centavos por semana, por canal). */
function vendeNoMundo(gastos: Record<string, number[]>, S: number, k: number): number {
  const m = multiplicadores(S, k);
  let total = 0;
  for (const c of CANAIS) {
    const w = pesosDoAtraso(c.atraso ?? 0), g = gastos[c.canal] ?? Array(S).fill(0);
    for (let t = 0; t < S; t++) {
      let eq = 0;
      for (let j = 0; j < SEMANAS_DO_ATRASO && t - j >= 0; j++) eq += w[j] * g[t - j];
      total += ingressosNoGasto(c, eq) * m[t];
    }
  }
  return total;
}

/** O melhor calendário no mundo k (a mesma divisão gulosa do produto, mas sabendo do multiplicador). */
function melhorNoMundo(S: number, k: number, totalCentavos: number, passo = 5000): Record<string, number[]> {
  const g: Record<string, number[]> = Object.fromEntries(CANAIS.map(c => [c.canal, Array(S).fill(0)]));
  let base = vendeNoMundo(g, S, k);
  for (let r = Math.floor(totalCentavos / passo); r > 0; r--) {
    let melhor: [string, number] | null = null, ganho = 1e-9;
    for (const c of CANAIS) for (let t = 0; t < S; t++) {
      g[c.canal][t] += passo; const d = vendeNoMundo(g, S, k) - base; g[c.canal][t] -= passo;
      if (d > ganho) { ganho = d; melhor = [c.canal, t]; }
    }
    if (!melhor) break;
    g[melhor[0]][melhor[1]] += passo; base += ganho;
  }
  return g;
}

const linhas: string[] = ["saturacao,semanas,orcamento_reais,k,melhor,calendario,igual,fim,perda_calendario_pct,perda_igual_pct,perda_fim_pct,parte_no_fim_calendario,parte_no_fim_melhor"];
// A saturação: 1 = a dos dados inventados (cada canal rende bem menos a partir de um gasto semanal parecido com o que se gasta); 4 = quase reta (rende quase igual mesmo gastando muito).
const resumo: Record<string, { cal: number[]; igual: number[]; fim: number[]; noFimCal: number[]; noFimMelhor: number[]; prudente: number[] }> = {};
const K_PRUDENTE = PRUDENCIA_DA_PROXIMIDADE;
const prudentes: Record<string, Record<string, number[]>> = {};
for (const saturacao of [1, 4]) for (const S of [4, 6, 8, 12]) for (const semanal of [300, 700, 1500]) for (const k of [0, 0.5, 1, 2, 4]) {
  CANAIS = Object.keys(VERDADE).map(n => canal(n, saturacao));
  const total = semanal * S * 100;
  const cal = montarCalendario(CANAIS, { totalCentavos: total, inicio: "2027-01-04", diaDaSessao: new Date(Date.UTC(2027, 0, 4) + (S * 7 - 1) * 86400000).toISOString().slice(0, 10) }, 0)!;
  if (cal.semanas.length !== S) throw new Error(`semanas ${cal.semanas.length} x ${S}`);
  const doCal = Object.fromEntries(CANAIS.map(c => [c.canal, cal.semanas.map(s => s.porCanal[c.canal] ?? 0)]));
  const igual = Object.fromEntries(CANAIS.map(c => [c.canal, Array(S).fill(cal.totalPorCanal[c.canal] / S)]));
  const fim = Object.fromEntries(CANAIS.map(c => [c.canal, Array.from({ length: S }, (_, t) => (t >= S - 2 ? cal.totalPorCanal[c.canal] / 2 : 0))]));
  const melhor = melhorNoMundo(S, k, cal.totalCentavos);
  // O calendário PRUDENTE: montado como se o mundo tivesse força K_PRUDENTE (sem saber a verdadeira).
  // O prudente é o calendário do PRODUTO (montarCalendario com a prudência padrão, PRUDENCIA_DA_PROXIMIDADE).
  const prudente = (prudentes[`${saturacao}-${S}-${semanal}`] ??= (() => {
    const p = montarCalendario(CANAIS, { totalCentavos: total, inicio: "2027-01-04", diaDaSessao: new Date(Date.UTC(2027, 0, 4) + (S * 7 - 1) * 86400000).toISOString().slice(0, 10) })!;
    return Object.fromEntries(CANAIS.map(c => [c.canal, p.semanas.map(x => x.porCanal[c.canal] ?? 0)]));
  })());
  const v = { melhor: vendeNoMundo(melhor, S, k), cal: vendeNoMundo(doCal, S, k), igual: vendeNoMundo(igual, S, k), fim: vendeNoMundo(fim, S, k), prudente: vendeNoMundo(prudente, S, k) };
  const perda = (x: number) => (100 * (v.melhor - x)) / v.melhor;
  const noFim = (g: Record<string, number[]>) => { const tot = Object.values(g).flat().reduce((s, x) => s + x, 0); return Object.values(g).reduce((s, a) => s + a.slice(Math.floor(S / 2)).reduce((u, x) => u + x, 0), 0) / tot; };
  linhas.push([saturacao, S, semanal * S, k, v.melhor.toFixed(1), v.cal.toFixed(1), v.igual.toFixed(1), v.fim.toFixed(1), perda(v.cal).toFixed(2), perda(v.igual).toFixed(2), perda(v.fim).toFixed(2), noFim(doCal).toFixed(2), noFim(melhor).toFixed(2)].join(","));
  const r = (resumo[`${saturacao === 1 ? "saturação forte" : "quase reta"} · k=${k}`] ??= { cal: [], igual: [], fim: [], noFimCal: [], noFimMelhor: [], prudente: [] });
  r.prudente.push(perda(v.prudente));
  r.cal.push(perda(v.cal)); r.igual.push(perda(v.igual)); r.fim.push(perda(v.fim)); r.noFimCal.push(noFim(doCal)); r.noFimMelhor.push(noFim(melhor));
}
writeFileSync(new URL("./estudo_da_proximidade.csv", import.meta.url), linhas.join("\n") + "\n");
const media = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
console.log(`"prudente" = o calendário do produto (prudência ${K_PRUDENTE}); "calendário" = o mesmo sem prudência`);
console.log("mundo | perda média do calendário | pior | prudente: média | prudente: pior | igual toda semana | tudo nas 2 últimas | gasto na 2ª metade: calendário x melhor   (perdas em % dos ingressos do melhor calendário possível, 12 cenários cada)");
for (const [k, r] of Object.entries(resumo)) console.log(`${k} | ${media(r.cal).toFixed(1)}% | ${Math.max(...r.cal).toFixed(1)}% | ${media(r.prudente).toFixed(1)}% | ${Math.max(...r.prudente).toFixed(1)}% | ${media(r.igual).toFixed(1)}% | ${media(r.fim).toFixed(1)}% | ${(100 * media(r.noFimCal)).toFixed(0)}% x ${(100 * media(r.noFimMelhor)).toFixed(0)}%`);
