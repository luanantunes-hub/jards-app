import { consultarContatos } from "@/lib/mcp/consultas";
import { garantirDaOrganizacao } from "@/lib/mcp/crm";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { paginacao, termoDeBusca } from "@/lib/mcp/validacao";

/**
 * Contatos que a equipe cadastrou nessa empresa do CRM. É leitura simples, sem gastar crédito: o crédito do Jards
 * é só para abrir os contatos da base pública de patrocinadores no app, não para ver os da própria carteira.
 */
export const GET = rotaMcp({ escrita: false }, async ({ admin, orgId, id, query }) => {
  await garantirDaOrganizacao(admin, orgId, "empresas_crm", "id", id);
  const { limite, deslocamento } = paginacao(query);
  const contatos = await consultarContatos(admin, orgId, {
    busca: termoDeBusca(query.get("busca")),
    empresa_crm_id: id,
    proponente_id: null,
    captador_id: null,
    limite,
    deslocamento,
  });
  return resposta({ contatos });
});
