import type { SupabaseClient } from "@supabase/supabase-js";

type PostgrestLikeError = { code?: string | null; message?: string | null; details?: string | null } | null | undefined;

const SEM_PERMISSAO = "Não foi possível excluir. Verifique suas permissões e atualize a página.";

/** Tabelas que costumam impedir exclusões, no vocabulário da interface. */
const LIGACOES: Record<string, string> = {
  atividades: "atividades",
  notas: "notas",
  propostas: "propostas",
  contratos: "contratos",
  cotas_patrocinio: "cotas de patrocínio",
  captacoes: "negociações",
  editais_user: "inscrições",
  projetos_crm: "projetos",
  contatos: "contatos",
  contas_patrocinio: "clientes",
  compromissos_cliente: "entregas de cliente",
  atribuicoes: "atribuições",
};

/** Nome da tabela que impediu a exclusão, lido do detalhe do erro do Postgres. */
export function tabelaQueImpede(error: PostgrestLikeError): string | null {
  const texto = `${error?.details ?? ""} ${error?.message ?? ""}`;
  return /table "(?:public\.)?([a-z_]+)"/.exec(texto)?.[1] ?? null;
}

/**
 * Traduz a falha de uma exclusão para uma mensagem que a pessoa consegue agir.
 * 23503 (NO ACTION) e 23001 (RESTRICT) são vínculos; quando o Postgres informa
 * a tabela, a mensagem diz qual é. `vinculado` vale quando a tabela é outra.
 */
export function mensagemDeExclusao(error: PostgrestLikeError, vinculado?: string): string {
  if (!error) return SEM_PERMISSAO;
  if (error.code === "23503" || error.code === "23001") {
    const tabela = tabelaQueImpede(error);
    if (tabela === "vendas_patrocinio") return "Há uma venda registrada ligada a este registro. Ele faz parte do histórico do cliente e não pode ser excluído.";
    if (tabela && LIGACOES[tabela]) return `Este registro ainda está ligado a ${LIGACOES[tabela]}. Remova ou altere esses vínculos antes de excluí-lo.`;
    return vinculado ?? "Este registro ainda tem itens vinculados e não pode ser excluído.";
  }
  if (error.code === "42501") return SEM_PERMISSAO;
  return error.message?.trim() || "Não foi possível excluir agora. Tente novamente.";
}

/**
 * Exclui uma linha e confirma que ela de fato saiu do banco. Sem o `select`,
 * uma política de RLS que bloqueia a exclusão devolve sucesso silencioso e a
 * interface removeria um item que continua existindo.
 * Lança `Error` com mensagem pronta para o diálogo de confirmação.
 */
export async function excluirPorId(
  supabase: SupabaseClient<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  tabela: string,
  id: string,
  opcoes: { vinculado?: string } = {},
): Promise<void> {
  const { data, error } = await supabase.from(tabela).delete().eq("id", id).select("id").maybeSingle();
  if (error || !data) throw new Error(mensagemDeExclusao(error, opcoes.vinculado));
}

/**
 * Exclui o registro do documento antes do arquivo: se o banco recusar, o
 * arquivo continua acessível; um arquivo órfão no storage é preferível a um
 * documento listado que não abre mais.
 */
export async function excluirDocumento(
  supabase: SupabaseClient<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  documento: { id: string; url: string },
): Promise<void> {
  await excluirPorId(supabase, "documentos", documento.id);
  const { error } = await supabase.storage.from("documentos").remove([documento.url]);
  if (error) console.warn("Arquivo do documento não removido do storage", documento.url, error.message);
}
