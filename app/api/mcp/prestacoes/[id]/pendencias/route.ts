import { COLUNAS_DA_FILA, montarPendencias } from "@/lib/mcp/prestacao/pendencias";
import { lerTodas, orcamentoAtivo, prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { linkDaPrestacao } from "@/lib/mcp/prestacao/resumo";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { paginacao, paramBooleano } from "@/lib/mcp/validacao";
import type { DespesaDaFila, PagamentoDaFila, VerificacaoDaFila } from "@/lib/prestacao/pendencias";

/**
 * O que falta para a prestação ficar pronta: por item do orçamento, as despesas sem pagamento conciliado, as regras
 * pendentes e o saldo; e todas as verificações abertas, com o link de onde resolver. É a aba Pendências do app.
 */
export const GET = rotaMcp({ escrita: false, modulo: "prestacao" }, async ({ admin, orgId, id, query, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const { limite, deslocamento } = paginacao(query);
  const somentePendentes = query.has("somente_com_pendencia") ? paramBooleano(query, "somente_com_pendencia") : true;

  const [{ nos }, despesas, pagamentos, verificacoes] = await Promise.all([
    orcamentoAtivo(admin, prestacao.id),
    lerTodas<DespesaDaFila>(() => admin.from("prestacao_comprovantes").select(COLUNAS_DA_FILA.despesas).eq("prestacao_id", prestacao.id).order("id") as never),
    lerTodas<PagamentoDaFila>(() => admin.from("prestacao_pagamentos").select(COLUNAS_DA_FILA.pagamentos).eq("prestacao_id", prestacao.id).order("id") as never),
    lerTodas<VerificacaoDaFila>(() => admin.from("prestacao_verificacoes").select(COLUNAS_DA_FILA.verificacoes).eq("prestacao_id", prestacao.id).eq("status", "aberta").order("id") as never),
  ]);

  return resposta({
    prestacao: { id: prestacao.id, titulo: prestacao.titulo, status: prestacao.status, url: linkDaPrestacao(origem, prestacao.id) },
    ultima_verificacao_em: prestacao.verificada_em,
    ...(prestacao.verificada_em ? {} : { aviso: "Esta prestação ainda não foi verificada: as pendências abaixo podem estar incompletas. A verificação roda na aba Pendências do app." }),
    ...montarPendencias({ prestacaoId: prestacao.id, origem, nos, despesas, pagamentos, verificacoes, somentePendentes, limite, deslocamento }),
    pagina: { limite, deslocamento },
  });
});
