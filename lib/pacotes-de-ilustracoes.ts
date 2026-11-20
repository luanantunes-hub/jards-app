/**
 * Pacotes de ilustrações do Jards. Um pacote é um conjunto de desenhos que sempre anda junto: mora numa
 * pasta própria em `public/ilustracoes/<id>/`, com arquivos numerados de `01.png` até o total, e o sorteio
 * do dia (lib/frases-das-secoes.ts) escolhe sempre dentro de um pacote, nunca misturando dois.
 *
 * Para um pacote novo: ponha a pasta com os desenhos numerados sem buraco, acrescente uma entrada em
 * `PACOTES_DE_ILUSTRACOES` e, para ele aparecer, troque o `PACOTE_ATIVO`. O teste confere pasta e total.
 */
export type PacoteDeIlustracoes = {
  /** Nome da pasta em `public/ilustracoes/`. */
  id: string;
  /** Como o pacote se chama na conversa. */
  nome: string;
  /** Quantos desenhos tem: `01.png` até este número, sem buraco. */
  total: number;
};

export const PACOTES_DE_ILUSTRACOES = [
  // O tamanduá tomando café, andando de skate, atendendo o telefone e comendo hambúrguer: 15 desenhos.
  { id: "dia-a-dia", nome: "Tamanduá no dia a dia", total: 15 },
] as const satisfies readonly PacoteDeIlustracoes[];

/** O pacote que aparece na frente das frases hoje. */
export const PACOTE_ATIVO: PacoteDeIlustracoes = PACOTES_DE_ILUSTRACOES[0];

/** O endereço do desenho `numero` (de 1 ao total) de um pacote. */
export function caminhoDaIlustracao(pacote: PacoteDeIlustracoes, numero: number): string {
  return `/ilustracoes/${pacote.id}/${String(numero).padStart(2, "0")}.png`;
}
