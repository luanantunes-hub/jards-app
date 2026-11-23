// O resultado do modelo de marketing (MMM) calculado pelo job em Python: o formato que ele devolve, a conferência (nada que chega é confiável), as regras de confiança e a comparação com o que
// os links de divulgação mostram. Sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-modelo-resultado.test.ts) e na tela.

import { canalDoGasto, MIN_SEMANAS_DE_VENDAS, SEMANAS_DA_CONFIANCA_MEDIA, SEMANAS_IDEAIS, VARIACAO_MINIMA, type Confianca } from "@/lib/ticketeria/modelo";

export const MAX_CANAIS_NO_RESULTADO = 20;
export const MAX_PONTOS_DA_CURVA = 40;
/** O r-hat acima disto diz que o ajuste não convergiu direito. */
export const R_HAT_MAXIMO_ACEITO = 1.05;

export type PontoDaCurva = { gasto_centavos: number; ingressos: number };
export type CanalDoResultado = {
  canal: string; porcento: number; baixo: number; alto: number; ingressos: number; gasto_centavos: number; custo_por_ingresso_centavos: number | null;
  saturacao_gasto_centavos: number | null; margem_grande: boolean; gasto_constante: boolean; curva: PontoDaCurva[];
  /** A parte do efeito de uma semana que passa para a seguinte (o adstock do canal, de 0 a 0,95); null nas rodadas antigas, que não o gravavam. */
  atraso?: number | null;
};
export type DiagnosticosDoModelo = { r_hat_maximo: number; divergencias: number; ess_minimo: number };
/** As partes em que a base ("venderia de qualquer jeito") se divide: o nível normal da loja, a tendência e a época do ano e cada controle que entrou no modelo. */
export const CHAVES_DAS_PARTES = ["nivel", "tendencia", "proximidade", "feriado", "lugares", "boca", "urgencia", "imprensa", "ferias", "preco_e_lotes", "cupom", "visitas"] as const;
export type ChaveDaParte = (typeof CHAVES_DAS_PARTES)[number];
/** Pode ser negativa: o preço mais alto ou a falta de uma data de pico também seguram a venda. */
export type ParteDaBase = { chave: ChaveDaParte; porcento: number; baixo: number; alto: number; /** Só nas datas que podem importar (férias, imprensa): quanto as semanas delas venderam a mais que sem elas (0,31 = 31%). */ efeito_na_semana?: number | null };
export const MAX_PARTES_DA_BASE = 12;
/** A soma das partes pode destoar da base por arredondamento (e só por isso). */
export const TOLERANCIA_DA_SOMA_DAS_PARTES = 3;
export type ResultadoDoModelo = {
  motor: string; versao_motor: string; semanas: number; confianca: Confianca; diagnosticos: DiagnosticosDoModelo;
  base: { porcento: number; baixo: number; alto: number; partes: ParteDaBase[] }; canais: CanalDoResultado[];
};

/**
 * A confiança: pelas semanas, pelo diagnóstico e pela variação do gasto. Ajuste que não convergiu (r-hat alto) ou com divergências vale como baixa, qualquer que seja o número de semanas. Abaixo de
 * SEMANAS_DA_CONFIANCA_MEDIA semanas é baixa (no estudo com dados inventados, com 30 e 45 semanas o erro médio por canal foi de 9 pontos e o ajuste costumou não fechar). Com algum canal de gasto
 * quase constante (`canais`), no máximo média: sem variação o modelo não separa o efeito do anúncio do nível normal de vendas.
 */
export function confiancaDoResultado(semanas: number, d: DiagnosticosDoModelo, canais: { gasto_constante: boolean }[] = []): Confianca {
  if (d.r_hat_maximo > R_HAT_MAXIMO_ACEITO || d.divergencias > 0) return "baixa";
  if (semanas < SEMANAS_DA_CONFIANCA_MEDIA) return "baixa";
  return semanas >= SEMANAS_IDEAIS && !canais.some(c => c.gasto_constante) ? "boa" : "media";
}

/** As partes da base, conferidas: chaves conhecidas e sem repetir, números dentro de -100 a 100 e o intervalo em ordem. Vazio é aceito (resultado sem quebra); formato errado devolve null. */
export function lerPartesDaBase(entrada: unknown): ParteDaBase[] | null {
  if (entrada === undefined || entrada === null) return [];
  if (!Array.isArray(entrada) || entrada.length > MAX_PARTES_DA_BASE) return null;
  const vistas = new Set<string>();
  const partes: ParteDaBase[] = [];
  for (const bruta of entrada) {
    const o = (bruta && typeof bruta === "object" ? bruta : {}) as Record<string, unknown>;
    const chave = (CHAVES_DAS_PARTES as readonly string[]).includes(o.chave as string) && !vistas.has(o.chave as string) ? (o.chave as ChaveDaParte) : null;
    const p = numero(o.porcento, -100, 100); const lo = numero(o.baixo, -100, 100); const hi = numero(o.alto, -100, 100);
    if (!chave || p === null || lo === null || hi === null || lo > hi) return null;
    vistas.add(chave);
    const efeito = o.efeito_na_semana === undefined || o.efeito_na_semana === null ? null : numero(o.efeito_na_semana, -1, 10);
    partes.push({ chave, porcento: casas(p, 2), baixo: casas(lo, 2), alto: casas(hi, 2), ...(efeito !== null ? { efeito_na_semana: casas(efeito, 3) } : {}) });
  }
  return partes;
}

/**
 * O quanto a margem de erro do modelo (o ±) é alargada na tela. Nos testes com dados inventados, em que a resposta certa é conhecida, o erro real do modelo foi até 3 vezes o que o ± dizia
 * (a verdade ficou fora do intervalo de 80% em 4 de 5 estimativas): o intervalo que o cálculo devolve é otimista. PROVISÓRIO: sai quando houver dado real para calibrar (teste de pausa).
 */
export const FATOR_DE_CAUTELA = 3;
/** A margem (±, em pontos) que a tela mostra: a maior distância da estimativa a uma ponta do intervalo, vezes FATOR_DE_CAUTELA. */
export const margemMostrada = (baixo: number, alto: number, meio: number): number => Math.round(FATOR_DE_CAUTELA * Math.max(meio - baixo, alto - meio));

/** "Margem grande": o intervalo é mais largo que a própria contribuição (e passa de 5 pontos). */
export const temMargemGrande = (porcento: number, baixo: number, alto: number): boolean => alto - baixo > Math.max(porcento, 5);

const CANAL = /^[a-z0-9_-]{1,30}$/;
const numero = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);
const inteiro = (v: unknown, max: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null);
const casas = (n: number, c: number) => Math.round(n * 10 ** c) / 10 ** c;

/**
 * O corpo que o job manda, conferido de novo: semanas dentro do que o modelo aceita, diagnósticos, a base ("venderia de qualquer jeito") e cada canal (porcentagens de 0 a 100 com o intervalo
 * em ordem, números inteiros dentro do limite, curva curta). As partes somam perto de 100% (a conta do modelo fecha o total). A confiança e os avisos são calculados AQUI, não pelo job.
 */
export function lerResultadoDoModelo(entrada: unknown): { ok: true; resultado: ResultadoDoModelo } | { ok: false; problema: string } {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  const motor = typeof e.motor === "string" && /^[a-z0-9 ._-]{1,40}$/i.test(e.motor) ? e.motor : null;
  const versao = typeof e.versao_motor === "string" && /^[a-z0-9._+-]{1,40}$/i.test(e.versao_motor) ? e.versao_motor : null;
  const semanas = inteiro(e.semanas, 2000);
  if (!motor || !versao) return { ok: false, problema: "motor" };
  if (semanas === null || semanas < MIN_SEMANAS_DE_VENDAS) return { ok: false, problema: "semanas" };
  const d = (e.diagnosticos && typeof e.diagnosticos === "object" ? e.diagnosticos : {}) as Record<string, unknown>;
  const rHat = numero(d.r_hat_maximo, 0, 1000);
  const divergencias = inteiro(d.divergencias, 1000000);
  const ess = inteiro(d.ess_minimo, 100000000);
  if (rHat === null || divergencias === null || ess === null) return { ok: false, problema: "diagnosticos" };
  const b = (e.base && typeof e.base === "object" ? e.base : {}) as Record<string, unknown>;
  const bp = numero(b.porcento, 0, 100); const bb = numero(b.baixo, 0, 100); const ba = numero(b.alto, 0, 100);
  if (bp === null || bb === null || ba === null || bb > ba) return { ok: false, problema: "base" };
  const partes = lerPartesDaBase(b.partes);
  if (partes === null || (partes.length > 0 && Math.abs(partes.reduce((soma, x) => soma + x.porcento, 0) - bp) > TOLERANCIA_DA_SOMA_DAS_PARTES)) return { ok: false, problema: "partes" };
  if (!Array.isArray(e.canais) || e.canais.length === 0 || e.canais.length > MAX_CANAIS_NO_RESULTADO) return { ok: false, problema: "canais" };
  const vistos = new Set<string>();
  const canais: CanalDoResultado[] = [];
  for (const bruto of e.canais) {
    const c = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
    const canal = typeof c.canal === "string" && CANAL.test(c.canal) && !vistos.has(c.canal) ? c.canal : null;
    const p = numero(c.porcento, 0, 100); const lo = numero(c.baixo, 0, 100); const hi = numero(c.alto, 0, 100);
    const ingressos = inteiro(c.ingressos, 1000000000); const gasto = inteiro(c.gasto_centavos, 100000000000000);
    const custo = c.custo_por_ingresso_centavos === null || c.custo_por_ingresso_centavos === undefined ? null : inteiro(c.custo_por_ingresso_centavos, 100000000000);
    const sat = c.saturacao_gasto_centavos === null || c.saturacao_gasto_centavos === undefined ? null : inteiro(c.saturacao_gasto_centavos, 100000000000);
    if (!canal || p === null || lo === null || hi === null || lo > hi || ingressos === null || gasto === null || (c.custo_por_ingresso_centavos != null && custo === null) || (c.saturacao_gasto_centavos != null && sat === null)) return { ok: false, problema: "canal" };
    const curvaBruta = c.curva === undefined || c.curva === null ? [] : c.curva;
    if (!Array.isArray(curvaBruta) || curvaBruta.length > MAX_PONTOS_DA_CURVA) return { ok: false, problema: "curva" };
    const curva: PontoDaCurva[] = [];
    for (const pt of curvaBruta) {
      const o = (pt && typeof pt === "object" ? pt : {}) as Record<string, unknown>;
      const g = inteiro(o.gasto_centavos, 100000000000); const i = numero(o.ingressos, 0, 1000000000);
      if (g === null || i === null) return { ok: false, problema: "curva" };
      curva.push({ gasto_centavos: g, ingressos: casas(i, 2) });
    }
    vistos.add(canal);
    const constante = c.gasto_constante === true;
    const atraso = c.atraso === null || c.atraso === undefined ? null : numero(c.atraso, 0, 0.95);
    if (c.atraso != null && atraso === null) return { ok: false, problema: "atraso" };
    canais.push({ canal, porcento: casas(p, 2), baixo: casas(lo, 2), alto: casas(hi, 2), ingressos, gasto_centavos: gasto, custo_por_ingresso_centavos: custo, saturacao_gasto_centavos: sat, margem_grande: temMargemGrande(p, lo, hi), gasto_constante: constante, curva, atraso: atraso === null ? null : casas(atraso, 3) });
  }
  const soma = bp + canais.reduce((s, c) => s + c.porcento, 0);
  if (soma < 90 || soma > 110) return { ok: false, problema: "soma" };
  const diagnosticos = { r_hat_maximo: casas(rHat, 4), divergencias, ess_minimo: ess };
  return { ok: true, resultado: { motor, versao_motor: versao, semanas, confianca: confiancaDoResultado(semanas, diagnosticos, canais), diagnosticos, base: { porcento: casas(bp, 2), baixo: casas(bb, 2), alto: casas(ba, 2), partes }, canais } };
}

// ─── O modelo ao lado dos links ─────────────────────────────────────────────

export type LinhaDaComparacao = { canal: string; modelo: number; baixo: number; alto: number; links: number | null; custoPorIngressoCentavos: number | null; gastoCentavos: number; margemGrande: boolean; gastoConstante: boolean };
const ANUNCIOS = new Set(["meta-ads", "google-ads"]);

/**
 * O que o modelo diz de cada canal ao lado do que os links de divulgação mostram (a parte de cada canal nos ingressos vendidos por link, em %). Anúncios pagos de Meta e de Google não se
 * separam nos links (o produtor escolhe "Anúncio pago"): ficam sem número nos links e entram juntos em `anuncios`.
 */
/** O canal antes da separação de marca e eventos ("meta-ads-marca" → "meta-ads"): os links não sabem dessa divisão. */
const canalSemParte = (canal: string): string => canalDoGasto(canal.replace(/-(marca|eventos)$/, ""));

export function compararComOsLinks(canais: CanalDoResultado[], ingressosPorCanalDoLink: Record<string, number>): { linhas: LinhaDaComparacao[]; anuncios: { modelo: number; links: number | null } | null } {
  const total = Object.values(ingressosPorCanalDoLink).reduce((s, n) => s + n, 0);
  const parteDoLink = (chave: string): number | null => (total > 0 ? Math.round(((ingressosPorCanalDoLink[chave] ?? 0) / total) * 100) : null);
  const linhas = canais.map(c => ({
    canal: c.canal, modelo: c.porcento, baixo: c.baixo, alto: c.alto, links: ANUNCIOS.has(canalSemParte(c.canal)) || /-(marca|eventos)$/.test(c.canal) ? null : parteDoLink(canalDoGasto(c.canal)),
    custoPorIngressoCentavos: c.custo_por_ingresso_centavos, gastoCentavos: c.gasto_centavos, margemGrande: c.margem_grande, gastoConstante: c.gasto_constante,
  }));
  const pagos = canais.filter(c => ANUNCIOS.has(canalSemParte(c.canal)));
  return { linhas, anuncios: pagos.length > 0 ? { modelo: Math.round(pagos.reduce((s, c) => s + c.porcento, 0)), links: parteDoLink("anuncio-pago") } : null };
}

/** O gasto semanal de um canal está "quase constante" quando a variação (desvio ÷ média) fica abaixo do mínimo. */
export const gastoQuaseConstante = (variacao: number): boolean => variacao < VARIACAO_MINIMA;
