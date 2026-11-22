// O QUADRO DE PRECIFICAÇÃO (plano da Ticketeria, seção 11, fase P1, só de leitura): para cada sessão por vir, o preço que vale, a ocupação e a previsão de lotação por comparação com eventos
// parecidos do mesmo produtor (a conta é a do ritmo comparado, lib/ticketeria/ritmo-comparado.ts), com uma SUGESTÃO DE DIREÇÃO (subir, manter ou baixar). Sem banco e sem imports de servidor: roda na
// tela e nos testes (tests/ticketeria-precificacao.test.ts); quem lê as vendas é lib/ticketeria/precificacao-servidor.ts.
//
// O que a sugestão NÃO é: não é um preço. Os eventos do produtor quase nunca variam o preço, então não há como medir quanto a venda reage a ele; o que se sabe é se esta sessão vende acima ou abaixo do que
// eventos parecidos vendiam no mesmo ponto. Por isso a sugestão diz só a direção, com o motivo, e a referência de preço é o que parecidos que lotaram cobraram. Os limites abaixo são PALPITES, a
// ajustar com dados reais (como os números de risco da seção 9 do plano). A sugestão mira a receita e a lotação do produtor, nunca a comissão do Jards.

import { vendidoNoFim, type CurvaDoEvento, type PrevisaoPorComparacao } from "@/lib/ticketeria/ritmo-comparado";
import type { Selo } from "@/lib/ticketeria/modelo-painel";

/** Mesmo no cenário mais fraco da faixa, a previsão chega a esta parte da lotação ou mais: há espaço para subir. */
export const LOTACAO_PARA_SUBIR = 0.9;
/** Mesmo no cenário mais forte da faixa, a previsão fica abaixo desta parte da lotação: vale considerar baixar. */
export const LOTACAO_PARA_BAIXAR = 0.6;
/** Um parecido só diz alguma coisa do preço se lotou: vendeu pelo menos esta parte da lotação. */
export const LOTACAO_DO_PARECIDO_QUE_LOTOU = 0.9;

export type DirecaoDoPreco = "subir" | "manter" | "baixar" | "sem_comparacao";

export const ROTULO_DA_DIRECAO: Record<DirecaoDoPreco, string> = {
  subir: "Há espaço para subir",
  manter: "No ritmo esperado",
  baixar: "Vale considerar baixar",
  sem_comparacao: "Sem comparação ainda",
};

export type Sugestao = { direcao: DirecaoDoPreco; motivo: string };

const pct = (x: number) => `${Math.round(x)}%`;

/** A direção do preço de uma sessão, a partir do que ela vendeu e da previsão por comparação. Só sugere com pelo menos dois parecidos (com um só não há faixa). */
export function sugestaoDePreco(e: { vendidos: number; lugares: number; previsao: PrevisaoPorComparacao | null }): Sugestao {
  if (e.lugares <= 0) return { direcao: "sem_comparacao", motivo: "Não sei a lotação desta sessão." };
  if (e.vendidos <= 0) return { direcao: "sem_comparacao", motivo: "Ainda sem vendas nesta sessão." };
  const p = e.previsao;
  if (!p) return { direcao: "sem_comparacao", motivo: "Sem eventos parecidos com venda no mesmo ponto." };
  if (p.baixo === null || p.alto === null) return { direcao: "sem_comparacao", motivo: "Só um evento parecido: pouco para sugerir." };
  const baixo = (p.baixo / e.lugares) * 100;
  const alto = (p.alto / e.lugares) * 100;
  const faixa = `${pct(baixo)} a ${pct(alto)} da lotação`;
  if (baixo / 100 >= LOTACAO_PARA_SUBIR) return { direcao: "subir", motivo: `Eventos parecidos chegavam a ${faixa} neste ponto, mesmo no cenário mais fraco.` };
  if (alto / 100 < LOTACAO_PARA_BAIXAR) return { direcao: "baixar", motivo: `Eventos parecidos chegavam a ${faixa} neste ponto, mesmo no cenário mais forte.` };
  return { direcao: "manter", motivo: `Eventos parecidos chegavam a ${faixa} neste ponto.` };
}

export type ReferenciaDePreco = { mediaCentavos: number; n: number };

/** O que os parecidos que lotaram cobraram, em média (preço médio pago de cada um): uma referência, não uma recomendação. Null se nenhum lotou ou nenhum tem preço. */
export function referenciaDePreco(parecidos: readonly CurvaDoEvento[]): ReferenciaDePreco | null {
  const lotaram = parecidos.filter(c => c.lugares > 0 && c.precoMedioCentavos > 0 && vendidoNoFim(c) / c.lugares >= LOTACAO_DO_PARECIDO_QUE_LOTOU);
  if (lotaram.length === 0) return null;
  return { mediaCentavos: Math.round(lotaram.reduce((s, c) => s + c.precoMedioCentavos, 0) / lotaram.length), n: lotaram.length };
}

/** Uma sessão no quadro. As horas são ISO; o fuso é o do local. */
export type LinhaDoQuadro = {
  sessaoId: string;
  inicio: string;
  fuso: string;
  lugares: number;
  vendidos: number;
  diasAteASessao: number;
  /** O preço do lote da vez e o que vale nesta sessão (o próprio dela, se houver), do ingresso de menor preço pago do evento; null se o evento não tem ingresso pago à venda. */
  precoBaseCentavos: number | null;
  precoVigenteCentavos: number | null;
  precoProprio: boolean;
  /** A previsão de lotação, em % e a faixa de 80% em ingressos; null sem comparação. */
  previsaoPorcento: number | null;
  faixaBaixo: number | null;
  faixaAlto: number | null;
  parecidos: number;
  selo: Selo | null;
  sugestao: Sugestao;
};

export type QuadroDoEvento = { linhas: LinhaDoQuadro[]; referencia: ReferenciaDePreco | null };
