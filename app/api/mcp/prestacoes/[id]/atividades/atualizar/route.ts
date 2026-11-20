import { exigirEdicao, quemGrava } from "@/lib/mcp/prestacao/gravacao";
import { prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { atualizarAtividade } from "@/lib/mcp/prestacao/objeto-gravacao";
import { linkDaPrestacao } from "@/lib/mcp/prestacao/resumo";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { uuidDe } from "@/lib/mcp/validacao";

/**
 * Muda só os campos informados de uma atividade (pelo atividade_id de obter_objeto_da_prestacao): o resto fica como está.
 * Campo informado vazio é limpo. O que havia antes fica guardado em "Ações do assistente".
 */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ admin, orgId, id, ctx, corpo, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const quem = quemGrava(ctx);
  await exigirEdicao(admin, quem.usuarioId, prestacao.id);
  const atividadeId = uuidDe(corpo, "atividade_id", true) as string;
  const resultado = await atualizarAtividade({ admin, prestacaoId: prestacao.id, quem, atividadeId, corpo });
  return resposta({ prestacao: { id: prestacao.id, titulo: prestacao.titulo, url: linkDaPrestacao(origem, prestacao.id, "atividades") }, ...resultado });
});
