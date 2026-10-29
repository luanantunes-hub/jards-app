import { retirarRegistro } from "@/lib/mcp/prestacao/desfazer";
import { exigirEdicao, quemGrava } from "@/lib/mcp/prestacao/gravacao";
import { prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { uuidDe } from "@/lib/mcp/validacao";

/**
 * Retira uma despesa ou evidência que o assistente criou (pelo acao_id de listar_acoes_do_assistente), enquanto a equipe ainda
 * não avaliou, não enviou ao órgão e nada está ligado a ela. É o único jeito de o assistente apagar algo, e só do que ele mesmo criou.
 */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ admin, orgId, id, ctx, corpo }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  const quem = quemGrava(ctx);
  await exigirEdicao(admin, quem.usuarioId, prestacao.id);
  const acaoId = uuidDe(corpo, "acao_id", true) as string;
  const { retirado, resumo } = await retirarRegistro({ admin, prestacaoId: prestacao.id, quem, acaoId });
  return resposta({ retirado, resumo });
});
