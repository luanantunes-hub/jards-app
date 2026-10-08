import { garantirMembro } from "@/lib/mcp/crm";
import { hojeEmSaoPaulo } from "@/lib/mcp/datas";
import { WORKFLOWS_FOLLOWUP } from "@/lib/mcp/enums";
import { carregarOpcoesComerciais, exigirOpcao } from "@/lib/mcp/funil";
import { lerContextoDoRelacionamento, tipoDaInteracao } from "@/lib/mcp/relacionamento";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { dataDe, diaSeguinte, erroDoBanco, ErroMcp, opcao, paraInstante, texto, uuidDe } from "@/lib/mcp/validacao";

/** Lembrete de retomar o contato numa data: fica na ficha da empresa e na negociação, e avisa o responsável. */
export const POST = rotaMcp({ escrita: true }, async ({ admin, ctx, orgId, corpo }) => {
  const titulo = texto(corpo, "titulo", { obrigatorio: true, max: 200 }) as string;
  const contexto = await lerContextoDoRelacionamento(admin, orgId, corpo);
  // O banco só aceita follow-up pendente ligado a uma empresa, a uma negociação ou a um proponente.
  if (!contexto.empresa_crm_id && !contexto.captacao_id && !contexto.proponente_id) {
    throw new ErroMcp(400, "Informe a que o follow-up se refere: empresa_crm_id, captacao_id ou proponente_id.");
  }

  const opcoes = await carregarOpcoesComerciais(admin, orgId);
  const canal = exigirOpcao(texto(corpo, "canal", { max: 60 }), opcoes.canal, "canal") ?? "email";
  const previsto = dataDe(corpo, "previsto_para") ?? diaSeguinte(hojeEmSaoPaulo());
  const responsavelId = (await garantirMembro(admin, orgId, "responsavel_id", uuidDe(corpo, "responsavel_id"))) ?? ctx.userId;

  const campos: Record<string, unknown> = {
    organization_id: orgId,
    account_id: ctx.userId,
    created_by: ctx.userId,
    ...contexto,
    titulo,
    motivo: texto(corpo, "motivo", { max: 2000 }),
    canal: tipoDaInteracao(canal),
    previsto_para: paraInstante(previsto),
    workflow: opcao(corpo, "workflow", WORKFLOWS_FOLLOWUP),
    responsavel_id: responsavelId,
  };
  for (const chave of Object.keys(campos)) if (campos[chave] === null) delete campos[chave];

  const { data, error } = await admin
    .from("crm_followups")
    .insert(campos)
    .select("id,titulo,motivo,canal,previsto_para,status,workflow,responsavel_id,empresa_crm_id,contato_id,captacao_id,proponente_id")
    .single();
  if (error) throw erroDoBanco(error);
  return resposta({ followup: data }, 201);
});
