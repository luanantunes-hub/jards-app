import { COLUNAS_DA_FILA } from "@/lib/mcp/prestacao/pendencias";
import { lerTodas, orcamentoAtivo, prestacaoDaOrganizacao, regimeDaPrestacao } from "@/lib/mcp/prestacao/leitura";
import { montarOrcamento } from "@/lib/mcp/prestacao/orcamento";
import { linkDaPrestacao } from "@/lib/mcp/prestacao/resumo";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { paginacao, paramBooleano } from "@/lib/mcp/validacao";
import type { ComprovanteDoOrcamento, PagamentoDoOrcamento } from "@/lib/prestacao/orcamento";

/** O orçamento em uso da prestação, item a item, com o que foi aprovado, remanejado, comprometido e pago (a aba Orçamento do app). */
export const GET = rotaMcp({ escrita: false, modulo: "prestacao" }, async ({ admin, orgId, id, query, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const { limite, deslocamento } = paginacao(query);
  const somenteAgrupadores = paramBooleano(query, "somente_agrupadores");

  const [{ versao, nos }, regime, comprovantes, pagamentos] = await Promise.all([
    orcamentoAtivo(admin, prestacao.id),
    regimeDaPrestacao(admin, prestacao.regime_id),
    lerTodas<ComprovanteDoOrcamento>(() => admin.from("prestacao_comprovantes").select("id,no_id,status,valor_extraido,valor_liquido").eq("prestacao_id", prestacao.id).order("id") as never),
    lerTodas<PagamentoDoOrcamento>(() => admin.from("prestacao_pagamentos").select(COLUNAS_DA_FILA.pagamentos).eq("prestacao_id", prestacao.id).order("id") as never),
  ]);

  return resposta({
    prestacao: { id: prestacao.id, titulo: prestacao.titulo, status: prestacao.status, url: linkDaPrestacao(origem, prestacao.id, "orcamento") },
    versao: versao ? { nome: versao.nome, tipo: versao.tipo, ato: versao.ato, data_do_ato: versao.data_ato } : null,
    ...(versao ? {} : { aviso: "Esta prestação ainda não tem orçamento em uso. Cadastre ou importe o orçamento aprovado na aba Orçamento do app." }),
    ...montarOrcamento({ nos, comprovantes, pagamentos, regime: regime?.parametros ?? null, somenteAgrupadores, limite, deslocamento }),
    pagina: { limite, deslocamento },
  });
});
