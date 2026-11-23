// O CALENDÁRIO DE DIVULGAÇÃO de um evento: como dividir um orçamento de anúncios entre os canais E entre as semanas até a sessão, para vender o máximo antes da data. A ideia vem de
// Morais et al. (Procedia Computer Science 242, 2024): o mesmo dinheiro rende diferente conforme se distribui no tempo, porque o efeito de um anúncio demora a aparecer e dura algumas semanas
// (o atraso) e cada canal rende cada vez menos quanto mais se gasta na mesma semana (a curva). Para ingresso há uma diferença que pesa: o efeito que sobra depois da sessão não vende nada,
// então só conta o que cai até a semana da sessão.
//
// Usa o que o modelo já estima de cada canal: a curva de resposta (gasto semanal constante → ingressos por semana) e o atraso (o alpha do adstock geométrico normalizado, com
// SEMANAS_DO_ATRASO semanas, o mesmo de modelo/mmm.py). Com o adstock normalizado, a "semana equivalente" de um gasto que muda é a média ponderada dos gastos das últimas semanas, e a curva
// diz quanto ela vende. Sem banco e sem imports de servidor: roda no navegador e nos testes (tests/ticketeria-modelo-calendario.test.ts).
//
// É uma PREVISÃO do modelo, não uma garantia; abre só onde o "Onde vale investir mais" abre (confiança boa).

import { FATOR_DE_CAUTELA } from "@/lib/ticketeria/modelo-resultado";
import { ingressosNoGasto, limiteDaCurva, maiorGastoTestado, type CanalComCurva } from "@/lib/ticketeria/modelo-recomendacao";

/** Quantas semanas o efeito de um anúncio dura no modelo (o l_max do adstock em modelo/mmm.py). */
export const SEMANAS_DO_ATRASO = 6;
export const MAX_SEMANAS_DO_CALENDARIO = 16;
/** O menor degrau da divisão (R$ 50); com orçamento grande o degrau cresce para a conta caber em até MAX_DEGRAUS passos. */
export const PASSO_MINIMO_CENTAVOS = 5000;
export const MAX_DEGRAUS = 400;
/** A janela de "tudo no fim" da comparação. */
export const SEMANAS_DO_FIM = 2;
/**
 * A PRUDÊNCIA com a proximidade da sessão. O modelo supõe que o anúncio rende igual em qualquer semana, mas há sinais de que rende mais perto da data (Kang, 2019). O estudo em
 * modelo/ESTUDO-DA-PROXIMIDADE.md mostrou que montar o calendário como se o anúncio rendesse um pouco mais perto da data (o peso da semana é 1 + K × proximidade, com K = 0,5) quase não custa
 * se o modelo estiver certo (perda média de 0,2% a 2,5%) e corta o pior caso de 35% para menos de 10% se não estiver. Só a ESCOLHA do calendário usa isso: as previsões na tela são as do modelo.
 */
export const PRUDENCIA_DA_PROXIMIDADE = 0.5;
export const HORIZONTE_DA_PROXIMIDADE = 8;
/**
 * O peso de cada uma das S semanas na escolha do calendário: 1 + K × proximidade, com média 1. A proximidade é 1 nas semanas em cartaz (a última, numa sessão única; todas as da temporada
 * ou da exposição) e cai até 0 oito semanas antes da primeira delas.
 */
export function pesosDaProximidade(S: number, k: number = PRUDENCIA_DA_PROXIMIDADE, emCartaz?: boolean[]): number[] {
  const cartaz = emCartaz && emCartaz.length === S && emCartaz.some(Boolean) ? emCartaz : Array.from({ length: S }, (_, t) => t === S - 1);
  const primeira = cartaz.indexOf(true);
  const m = Array.from({ length: S }, (_, t) => {
    if (cartaz[t] || t > primeira) return 1 + k;
    const d = primeira - t;
    return 1 + k * (d <= HORIZONTE_DA_PROXIMIDADE ? 1 - d / (HORIZONTE_DA_PROXIMIDADE + 1) : 0);
  });
  const media = m.reduce((s, x) => s + x, 0) / S;
  return m.map(x => x / media);
}

export type SemanaDoCalendario = { inicio: string; porCanal: Record<string, number>; totalCentavos: number; /** A última semana (a da sessão, ou a da última sessão). */ daSessao: boolean; /** Há sessão (ou a exposição está aberta) nesta semana. */ emCartaz: boolean };
export type ComparacaoDoCalendario = { ingressos: number; igual: number; noFim: number };
export type Calendario = {
  semanas: SemanaDoCalendario[];
  totalPorCanal: Record<string, number>;
  /** O que de fato foi dividido (pode ser menos que o pedido quando as curvas acabam). */ totalCentavos: number;
  /** O pedido que não coube: acima do que as curvas dos canais cobrem nessas semanas, ou além do que os lugares que faltam permitem vender. */ sobraCentavos: number;
  /** A divisão parou porque os anúncios já venderiam os lugares que faltam: mais dinheiro não teria onde virar ingresso. */ parouNaLotacao: boolean;
  /** Ingressos pelos anúncios até a sessão, e a faixa (a incerteza do modelo sobre cada canal, alargada por FATOR_DE_CAUTELA). */ ingressos: number; baixo: number; alto: number;
  /** O mesmo dinheiro de cada canal gasto igual toda semana, e todo nas SEMANAS_DO_FIM últimas semanas. */ comparacao: ComparacaoDoCalendario;
  /** Ingressos esperados por semana e por canal, até SEMANAS_DO_ATRASO semanas depois da sessão (o que cai depois não vende). */ porSemana: Record<string, number[]>;
  /** Canais com alguma semana acima do maior gasto semanal que já tiveram: a previsão fica menos firme. */ foraDaFaixa: string[];
};

export type PedidoDoCalendario = {
  totalCentavos: number; inicio: string;
  /** O dia da (última) sessão: o calendário vai até ele. */ diaDaSessao: string;
  /** Os lugares que ainda faltam vender (somados em todas as sessões; null ou ausente: sem teto). */ lugaresRestantes?: number | null;
  /** Os dias com sessão ou com a exposição aberta (AAAA-MM-DD): marcam as semanas em cartaz. Ausente: só a última semana. */ diasEmCartaz?: string[];
};
export type LeituraDoPedido = { ok: true; semanas: number; totalCentavos: number } | { ok: false; problema: "valor" | "datas" | "sessao_passou" | "longe_demais" };

const DIA = 86400000;
const dataUtc = (iso: string): number | null => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? Date.parse(`${iso}T00:00:00Z`) : null);
export const somarDias = (iso: string, dias: number): string => new Date((dataUtc(iso) ?? 0) + dias * DIA).toISOString().slice(0, 10);

/** Quantas semanas há do início até a sessão: semanas de 7 dias a partir do início, a última termina no dia da sessão ou logo antes (sessão no mesmo dia ou em menos de uma semana: uma semana). */
export function lerPedidoDoCalendario(p: PedidoDoCalendario): LeituraDoPedido {
  if (!Number.isFinite(p.totalCentavos) || p.totalCentavos < PASSO_MINIMO_CENTAVOS || p.totalCentavos > 100_000_000_00) return { ok: false, problema: "valor" };
  const a = dataUtc(p.inicio), b = dataUtc(p.diaDaSessao);
  if (a === null || b === null) return { ok: false, problema: "datas" };
  if (b < a) return { ok: false, problema: "sessao_passou" };
  const semanas = Math.max(1, Math.ceil((b - a) / DIA / 7));
  if (semanas > MAX_SEMANAS_DO_CALENDARIO) return { ok: false, problema: "longe_demais" };
  return { ok: true, semanas, totalCentavos: Math.round(p.totalCentavos) };
}

/** Quais das S semanas (a partir do início) têm sessão ou exposição aberta. Sem a lista, só a última. */
export function semanasEmCartaz(pedido: Pick<PedidoDoCalendario, "inicio" | "diasEmCartaz">, S: number): boolean[] {
  const a = dataUtc(pedido.inicio);
  const marcadas = Array(S).fill(false) as boolean[];
  for (const d of pedido.diasEmCartaz ?? []) {
    const b = dataUtc(d);
    if (a === null || b === null || b < a) continue;
    const t = Math.min(S - 1, Math.floor((b - a) / DIA / 7));
    marcadas[t] = true;
  }
  if (!marcadas.some(Boolean)) marcadas[S - 1] = true;
  return marcadas;
}

/** Os pesos do adstock geométrico normalizado: quanto do gasto de k semanas atrás entra na semana de hoje (somam 1). */
export function pesosDoAtraso(atraso: number): number[] {
  const a = Math.min(0.95, Math.max(0, atraso));
  const brutos = Array.from({ length: SEMANAS_DO_ATRASO }, (_, k) => a ** k);
  const soma = brutos.reduce((s, x) => s + x, 0);
  return brutos.map(x => x / soma);
}

/** A "semana equivalente" de cada semana (média ponderada dos gastos das últimas semanas), até `ate` semanas. */
function equivalentes(gastos: number[], pesos: number[], ate: number): number[] {
  return Array.from({ length: ate }, (_, t) => pesos.reduce((s, w, k) => s + (t - k >= 0 && t - k < gastos.length ? w * gastos[t - k] : 0), 0));
}

/** Os ingressos por semana que um canal traz com estes gastos semanais, até `ate` semanas. */
export function ingressosPorSemana(c: CanalComCurva, gastos: number[], ate: number): number[] {
  const pesos = pesosDoAtraso(c.atraso ?? 0);
  return equivalentes(gastos, pesos, ate).map(g => ingressosNoGasto(c, g));
}

const ateASessao = (c: CanalComCurva, gastos: number[], semanas: number) => ingressosPorSemana(c, gastos, semanas).reduce((s, x) => s + x, 0);

/** Os canais que servem ao calendário: com curva e com o atraso gravado (rodadas antigas não têm). A marca (canal "-marca") fica de fora: ela não é de um evento. */
export const canaisDoCalendario = (canais: CanalComCurva[]): CanalComCurva[] => canais.filter(c => typeof c.atraso === "number" && !c.canal.endsWith("-marca"));
/** O resultado do modelo é de uma rodada antiga, sem o atraso: o calendário espera a próxima. */
export const faltaAtraso = (canais: CanalComCurva[]): boolean => canais.length > 0 && canaisDoCalendario(canais).length === 0;

/**
 * Divide o orçamento entre (canal, semana), de degrau em degrau, sempre na casa em que o próximo degrau vende mais até a sessão. As curvas são côncavas e o atraso é uma média, então a soma
 * é côncava e este jeito acha (quase) a melhor divisão. Cada casa vai até o fim da curva do canal; o que não couber fica como sobra.
 */
export function montarCalendario(canaisBrutos: CanalComCurva[], pedido: PedidoDoCalendario, prudencia: number = PRUDENCIA_DA_PROXIMIDADE): Calendario | null {
  const leitura = lerPedidoDoCalendario(pedido);
  const canais = canaisDoCalendario(canaisBrutos);
  if (!leitura.ok || canais.length === 0) return null;
  const S = leitura.semanas;
  const passo = Math.max(PASSO_MINIMO_CENTAVOS, Math.ceil(leitura.totalCentavos / MAX_DEGRAUS / PASSO_MINIMO_CENTAVOS) * PASSO_MINIMO_CENTAVOS);
  const gastos: Record<string, number[]> = Object.fromEntries(canais.map(c => [c.canal, Array(S).fill(0)]));
  const pesos: Record<string, number[]> = Object.fromEntries(canais.map(c => [c.canal, pesosDoAtraso(c.atraso ?? 0)]));
  const equiv: Record<string, number[]> = Object.fromEntries(canais.map(c => [c.canal, Array(S).fill(0)]));
  const emCartaz = semanasEmCartaz(pedido, S);
  const prox = pesosDaProximidade(S, prudencia, emCartaz);
  let restante = Math.floor(leitura.totalCentavos / passo) * passo;
  const pedidoArredondado = restante;
  // O teto: os anúncios não vendem mais do que os lugares que faltam (e parte deles ainda vende sem anúncio, então o teto é generoso).
  const teto = typeof pedido.lugaresRestantes === "number" && pedido.lugaresRestantes >= 0 ? pedido.lugaresRestantes : Infinity;
  let vendidos = 0;
  let parouNaLotacao = false;
  while (restante >= passo) {
    let melhor: { c: CanalComCurva; t: number } | null = null;
    let ganho = 1e-9, ganhoDoModelo = 0;
    for (const c of canais) {
      const fim = limiteDaCurva(c), w = pesos[c.canal], e = equiv[c.canal];
      for (let t = 0; t < S; t++) {
        if (gastos[c.canal][t] + passo > fim) continue;
        // A escolha pesa cada semana pela prudência com a proximidade; o teto de lugares conta o ganho do modelo, sem peso.
        let d = 0, dm = 0;
        for (let u = t; u < S && u - t < SEMANAS_DO_ATRASO; u++) { const x = ingressosNoGasto(c, e[u] + w[u - t] * passo) - ingressosNoGasto(c, e[u]); d += x * prox[u]; dm += x; }
        if (d > ganho) { ganho = d; ganhoDoModelo = dm; melhor = { c, t }; }
      }
    }
    if (!melhor) break; // as curvas acabaram ou ficaram planas
    if (vendidos + ganhoDoModelo > teto) { parouNaLotacao = true; break; }
    vendidos += ganhoDoModelo;
    const { c, t } = melhor;
    gastos[c.canal][t] += passo;
    for (let u = t; u < S && u - t < SEMANAS_DO_ATRASO; u++) equiv[c.canal][u] += pesos[c.canal][u - t] * passo;
    restante -= passo;
  }
  const totalPorCanal = Object.fromEntries(canais.map(c => [c.canal, gastos[c.canal].reduce((s, x) => s + x, 0)]));
  const totalCentavos = pedidoArredondado - restante;
  // A previsão, a faixa e as comparações (o mesmo total de cada canal, gasto de outros jeitos).
  let ingressos = 0, baixo = 0, alto = 0, igual = 0, noFim = 0;
  const porSemana: Record<string, number[]> = {};
  const fora: string[] = [];
  const fimDe = Math.min(SEMANAS_DO_FIM, S);
  for (const c of canais) {
    const g = gastos[c.canal], tot = totalPorCanal[c.canal];
    const i = ateASessao(c, g, S);
    ingressos += i;
    baixo += c.porcento > 0 ? Math.max(0, i - FATOR_DE_CAUTELA * (i - i * (c.baixo / c.porcento))) : i;
    alto += c.porcento > 0 ? i + FATOR_DE_CAUTELA * (i * (c.alto / c.porcento) - i) : i;
    igual += ateASessao(c, Array(S).fill(tot / S), S);
    noFim += ateASessao(c, Array.from({ length: S }, (_, t) => (t >= S - fimDe ? tot / fimDe : 0)), S);
    porSemana[c.canal] = ingressosPorSemana(c, g, S + SEMANAS_DO_ATRASO);
    if (g.some(x => x > maiorGastoTestado(c))) fora.push(c.canal);
  }
  const semanas: SemanaDoCalendario[] = Array.from({ length: S }, (_, t) => {
    const porCanal = Object.fromEntries(canais.map(c => [c.canal, gastos[c.canal][t]]));
    return { inicio: somarDias(pedido.inicio, 7 * t), porCanal, totalCentavos: Object.values(porCanal).reduce((s, x) => s + x, 0), daSessao: t === S - 1, emCartaz: emCartaz[t] };
  });
  const um = (x: number) => Math.round(x * 10) / 10;
  return {
    semanas, totalPorCanal, totalCentavos, sobraCentavos: Math.max(0, Math.round(leitura.totalCentavos) - totalCentavos), parouNaLotacao,
    ingressos: um(ingressos), baixo: Math.round(baixo), alto: Math.round(alto), comparacao: { ingressos: um(ingressos), igual: um(igual), noFim: um(noFim) }, porSemana, foraDaFaixa: fora,
  };
}

/** Por que o canal ficou assim no calendário: o que o atraso diz dele e onde o dinheiro caiu. */
export function porQueAssim(c: { atraso?: number | null }, gastos: number[]): string {
  const total = gastos.reduce((s, x) => s + x, 0);
  if (total <= 0) return "Ficou de fora: nestas semanas, o dinheiro rende mais nos outros canais.";
  const a = c.atraso ?? 0;
  const jeito = a >= 0.45 ? "Demora a pegar e o efeito dura semanas." : a <= 0.2 ? "Quem vê compra logo, e o efeito passa rápido." : "O efeito dura uma ou duas semanas.";
  // Começo x fim: a média por semana de cada metade (com número ímpar de semanas, a do meio fica fora).
  const metade = Math.floor(gastos.length / 2);
  const media = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
  const [antes, depois] = [media(gastos.slice(0, metade)), media(gastos.slice(gastos.length - metade))];
  const onde = gastos.length < 2 ? "" : antes >= 1.3 * depois ? " Mais no começo" : depois >= 1.3 * antes ? " Mais perto da sessão" : " Espalhado pelas semanas";
  const para = gastos.length >= 2 && gastos.at(-1) === 0 ? (onde ? ", e para antes da última semana." : " Para antes da última semana.") : onde ? "." : "";
  return `${jeito}${onde}${para}`;
}

/** A planilha do calendário (CSV com ponto e vírgula, como o Excel em português abre): uma linha por semana, uma coluna por canal, em reais. */
export function planilhaDoCalendario(cal: Calendario, rotulo: (canal: string) => string): string {
  const canais = Object.keys(cal.totalPorCanal);
  const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  const data = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  const linhas = [["Semana de", ...canais.map(rotulo), "Total da semana"].join(";")];
  for (const s of cal.semanas) linhas.push([data(s.inicio) + (s.daSessao ? " (sessão)" : ""), ...canais.map(c => reais(s.porCanal[c] ?? 0)), reais(s.totalCentavos)].join(";"));
  linhas.push(["Total", ...canais.map(c => reais(cal.totalPorCanal[c])), reais(cal.totalCentavos)].join(";"));
  return linhas.join("\r\n");
}

// ─── Os eventos para planejar (temporada, exposição, sessão única) ──────────

export type TipoDoEvento = "temporada" | "exposicao" | "sessao_unica";
export type EventoParaPlanejar = {
  eventoId: string; evento: string; tipo: TipoDoEvento; primeiroDia: string; ultimoDia: string; sessoes: number;
  /** Somados nas sessões que ainda vêm; null se alguma não tem a lotação. */ lugaresRestantes: number | null;
  /** Os dias com sessão ou com a exposição aberta (um por semana basta para marcar a semana). */ diasEmCartaz: string[];
};
type SessaoDoEvento = { id: string; evento: string; evento_id?: string; dia?: string; fim?: string | null; lugares_restantes?: number | null };

/** As sessões que ainda vêm (ou a exposição ainda aberta), agrupadas por evento, da estreia mais próxima para a mais distante. Temporada: duas sessões ou mais; exposição: sessão que dura dias. */
export function eventosParaPlanejar(sessoes: SessaoDoEvento[], hoje: string): EventoParaPlanejar[] {
  const porEvento = new Map<string, SessaoDoEvento[]>();
  for (const s of sessoes) {
    if (!s.dia || (s.fim ?? s.dia) < hoje) continue;
    const chave = s.evento_id ?? s.id;
    porEvento.set(chave, [...(porEvento.get(chave) ?? []), s]);
  }
  const saida: EventoParaPlanejar[] = [];
  for (const [eventoId, lista] of porEvento) {
    const ordenadas = [...lista].sort((a, b) => (a.dia as string).localeCompare(b.dia as string));
    const longa = ordenadas.some(s => s.fim && s.fim > (s.dia as string));
    const dias: string[] = [];
    for (const s of ordenadas) {
      const de = (s.dia as string) < hoje ? hoje : (s.dia as string), ate = s.fim && s.fim > (s.dia as string) ? s.fim : (s.dia as string);
      for (let d = de; d <= ate; d = somarDias(d, 7)) dias.push(d);
      if (!dias.includes(ate)) dias.push(ate);
    }
    const restantes = ordenadas.map(s => s.lugares_restantes);
    saida.push({
      eventoId, evento: ordenadas[0].evento, tipo: longa ? "exposicao" : ordenadas.length > 1 ? "temporada" : "sessao_unica",
      primeiroDia: ordenadas[0].dia as string, ultimoDia: ordenadas.reduce((m, s) => { const f = s.fim && s.fim > (s.dia as string) ? s.fim : (s.dia as string); return f > m ? f : m; }, ordenadas[0].dia as string),
      sessoes: ordenadas.length, lugaresRestantes: restantes.every(x => typeof x === "number") ? restantes.reduce((a, x) => a + (x as number), 0) : null, diasEmCartaz: [...new Set(dias)].sort(),
    });
  }
  return saida.sort((a, b) => a.primeiroDia.localeCompare(b.primeiroDia));
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const diaEMes = (iso: string) => `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`;
/** "Temporada de 12 a 24 de março", "Exposição de 20 a 30 de abril", "8 de maio". */
export function periodoDoEvento(e: Pick<EventoParaPlanejar, "tipo" | "primeiroDia" | "ultimoDia">): string {
  if (e.tipo === "sessao_unica" || e.primeiroDia === e.ultimoDia) return diaEMes(e.primeiroDia);
  const mesmoMes = e.primeiroDia.slice(0, 7) === e.ultimoDia.slice(0, 7);
  const de = mesmoMes ? String(Number(e.primeiroDia.slice(8, 10))) : diaEMes(e.primeiroDia);
  return `${e.tipo === "exposicao" ? "Exposição" : "Temporada"} de ${de} a ${diaEMes(e.ultimoDia)}`;
}
