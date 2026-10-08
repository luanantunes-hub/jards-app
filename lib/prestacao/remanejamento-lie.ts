// Planilha de remanejamento e readequação da LIE, Modelo I (P8.3).
//
// O pedido de remanejamento ou de readequação vai com o ofício, a descrição do
// plano de trabalho, esta planilha e a planilha orçamentária atualizada
// (Portaria MESP 10/2026, art. 54). O modelo tem um bloco de 11 linhas por
// item alterado: a situação aprovada (unidade, quantidade, duração, valor
// unitário e total), a executada, a proposta além do executado, o total do
// item, o valor remanejado e a justificativa. Este módulo monta os blocos a
// partir de uma alteração do orçamento (P1.7) e grava sobre o modelo oficial
// convertido para .xlsx. Sem React e sem Supabase.
//
// O valor remanejado segue o rótulo do modelo: proposta + executada − aprovada
// (positivo quando o item cresce). O exemplo que acompanha o modelo usa o
// sinal oposto na fórmula; o rótulo é o que a pessoa lê ao preencher.

import { PastaDeTrabalho } from "../xlsx-modelo";
import type { MovimentoAlteracao } from "./alteracoes";
import type { EstadoDaPrestacao } from "./checagens/catalogo";
import { planoDeTrabalho } from "./formulario-lie";

const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Abas e posições do modelo (planilha-remanejamento-readequacao). */
export const ABA_DO_REMANEJAMENTO = "Remanejamento-Readequação";
export const PRIMEIRO_BLOCO = 6;
export const LINHAS_POR_BLOCO = 11;
export const BLOCOS_NO_MODELO = 34;
/** Linhas dos totais, depois do último bloco. */
export const LINHA_TOTAL_NEGATIVOS = 380;
export const LINHA_TOTAL_POSITIVOS = 381;

export type ItemDoRemanejamento = {
  noId: string | null;
  codigo: string;
  nome: string;
  unidade: string;
  quantidade: number | null;
  duracao: number | null;
  /** Centavos. */
  valorUnitario: number | null;
  aprovado: number;
  executado: number;
  /** Além do executado: total proposto − executado. */
  proposto: number;
  total: number;
  /** Proposta + executada − aprovada. */
  remanejado: number;
};

export type PlanilhaDeRemanejamento = {
  projeto: string;
  numero: number;
  justificativa: string;
  itens: ItemDoRemanejamento[];
  /** Centavos: soma dos valores remanejados negativos (o que sai) e positivos (o que entra). */
  totais: { negativos: number; positivos: number };
  criticas: string[];
};

export type DadosDoRemanejamento = {
  estado: Pick<EstadoDaPrestacao, "nos" | "despesas" | "pagamentos">;
  projeto: string;
  alteracao: { numero: number; justificativa: string | null; movimentos: readonly MovimentoAlteracao[] };
};

export function planilhaDeRemanejamento(dados: DadosDoRemanejamento): PlanilhaDeRemanejamento {
  const { itens: doPlano, codigoDoItem } = planoDeTrabalho(dados.estado);
  const executadoDoItem = new Map(doPlano.map(i => [i.id, i.executado]));
  const nos = new Map((dados.estado.nos ?? []).map(n => [n.id, n]));
  const criticas: string[] = [];
  const movimentos = dados.alteracao.movimentos.filter(m => centavos(m.de) !== centavos(m.para));

  const itens = movimentos.map((m): ItemDoRemanejamento => {
    const no = m.no_id ? nos.get(m.no_id) : undefined;
    const aprovado = centavos(m.de);
    const total = centavos(m.para);
    const executado = m.no_id ? executadoDoItem.get(m.no_id) ?? 0 : 0;
    const codigo = (m.no_id && codigoDoItem.get(m.no_id)) || "";
    if (!codigo) criticas.push(m.no_id ? `${m.nome}: o item não está no orçamento em uso; preencha o nº do item.` : `${m.nome}: item novo; preencha o nº que ele terá no plano de trabalho.`);
    if (total < executado) criticas.push(`${m.nome}: o total proposto (${reais(total)}) fica abaixo do já executado (${reais(executado)}).`);
    return {
      noId: m.no_id,
      codigo,
      nome: m.nome,
      unidade: (no?.unidade ?? "").trim(),
      quantidade: no?.quantidade ?? null,
      duracao: no?.ocorrencias ?? null,
      valorUnitario: no?.valor_unitario === null || no?.valor_unitario === undefined ? null : centavos(no.valor_unitario),
      aprovado,
      executado,
      proposto: total - executado,
      total,
      remanejado: total - aprovado,
    };
  });
  if (!itens.length) criticas.push("A alteração não muda o valor de nenhum item.");
  if (itens.length > BLOCOS_NO_MODELO) criticas.push(`O modelo tem ${BLOCOS_NO_MODELO} blocos: ${itens.length - BLOCOS_NO_MODELO} itens ficam de fora.`);
  if (!(dados.alteracao.justificativa ?? "").trim()) criticas.push("A alteração não tem justificativa: a coluna JUSTIFICATIVA sai vazia.");
  return {
    projeto: dados.projeto,
    numero: dados.alteracao.numero,
    justificativa: (dados.alteracao.justificativa ?? "").trim(),
    itens,
    totais: {
      negativos: itens.reduce((s, i) => s + Math.min(i.remanejado, 0), 0),
      positivos: itens.reduce((s, i) => s + Math.max(i.remanejado, 0), 0),
    },
    criticas,
  };
}

export const nomeDaPlanilhaDeRemanejamento = (p: Pick<PlanilhaDeRemanejamento, "numero" | "projeto">) =>
  `Remanejamento_${p.numero}_${p.projeto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "projeto"}.xlsx`;

/** Grava os blocos sobre o modelo; os blocos que sobram ficam em branco. */
export async function gravarPlanilhaDeRemanejamento(modelo: Uint8Array, p: PlanilhaDeRemanejamento): Promise<Uint8Array> {
  const pasta = await PastaDeTrabalho.abrir(modelo);
  const aba = pasta.planilha(ABA_DO_REMANEJAMENTO);
  aba.escrever("B1", `Projeto: ${p.projeto}\nProcesso nº: `);
  const valor = (c: number | null) => (c === null ? null : c / 100);
  for (let k = 0; k < BLOCOS_NO_MODELO; k++) {
    const r = PRIMEIRO_BLOCO + k * LINHAS_POR_BLOCO;
    const item = p.itens[k];
    if (!item) {
      aba.escrever(`B${r + 1}`, null);
      continue;
    }
    aba.escrever(`B${r + 1}`, item.codigo || null);
    aba.escrever(`C${r + 1}`, item.nome);
    aba.escrever(`F${r + 1}`, item.unidade || null);
    aba.escrever(`G${r + 1}`, item.quantidade);
    aba.escrever(`H${r + 1}`, item.duracao);
    aba.escrever(`I${r + 1}`, valor(item.valorUnitario));
    aba.escrever(`J${r + 1}`, valor(item.aprovado));
    aba.escrever(`J${r + 2}`, valor(item.executado));
    aba.escrever(`J${r + 5}`, valor(item.proposto));
    aba.escrever(`J${r + 8}`, valor(item.total));
    aba.escrever(`J${r + 9}`, valor(item.remanejado));
    aba.escrever(`K${r + 1}`, p.justificativa || null);
  }
  // A fórmula do modelo nesse total aponta para uma referência perdida (#REF!): sai o valor.
  aba.escrever(`J${LINHA_TOTAL_NEGATIVOS}`, valor(p.totais.negativos));
  aba.escrever(`J${LINHA_TOTAL_POSITIVOS}`, valor(p.totais.positivos));
  return pasta.gravar();
}
