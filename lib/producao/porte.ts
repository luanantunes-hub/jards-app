// Porte progressivo (plano do módulo de produção, PD0.12): a página da data
// mostra só o que se aplica. O artista solo com cinco datas e o teatro municipal
// usam o mesmo motor, mas painel que não serve não aparece. Este arquivo decide
// quais painéis aparecem; ele não sabe de banco nem de tela.
//
// Regras:
// - o essencial (o dia e a equipe) aparece sempre;
// - os sinais da data valem para qualquer tipo: quem viaja vê viagem e
//   hospedagem, quem tem cota vê convidados, quem tem outra parte vê o acerto;
// - o catálogo do tipo acrescenta os painéis próprios dele (palco, obras,
//   visitação, público, borderô); ele sugere, não limita;
// - painel com conteúdo, ou ligado à mão, nunca some, nem quando o tipo muda;
// - o dinheiro (e a receita do borderô) só aparece com permissão.

import { tipoDeProducao, type PainelId, type TipoProducao } from "@/lib/producao/vocabulario";

export type ContextoDaData = {
  tipo: TipoProducao;
  /** Alguém da equipe se desloca para esta data. */
  alguemViaja: boolean;
  /** A data tem cota de convidados ou cortesias. */
  temCotaDeConvidados: boolean;
  /** A pessoa que olha pode ver cachês e o dinheiro da produção. */
  podeVerDinheiro: boolean;
  /**
   * Há outra parte no acerto técnico: o espaço que recebe a companhia, o
   * contratante, ou a companhia ou atração que vem de fora (use o Jards ou não).
   */
  temOutraParte: boolean;
  /** Painéis que já têm algo registrado. */
  comConteudo?: readonly PainelId[];
  /** Painéis ligados à mão ("Mostrar mais painéis"). */
  escolhidos?: readonly PainelId[];
};

/** Ordem fixa dos painéis na página da data. */
export const ORDEM_DOS_PAINEIS: readonly PainelId[] = [
  "dia", "equipe", "viagem", "hospedagem", "acerto", "palco", "obras", "visitacao", "convidados", "publico", "dinheiro", "bordero",
];

const DE_DINHEIRO: readonly PainelId[] = ["dinheiro", "bordero"];

/** Painéis da data, na ordem fixa. */
export function paineisDaData(contexto: ContextoDaData): PainelId[] {
  const ligados = new Set<PainelId>(["dia", "equipe"]);
  if (contexto.alguemViaja) { ligados.add("viagem"); ligados.add("hospedagem"); }
  if (contexto.temCotaDeConvidados) ligados.add("convidados");
  if (contexto.temOutraParte) ligados.add("acerto");
  if (contexto.podeVerDinheiro) ligados.add("dinheiro");
  for (const painel of tipoDeProducao(contexto.tipo).paineis) ligados.add(painel);
  for (const painel of contexto.comConteudo ?? []) ligados.add(painel);
  for (const painel of contexto.escolhidos ?? []) ligados.add(painel);
  return ORDEM_DOS_PAINEIS.filter(painel =>
    ligados.has(painel) && (contexto.podeVerDinheiro || !DE_DINHEIRO.includes(painel)));
}

/** O que ainda pode ser ligado à mão nesta data ("Mostrar mais painéis"). */
export function paineisParaLigar(contexto: ContextoDaData): PainelId[] {
  const visiveis = paineisDaData(contexto);
  return ORDEM_DOS_PAINEIS.filter(painel =>
    !visiveis.includes(painel) && (contexto.podeVerDinheiro || !DE_DINHEIRO.includes(painel)));
}
