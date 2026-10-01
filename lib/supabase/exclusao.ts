import type { SupabaseClient } from "@supabase/supabase-js";

type PostgrestLikeError = { code?: string | null; message?: string | null } | null | undefined;

const SEM_PERMISSAO = "Não foi possível excluir. Verifique suas permissões e atualize a página.";

/**
 * Traduz a falha de uma exclusão para uma mensagem que a pessoa consegue agir.
 * `vinculado` substitui a mensagem padrão de violação de chave estrangeira.
 */
export function mensagemDeExclusao(error: PostgrestLikeError, vinculado?: string): string {
  if (!error) return SEM_PERMISSAO;
  if (error.code === "23503") return vinculado ?? "Este registro ainda tem itens vinculados e não pode ser excluído.";
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
