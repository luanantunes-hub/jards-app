// O PAINEL EVOLUTIVO da aba Modelo: em vez de esconder o que o modelo ainda não sustenta, mostra tudo com um SELO DE PRECISÃO e o motivo. Já no primeiro evento o produtor vê o que é real (vendas, ritmo,
// origem, custo medido); o que ainda não dá para calcular aparece como PRÉVIA COM EXEMPLO (dados de demonstração, nunca os dele) e diz o que falta. Sem banco e sem imports de servidor: roda na tela e
// nos testes (tests/ticketeria-modelo-painel.test.ts).
//
// A EXCEÇÃO, decidida com o dono: o ranking de canais ("onde vale investir mais") e o simulador NÃO aparecem com os números do produtor antes da confiança boa (104 semanas, gasto variando, ajuste
// limpo). No estudo (modelo/ESTUDO-DO-CORTE.md) o modelo errou o melhor canal pior que sorteio abaixo de 52 semanas e em 3 de cada 4 vezes com 58: um selo "impreciso" não impede que o produtor aja em cima
// do número. O tamanho de cada canal, com margem larga, pode aparecer desde 52 semanas.

import { SEMANAS_DA_CONFIANCA_MEDIA, SEMANAS_IDEAIS, type Confianca } from "@/lib/ticketeria/modelo";
import type { CurvaDoEvento } from "@/lib/ticketeria/ritmo-comparado";

export type Selo = "medido" | "razoavel" | "impreciso" | "muito_impreciso" | "exemplo";
export const ROTULO_DO_SELO: Record<Selo, string> = { medido: "medido", razoavel: "razoável", impreciso: "impreciso", muito_impreciso: "muito impreciso", exemplo: "exemplo" };
export const EXPLICACAO_DO_SELO: Record<Selo, string> = {
  medido: "o que de fato aconteceu", razoavel: "o modelo tem dados de sobra", impreciso: "estimativa com margem larga", muito_impreciso: "conta simples, pode errar muito", exemplo: "dados de demonstração, não os seus",
};

// ─── O ritmo de venda do evento ─────────────────────────────────────────────

const msDoDia = 86400000;
const noDia = (dia: string): number => Date.parse(`${dia}T00:00:00Z`);
const somaDias = (dia: string, n: number): string => new Date(noDia(dia) + n * msDoDia).toISOString().slice(0, 10);
export const DIAS_DO_RITMO = 7;
export const DIAS_DO_GRAFICO = 28;

export type RitmoDoEvento = {
  evento: string; vendidos: number; lugares: number; /** De 0 a 100; null se não se sabe a lotação. */ porcento: number | null; diasAteASessao: number; ritmoPorDia: number;
  /** Os ingressos até a sessão se o ritmo dos últimos 7 dias continuar (limitado à lotação). */ projecao: number;
  /** Se o ritmo cair à metade; e se dobrar: o que vendem, e se lotaria antes da data. */ metade: number; dobro: number; dobroLota: boolean;
  serie: { dia: string; ingressos: number }[];
  /** O que a comparação com eventos parecidos precisa (só o servidor preenche): o evento atual e as curvas dos eventos que já aconteceram. */
  comparacao?: { sessaoId: string; localId: string; precoMedioCentavos: number; /** Quantos compradores o evento atual tem (com 20 ou mais, parecido é quem divide o público). */ compradores?: number; acumulado: number[]; curvas: CurvaDoEvento[] };
};

/** A conta simples do ritmo: o que já vendeu, o ritmo dos últimos 7 dias e até onde chega se ele continuar, caísse à metade ou dobrasse. NÃO é uma previsão do modelo. */
export function ritmoDoEvento(e: { evento: string; vendasPorDia: Record<string, number>; vendidos: number; lugares: number; hoje: string; diaDaSessao: string }): RitmoDoEvento | null {
  const dias = Math.round((noDia(e.diaDaSessao) - noDia(e.hoje)) / msDoDia);
  if (dias < 0 || e.vendidos <= 0) return null;
  let ultimos = 0;
  for (let i = 0; i < DIAS_DO_RITMO; i++) ultimos += e.vendasPorDia[somaDias(e.hoje, -i)] ?? 0;
  const ritmo = ultimos / DIAS_DO_RITMO;
  const limita = (n: number) => (e.lugares > 0 ? Math.min(e.lugares, n) : n);
  const ate = (r: number) => e.vendidos + Math.round(r * dias);
  return {
    evento: e.evento, vendidos: e.vendidos, lugares: e.lugares, porcento: e.lugares > 0 ? Math.min(100, Math.round((e.vendidos / e.lugares) * 100)) : null, diasAteASessao: dias, ritmoPorDia: Math.round(ritmo * 10) / 10,
    projecao: limita(ate(ritmo)), metade: limita(ate(ritmo / 2)), dobro: limita(ate(ritmo * 2)), dobroLota: e.lugares > 0 && ate(ritmo * 2) >= e.lugares,
    serie: Array.from({ length: DIAS_DO_GRAFICO }, (_, i) => { const dia = somaDias(e.hoje, i - (DIAS_DO_GRAFICO - 1)); return { dia, ingressos: e.vendasPorDia[dia] ?? 0 }; }),
  };
}

// ─── O que abre com os dados do produtor e o que fica em prévia ─────────────

export type EstadoDoBloco = { aberto: boolean; selo: Selo | null; /** Quando em prévia: o que falta, em uma frase. */ motivo: string | null };

/** O tamanho de cada canal e o que empurra as vendas: abrem com 52 semanas ou mais, com o selo pela confiança; abaixo disso, prévia. */
export function blocoDoTamanhoDosCanais(semanas: number, confianca: Confianca): EstadoDoBloco {
  if (semanas < SEMANAS_DA_CONFIANCA_MEDIA) return { aberto: false, selo: null, motivo: `Abre com ${SEMANAS_DA_CONFIANCA_MEDIA} semanas de histórico e os seus números; você tem ${semanas}.` };
  return { aberto: true, selo: confianca === "boa" ? "razoavel" : confianca === "media" ? "impreciso" : "muito_impreciso", motivo: null };
}

/** O ranking de canais e o simulador: só com confiança boa (a exceção). Com menos, prévia com o motivo mais concreto que houver. */
export function blocoDeInvestir(confianca: Confianca, semanas: number, algumCanalConstante: boolean): EstadoDoBloco {
  if (confianca === "boa") return { aberto: true, selo: "impreciso", motivo: null };
  if (semanas < SEMANAS_IDEAIS) return { aberto: false, selo: null, motivo: `Com os seus números abre com ${SEMANAS_IDEAIS} semanas e gasto variando em todos os canais. Faltam ${SEMANAS_IDEAIS - semanas} semanas. Antes disso o modelo erra o melhor canal com frequência, e um selo não evitaria que você agisse em cima disso.` };
  return { aberto: false, selo: null, motivo: algumCanalConstante ? "O gasto de algum canal quase não varia: o modelo não separa o efeito do anúncio. Um pequeno experimento, movendo parte do gasto entre canais, ajuda." : "O cálculo ainda não se firmou direito com estes dados." };
}

// ─── Os dados de exemplo das prévias (demonstração, nunca os do produtor) ───

export const EXEMPLO_DOS_CANAIS = [{ rotulo: "Meta Ads", porcento: 28, margem: 9 }, { rotulo: "Google Ads", porcento: 16, margem: 12 }, { rotulo: "Instagram", porcento: 3, margem: 3 }];
export const EXEMPLO_DE_INVESTIR = [{ rotulo: "Instagram", ingressosPorCem: 4.8 }, { rotulo: "Meta Ads", ingressosPorCem: 4.5 }, { rotulo: "Google Ads", ingressosPorCem: 2.2 }];
