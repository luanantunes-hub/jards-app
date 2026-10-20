import { isRateLimited } from "@/lib/mcp/rateLimit";
import { exigirEdicao, quemGrava } from "@/lib/mcp/prestacao/gravacao";
import { prestacaoDaOrganizacao } from "@/lib/mcp/prestacao/leitura";
import { linkDaPrestacao } from "@/lib/mcp/prestacao/resumo";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { ErroMcp } from "@/lib/mcp/validacao";
import { verificarPrestacao } from "@/lib/prestacao/verificar-servidor";

/** Quantas verificações por minuto cada prestação aceita pelo conector: o motor lê dezenas de tabelas. */
const VERIFICACOES_POR_MINUTO = 3;

/**
 * Roda o motor de checagens da prestação e atualiza as verificações, como o botão de verificar do app (é o mesmo
 * código, em lib/prestacao/verificar-servidor.ts). O assistente não informa dado nenhum: só pede a conferência.
 */
export const POST = rotaMcp({ escrita: true, modulo: "prestacao" }, async ({ admin, orgId, id, ctx, origem }) => {
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, id);
  await exigirEdicao(admin, quemGrava(ctx).usuarioId, prestacao.id);
  if (isRateLimited(`mcp-verificar:${prestacao.id}`, VERIFICACOES_POR_MINUTO)) {
    throw new ErroMcp(429, "Esta prestação foi verificada agora há pouco. Aguarde um minuto e peça de novo.");
  }

  const resumo = await verificarPrestacao(admin as never, prestacao.id);
  return resposta({
    prestacao: { id: prestacao.id, titulo: prestacao.titulo, url: linkDaPrestacao(origem, prestacao.id) },
    verificada_em: resumo.verificada_em,
    resultado: {
      bloqueios_abertos: resumo.bloqueios,
      outras_abertas: Math.max(0, resumo.abertas - resumo.bloqueios),
      avisos: resumo.avisos,
      justificadas: resumo.justificadas,
      dispensadas: resumo.dispensadas,
      resolvidas: resumo.resolvidas,
      achados_encontrados: resumo.achados,
    },
    impede_o_envio: resumo.bloqueios > 0,
    proximo_passo: "Use listar_pendencias_da_prestacao para ver o que falta e onde resolver.",
  });
});
