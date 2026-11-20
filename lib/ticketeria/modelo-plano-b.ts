// O PLANO B para quem ainda tem pouco histórico: o que já dá para MEDIR (custo por ingresso das ações) e um EXPERIMENTO pequeno e seguro para o próprio produtor descobrir onde o dinheiro rende
// mais. Sem banco e sem imports de servidor: roda na tela e nos testes (tests/ticketeria-modelo-plano-b.test.ts).
//
// O princípio (decisão do dono, 20/11/2026): o produtor NÃO é laboratório do Jards. O experimento serve ao ganho marginal DELE, nunca a calibrar o nosso modelo. Por isso é controlado: pequeno
// (uma parte do gasto de um canal vai para outro), com o MESMO total gasto, sem pausar canal nem dobrar gasto, por poucas semanas, e nunca perto de uma sessão. Que o dado também ajude o modelo
// é só um subproduto: a tela nunca fala nisso como motivo.

import { custoPorIngresso, type AcaoComResultado, type CamposDaAcao } from "@/lib/ticketeria/divulgacao";
import { MIN_SEMANAS_COM_GASTO_POR_CANAL, VARIACAO_MINIMA, inicioDaSemana, rotuloDoCanalDeGasto, type ResumoDoCanal } from "@/lib/ticketeria/modelo";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";

/** Com menos ingressos medidos que isto o custo por ingresso ainda diz pouco. */
export const MIN_INGRESSOS_DO_CUSTO = 20;
/** Do gasto semanal do canal que mais gasta, esta parte vai para outro canal. */
export const PARTE_DO_EXPERIMENTO = 0.2;
export const SEMANAS_DO_EXPERIMENTO = 2;
/** O experimento só é sugerido se nenhuma sessão começa até tantos dias depois do fim dele (as vendas não são arriscadas). */
export const FOLGA_ANTES_DA_SESSAO_EM_DIAS = 21;
const PASSO_EM_CENTAVOS = 500;
const msDoDia = 86400000;
const somaDias = (dia: string, n: number): string => new Date(Date.parse(`${dia}T00:00:00Z`) + n * msDoDia).toISOString().slice(0, 10);

// ─── O que já dá para medir ─────────────────────────────────────────────────

export type CustoMedido = { canal: string; rotulo: string; gastoCentavos: number; ingressos: number; custoPorIngressoCentavos: number | null; acoes: number; poucoDado: boolean };

/** O custo por ingresso de cada canal, medido pelas ações com link de divulgação (só conta quem clicou e comprou). Do canal que mais trouxe ingressos para o que menos. */
export function custoMedidoPorCanal(acoes: AcaoComResultado[]): CustoMedido[] {
  const porCanal = new Map<string, CustoMedido>();
  for (const a of acoes) {
    const atual = porCanal.get(a.canal) ?? { canal: a.canal, rotulo: a.rotulo_do_canal, gastoCentavos: 0, ingressos: 0, custoPorIngressoCentavos: null, acoes: 0, poucoDado: true };
    atual.gastoCentavos += a.gasto_centavos; atual.ingressos += a.ingressos; atual.acoes += 1;
    porCanal.set(a.canal, atual);
  }
  return [...porCanal.values()]
    .map(c => ({ ...c, custoPorIngressoCentavos: custoPorIngresso(c.gastoCentavos, c.ingressos), poucoDado: c.ingressos < MIN_INGRESSOS_DO_CUSTO }))
    .sort((a, b) => b.ingressos - a.ingressos || b.gastoCentavos - a.gastoCentavos);
}

// ─── O quanto o gasto varia ─────────────────────────────────────────────────

export type LinhaDeVariacao = { canal: string; rotulo: string; medianaCentavos: number; variacao: number; /** De 0 a 1: o quanto falta (ou sobra) para o traço do mínimo, que fica em 0,5. */ nivel: number; suficiente: boolean };

/** Os canais com gasto suficiente para conferir e se o gasto deles varia de uma semana para outra. */
export function variacaoDosCanais(canais: ResumoDoCanal[]): LinhaDeVariacao[] {
  return canais.filter(c => c.semanasComGasto >= MIN_SEMANAS_COM_GASTO_POR_CANAL).map(c => ({
    canal: c.canal, rotulo: rotuloDoCanalDeGasto(c.canal), medianaCentavos: c.medianaCentavos, variacao: c.variacao,
    nivel: Math.max(0, Math.min(1, c.variacao / (2 * VARIACAO_MINIMA))), suficiente: c.variacao >= VARIACAO_MINIMA,
  }));
}

// ─── O experimento pequeno e seguro ─────────────────────────────────────────

export type PonteDoExperimento = { canal: string; rotulo: string; gastoCentavos: number };
export type Experimento = { de: PonteDoExperimento; para: PonteDoExperimento; valorCentavos: number; inicio: string; fim: string; semanas: number };
export type SituacaoDoExperimento =
  | { tipo: "sugerido"; experimento: Experimento }
  | { tipo: "esperar_sessao"; sessao: string }
  | { tipo: "poucos_canais" }
  | { tipo: "nao_precisa" };

/** A próxima segunda-feira depois de `hoje` (AAAA-MM-DD). */
export const proximaSegunda = (hoje: string): string => somaDias(inicioDaSemana(hoje), 7);

/**
 * Sugere mover uma parte do gasto semanal do canal que mais gasta para o segundo que mais gasta, por duas semanas, mantendo o mesmo total. Só quando o gasto deles quase não varia (se já varia o
 * bastante, não há o que sugerir) e quando não há sessão começando até FOLGA_ANTES_DA_SESSAO_EM_DIAS depois do fim. `proximaSessao` é o dia (AAAA-MM-DD) da próxima sessão, se houver.
 */
export function sugerirExperimento(canais: ResumoDoCanal[], hoje: string, proximaSessao: string | null): SituacaoDoExperimento {
  const elegiveis = canais.filter(c => c.semanasComGasto >= MIN_SEMANAS_COM_GASTO_POR_CANAL && c.medianaCentavos > 0).sort((a, b) => b.medianaCentavos - a.medianaCentavos);
  if (elegiveis.length < 2) return { tipo: "poucos_canais" };
  if (elegiveis.every(c => c.variacao >= VARIACAO_MINIMA)) return { tipo: "nao_precisa" };
  const [doador, receptor] = elegiveis;
  const valor = Math.max(PASSO_EM_CENTAVOS, Math.round((PARTE_DO_EXPERIMENTO * doador.medianaCentavos) / PASSO_EM_CENTAVOS) * PASSO_EM_CENTAVOS);
  if (valor > 0.3 * doador.medianaCentavos) return { tipo: "poucos_canais" }; // gasto pequeno demais para mover sem pesar: o degrau mínimo passa de 30% dele
  const inicio = proximaSegunda(hoje);
  const fim = somaDias(inicio, 7 * SEMANAS_DO_EXPERIMENTO - 1);
  if (proximaSessao && proximaSessao >= hoje && proximaSessao <= somaDias(fim, FOLGA_ANTES_DA_SESSAO_EM_DIAS)) return { tipo: "esperar_sessao", sessao: proximaSessao };
  const ponte = (c: ResumoDoCanal): PonteDoExperimento => ({ canal: c.canal, rotulo: rotuloDoCanalDeGasto(c.canal), gastoCentavos: c.medianaCentavos });
  return { tipo: "sugerido", experimento: { de: ponte(doador), para: ponte(receptor), valorCentavos: valor, inicio, fim, semanas: SEMANAS_DO_EXPERIMENTO } };
}

const ANUNCIOS = new Set(["meta-ads", "google-ads"]);

/** Os campos da folha "Registrar ação" já preenchidos com o experimento (o produtor confere e salva; o gasto fica em branco: o total não muda). */
export function acaoDoExperimento(e: Experimento): CamposDaAcao {
  const pago = ANUNCIOS.has(e.de.canal) || ANUNCIOS.has(e.para.canal);
  return { nome: `Experimento: ${formatarMoeda(e.valorCentavos)} por semana do ${e.de.rotulo} para o ${e.para.rotulo}`.replace(/\u00a0/g, " ").slice(0, 80), canal: pago ? "anuncio-pago" : "outro", inicio: e.inicio, fim: e.fim, gasto: "" };
}
