// A lista do que levar (plano do módulo, PD4.4, primeiro corte): o que o rider pede e a sala não atende. A pessoa liga cada linha do rider ao equipamento da casa que a
// atende; a linha sem equipamento em uso na sala, ou com menos unidades do que pede, entra na lista. Sem tela e sem banco.

import type { EstadoDoEquipamento } from "@/lib/producao/estados";

export type LinhaDoRider = { id: string; secao: string; texto: string; quantidade: number | null; obrigatorio: boolean };
export type EquipamentoDaCasa = { id: string; nome: string; categoria: string | null; quantidade: number; estado: EstadoDoEquipamento; sala_id: string | null; espaco_id: string };
export type LigacaoDaLinha = { rider_item_id: string; equipamento_id: string };

export type SituacaoDaLinha = "atendida" | "parcial" | "levar";
export type LinhaDoQueLevar = {
  linha: LinhaDoRider;
  situacao: SituacaoDaLinha;
  /** Quantas unidades a casa oferece em uso, somando os equipamentos ligados. */
  oferece: number;
  /** Quantas unidades a produção leva (o que o rider pede menos o que a casa oferece). */
  levar: number;
  /** Os equipamentos ligados, com o motivo quando não contam (em manutenção, avariado ou baixado). */
  ligados: { id: string; nome: string; quantidade: number; conta: boolean }[];
};

/** O que a sala dá de si: o equipamento da própria sala e o do espaço inteiro (sem sala). */
export const equipamentoDaSala = (equipamento: Pick<EquipamentoDaCasa, "sala_id" | "espaco_id">, salaId: string, espacoId: string) =>
  equipamento.sala_id === salaId || (equipamento.sala_id === null && equipamento.espaco_id === espacoId);

/** Só o equipamento em uso conta: em manutenção, avariado ou baixado não atende ninguém. */
export const equipamentoUsavel = (estado: EstadoDoEquipamento) => estado === "em_uso";

/**
 * A lista de uma sala: cada linha do rider diz se a casa atende, atende em parte ou não atende, e quantas unidades a produção leva. Só valem os equipamentos da sala
 * (ou do espaço) e em uso; uma ligação com equipamento de outra sala não conta (trocar a sala muda a lista).
 */
export function listaDoQueLevar(
  linhas: readonly LinhaDoRider[], ligacoes: readonly LigacaoDaLinha[], equipamentos: readonly EquipamentoDaCasa[], salaId: string, espacoId: string,
): LinhaDoQueLevar[] {
  const daSala = new Map(equipamentos.filter(item => equipamentoDaSala(item, salaId, espacoId)).map(item => [item.id, item]));
  return linhas.map(linha => {
    const pedido = Math.max(1, linha.quantidade ?? 1);
    const ligados = ligacoes
      .filter(ligacao => ligacao.rider_item_id === linha.id)
      .flatMap(ligacao => { const equipamento = daSala.get(ligacao.equipamento_id); return equipamento ? [{ id: equipamento.id, nome: equipamento.nome, quantidade: equipamento.quantidade, conta: equipamentoUsavel(equipamento.estado) }] : []; });
    const oferece = ligados.filter(item => item.conta).reduce((soma, item) => soma + item.quantidade, 0);
    const situacao: SituacaoDaLinha = oferece >= pedido ? "atendida" : oferece > 0 ? "parcial" : "levar";
    return { linha, situacao, oferece, levar: Math.max(0, pedido - oferece), ligados };
  });
}

/** Só o que a produção leva (parcial ou total), obrigatório primeiro, e depois na ordem do rider. */
export function soOQueLevar(lista: readonly LinhaDoQueLevar[]): LinhaDoQueLevar[] {
  return lista.filter(item => item.situacao !== "atendida")
    .map((item, indice) => ({ item, indice }))
    .sort((a, b) => Number(b.item.linha.obrigatorio) - Number(a.item.linha.obrigatorio) || a.indice - b.indice)
    .map(({ item }) => item);
}

const semAcento = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** O plural vira singular, para "refletores" casar com "Refletor" e "luzes" com "luz": tira o "es" depois de r ou z, e o "s" final das outras. */
const singular = (palavra: string) => (/(?:r|z)es$/.test(palavra) && palavra.length > 4 ? palavra.slice(0, -2) : palavra.length > 3 && palavra.endsWith("s") ? palavra.slice(0, -1) : palavra);
const palavras = (texto: string) => new Set(semAcento(texto).split(/[^a-z0-9]+/).filter(palavra => palavra.length >= 3).map(singular));

/** O equipamento mais parecido com o texto da linha do rider (palavras em comum), ou nulo quando nenhum se parece o bastante. Só sugere: quem liga é a pessoa. */
export function equipamentoSugerido(texto: string, equipamentos: readonly Pick<EquipamentoDaCasa, "id" | "nome" | "categoria">[]): string | null {
  const dela = palavras(texto);
  if (dela.size === 0) return null;
  let melhor: { id: string; nota: number } | null = null;
  for (const equipamento of equipamentos) {
    const dele = palavras(`${equipamento.nome} ${equipamento.categoria ?? ""}`);
    const comuns = [...dela].filter(palavra => dele.has(palavra)).length;
    if (comuns === 0) continue;
    const nota = comuns / Math.min(dela.size, dele.size);
    if (nota >= 0.5 && (melhor === null || nota > melhor.nota)) melhor = { id: equipamento.id, nota };
  }
  return melhor?.id ?? null;
}

/** O texto da lista para mandar ou colar: "O que levar para Teatro Central · Sala 1" e uma linha por item. */
export function textoDoQueLevar(sala: string, lista: readonly LinhaDoQueLevar[]): string {
  const itens = soOQueLevar(lista);
  if (itens.length === 0) return `Nada a levar para ${sala}: a casa atende todo o rider.`;
  return [
    `O que levar para ${sala}:`,
    ...itens.map(item => `- ${item.levar}× ${item.linha.texto}${item.situacao === "parcial" ? ` (a casa tem ${item.oferece})` : ""}${item.linha.obrigatorio ? "" : " [opcional]"}`),
  ].join("\n");
}
