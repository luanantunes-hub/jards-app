// A folha do dia da pessoa convidada (PD1.12): os tipos do que fn_equipe_folha e fn_equipe_minhas_datas
// devolvem, e o "agora" e o "próximo" da data. Sem tela e sem banco.

import type { ConfirmacaoDaEscala, SituacaoDaData, TipoDeCartaoDoDia, ExibicaoDoBloco, TipoDeDeslocamento } from "@/lib/producao/estados";
import type { TipoData } from "@/lib/producao/vocabulario";

/** Uma linha de fn_equipe_minhas_datas: a data e a escala da pessoa nela. */
export type MinhaData = {
  escala_id: string;
  data_id: string;
  data: string;
  data_fim: string | null;
  tipo: TipoData;
  situacao: SituacaoDaData;
  uf: string | null;
  fuso: string;
  temporada_titulo: string;
  organizacao_nome: string;
  funcao: string | null;
  chamada: string | null;
  saida: string | null;
  confirmacao: ConfirmacaoDaEscala;
};

export type BlocoDaFolha = { id: string; inicio: string | null; fim: string | null; exibicao: ExibicaoDoBloco; tipo: string; titulo: string | null; confirmado: boolean };
export type CartaoDaFolha = { tipo: TipoDeCartaoDoDia; titulo: string | null; inicio: string | null; fim: string | null; endereco: string | null; localizador: string | null; notas: string | null };

/** Um deslocamento em que a pessoa vai ou que ela dirige (PD6.11). */
export type DeslocamentoDaFolha = {
  id: string; tipo: TipoDeDeslocamento; origem: string | null; destino: string | null; saida: string | null; chegada: string | null;
  veiculo: string | null; placa: string | null; companhia: string | null; localizador: string | null; notas: string | null; motorista: boolean;
  /** PD6.4: só para o motorista; ausentes na folha guardada antes dessa entrega. */
  odometro_saida_km?: number | null; odometro_chegada_km?: number | null;
  abastecimentos?: { id: string; litros: number; combustivel: string; posto: string | null; quando: string }[];
};
/** O hotel em que a pessoa tem quarto na data (PD6.11): o nome do quarto, sem os colegas. */
export type HospedagemDaFolha = { id: string; hotel: string; endereco: string | null; entrada: string | null; saida: string | null; localizador: string | null; quarto: string };

/** O que fn_equipe_folha devolve: só o que cabe à pessoa. */
export type FolhaDaEquipe = {
  data: { id: string; data: string; data_fim: string | null; tipo: TipoData; situacao: SituacaoDaData; uf: string | null; fuso: string; temporada_titulo: string; organizacao_nome: string };
  escala: { id: string; funcao: string | null; chamada: string | null; saida: string | null; confirmacao: ConfirmacaoDaEscala };
  blocos: BlocoDaFolha[];
  cartoes: CartaoDaFolha[];
  /** Ausentes na folha antiga guardada no aparelho (de antes da PD6.11): a tela trata como vazio. */
  deslocamentos?: DeslocamentoDaFolha[];
  hospedagens?: HospedagemDaFolha[];
};

/**
 * O bloco que está acontecendo e o próximo. "Agora" é o bloco com início e fim em que o instante cai
 * (o início conta, o fim não); sem fim, o bloco não está "agora", só vira o "próximo" antes da hora.
 * Os blocos "a definir" (sem início) ficam de fora dos dois.
 */
export function agoraEProximo<T extends { inicio: string | null; fim: string | null }>(blocos: readonly T[], agoraMs: number): { agora: T | null; proximo: T | null } {
  const comHora = blocos.filter(bloco => bloco.inicio).sort((a, b) => Date.parse(a.inicio as string) - Date.parse(b.inicio as string));
  const agora = comHora.find(bloco => bloco.fim && Date.parse(bloco.inicio as string) <= agoraMs && agoraMs < Date.parse(bloco.fim)) ?? null;
  const proximo = comHora.find(bloco => Date.parse(bloco.inicio as string) > agoraMs) ?? null;
  return { agora, proximo };
}
