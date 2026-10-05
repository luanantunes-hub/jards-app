import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Notas livres de uma negociação ou de uma inscrição em edital.
 * A tabela não tem `user_id`: a autoria fica em `account_id`, que o RLS exige
 * igual ao usuário logado — cada pessoa vê e edita as próprias notas.
 */
export type NotaRegistro = {
  id: string;
  titulo: string | null;
  conteudo: string;
  created_at: string;
};

export type EscopoNota = { coluna: "captacao_id" | "edital_user_id"; id: string };

export const CAMPOS_NOTA = "id, titulo, conteudo, created_at";

// A tipagem manual do Supabase ainda não expõe a tabela notas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = SupabaseClient<any>;

export async function buscarNotas(supabase: Cliente, escopo: EscopoNota): Promise<NotaRegistro[]> {
  const { data, error } = await supabase
    .from("notas")
    .select(CAMPOS_NOTA)
    .eq(escopo.coluna, escopo.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar as notas.");
  return (data as NotaRegistro[] | null) ?? [];
}

export type DadosNota = { titulo: string; conteudo: string };

/** Título opcional; conteúdo obrigatório (a coluna é NOT NULL). */
export function normalizarNota(dados: DadosNota): { titulo: string | null; conteudo: string } | null {
  const conteudo = dados.conteudo.trim();
  if (!conteudo) return null;
  return { titulo: dados.titulo.trim() || null, conteudo };
}

export async function criarNota(
  supabase: Cliente,
  escopo: EscopoNota,
  organizationId: string | null,
  dados: DadosNota,
): Promise<void> {
  const nota = normalizarNota(dados);
  if (!nota) throw new Error("Escreva a nota antes de salvar.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sua sessão expirou. Entre de novo para salvar.");
  const { error } = await supabase.from("notas").insert({
    ...nota,
    account_id: user.id,
    organization_id: organizationId,
    [escopo.coluna]: escopo.id,
  });
  if (error) throw new Error("Não foi possível salvar a nota. Tente novamente.");
}

export async function atualizarNota(supabase: Cliente, notaId: string, dados: DadosNota): Promise<void> {
  const nota = normalizarNota(dados);
  if (!nota) throw new Error("Escreva a nota antes de salvar.");
  const { data, error } = await supabase.from("notas").update(nota).eq("id", notaId).select("id").maybeSingle();
  if (error || !data) throw new Error("Não foi possível salvar a nota. Tente novamente.");
}

/** Trecho da nota para o histórico, onde cabe uma linha. */
export function resumoNota(conteudo: string, limite = 120): string {
  const texto = conteudo.replace(/\s+/g, " ").trim();
  return texto.length > limite ? `${texto.slice(0, limite - 1).trimEnd()}…` : texto;
}
