// O QUE A LITERATURA REGISTRA SOBRE O PREÇO DINÂMICO (plano da Ticketeria, seção 11; estudo em docs/acoes-futuras/estudos/estudo-cancelamento-preco-dinamico.md). Só dados, sem banco e sem imports de
// servidor: a folha de adesão mostra estes itens ao produtor, de forma neutra, antes de ele escolher a faixa. Cada item diz o que o estudo encontrou, em frase curta e exata (o contexto só quando muda a leitura),
// sem recomendar nem desaconselhar. Os números vêm dos resumos e das páginas dos estudos; os artigos completos NÃO foram lidos (alguns são pagos). Revisar quando houver dado das vendas do Jards.

import { FATOR_BASE, type RegraDinamica } from "@/lib/ticketeria/preco-dinamico";

export type TipoDeEvidencia = "ganho" | "risco" | "mitigacao";
export type FonteDaEvidencia = { nome: string; url: string };
export type Evidencia = { tipo: TipoDeEvidencia; texto: string; fontes: readonly FonteDaEvidencia[] };

export const GRUPOS_DE_EVIDENCIA: Record<TipoDeEvidencia, string> = {
  ganho: "Ganho",
  risco: "Riscos registrados",
  mitigacao: "Associado a menos risco",
};

export const EVIDENCIAS: readonly Evidencia[] = [
  {
    tipo: "ganho", texto: "A literatura dá 5% a 16%, de contextos diferentes.",
    fontes: [
      { nome: "Courty e Pagliero, 2012", url: "https://econpapers.repec.org/RePEc:tpr:restat:v:94:y:2012:i:1:p:359-369" },
      { nome: "Sweeting, 2012", url: "https://www.econ.umd.edu/publication/price-dynamics-perishable-goods-markets-case-secondary-markets-major-league-baseball" },
    ],
  },
  { tipo: "risco", texto: "Clientes que pagaram mais e depois viram o preço menor reduziram as compras seguintes na mesma loja, por cerca de 20 meses (experimento de campo, varejo de catálogo).", fontes: [{ nome: "Anderson e Simester, 2010", url: "https://dspace.mit.edu/handle/1721.1/58801" }] },
  { tipo: "risco", texto: "Em modelos teóricos, compradores que antecipam a queda do preço adiam a compra, e a receita de quem ignora isso é menor.", fontes: [{ nome: "Levin, McGill e Nediak, 2009", url: "https://ideas.repec.org/a/inm/ormnsc/v55y2009i1p32-46.html" }, { nome: "Su, 2007", url: "https://repository.upenn.edu/oid_papers/153" }] },
  { tipo: "risco", texto: "CDC, art. 49: direito de arrependimento de 7 dias em compra à distância. A aplicação a ingresso com data marcada é objeto de divergência.", fontes: [{ nome: "Idec", url: "https://idec.org.br/dicas-e-direitos/vai-comprar-ingresso-pela-internet-saiba-quais-sao-seus-direitos" }] },
  { tipo: "risco", texto: "Visa: limite de 1,5% de razão de disputas para comerciantes na América Latina, acima de um volume mínimo de transações.", fontes: [{ nome: "Solidgate", url: "https://docs.solidgate.com/risks/monitoring-programs/visa/" }] },
  { tipo: "mitigacao", texto: "Em modelo teórico, devolver a diferença quando o preço cai logo depois da compra aumentou o lucro do vendedor, mesmo com todos os elegíveis pedindo.", fontes: [{ nome: "Cohen-Vernik e Pazgal, 2017", url: "https://econpapers.repec.org/RePEc:eee:jouret:v:93:y:2017:i:4:p:507-526" }] },
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
