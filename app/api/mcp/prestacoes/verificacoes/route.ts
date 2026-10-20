import { prestacaoDaOrganizacao, regimeDaPrestacao } from "@/lib/mcp/prestacao/leitura";
import { codigoConhecido, explicarVerificacao } from "@/lib/mcp/prestacao/verificacoes";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { ErroMcp, paramTexto, paramUuid } from "@/lib/mcp/validacao";

/**
 * O que uma verificação quer dizer: o código (como em listar_pendencias_da_prestacao), o que fazer, onde resolver e,
 * se vier a prestação, a regra do regime dela e a norma que a sustenta.
 */
export const GET = rotaMcp({ escrita: false, modulo: "prestacao" }, async ({ admin, orgId, query, origem }) => {
  const codigo = paramTexto(query, "codigo", 80);
  if (!codigo) throw new ErroMcp(400, "Informe o codigo da verificação (ex.: DOC_RETENCOES), como aparece em listar_pendencias_da_prestacao.");
  if (!codigoConhecido(codigo)) throw new ErroMcp(404, `Não conheço a verificação ${codigo}. Use o codigo que aparece em listar_pendencias_da_prestacao.`);

  const prestacaoId = paramUuid(query, "prestacao_id");
  if (!prestacaoId) return resposta(explicarVerificacao(codigo, null));
  const prestacao = await prestacaoDaOrganizacao(admin, orgId, prestacaoId);
  const regime = await regimeDaPrestacao(admin, prestacao.regime_id);
  return resposta(explicarVerificacao(codigo, regime, { origem, prestacaoId: prestacao.id }));
});
