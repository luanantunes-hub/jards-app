import { comDiasPuros } from "@/lib/mcp/consultas";
import { garantirDaOrganizacao, linkDoApp, nomesPorId, type Linha } from "@/lib/mcp/crm";
import { carregarFunil } from "@/lib/mcp/funil";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { erroDoBanco } from "@/lib/mcp/validacao";

const COLUNAS =
  "id,status,potencial_fechamento,prioridade,valor_solicitado,valor_aprovado,data_previsao,proxima_prospeccao,empresa_crm_id,projeto_id,contato_empresa_id,captador_id,captador_externo_id,supervisor_id,origem_oportunidade,canal_planejado,notas,created_at,updated_at";

/** Ficha da negociação: ela, a empresa, o projeto, o contato, a proposta e o que aconteceu até agora. */
export const GET = rotaMcp({ escrita: false }, async ({ admin, orgId, id, origem }) => {
  const negociacao = await garantirDaOrganizacao(admin, orgId, "captacoes", "id", id, COLUNAS);
  if (!negociacao) return resposta({ error: "Informe o id da negociação." }, 400);

  const daNegociacao = (tabela: string, colunas: string) => admin.from(tabela).select(colunas).eq("organization_id", orgId).eq("captacao_id", id);
  const [propostas, interacoes, followups, atividades, notas, historico, funil, contato] = await Promise.all([
    daNegociacao("propostas", "id,titulo,status,valor_proposto,cota_id,created_at").order("created_at", { ascending: false }).limit(5),
    daNegociacao("crm_interacoes", "id,tipo,canal,direcao,assunto,resumo,resultado,proximo_passo,ocorreu_em").order("ocorreu_em", { ascending: false }).limit(10),
    daNegociacao("crm_followups", "id,titulo,motivo,canal,previsto_para,status,workflow,responsavel_id").eq("status", "pendente").order("previsto_para", { ascending: true }).limit(10),
    daNegociacao("atividades", "id,nome,tipo,prioridade,data_prevista,responsavel_id").eq("feita", false).order("data_prevista", { ascending: true, nullsFirst: false }).limit(10),
    daNegociacao("notas", "id,titulo,conteudo,created_at").order("created_at", { ascending: false }).limit(10),
    admin.from("historico_captações").select("campo,valor_anterior,valor_novo,created_at").eq("organization_id", orgId).eq("captacao_id", id).order("created_at", { ascending: false }).limit(15),
    carregarFunil(admin, orgId),
    negociacao.contato_empresa_id
      ? admin.from("contatos").select("id,nome,cargo,email,telefone").eq("organization_id", orgId).eq("id", negociacao.contato_empresa_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  for (const resultado of [propostas, interacoes, followups, atividades, notas, historico, contato]) {
    if (resultado.error) throw erroDoBanco(resultado.error);
  }

  const [empresas, projetos] = await Promise.all([
    nomesPorId(admin, orgId, "empresas_crm", [negociacao.empresa_crm_id]),
    nomesPorId(admin, orgId, "projetos_crm", [negociacao.projeto_id]),
  ]);
  return resposta({
    negociacao: {
      ...(negociacao as Linha),
      etapa: funil.negociacao.find((etapa) => etapa.chave === negociacao.status)?.nome ?? negociacao.status,
      empresa_nome: negociacao.empresa_crm_id ? empresas.get(negociacao.empresa_crm_id) ?? null : null,
      projeto_nome: negociacao.projeto_id ? projetos.get(negociacao.projeto_id) ?? null : null,
    },
    url: linkDoApp(origem, "negociacao", id as string),
    contato: contato.data,
    propostas: propostas.data,
    followups_pendentes: followups.data,
    atividades_pendentes: ((atividades.data ?? []) as unknown as Linha[]).map(comDiasPuros),
    ultimas_interacoes: interacoes.data,
    notas_recentes: notas.data,
    historico_de_mudancas: historico.data,
  });
});
