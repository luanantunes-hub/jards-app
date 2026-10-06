import assert from "node:assert/strict";
import test from "node:test";
import { filaDePendencias, soComPendencia, type DespesaDaFila, type VerificacaoDaFila } from "../lib/prestacao/pendencias";
import type { NoOrcamento } from "../lib/prestacao/orcamento";

const no = (id: string, nome: string, valor_total: number, campos: Partial<NoOrcamento> = {}): NoOrcamento => ({
  id, nome, versao_id: "v1", parent_id: null, tipo: "item", codigo: null, descricao: null, uf: null, municipio: null,
  grupo_custo: null, unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null, valor_total, valor_remanejado: 0, ordem: 0, ...campos,
});

const despesa = (id: string, no_id: string | null, valor: number, campos: Partial<DespesaDaFila> = {}): DespesaDaFila => ({
  id, nome_arquivo: `${id}.pdf`, tipo: "nfse", status: "pendente", no_id, valor_extraido: valor, ...campos,
});

const verificacao = (id: string, campos: Partial<VerificacaoDaFila>): VerificacaoDaFila => ({
  id, chave: `X:${id}`, check_codigo: "X", severidade: "alerta", status: "aberta", entidade_tipo: "despesa", entidade_id: null, mensagem: id, ...campos,
});

const NOS = [
  no("prod", "Produção", 0, { tipo: "etapa", ordem: 1 }),
  no("som", "Som", 1000, { parent_id: "prod", grupo_custo: "execucao" }),
  no("luz", "Luz", 2000, { parent_id: "prod", grupo_custo: "execucao", ordem: 1 }),
  no("cache", "Cachê", 5000, { ordem: 2 }),
];

const DESPESAS = [
  despesa("d1", "som", 600),
  despesa("d2", "som", 600),
  despesa("d3", "luz", 2000),
  despesa("d4", null, 300),
  despesa("d5", "som", 999, { status: "rejeitado" }),
  despesa("d6", "som", 50, { tipo: "foto" }),
];

const PAGAMENTOS = [
  { id: "p1", despesa_id: "d1", valor: 600, lancamento_id: "l1" },
  { id: "p2", despesa_id: "d2", valor: 600, lancamento_id: null },
  { id: "p3", despesa_id: "d3", valor: 2000, lancamento_id: "l3" },
];

const VERIFICACOES = [
  verificacao("v1", { entidade_tipo: "despesa", entidade_id: "d2", severidade: "alerta" }),
  verificacao("v2", { entidade_tipo: "pagamento", entidade_id: "p2", check_codigo: "PAGAMENTO_SEM_LANCAMENTO" }),
  verificacao("v3", { entidade_tipo: "prestacao", check_codigo: "ITEM_SEM_SALDO", severidade: "bloqueio", chave: "ITEM_SEM_SALDO:prestacao:-:som" }),
  verificacao("v4", { entidade_tipo: "despesa", entidade_id: "d3", severidade: "info" }),
  verificacao("v5", { entidade_tipo: "despesa", entidade_id: "d3", status: "justificada" }),
  verificacao("v6", { entidade_tipo: "lancamento", entidade_id: "l9", check_codigo: "DEBITO_SEM_COMPROVANTE", severidade: "bloqueio", dados: { valor: 800, ligado: 300 } }),
];

test("fila: uma linha por item na ordem da árvore, com despesas, o que falta conciliar, pendências e saldo", () => {
  const { linhas } = filaDePendencias({ nos: NOS, despesas: DESPESAS, pagamentos: PAGAMENTOS, verificacoes: VERIFICACOES });
  assert.deepEqual(linhas.map(l => l.id), ["som", "luz", "cache", null], "itens em ordem e a linha sem item no fim");

  const som = linhas[0];
  assert.deepEqual(som.caminho, ["Produção"]);
  assert.deepEqual(som.despesas, { quantidade: 2, valor: 1200 }, "recusada e documento complementar ficam de fora");
  assert.deepEqual(som.aConciliar, { quantidade: 1, valor: 600 }, "d2 tem pagamento sem lançamento");
  assert.deepEqual(som.pendencias, { bloqueios: 1, outras: 2 }, "a do pagamento conta na despesa; a do saldo, no item");
  assert.equal(som.saldo, -200);
  assert.equal(som.temPendencia, true);
  assert.deepEqual(som.despesasDoItem.map(d => d.id), ["d2", "d1"], "a despesa com pendência primeiro");

  const luz = linhas[1];
  assert.deepEqual([luz.aConciliar.quantidade, luz.pendencias.bloqueios + luz.pendencias.outras, luz.saldo], [0, 0, 0], "aviso e justificada não contam");
  assert.equal(luz.temPendencia, false);
  assert.equal(linhas[2].temPendencia, false, "item sem despesa não é pendência");

  const semItem = linhas[3];
  assert.equal(semItem.nome, "Despesas sem item do orçamento");
  assert.deepEqual([semItem.vigente, semItem.saldo, semItem.aConciliar.valor], [null, null, 300]);
});

test("resumo e filtro só com pendência", () => {
  const { linhas, resumo } = filaDePendencias({ nos: NOS, despesas: DESPESAS, pagamentos: PAGAMENTOS, verificacoes: VERIFICACOES });
  assert.deepEqual(resumo, {
    itensComPendencia: 1,
    aConciliar: { quantidade: 2, valor: 900 },
    bloqueios: 2,
    debitosSemDespesa: { quantidade: 1, valor: 500 },
    semItem: { quantidade: 1, valor: 300 },
  });
  assert.deepEqual(soComPendencia(linhas).map(l => l.id), ["som", null]);

  const vazia = filaDePendencias({ nos: [], despesas: [], pagamentos: [], verificacoes: [] });
  assert.deepEqual([vazia.linhas.length, vazia.resumo.itensComPendencia], [0, 0]);
});
