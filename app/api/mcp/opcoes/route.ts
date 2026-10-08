import { membrosDaEquipe } from "@/lib/mcp/crm";
import {
  CANAIS_PREFERIDOS,
  FASES_PROJETO,
  ORIGENS_CONTATO,
  PAPEIS_DECISAO,
  POTENCIAIS_FECHAMENTO,
  PRIORIDADES,
  STATUS_COMERCIAL_PROJETO,
  TIPOS_ATIVIDADE,
  TIPOS_EMPRESA,
  TIPOS_PROPONENTE,
  WORKFLOWS_FOLLOWUP,
} from "@/lib/mcp/enums";
import { carregarFunil, carregarOpcoesComerciais } from "@/lib/mcp/funil";
import { resposta, rotaMcp } from "@/lib/mcp/rota";

/**
 * O que vale em cada campo do CRM desta organização: etapas do funil (que cada organização personaliza),
 * origens, canais e resultados, valores fixos e a equipe (ids para responsável). O assistente consulta antes de
 * criar negociações, atividades, interações e follow-ups.
 */
export const GET = rotaMcp({ escrita: false }, async ({ admin, orgId }) => {
  const [funil, comerciais, equipe] = await Promise.all([carregarFunil(admin, orgId), carregarOpcoesComerciais(admin, orgId), membrosDaEquipe(admin, orgId)]);
  return resposta({
    etapas_da_negociacao: funil.negociacao,
    etapas_da_inscricao: funil.inscricao,
    origens_da_oportunidade: comerciais.origem,
    canais: comerciais.canal,
    resultados_do_contato: comerciais.resultado,
    equipe,
    valores_fixos: {
      tipo_de_empresa: TIPOS_EMPRESA,
      potencial_de_fechamento: POTENCIAIS_FECHAMENTO,
      prioridade: PRIORIDADES,
      tipo_de_atividade: TIPOS_ATIVIDADE,
      papel_do_contato_na_decisao: PAPEIS_DECISAO,
      canal_preferido_do_contato: CANAIS_PREFERIDOS,
      origem_do_contato: ORIGENS_CONTATO,
      fase_do_projeto: FASES_PROJETO,
      status_comercial_do_projeto: STATUS_COMERCIAL_PROJETO,
      tipo_de_proponente: TIPOS_PROPONENTE,
      roteiro_do_followup: WORKFLOWS_FOLLOWUP,
    },
  });
});
