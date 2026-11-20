import { nomesPorId, type Admin, type Linha } from "@/lib/mcp/crm";
import { erroDoBanco } from "@/lib/mcp/validacao";

const COLUNAS_CONTATO =
  "id,nome,cargo,email,telefone,telefone_2,linkedin_url,origem,papel_decisao,canal_preferido,sentimento,score,ativo_na_empresa,ultima_interacao,empresa_crm_id,proponente_id,captador_id,responsavel_interno_id,updated_at";

/**
 * O app guarda o dia da atividade como instante à meia-noite UTC e lê só a parte do dia (data.split("T")[0]).
 * O conector devolve o mesmo dia puro, para o assistente não ler "21h do dia anterior" em Brasília.
 */
export function comDiasPuros<T extends Linha>(linha: T): T {
  const saida: Linha = { ...linha };
  for (const campo of ["data_inicio", "data_prevista"]) {
    if (typeof saida[campo] === "string") saida[campo] = (saida[campo] as string).slice(0, 10);
  }
  return saida as T;
}

export interface FiltroDeContatos {
  busca: string | null;
  empresa_crm_id: string | null;
  proponente_id: string | null;
  captador_id: string | null;
  limite: number;
  deslocamento: number;
}

/** Contatos do CRM da organização (os que a equipe cadastrou). Ler os próprios contatos não gasta crédito. */
export async function consultarContatos(admin: Admin, orgId: string, filtro: FiltroDeContatos): Promise<Linha[]> {
  let consulta = admin
    .from("contatos")
    .select(COLUNAS_CONTATO)
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(filtro.deslocamento, filtro.deslocamento + filtro.limite - 1);
  if (filtro.empresa_crm_id) consulta = consulta.eq("empresa_crm_id", filtro.empresa_crm_id);
  if (filtro.proponente_id) consulta = consulta.eq("proponente_id", filtro.proponente_id);
  if (filtro.captador_id) consulta = consulta.eq("captador_id", filtro.captador_id);
  if (filtro.busca) {
    const padrao = `%${filtro.busca}%`;
    consulta = consulta.or(`nome.ilike.${padrao},email.ilike.${padrao},cargo.ilike.${padrao}`);
  }
  const { data, error } = await consulta;
  if (error) throw erroDoBanco(error);
  const linhas = (data ?? []) as Linha[];
  const empresas = await nomesPorId(admin, orgId, "empresas_crm", linhas.map((linha) => linha.empresa_crm_id));
  return linhas.map((linha) => ({ ...linha, empresa_nome: linha.empresa_crm_id ? empresas.get(linha.empresa_crm_id) ?? null : null }));
}
