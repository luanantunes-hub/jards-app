import { comDiasPuros } from "@/lib/mcp/consultas";
import { garantirDaOrganizacao, linkDoApp, nomesPorId, type Linha } from "@/lib/mcp/crm";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { erroDoBanco } from "@/lib/mcp/validacao";

const COLUNAS_EMPRESA =
  "id,nome,setor,site,domain_key,tipo,status,cidade,estado,localizacao,cidades_interesse,ja_patrocina_cultura,patrocina_cultura_com,ja_patrocina_esporte,patrocina_esporte_com,leis_que_usa,janela_decisao,potencial_relacionamento,potencial_justificativa,responsavel_interno_id,empresa_pub_id,created_at,updated_at";

/** Ficha da empresa: ela mesma e o que está ligado a ela (contatos, negociações, o que falta fazer, o que já aconteceu). */
export const GET = rotaMcp({ escrita: false }, async ({ admin, orgId, id, origem }) => {
  const empresa = await garantirDaOrganizacao(admin, orgId, "empresas_crm", "id", id, COLUNAS_EMPRESA);
  if (!empresa) return resposta({ error: "Informe o id da empresa." }, 400);

  const daEmpresa = (tabela: string, colunas: string) => admin.from(tabela).select(colunas).eq("organization_id", orgId).eq("empresa_crm_id", id);
  const [contatos, negociacoes, atividades, interacoes, followups, notas] = await Promise.all([
    daEmpresa("contatos", "id,nome,cargo,email,telefone,papel_decisao,sentimento,ultima_interacao").order("nome").limit(50),
    daEmpresa("captacoes", "id,status,potencial_fechamento,prioridade,valor_solicitado,valor_aprovado,data_previsao,projeto_id,updated_at").order("updated_at", { ascending: false }).limit(30),
    daEmpresa("atividades", "id,nome,tipo,prioridade,data_prevista,responsavel_id").eq("feita", false).order("data_prevista", { ascending: true, nullsFirst: false }).limit(20),
    daEmpresa("crm_interacoes", "id,tipo,canal,direcao,assunto,resumo,resultado,ocorreu_em,contato_id").order("ocorreu_em", { ascending: false }).limit(10),
    daEmpresa("crm_followups", "id,titulo,motivo,canal,previsto_para,status,workflow,contato_id,responsavel_id").eq("status", "pendente").order("previsto_para", { ascending: true }).limit(10),
    daEmpresa("notas", "id,titulo,conteudo,created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  for (const resultado of [contatos, negociacoes, atividades, interacoes, followups, notas]) {
    if (resultado.error) throw erroDoBanco(resultado.error);
  }

  const projetos = await nomesPorId(admin, orgId, "projetos_crm", ((negociacoes.data ?? []) as unknown as Linha[]).map((linha) => linha.projeto_id));
  return resposta({
    empresa,
    url: linkDoApp(origem, "empresa", id as string),
    contatos: contatos.data,
    negociacoes: ((negociacoes.data ?? []) as unknown as Linha[]).map((linha) => ({ ...linha, projeto_nome: linha.projeto_id ? projetos.get(linha.projeto_id) ?? null : null })),
    atividades_pendentes: ((atividades.data ?? []) as unknown as Linha[]).map(comDiasPuros),
    followups_pendentes: followups.data,
    ultimas_interacoes: interacoes.data,
    notas_recentes: notas.data,
  });
});
