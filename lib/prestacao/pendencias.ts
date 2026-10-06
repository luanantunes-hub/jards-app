// Fila de pendências (P2.9): uma linha por item do orçamento em uso, com o
// que falta para o item ficar pronto: despesas ainda sem pagamento conciliado
// com o extrato, regras pendentes (verificações abertas das despesas, dos
// pagamentos e do próprio item) e saldo. Despesas sem item têm a linha delas.
// O filtro "só com pendência" deixa na tela o que falta zerar. Sem React e
// sem Supabase.

import { ehDespesa } from "./despesas";
import {
  conciliadoPorDespesa,
  execucaoDaDespesa,
  itensDaArvore,
  montarArvore,
  type GrupoCusto,
  type NoOrcamento,
  type PagamentoDoOrcamento,
} from "./orcamento";
import type { PrestacaoComprovante, PrestacaoVerificacao } from "@/lib/supabase/types";

export type DespesaDaFila = Pick<PrestacaoComprovante, "id" | "nome_arquivo" | "tipo" | "status" | "no_id" | "valor_extraido"> &
  Partial<Pick<PrestacaoComprovante, "valor_liquido" | "data_doc" | "descricao_servico">>;
export type PagamentoDaFila = PagamentoDoOrcamento & { id: string };
export type VerificacaoDaFila = Pick<PrestacaoVerificacao, "id" | "chave" | "check_codigo" | "severidade" | "status" | "entidade_tipo" | "entidade_id" | "mensagem"> &
  Partial<Pick<PrestacaoVerificacao, "dados">>;

export type Contagem = { quantidade: number; valor: number };

export type DespesaNaFila = {
  id: string;
  nome: string;
  valor: number;
  /** Parte do valor ainda sem pagamento conciliado. */
  aConciliar: number;
  pendencias: VerificacaoDaFila[];
};

export type LinhaDaFila = {
  /** Item do orçamento; null na linha das despesas sem item desta versão. */
  id: string | null;
  nome: string;
  caminho: string[];
  grupo: GrupoCusto | null;
  vigente: number | null;
  despesas: Contagem;
  aConciliar: Contagem;
  /** Verificações abertas (sem os avisos) das despesas, dos pagamentos e do item. */
  pendencias: { bloqueios: number; outras: number };
  saldo: number | null;
  despesasDoItem: DespesaNaFila[];
  temPendencia: boolean;
};

export type ResumoDaFila = {
  itensComPendencia: number;
  aConciliar: Contagem;
  bloqueios: number;
  /** Débitos do extrato sem despesa: ficam fora dos itens, porque ainda não têm item. */
  debitosSemDespesa: Contagem;
  semItem: Contagem;
};

const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
const abertaQueConta = (v: VerificacaoDaFila) => v.status === "aberta" && v.severidade !== "info";

export function filaDePendencias(p: {
  nos: readonly NoOrcamento[];
  despesas: readonly DespesaDaFila[];
  pagamentos: readonly PagamentoDaFila[];
  verificacoes: readonly VerificacaoDaFila[];
}): { linhas: LinhaDaFila[]; resumo: ResumoDaFila } {
  const despesas = p.despesas.filter(d => d.status !== "rejeitado" && ehDespesa(d.tipo));
  const conciliado = conciliadoPorDespesa(p.pagamentos);
  const abertas = p.verificacoes.filter(abertaQueConta);
  const despesaDoPagamento = new Map(p.pagamentos.map(pg => [pg.id, pg.despesa_id]));

  // Verificações por despesa (as do pagamento contam para a despesa dele) e por item.
  const porDespesa = new Map<string, VerificacaoDaFila[]>();
  const porItem = new Map<string, VerificacaoDaFila[]>();
  for (const v of abertas) {
    const despesaId = v.entidade_tipo === "despesa" ? v.entidade_id : v.entidade_tipo === "pagamento" && v.entidade_id ? despesaDoPagamento.get(v.entidade_id) ?? null : null;
    if (despesaId) {
      porDespesa.set(despesaId, [...(porDespesa.get(despesaId) ?? []), v]);
    } else if (v.check_codigo === "ITEM_SEM_SALDO") {
      // A chave do saldo termina no id do item (checar-financeiro).
      const itemId = v.chave.split(":").at(-1)!;
      porItem.set(itemId, [...(porItem.get(itemId) ?? []), v]);
    }
  }

  const naFila = (d: DespesaDaFila): DespesaNaFila => {
    const execucao = execucaoDaDespesa(d, conciliado.get(d.id) ?? 0);
    return {
      id: d.id,
      nome: d.descricao_servico || d.nome_arquivo,
      valor: centavos(d.valor_extraido) / 100,
      aConciliar: (execucao?.comprometido ?? 0) / 100,
      pendencias: porDespesa.get(d.id) ?? [],
    };
  };

  const montar = (base: Omit<LinhaDaFila, "despesas" | "aConciliar" | "pendencias" | "despesasDoItem" | "temPendencia">, doItem: DespesaNaFila[], doProprioItem: VerificacaoDaFila[]): LinhaDaFila => {
    const pendentes = [...doItem.flatMap(d => d.pendencias), ...doProprioItem];
    const aConciliar = doItem.filter(d => d.aConciliar > 0);
    const linha: LinhaDaFila = {
      ...base,
      despesas: { quantidade: doItem.length, valor: doItem.reduce((s, d) => s + centavos(d.valor), 0) / 100 },
      aConciliar: { quantidade: aConciliar.length, valor: aConciliar.reduce((s, d) => s + centavos(d.aConciliar), 0) / 100 },
      pendencias: { bloqueios: pendentes.filter(v => v.severidade === "bloqueio").length, outras: pendentes.filter(v => v.severidade !== "bloqueio").length },
      despesasDoItem: [...doItem].sort((a, b) => b.pendencias.length - a.pendencias.length || b.aConciliar - a.aConciliar || a.nome.localeCompare(b.nome, "pt-BR")),
      temPendencia: false,
    };
    linha.temPendencia = linha.aConciliar.quantidade > 0 || linha.pendencias.bloqueios + linha.pendencias.outras > 0 || (linha.saldo !== null && linha.saldo < 0);
    return linha;
  };

  const arvore = montarArvore(p.nos, despesas, p.pagamentos);
  const itens = itensDaArvore(arvore.raizes);
  const idsDosItens = new Set(itens.map(l => l.no.id));
  const linhas = itens.map(l => montar(
    {
      id: l.no.id,
      nome: l.no.nome,
      caminho: l.caminho,
      grupo: l.grupo,
      vigente: l.totais.vigente,
      saldo: l.totais.saldo,
    },
    despesas.filter(d => d.no_id === l.no.id).map(naFila),
    porItem.get(l.no.id) ?? [],
  ));

  const semItem = despesas.filter(d => !d.no_id || !idsDosItens.has(d.no_id)).map(naFila);
  if (semItem.length) {
    linhas.push(montar({ id: null, nome: "Despesas sem item do orçamento", caminho: [], grupo: null, vigente: null, saldo: null }, semItem, []));
  }

  const debitos = abertas.filter(v => v.check_codigo === "DEBITO_SEM_COMPROVANTE");
  const resumo: ResumoDaFila = {
    itensComPendencia: linhas.filter(l => l.id !== null && l.temPendencia).length,
    aConciliar: {
      quantidade: linhas.reduce((s, l) => s + l.aConciliar.quantidade, 0),
      valor: linhas.reduce((s, l) => s + centavos(l.aConciliar.valor), 0) / 100,
    },
    bloqueios: abertas.filter(v => v.severidade === "bloqueio").length,
    // O que falta ligar de cada débito: o valor menos o que já está ligado (dados do achado).
    debitosSemDespesa: {
      quantidade: debitos.length,
      valor: debitos.reduce((s, v) => s + Math.max(centavos(v.dados?.valor) - centavos(v.dados?.ligado), 0), 0) / 100,
    },
    semItem: { quantidade: semItem.length, valor: semItem.reduce((s, d) => s + centavos(d.valor), 0) / 100 },
  };
  return { linhas, resumo };
}

/** O que a tela mostra com o filtro "só com pendência". */
export function soComPendencia(linhas: readonly LinhaDaFila[]): LinhaDaFila[] {
  return linhas.filter(l => l.temPendencia);
}
