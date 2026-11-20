// A PREVISÃO do modelo de marketing: de onde vale investir mais, quanto rende cada real a mais e como dividir um orçamento. Tudo sai da curva de resposta que o modelo estimou de cada canal
// (gasto semanal x ingressos por semana, vinda do cálculo em modelo/mmm.py) e do que o produtor gasta por semana. Sem banco e sem imports de servidor: roda no navegador (a aba Modelo e a
// folha "Simular orçamento") e nos testes (tests/ticketeria-modelo-recomendacao.test.ts).
//
// O que isto é e o que não é: é uma PREVISÃO, não uma garantia. A curva só vale perto do que o produtor já gastou: o cálculo desenha a curva até 1,5 vez o maior gasto semanal que o canal
// já teve (FATOR_DA_CURVA, o mesmo `max_value` de modelo/mmm.py); acima do maior gasto já testado a estimativa fica bem menos firme e a tela avisa. A faixa de cada previsão reaproveita a
// incerteza do próprio modelo sobre o canal, que costuma ser otimista. Só entram canais com gasto e curva (o que não tem gasto não tem o que ajustar).

import type { CanalDoResultado, PontoDaCurva } from "@/lib/ticketeria/modelo-resultado";

/** O mesmo `max_value` de `sample_saturation_curve` em modelo/mmm.py: a curva vai até esta parte do maior gasto semanal do canal. */
export const FATOR_DA_CURVA = 1.5;
/** O degrau da divisão do orçamento (R$ 5,00 por semana). */
export const PASSO_DO_ORCAMENTO_CENTAVOS = 500;
/** "Quanto rende R$ 100 a mais por semana." */
export const REFERENCIA_EM_CENTAVOS = 10000;
/** Perto do limite: o gasto passou desta parte do ponto de saturação. */
export const PARTE_DO_LIMITE = 0.8;
export const MIN_PONTOS_DA_CURVA = 5;

export type CanalComCurva = { canal: string; curva: PontoDaCurva[]; saturacaoCentavos: number | null; porcento: number; baixo: number; alto: number; margemGrande: boolean };

/** Os canais do resultado que têm curva para prever (poucos pontos ou curva sem subida ficam de fora). */
export function canaisComCurva(canais: CanalDoResultado[]): CanalComCurva[] {
  return canais
    .filter(c => c.curva.length >= MIN_PONTOS_DA_CURVA && c.curva.at(-1)!.gasto_centavos > 0 && c.curva.at(-1)!.ingressos > c.curva[0].ingressos)
    .map(c => ({ canal: c.canal, curva: [...c.curva].sort((a, b) => a.gasto_centavos - b.gasto_centavos), saturacaoCentavos: c.saturacao_gasto_centavos, porcento: c.porcento, baixo: c.baixo, alto: c.alto, margemGrande: c.margem_grande }));
}

/** O maior gasto semanal que a curva cobre. */
export const limiteDaCurva = (c: { curva: PontoDaCurva[] }): number => c.curva.at(-1)?.gasto_centavos ?? 0;
/** O maior gasto semanal que o canal já teve (a curva vai até FATOR_DA_CURVA vezes isto): acima disso é terreno que o modelo não viu. */
export const maiorGastoTestado = (c: { curva: PontoDaCurva[] }): number => Math.round(limiteDaCurva(c) / FATOR_DA_CURVA);

/** Os ingressos por semana que o canal traz com um gasto semanal, lido da curva (reta entre os pontos; acima do fim da curva vale o último ponto, que é conservador). */
export function ingressosNoGasto(c: { curva: PontoDaCurva[] }, gastoCentavos: number): number {
  const p = c.curva;
  if (p.length === 0) return 0;
  const g = Math.max(0, gastoCentavos);
  if (g <= p[0].gasto_centavos) return p[0].ingressos * (p[0].gasto_centavos > 0 ? g / p[0].gasto_centavos : 1);
  if (g >= p.at(-1)!.gasto_centavos) return p.at(-1)!.ingressos;
  let i = 1;
  while (p[i].gasto_centavos < g) i++;
  const [a, b] = [p[i - 1], p[i]];
  return a.ingressos + ((b.ingressos - a.ingressos) * (g - a.gasto_centavos)) / (b.gasto_centavos - a.gasto_centavos);
}

/** Os ingressos a mais por semana que R$ 100 a mais por semana trazem, a partir do gasto de hoje. */
export const ingressosPorCemReais = (c: { curva: PontoDaCurva[] }, gastoCentavos: number): number => ingressosNoGasto(c, gastoCentavos + REFERENCIA_EM_CENTAVOS) - ingressosNoGasto(c, gastoCentavos);

export type EstadoDoCanal = "espaco" | "limite";
export type LinhaDeInvestimento = {
  canal: string; gastoCentavos: number; ingressosPorCem: number; custoDoExtraCentavos: number | null; /** De 0 a 100: o gasto na curva. */ posicao: number; /** De 0 a 100: onde o canal passa a render pouco (null se nunca chega lá na curva). */ limite: number | null;
  estado: EstadoDoCanal; margemGrande: boolean; foraDaFaixa: boolean;
};

/** Cada canal com o que R$ 100 a mais rendem hoje, o custo do ingresso extra e se está perto do limite; do que mais rende para o que menos rende. */
export function linhasDeInvestimento(canais: CanalComCurva[], gastoPorCanal: Record<string, number>): LinhaDeInvestimento[] {
  return canais.map(c => {
    const g = Math.max(0, gastoPorCanal[c.canal] ?? 0);
    const fim = limiteDaCurva(c);
    const extra = ingressosPorCemReais(c, g);
    const perto = c.saturacaoCentavos !== null && g >= PARTE_DO_LIMITE * c.saturacaoCentavos;
    return {
      canal: c.canal, gastoCentavos: g, ingressosPorCem: Math.round(extra * 10) / 10, custoDoExtraCentavos: extra > 0.05 ? Math.round(REFERENCIA_EM_CENTAVOS / extra) : null,
      posicao: Math.min(100, Math.round((g / fim) * 100)), limite: c.saturacaoCentavos === null ? null : Math.min(100, Math.round((c.saturacaoCentavos / fim) * 100)),
      estado: (perto ? "limite" : "espaco") as EstadoDoCanal, margemGrande: c.margemGrande, foraDaFaixa: g > maiorGastoTestado(c),
    };
  }).sort((a, b) => b.ingressosPorCem - a.ingressosPorCem);
}

export type Recomendacao = { tipo: "canal" | "sem_espaco" | "sem_dados"; canal: string | null; segundo: string | null; ingressosPorCem: number; ingressosPorCemDoSegundo: number | null };

/** A frase de cima: o canal em que o próximo real rende mais (e o segundo, para comparar); ou que todos estão perto do limite. */
export function recomendar(linhas: LinhaDeInvestimento[]): Recomendacao {
  const com = linhas.filter(l => l.gastoCentavos > 0);
  if (com.length === 0) return { tipo: "sem_dados", canal: null, segundo: null, ingressosPorCem: 0, ingressosPorCemDoSegundo: null };
  const [melhor, segundo] = com;
  if (com.every(l => l.estado === "limite")) return { tipo: "sem_espaco", canal: melhor.canal, segundo: segundo?.canal ?? null, ingressosPorCem: melhor.ingressosPorCem, ingressosPorCemDoSegundo: segundo?.ingressosPorCem ?? null };
  return { tipo: "canal", canal: melhor.canal, segundo: segundo?.canal ?? null, ingressosPorCem: melhor.ingressosPorCem, ingressosPorCemDoSegundo: segundo?.ingressosPorCem ?? null };
}

// ─── Dividir um orçamento ───────────────────────────────────────────────────

export type Divisao = { porCanal: Record<string, number>; totalCentavos: number };
export type Previsao = {
  /** Os ingressos por semana que os anúncios trazem com esta divisão. */ ingressos: number; /** A faixa, vinda da incerteza do próprio modelo sobre cada canal. */ baixo: number; alto: number;
  custoPorIngressoCentavos: number | null; /** Os canais com gasto acima do maior que já teve. */ foraDaFaixa: string[];
};

/** Divide um orçamento semanal entre os canais, de R$ 5 em R$ 5, sempre no canal em que o próximo degrau rende mais (a curva é côncava, então isto acha a melhor divisão). Cada canal vai até o fim da curva. */
export function dividirOrcamento(canais: CanalComCurva[], totalCentavos: number): Divisao {
  const gasto: Record<string, number> = Object.fromEntries(canais.map(c => [c.canal, 0]));
  let restante = Math.max(0, Math.floor(totalCentavos / PASSO_DO_ORCAMENTO_CENTAVOS)) * PASSO_DO_ORCAMENTO_CENTAVOS;
  const gastoTotal = restante;
  while (restante >= PASSO_DO_ORCAMENTO_CENTAVOS) {
    let melhor: CanalComCurva | null = null;
    let ganho = 0;
    for (const c of canais) {
      const g = gasto[c.canal];
      if (g + PASSO_DO_ORCAMENTO_CENTAVOS > limiteDaCurva(c)) continue;
      const d = ingressosNoGasto(c, g + PASSO_DO_ORCAMENTO_CENTAVOS) - ingressosNoGasto(c, g);
      if (d > ganho) { ganho = d; melhor = c; }
    }
    if (!melhor) break; // nada mais rende (a curva acabou ou ficou plana)
    gasto[melhor.canal] += PASSO_DO_ORCAMENTO_CENTAVOS;
    restante -= PASSO_DO_ORCAMENTO_CENTAVOS;
  }
  return { porCanal: gasto, totalCentavos: gastoTotal - restante };
}

/** O que esperar de uma divisão: os ingressos por semana, a faixa e o custo por ingresso. */
export function preverDivisao(canais: CanalComCurva[], porCanal: Record<string, number>): Previsao {
  let ingressos = 0, baixo = 0, alto = 0, gasto = 0;
  const fora: string[] = [];
  for (const c of canais) {
    const g = porCanal[c.canal] ?? 0;
    const i = ingressosNoGasto(c, g);
    ingressos += i; gasto += g;
    baixo += c.porcento > 0 ? i * (c.baixo / c.porcento) : i;
    alto += c.porcento > 0 ? i * (c.alto / c.porcento) : i;
    if (g > maiorGastoTestado(c)) fora.push(c.canal);
  }
  return { ingressos: Math.round(ingressos * 10) / 10, baixo: Math.round(baixo), alto: Math.round(alto), custoPorIngressoCentavos: ingressos >= 1 && gasto > 0 ? Math.round(gasto / ingressos) : null, foraDaFaixa: fora };
}

/** O orçamento que cabe na curva: a soma dos limites. */
export const orcamentoMaximo = (canais: CanalComCurva[]): number => canais.reduce((s, c) => s + limiteDaCurva(c), 0);
