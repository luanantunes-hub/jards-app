// As tabelas para a transportadora e para a locadora (PD8.6): só o que cada parceiro precisa. Sem banco e sem tela: quem chama (a página
// pública do link) entrega as linhas já lidas. Nunca entra contato, documento, nota, dinheiro, odômetro, placa nem motorista: as funções
// só copiam os campos abaixo e, no transfer, o nome de cada passageiro.

import { ROTULO_DO_DESLOCAMENTO } from "@/lib/producao/deslocamentos";
import { ROTULO_DA_CATEGORIA } from "@/lib/producao/inventario";
import type { CategoriaDoItem, TipoDeDeslocamento, TipoDeTabela } from "@/lib/producao/estados";
import { TIPOS_DE_TABELA } from "@/lib/producao/estados";

export { TIPOS_DE_TABELA };
export type { TipoDeTabela };
export const ROTULO_DA_TABELA: Record<TipoDeTabela, string> = { transfers: "Transportadora (transfers)", locacao: "Locadora (itens locados)" };

/** Compara sem ligar para maiúsculas, acentos e espaços nas pontas: "Locadora São Paulo" casa com "locadora sao paulo ". */
const comparavel = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** Sem filtro, tudo passa; com filtro, só o que for exatamente daquele parceiro (a companhia do transfer, o fornecedor do item). */
export function bateComOFiltro(valor: string | null, filtro: string | null): boolean {
  if (filtro === null || comparavel(filtro) === "") return true;
  return valor !== null && comparavel(valor) === comparavel(filtro);
}

export type TransferDaTransportadora = {
  dia: string; tipo: string; origem: string | null; destino: string | null; saida: string | null; chegada: string | null;
  companhia: string | null; localizador: string | null; passageiros: string[];
};

type DataLida = { id: string; data: string; fuso: string };
type DeslocamentoLido = {
  id: string; data_id: string; tipo: TipoDeDeslocamento; origem: string | null; destino: string | null;
  saida: string | null; chegada: string | null; companhia: string | null; localizador: string | null;
};

const hora = (instante: string | null, fuso: string): string | null =>
  instante === null ? null : new Date(instante).toLocaleTimeString("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit" });
const diaLocal = (instante: string, fuso: string): string => new Date(instante).toLocaleDateString("sv-SE", { timeZone: fuso });

/** Os transfers da temporada em ordem de saída (sem saída, pelo dia da data), com a hora no fuso da data e os nomes dos passageiros. */
export function transfersParaATransportadora(
  datas: readonly DataLida[], deslocamentos: readonly DeslocamentoLido[],
  passageiros: readonly { deslocamento_id: string; pessoa_id: string }[], pessoas: readonly { id: string; nome: string }[], filtro: string | null,
): TransferDaTransportadora[] {
  const dataPorId = new Map(datas.map(data => [data.id, data]));
  const nomes = new Map(pessoas.map(pessoa => [pessoa.id, pessoa.nome]));
  const linhas: { chave: string; transfer: TransferDaTransportadora }[] = [];
  for (const deslocamento of deslocamentos) {
    const data = dataPorId.get(deslocamento.data_id);
    if (!data || !bateComOFiltro(deslocamento.companhia, filtro)) continue;
    const dia = deslocamento.saida ? diaLocal(deslocamento.saida, data.fuso) : data.data;
    const quem = passageiros
      .filter(item => item.deslocamento_id === deslocamento.id)
      .map(item => nomes.get(item.pessoa_id) ?? "Passageiro")
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    linhas.push({
      chave: `${dia} ${deslocamento.saida ? hora(deslocamento.saida, data.fuso) : "99:99"}`,
      transfer: {
        dia, tipo: ROTULO_DO_DESLOCAMENTO[deslocamento.tipo] ?? "Transfer", origem: deslocamento.origem, destino: deslocamento.destino,
        saida: hora(deslocamento.saida, data.fuso), chegada: hora(deslocamento.chegada, data.fuso),
        companhia: deslocamento.companhia, localizador: deslocamento.localizador, passageiros: quem,
      },
    });
  }
  return linhas.sort((a, b) => a.chave.localeCompare(b.chave)).map(linha => linha.transfer);
}

export type ItemParaALocadora = {
  nome: string; categoria: string; quantidade: number; locacao_inicio: string | null; locacao_fim: string | null;
  comprimento_cm: number | null; largura_cm: number | null; altura_cm: number | null; peso_kg: number | null;
};

type ItemLido = {
  nome: string; categoria: CategoriaDoItem; quantidade: number; fornecedor: string | null; locacao_inicio: string | null; locacao_fim: string | null;
  comprimento_cm: number | null; largura_cm: number | null; altura_cm: number | null; peso_kg: number | null;
};

/** Os itens locados, por início da locação e depois por nome, só os do fornecedor do filtro (se houver). Sem série, notas, valor nem fornecedor. */
export function itensParaALocadora(itens: readonly ItemLido[], filtro: string | null): ItemParaALocadora[] {
  return itens
    .filter(item => bateComOFiltro(item.fornecedor, filtro))
    .map(item => ({
      nome: item.nome, categoria: ROTULO_DA_CATEGORIA[item.categoria] ?? "Outro", quantidade: item.quantidade,
      locacao_inicio: item.locacao_inicio, locacao_fim: item.locacao_fim,
      comprimento_cm: item.comprimento_cm, largura_cm: item.largura_cm, altura_cm: item.altura_cm, peso_kg: item.peso_kg,
    }))
    .sort((a, b) => (a.locacao_inicio ?? "9999").localeCompare(b.locacao_inicio ?? "9999") || a.nome.localeCompare(b.nome, "pt-BR"));
}
