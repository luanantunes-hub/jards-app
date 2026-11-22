// O QUE A LITERATURA REGISTRA SOBRE O PREÇO DINÂMICO (plano da Ticketeria, seção 11; estudo em docs/acoes-futuras/estudos/estudo-cancelamento-preco-dinamico.md). Só dados, sem banco e sem imports de
// servidor: a folha de adesão mostra estes itens ao produtor, de forma neutra, antes de ele escolher a faixa. Cada item diz o que o estudo encontrou e em que contexto (nem todos são de ingressos),
// sem recomendar nem desaconselhar. Os números vêm dos resumos e das páginas dos estudos; os artigos completos NÃO foram lidos (alguns são pagos). Revisar quando houver dado das vendas do Jards.

import { FATOR_BASE, type RegraDinamica } from "@/lib/ticketeria/preco-dinamico";

export type TipoDeEvidencia = "ganho" | "risco" | "mitigacao" | "lacuna";
export type Evidencia = { tipo: TipoDeEvidencia; texto: string; fonte: string; url: string | null };

export const GRUPOS_DE_EVIDENCIA: Record<TipoDeEvidencia, string> = {
  ganho: "Ganhos estimados",
  risco: "Riscos registrados",
  mitigacao: "O que a literatura associa a menos risco",
  lacuna: "Sem medição pública",
};

export const EVIDENCIAS: readonly Evidencia[] = [
  { tipo: "ganho", texto: "Preço diferente por categoria de assento: cerca de 5% mais receita que preço único, em shows.", fonte: "Courty e Pagliero, 2012", url: "https://econpapers.repec.org/RePEc:tpr:restat:v:94:y:2012:i:1:p:359-369" },
  { tipo: "ganho", texto: "Preço dinâmico na revenda de ingressos de beisebol: cerca de 16% a mais no ganho esperado do vendedor; os preços caíram 40% ou mais perto do jogo.", fonte: "Sweeting, 2012", url: "https://www.econ.umd.edu/publication/price-dynamics-perishable-goods-markets-case-secondary-markets-major-league-baseball" },
  { tipo: "risco", texto: "Clientes que pagaram mais e depois viram o preço menor compraram menos da mesma loja, por cerca de 20 meses, mais entre os melhores clientes (varejo de catálogo, não ingressos).", fonte: "Anderson e Simester, 2010", url: "https://dspace.mit.edu/handle/1721.1/58801" },
  { tipo: "risco", texto: "Compradores que esperam preço menor podem adiar a compra; ignorar isso pode reduzir a receita (modelos teóricos).", fonte: "Su, 2007; Levin, McGill e Nediak, 2009", url: "https://ideas.repec.org/a/inm/ormnsc/v55y2009i1p32-46.html" },
  { tipo: "risco", texto: "No Brasil, o CDC (art. 49) dá 7 dias de arrependimento em compra à distância; para ingresso com data marcada a aplicação é discutida.", fonte: "Idec; Procon-MPMG", url: "https://idec.org.br/dicas-e-direitos/vai-comprar-ingresso-pela-internet-saiba-quais-sao-seus-direitos" },
  { tipo: "risco", texto: "Estorno no cartão: a Visa monitora a razão de disputas, com limite de 1,5% para comerciantes na América Latina.", fonte: "Solidgate", url: "https://docs.solidgate.com/risks/monitoring-programs/visa/" },
  { tipo: "mitigacao", texto: "Devolver a diferença quando o preço cai logo depois da compra aumentou o lucro num modelo teórico, mesmo com todos pedindo.", fonte: "Cohen-Vernik e Pazgal, 2017", url: "https://econpapers.repec.org/RePEc:eee:jouret:v:93:y:2017:i:4:p:507-526" },
  { tipo: "lacuna", texto: "Não achamos estudo público que meça devolução, chargeback ou espera por queda de preço em ingressos. Os números do seu evento virão das suas vendas.", fonte: "Levantamento do Jards, 22/11/2026", url: null },
];

export type ExposicaoDaFaixa = {
  /** Quanto mais barato pode ficar, no pior caso, o preço visto por quem comprou no teto (em %, uma casa). */
  quedaMaximaPct: number;
  /** A queda de um passo a partir do teto (em %, uma casa). */
  quedaDeUmPassoPct: number;
  /** Quantos passos separam o teto do piso. */
  passosAteOPiso: number;
  /** O tempo mínimo, em horas, para o preço ir do teto ao piso (um passo por intervalo). */
  horasAteOPiso: number;
};

const umaCasa = (x: number) => Math.round(x * 10) / 10;

/** O que a faixa escolhida expõe: o pior caso de quem comprou no preço mais alto e viu o preço menor depois. Conta direta sobre a regra, sem suposição de comportamento. */
export function exposicaoDaFaixa(r: Pick<RegraDinamica, "pisoBps" | "tetoBps" | "passoBps" | "intervaloMinutos">): ExposicaoDaFaixa {
  const teto = FATOR_BASE + r.tetoBps;
  const piso = FATOR_BASE + r.pisoBps;
  const passos = r.passoBps > 0 ? Math.ceil((teto - piso) / r.passoBps) : 0;
  return {
    quedaMaximaPct: umaCasa((1 - piso / teto) * 100),
    quedaDeUmPassoPct: umaCasa((1 - Math.max(piso, teto - r.passoBps) / teto) * 100),
    passosAteOPiso: passos,
    horasAteOPiso: umaCasa((passos * r.intervaloMinutos) / 60),
  };
}

const br = (x: number) => String(x).replace(".", ",");

/** A frase neutra da exposição. Sem faixa (teto e piso em zero) não há variação. */
export function textoDaExposicao(r: Pick<RegraDinamica, "pisoBps" | "tetoBps" | "passoBps" | "intervaloMinutos">): string {
  if (r.tetoBps === 0 && r.pisoBps === 0) return "Com esta faixa o preço não varia.";
  const e = exposicaoDaFaixa(r);
  const sinal = (bps: number) => (bps > 0 ? `+${br(bps / 100)}%` : bps < 0 ? `−${br(Math.abs(bps) / 100)}%` : "o preço-base");
  return `Quem comprar a ${sinal(r.tetoBps)} pode ver o preço até ${br(e.quedaMaximaPct)}% menor depois (${sinal(r.pisoBps)}), no mínimo ${br(e.horasAteOPiso)} h depois da compra. Cada queda seguida de um passo é de ${br(e.quedaDeUmPassoPct)}%.`;
}

/** Faixas prontas, só para preencher os campos (o produtor pode mudar qualquer número). */
export const FAIXAS_PRONTAS: readonly { nome: string; piso: string; teto: string; passo: string; horas: string }[] = [
  { nome: "Estreita", piso: "10", teto: "10", passo: "5", horas: "6" },
  { nome: "Intermediária", piso: "20", teto: "30", passo: "10", horas: "6" },
  { nome: "Ampla", piso: "30", teto: "50", passo: "10", horas: "6" },
];
