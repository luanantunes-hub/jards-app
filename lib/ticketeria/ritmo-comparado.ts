// O RITMO DE VENDA COMPARADO com eventos parecidos: a previsão da lotação de um evento a partir do que eventos parecidos do mesmo produtor tinham vendido no MESMO PONTO (os mesmos dias antes da sessão).
// Não é MMM: não fala de canais, só de quanto o evento deve vender. Sem banco e sem imports de servidor: roda na tela e nos testes (tests/ticketeria-ritmo-comparado.test.ts); quem lê as vendas é
// lib/ticketeria/modelo-servidor.ts.
//
// A conta: para cada evento parecido, a fração final que ele vendeu, ajustada pela razão entre o que este evento tem hoje e o que o parecido tinha no mesmo ponto; a previsão é a mediana dessas
// projeções, e a faixa é um intervalo de previsão de 80% (t de Student sobre o log das projeções) vezes FATOR_DA_FAIXA.
//
// De onde vêm os números (modelo/ESTUDO-DO-RITMO.md, dados inventados): o erro da previsão por comparação foi de ~6% a 18 dias da sessão (a conta simples do ritmo errou ~9%) e de ~3% a 5 dias; a faixa
// "mínimo a máximo" dos parecidos cobriu a verdade em só 36% das vezes com 2 parecidos e 53% com 3 (por isso NÃO se usa); o intervalo de previsão de 80% cobriu 77% a 79% das vezes (2 a 6 parecidos) e,
// com o fator 1,1, 79% a 82%.

import type { Selo } from "@/lib/ticketeria/modelo-painel";

export const DIAS_DA_CURVA = 60;
/** Alarga o intervalo de previsão: sem isto ele cobriu a verdade em 77% a 79% das vezes (nominal: 80%) no estudo; com 1,1, em 79% a 82%. */
export const FATOR_DA_FAIXA = 1.1;
/** Um parecido tem de ter vendido pelo menos esta parte da lotação no fim (senão não diz nada do tamanho do público). */
export const MIN_VENDIDO_DO_PARECIDO = 0.2;
/** O preço médio de um parecido tem de ficar entre estas vezes o do evento atual. */
export const FAIXA_DE_PRECO = { min: 0.6, max: 1.6 };
/** Com este número de parecidos ou mais o selo é "impreciso"; com menos, "muito impreciso". */
export const MIN_PARECIDOS_PARA_IMPRECISO = 3;
const T80: Record<number, number> = { 1: 3.078, 2: 1.886, 3: 1.638, 4: 1.533, 5: 1.476, 6: 1.44, 7: 1.415, 8: 1.397, 9: 1.383 };

/** O que um evento vendeu, dia a dia até a sessão: `acumulado[d]` são os ingressos vendidos até d dias antes da sessão (d de 0 a DIAS_DA_CURVA; o que veio antes de 60 dias entra no 60). */
export type CurvaDoEvento = { id: string; nome: string; quando: string; local: string; localId: string; precoMedioCentavos: number; lugares: number; acumulado: number[] };

const msDoDia = 86400000;
/** O acumulado de uma sessão: de `vendasPorDia` (dia do pagamento → ingressos) para "ingressos vendidos até d dias antes da sessão", de d = 0 a DIAS_DA_CURVA. Venda depois do dia da sessão não entra; a de mais de 60 dias entra no 60. */
export function acumuladoDaSessao(diaDaSessao: string, vendasPorDia: Record<string, number>): number[] {
  const baldes = new Array<number>(DIAS_DA_CURVA + 1).fill(0);
  for (const [dia, n] of Object.entries(vendasPorDia)) {
    const diasAntes = Math.round((Date.parse(`${diaDaSessao}T00:00:00Z`) - Date.parse(`${dia}T00:00:00Z`)) / msDoDia);
    if (diasAntes >= 0) baldes[Math.min(DIAS_DA_CURVA, diasAntes)] += n;
  }
  const acumulado = new Array<number>(DIAS_DA_CURVA + 1).fill(0);
  let soma = 0;
  for (let d = DIAS_DA_CURVA; d >= 0; d--) { soma += baldes[d]; acumulado[d] = soma; }
  return acumulado;
}

export const vendidoNoFim = (c: CurvaDoEvento): number => c.acumulado[0] ?? 0;
const fracao = (c: CurvaDoEvento, d: number): number => (c.lugares > 0 ? (c.acumulado[Math.min(DIAS_DA_CURVA, d)] ?? 0) / c.lugares : 0);

export type EventoAtual = { id: string; localId: string; precoMedioCentavos: number };
export type Veredito = { parecido: true } | { parecido: false; motivo: string };

/** Parecido quer dizer: mesmo local, preço médio na mesma faixa e que vendeu pelo menos MIN_VENDIDO_DO_PARECIDO da lotação. Quando não é, o motivo em uma frase. */
export function parecidoCom(atual: EventoAtual, c: CurvaDoEvento): Veredito {
  if (c.id === atual.id) return { parecido: false, motivo: "é o próprio evento" };
  if (c.localId !== atual.localId) return { parecido: false, motivo: "outro local" };
  if (atual.precoMedioCentavos > 0 && c.precoMedioCentavos > 0 && (c.precoMedioCentavos < atual.precoMedioCentavos * FAIXA_DE_PRECO.min || c.precoMedioCentavos > atual.precoMedioCentavos * FAIXA_DE_PRECO.max)) return { parecido: false, motivo: "outro preço" };
  if (c.lugares <= 0 || vendidoNoFim(c) < MIN_VENDIDO_DO_PARECIDO * c.lugares) return { parecido: false, motivo: "vendeu pouco" };
  return { parecido: true };
}

export type Candidato = { curva: CurvaDoEvento; veredito: Veredito; /** Se entra na comparação agora (a sugestão, ou a escolha do produtor). */ usado: boolean };

/** Os candidatos com o veredito e se entram; `escolhas` é o que o produtor marcou (id → entra ou não) e vale mais que a sugestão. */
export function candidatosDoEvento(atual: EventoAtual, curvas: CurvaDoEvento[], escolhas: Record<string, boolean> = {}): Candidato[] {
  return curvas.filter(c => c.id !== atual.id).map(curva => { const veredito = parecidoCom(atual, curva); return { curva, veredito, usado: escolhas[curva.id] ?? veredito.parecido }; });
}

export type PrevisaoPorComparacao = {
  /** Quantos parecidos entraram na conta (os que tinham venda no mesmo ponto). */ n: number;
  ingressos: number; porcento: number | null; /** A faixa de 80%; null com um parecido só (não há como medir o quanto eles variam). */ baixo: number | null; alto: number | null;
  /** O que os parecidos tinham vendido no mesmo ponto, em % da lotação (mínimo e máximo): para o produtor ver onde está. */ noMesmoPonto: { min: number; max: number };
  selo: Selo;
  /** Para o gráfico: a faixa dos parecidos (mínimo e máximo, em % da lotação) a cada dia até a sessão, de DIAS_DA_CURVA a 0. */ faixa: { d: number; min: number; max: number }[];
};

/** A previsão por comparação; null se não há parecido com venda no mesmo ponto, se faltam mais de DIAS_DA_CURVA dias para a sessão ou se não se sabe a lotação. */
export function preverPorComparacao(e: { vendidos: number; lugares: number; diasAteASessao: number; parecidos: CurvaDoEvento[] }): PrevisaoPorComparacao | null {
  if (e.lugares <= 0 || e.vendidos <= 0 || e.diasAteASessao < 0 || e.diasAteASessao > DIAS_DA_CURVA) return null;
  const hoje = e.vendidos / e.lugares;
  const usaveis = e.parecidos.filter(c => fracao(c, e.diasAteASessao) > 0 && vendidoNoFim(c) > 0);
  if (usaveis.length === 0) return null;
  const projecoes = usaveis.map(c => Math.min(1, (hoje / fracao(c, e.diasAteASessao)) * (vendidoNoFim(c) / c.lugares)));
  const ordenadas = [...projecoes].sort((a, b) => a - b);
  const meio = ordenadas.length % 2 ? ordenadas[(ordenadas.length - 1) / 2] : (ordenadas[ordenadas.length / 2 - 1] + ordenadas[ordenadas.length / 2]) / 2;
  const n = usaveis.length;
  let baixo: number | null = null;
  let alto: number | null = null;
  if (n >= 2) {
    const logs = projecoes.map(Math.log);
    const media = logs.reduce((s, x) => s + x, 0) / n;
    const desvio = Math.sqrt(logs.reduce((s, x) => s + (x - media) ** 2, 0) / (n - 1));
    const meia = (T80[n - 1] ?? 1.3) * desvio * Math.sqrt(1 + 1 / n) * FATOR_DA_FAIXA;
    baixo = Math.exp(media - meia) * e.lugares;
    alto = Math.min(1, Math.exp(media + meia)) * e.lugares;
  }
  const nosPontos = usaveis.map(c => fracao(c, e.diasAteASessao));
  return {
    n, ingressos: meio * e.lugares, porcento: Math.round(meio * 100), baixo, alto, noMesmoPonto: { min: Math.min(...nosPontos), max: Math.max(...nosPontos) },
    selo: n >= MIN_PARECIDOS_PARA_IMPRECISO ? "impreciso" : "muito_impreciso",
    faixa: Array.from({ length: DIAS_DA_CURVA + 1 }, (_, i) => { const d = DIAS_DA_CURVA - i; const f = usaveis.map(c => fracao(c, d)); return { d, min: Math.min(...f), max: Math.max(...f) }; }),
  };
}
