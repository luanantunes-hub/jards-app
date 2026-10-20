import { acaoParaOAssistente, COLUNAS_DA_ACAO, type LinhaDaAcao } from "@/lib/mcp/prestacao/desfazer";
import { prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { erroDoBanco, paginacao } from "@/lib/mcp/validacao";

/** O que o assistente fez nesta prestação, a mais recente primeiro, com o acao_id de cada ação (para retirar uma despesa ou evidência que ele criou). */
export const GET = rotaMcp({ escrita: false, modulo: "prestacao" }, async ({ admin, orgId, id, query }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const { limite, deslocamento } = paginacao(query);
  const { data, error, count } = await admin
    .from("assistente_acoes" as never)
    .select(COLUNAS_DA_ACAO, { count: "exact" })
    .eq("prestacao_id", prestacao.id)
    .order("created_at", { ascending: false })
    .range(deslocamento, deslocamento + limite - 1);
  if (error) throw erroDoBanco(error);
  const linhas = (data ?? []) as unknown as LinhaDaAcao[];
  const total = count ?? linhas.length;
  return resposta({
    acoes: linhas.map(acaoParaOAssistente),
    total,
    proximo_deslocamento: deslocamento + limite < total ? deslocamento + limite : null,
  });
});
