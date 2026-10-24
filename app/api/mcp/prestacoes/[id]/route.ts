import { leituraDoResumo, prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { montarResumoDaPrestacao } from "@/lib/mcp/prestacao/resumo";
import { resposta, rotaMcp } from "@/lib/mcp/rota";

/**
 * O resumo de uma prestação: status, regime, marcos e prazos, quanto foi comprovado, as verificações abertas e a
 * prontidão para enviar com o que falta. É a mesma conta da visão geral do app (as mesmas funções de lib/prestacao).
 */
export const GET = rotaMcp({ escrita: false, modulo: "prestacao" }, async ({ admin, orgId, id, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  return resposta(montarResumoDaPrestacao(await leituraDoResumo(admin, prestacao, origem)));
});
