import { mensagemParaOAssistente } from "@/lib/mcp/prestacao/mensagens";
import { destinoDaVerificacao } from "@/lib/prestacao/destino-da-verificacao";
import { pendenciasPorSeveridade, tituloDaChecagem } from "@/lib/prestacao/checagens";
import type { NoOrcamento } from "@/lib/prestacao/orcamento";
import { filaDePendencias, soComPendencia, type DespesaDaFila, type LinhaDaFila, type PagamentoDaFila, type VerificacaoDaFila } from "@/lib/prestacao/pendencias";

/** Colunas que a fila lê, as mesmas da aba Pendências do app. */
export const COLUNAS_DA_FILA = {
  despesas: "id,nome_arquivo,tipo,status,no_id,valor_extraido,valor_liquido,data_doc,descricao_servico",
  pagamentos: "id,despesa_id,valor,lancamento_id",
  verificacoes: "id,chave,check_codigo,severidade,status,entidade_tipo,entidade_id,mensagem,dados",
  nos: "id,versao_id,parent_id,tipo,codigo,nome,descricao,uf,municipio,grupo_custo,unidade,quantidade,ocorrencias,valor_unitario,valor_total,valor_remanejado,ordem,cnaes_aceitos,bem_permanente",
} as const;

const ORDEM_DA_SEVERIDADE: Record<string, number> = { bloqueio: 0, alerta: 1, justificativa: 2, info: 3 };

const MAX_DESPESAS_POR_ITEM = 5;
const MAX_VERIFICACOES = 25;

const absoluto = (origem: string, prestacaoId: string, href: string) => (href.startsWith("#") ? `${origem}/prestacoes/${prestacaoId}${href}` : `${origem}${href}`);

function verificacaoParaOAssistente(v: VerificacaoDaFila, prestacaoId: string, origem: string) {
  const destino = destinoDaVerificacao(prestacaoId, v);
  return {
    id: v.id,
    codigo: v.check_codigo,
    titulo: tituloDaChecagem(v.check_codigo),
    severidade: v.severidade,
    mensagem: mensagemParaOAssistente(v),
    entidade_tipo: v.entidade_tipo,
    entidade_id: v.entidade_id,
    onde_resolver: absoluto(origem, prestacaoId, destino.href),
    acao: destino.rotulo,
  };
}

function itemParaOAssistente(linha: LinhaDaFila, prestacaoId: string, origem: string) {
  const comPendencia = linha.despesasDoItem.filter(d => d.pendencias.length > 0 || d.aConciliar > 0);
  return {
    item_id: linha.id,
    nome: linha.nome,
    caminho: linha.caminho.length > 0 ? linha.caminho.join(" › ") : null,
    grupo_de_custo: linha.grupo,
    orcamento_vigente: linha.vigente,
    saldo: linha.saldo,
    saldo_negativo: linha.saldo !== null && linha.saldo < 0,
    despesas: linha.despesas,
    a_conciliar: linha.aConciliar,
    regras_pendentes: linha.pendencias,
    despesas_com_pendencia: comPendencia.slice(0, MAX_DESPESAS_POR_ITEM).map(d => ({
      id: d.id,
      nome: d.nome,
      valor: d.valor,
      sem_pagamento_conciliado: d.aConciliar,
      pendencias: d.pendencias.map(v => ({ codigo: v.check_codigo, titulo: tituloDaChecagem(v.check_codigo), severidade: v.severidade, mensagem: mensagemParaOAssistente(v) })),
      onde_resolver: `${origem}/prestacoes/${prestacaoId}/comprovantes?despesa=${d.id}`,
    })),
    despesas_omitidas: Math.max(0, comPendencia.length - MAX_DESPESAS_POR_ITEM),
  };
}

/** Quanto pesa a linha na fila do assistente: bloqueios primeiro, depois as demais regras, o saldo negativo e o que falta conciliar. */
function pesoDaLinha(linha: LinhaDaFila): number[] {
  return [linha.pendencias.bloqueios, linha.pendencias.outras, linha.saldo !== null && linha.saldo < 0 ? 1 : 0, linha.aConciliar.valor];
}

function maisPesada(a: LinhaDaFila, b: LinhaDaFila): number {
  const pa = pesoDaLinha(a);
  const pb = pesoDaLinha(b);
  for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
  return a.nome.localeCompare(b.nome, "pt-BR");
}

export interface EntradaDasPendencias {
  prestacaoId: string;
  origem: string;
  nos: readonly NoOrcamento[];
  despesas: readonly DespesaDaFila[];
  pagamentos: readonly PagamentoDaFila[];
  verificacoes: readonly VerificacaoDaFila[];
  somentePendentes: boolean;
  limite: number;
  deslocamento: number;
}

/**
 * O que falta em cada item do orçamento e as verificações abertas, como a aba Pendências do app (a fila vem de
 * lib/prestacao/pendencias.ts). Para o assistente, os itens vêm do que pesa mais para o que pesa menos.
 */
export function montarPendencias(entrada: EntradaDasPendencias) {
  const { linhas, resumo } = filaDePendencias(entrada);
  const candidatas = (entrada.somentePendentes ? soComPendencia(linhas) : [...linhas]).sort(maisPesada);
  const escolhidas = candidatas.slice(entrada.deslocamento, entrada.deslocamento + entrada.limite);

  const abertas = entrada.verificacoes.filter(v => v.status === "aberta");
  const ordenadas = [...abertas].sort((a, b) => (ORDEM_DA_SEVERIDADE[a.severidade] ?? 9) - (ORDEM_DA_SEVERIDADE[b.severidade] ?? 9));
  const porSeveridade = { ...pendenciasPorSeveridade(abertas), info: abertas.filter(v => v.severidade === "info").length };

  const proximo = entrada.deslocamento + entrada.limite;
  return {
    resumo: {
      itens_com_pendencia: resumo.itensComPendencia,
      a_conciliar: resumo.aConciliar,
      bloqueios: resumo.bloqueios,
      debitos_do_extrato_sem_despesa: resumo.debitosSemDespesa,
      despesas_sem_item: resumo.semItem,
    },
    itens: escolhidas.map(l => itemParaOAssistente(l, entrada.prestacaoId, entrada.origem)),
    itens_total: candidatas.length,
    proximo_deslocamento: proximo < candidatas.length ? proximo : null,
    verificacoes_abertas: {
      total: abertas.length,
      por_severidade: porSeveridade,
      mostradas: Math.min(abertas.length, MAX_VERIFICACOES),
      itens: ordenadas.slice(0, MAX_VERIFICACOES).map(v => verificacaoParaOAssistente(v, entrada.prestacaoId, entrada.origem)),
    },
  };
}
