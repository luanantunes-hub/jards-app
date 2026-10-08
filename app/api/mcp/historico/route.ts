import { garantirDaOrganizacao } from "@/lib/mcp/crm";
import { resposta, rotaMcp } from "@/lib/mcp/rota";
import { erroDoBanco, ErroMcp, paginacao, paramUuid } from "@/lib/mcp/validacao";

const ESCOPOS = {
  empresa_crm_id: "empresas_crm",
  contato_id: "contatos",
  captacao_id: "captacoes",
  proponente_id: "proponentes",
} as const;

/** O que já aconteceu com uma empresa, um contato, uma negociação ou um proponente: interações, follow-ups e notas. */
export const GET = rotaMcp({ escrita: false }, async ({ admin, orgId, query }) => {
  const campos = Object.keys(ESCOPOS) as (keyof typeof ESCOPOS)[];
  const informados = campos.map((campo) => [campo, paramUuid(query, campo)] as const).filter(([, id]) => id !== null);
  if (informados.length !== 1) throw new ErroMcp(400, `Informe exatamente um destes: ${campos.join(", ")}.`);
  const [coluna, id] = informados[0] as [keyof typeof ESCOPOS, string];
  await garantirDaOrganizacao(admin, orgId, ESCOPOS[coluna], coluna, id);

  const { limite } = paginacao(query);
  const doEscopo = (tabela: string, colunas: string) => admin.from(tabela).select(colunas).eq("organization_id", orgId).eq(coluna, id);
  const [interacoes, followups, notas] = await Promise.all([
    doEscopo("crm_interacoes", "id,tipo,canal,direcao,assunto,resumo,resultado,proximo_passo,ocorreu_em,contato_id,captacao_id,empresa_crm_id")
      .order("ocorreu_em", { ascending: false })
      .limit(limite),
    doEscopo("crm_followups", "id,titulo,motivo,canal,previsto_para,status,workflow,resultado,concluido_em,responsavel_id,contato_id,captacao_id,empresa_crm_id")
      .order("previsto_para", { ascending: false })
      .limit(limite),
    doEscopo("notas", "id,titulo,conteudo,created_at,contato_id,captacao_id,empresa_crm_id")
      .order("created_at", { ascending: false })
      .limit(limite),
  ]);
  for (const resultado of [interacoes, followups, notas]) if (resultado.error) throw erroDoBanco(resultado.error);
  return resposta({ interacoes: interacoes.data, followups: followups.data, notas: notas.data });
});
