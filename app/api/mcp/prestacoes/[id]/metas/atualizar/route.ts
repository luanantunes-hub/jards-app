import { exigirEdicao, quemGrava } from "@/lib/mcp/prestacao/gravacao";
import { prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { atualizarMeta } from "@/lib/mcp/prestacao/objeto-gravacao";
import { linkDaPrestacao } from "@/lib/mcp/prestacao/resumo";
import { resposta, rotaMcp } from "@/lib/mcp/rota";

/**
 * Lança o resultado de uma meta do objeto (pelo meta_id de obter_objeto_da_prestacao): quanto foi realizado e, se ficou
 * abaixo do previsto, a justificativa. O previsto e a descrição vêm do projeto aprovado e só mudam no app.
 */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ admin, orgId, id, ctx, corpo, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const quem = quemGrava(ctx);
  await exigirEdicao(admin, quem.usuarioId, prestacao.id);
  const resultado = await atualizarMeta({ admin, prestacaoId: prestacao.id, quem, corpo });
  return resposta({ prestacao: { id: prestacao.id, titulo: prestacao.titulo, url: linkDaPrestacao(origem, prestacao.id, "objeto") }, ...resultado });
});
