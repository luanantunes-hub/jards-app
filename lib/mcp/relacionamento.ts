import { garantirDaOrganizacao, type Admin } from "@/lib/mcp/crm";
import { ErroMcp, uuidDe, type Corpo } from "@/lib/mcp/validacao";

/** Tipo "antigo" da interação, que as telas do app ainda leem (mesma regra de RelationshipWorkspace). */
export function tipoDaInteracao(canal: string): string {
  if (canal === "whatsapp") return "mensagem";
  if (canal === "videoconferencia" || canal === "presencial") return "reuniao";
  return canal;
}

export function tipoDetalhadoDaInteracao(canal: string): "ligacao" | "reuniao" | "mensagem" {
  if (canal === "telefone") return "ligacao";
  if (canal === "videoconferencia" || canal === "presencial") return "reuniao";
  return "mensagem";
}

export interface ContextoDoRelacionamento {
  empresa_crm_id: string | null;
  contato_id: string | null;
  captacao_id: string | null;
  proponente_id: string | null;
}

/**
 * Lê a que a interação, o follow-up ou a nota se refere, confere que tudo é da organização e completa a empresa
 * quando só vieram a negociação ou o contato (assim o registro aparece também na ficha da empresa).
 */
export async function lerContextoDoRelacionamento(admin: Admin, orgId: string, corpo: Corpo): Promise<ContextoDoRelacionamento> {
  const empresaId = uuidDe(corpo, "empresa_crm_id");
  const contatoId = uuidDe(corpo, "contato_id");
  const captacaoId = uuidDe(corpo, "captacao_id");
  const proponenteId = uuidDe(corpo, "proponente_id");

  const empresa = await garantirDaOrganizacao(admin, orgId, "empresas_crm", "empresa_crm_id", empresaId);
  const contato = await garantirDaOrganizacao(admin, orgId, "contatos", "contato_id", contatoId, "id,empresa_crm_id");
  const captacao = await garantirDaOrganizacao(admin, orgId, "captacoes", "captacao_id", captacaoId, "id,empresa_crm_id");
  await garantirDaOrganizacao(admin, orgId, "proponentes", "proponente_id", proponenteId);

  const empresas = new Set(
    [empresa?.id, contato?.empresa_crm_id, captacao?.empresa_crm_id].filter((valor): valor is string => typeof valor === "string")
  );
  if (empresas.size > 1) {
    throw new ErroMcp(400, "Os ids informados são de empresas diferentes: confira empresa_crm_id, contato_id e captacao_id.");
  }
  return {
    empresa_crm_id: [...empresas][0] ?? null,
    contato_id: contatoId,
    captacao_id: captacaoId,
    proponente_id: proponenteId,
  };
}

export function exigirAlgumContexto(contexto: ContextoDoRelacionamento, aQueSeRefere: string, aceitos: string): void {
  if (!contexto.empresa_crm_id && !contexto.contato_id && !contexto.captacao_id && !contexto.proponente_id) {
    throw new ErroMcp(400, `Informe a que ${aQueSeRefere} se refere: ${aceitos}.`);
  }
}
