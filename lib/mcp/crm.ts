import { mesmoNome } from "@/lib/dominio";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAPEL_COM_ACESSO_AO_CRM } from "@/lib/mcp/enums";
import { ErroMcp, erroDoBanco, igualSemCaixa, trechoParaBusca } from "@/lib/mcp/validacao";

export type Admin = ReturnType<typeof createAdminClient>;
// A tipagem gerada do banco não cobre todas as tabelas do CRM: as linhas chegam soltas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Linha = Record<string, any>;

type TabelaDaOrganizacao =
  | "empresas_crm"
  | "projetos_crm"
  | "contatos"
  | "captacoes"
  | "proponentes"
  | "captadores"
  | "editais_user";

/**
 * Confere que o registro é da organização antes de ligar outro registro a ele. O conector grava com a chave de
 * serviço (sem o RLS do app), então sem esta conferência um id de outra organização seria aceito.
 */
export async function garantirDaOrganizacao(
  admin: Admin,
  orgId: string,
  tabela: TabelaDaOrganizacao,
  campo: string,
  id: string | null,
  colunas = "id"
): Promise<Linha | null> {
  if (!id) return null;
  const { data, error } = await admin.from(tabela).select(colunas).eq("organization_id", orgId).eq("id", id).maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw new ErroMcp(404, `${campo} não foi encontrado na sua organização.`);
  return data as unknown as Linha;
}

/**
 * Registro da organização com o mesmo nome (sem diferenciar caixa, acento nem espaços repetidos), para o conector
 * devolver o que já existe em vez de duplicar. Tenta a igualdade antes da busca por trecho: com um nome curto e
 * comum ("Vale") a busca por trecho traz muitos nomes e o igual poderia ficar de fora.
 */
export async function acharPorNome(
  admin: Admin,
  orgId: string,
  tabela: "empresas_crm" | "projetos_crm" | "proponentes",
  colunas: string,
  nome: string
): Promise<Linha | null> {
  const exatas = await admin.from(tabela).select(colunas).eq("organization_id", orgId).ilike("nome", igualSemCaixa(nome)).limit(5);
  if (exatas.error) throw erroDoBanco(exatas.error);
  const igual = ((exatas.data ?? []) as unknown as Linha[]).find((linha) => mesmoNome(linha.nome as string, nome));
  if (igual) return igual;

  const parecidas = await admin.from(tabela).select(colunas).eq("organization_id", orgId).ilike("nome", `%${trechoParaBusca(nome)}%`).limit(100);
  if (parecidas.error) throw erroDoBanco(parecidas.error);
  return ((parecidas.data ?? []) as unknown as Linha[]).find((linha) => mesmoNome(linha.nome as string, nome)) ?? null;
}

/** Responsável, supervisor ou captador interno: tem de ser gente da equipe (admin) da organização. */
export async function garantirMembro(admin: Admin, orgId: string, campo: string, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data, error } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("papel", PAPEL_COM_ACESSO_AO_CRM)
    .maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!data) throw new ErroMcp(404, `${campo} não é de uma pessoa da sua equipe. Use listar_opcoes_do_crm para ver os ids da equipe.`);
  return userId;
}

export interface MembroDaEquipe {
  id: string;
  nome: string;
  email: string | null;
}

export async function membrosDaEquipe(admin: Admin, orgId: string): Promise<MembroDaEquipe[]> {
  const { data: membros, error } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("papel", PAPEL_COM_ACESSO_AO_CRM);
  if (error) throw erroDoBanco(error);
  const ids = (membros ?? []).map((m) => m.user_id as string);
  if (ids.length === 0) return [];
  const { data: perfis, error: erroPerfis } = await admin.from("profiles").select("id,full_name,email").in("id", ids);
  if (erroPerfis) throw erroDoBanco(erroPerfis);
  const porId = new Map((perfis ?? []).map((p) => [p.id as string, p as Linha]));
  return ids
    .map((id) => ({ id, nome: (porId.get(id)?.full_name as string | null) || (porId.get(id)?.email as string | null) || "Membro da equipe", email: (porId.get(id)?.email as string | null) ?? null }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Nomes (ou outra coluna) de uma lista de ids, só da organização: para listar "empresa_nome" ao lado do id. */
export async function nomesPorId(
  admin: Admin,
  orgId: string,
  tabela: "empresas_crm" | "projetos_crm" | "contatos" | "proponentes" | "captadores",
  ids: ReadonlyArray<string | null | undefined>,
  coluna = "nome"
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unicos.length === 0) return new Map();
  const { data, error } = await admin.from(tabela).select(`id,${coluna}`).eq("organization_id", orgId).in("id", unicos);
  if (error) throw erroDoBanco(error);
  return new Map((data ?? []).map((linha) => [(linha as unknown as Linha).id as string, (linha as unknown as Linha)[coluna] as string]));
}

const CAMINHOS_DO_APP = {
  empresa: "/empresas-crm",
  contato: "/contatos",
  negociacao: "/captacoes",
  projeto: "/projetos",
  proponente: "/proponentes",
} as const;

export type TipoDeLink = keyof typeof CAMINHOS_DO_APP;

/** Endereço da tela do registro no Jards: o assistente entrega o link para a pessoa abrir. */
export function linkDoApp(origem: string, tipo: TipoDeLink, id: string): string {
  return `${origem}${CAMINHOS_DO_APP[tipo]}/${id}`;
}
