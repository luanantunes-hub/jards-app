import type { McpAuthContext } from "@/lib/mcp/auth";
import type { Admin } from "@/lib/mcp/crm";
import { ErroMcp, erroDoBanco } from "@/lib/mcp/validacao";

/**
 * Tudo que o assistente grava na prestação passa por aqui. O conector escreve com a chave de serviço, que ignora o RLS
 * e as travas que só valem para quem está logado; então, em vez de confiar só na casca da rota, cada gravação:
 *  1. pergunta ao banco se a pessoa que autorizou o assistente edita esta prestação (fn_mcp_prestacao_pode, a mesma
 *     regra do app, testada contra auth_prestacao_pode);
 *  2. para mudar um registro que já existe, confere a trava do envio (fn_prestacao_trava_do_registro);
 *  3. deixa registro do que fez (assistente_acoes), com o que havia antes, para a equipe ver e desfazer;
 *  4. avisa a equipe (fn_prestacao_avisar_assistente).
 */

export interface QuemGrava {
  usuarioId: string;
  chaveId: string | null;
  plataforma: "claude" | "chatgpt" | "outro";
}

export const quemGrava = (ctx: McpAuthContext): QuemGrava => ({ usuarioId: ctx.userId, chaveId: ctx.chaveId ?? null, plataforma: ctx.plataforma ?? "outro" });

/** Confirma com o banco que a pessoa edita a prestação. Falha fechada: qualquer dúvida é "não". */
export async function exigirEdicao(admin: Admin, usuarioId: string, prestacaoId: string): Promise<void> {
  const { data, error } = await admin.rpc("fn_mcp_prestacao_pode" as never, { p_usuario: usuarioId, p_prestacao: prestacaoId, p_acao: "editar" } as never);
  if (error) throw erroDoBanco(error);
  if (data !== true) throw new ErroMcp(403, "Sua conta não pode editar esta prestação (só admin e colaborador, com o módulo em vigor).");
}

/** O registro já foi enviado ao órgão (ou está na guarda legal)? Aí não muda. Devolve null quando está livre. */
export async function travaDoRegistro(admin: Admin, tabela: string, id: string): Promise<"vigente" | "guarda" | null> {
  const { data, error } = await admin.rpc("fn_prestacao_trava_do_registro" as never, { p_tabela: tabela, p_registro: id } as never);
  if (error) throw erroDoBanco(error);
  return data === "vigente" || data === "guarda" ? data : null;
}

export async function exigirRegistroLivre(admin: Admin, tabela: string, id: string): Promise<void> {
  const trava = await travaDoRegistro(admin, tabela, id);
  if (trava) throw new ErroMcp(409, "Este registro já foi enviado ao órgão e não pode mais mudar. Peça a reabertura do envio no app.");
}

export const ACOES_DO_ASSISTENTE = ["criar", "atualizar", "retirar", "verificar"] as const;

export interface AcaoDoAssistente {
  prestacaoId: string;
  ferramenta: string;
  acao: (typeof ACOES_DO_ASSISTENTE)[number];
  tabela?: string;
  registroId?: string;
  resumo: string;
  antes?: unknown;
  depois?: unknown;
}

/** Guarda o que o assistente fez. Se não conseguir guardar, a gravação não vale: quem chama desfaz. */
export async function registrarAcao(admin: Admin, quem: QuemGrava, acao: AcaoDoAssistente): Promise<string> {
  const { data, error } = await admin
    .from("assistente_acoes" as never)
    .insert({
      prestacao_id: acao.prestacaoId,
      usuario_id: quem.usuarioId,
      chave_id: quem.chaveId,
      plataforma: quem.plataforma,
      ferramenta: acao.ferramenta,
      acao: acao.acao,
      tabela: acao.tabela ?? null,
      registro_id: acao.registroId ?? null,
      resumo: acao.resumo.slice(0, 500),
      antes: acao.antes ?? null,
      depois: acao.depois ?? null,
    } as never)
    .select("id")
    .single();
  if (error || !data) throw erroDoBanco(error);
  return (data as { id: string }).id;
}

/** Aviso à equipe; falha de aviso nunca desfaz a gravação. `chave` junta os avisos repetidos de uma mesma ação. */
export async function avisarEquipe(admin: Admin, prestacaoId: string, titulo: string, mensagem: string, chave: string): Promise<void> {
  try {
    await admin.rpc("fn_prestacao_avisar_assistente" as never, { p_prestacao_id: prestacaoId, p_titulo: titulo, p_mensagem: mensagem, p_chave: chave } as never);
  } catch {
    // o aviso é cortesia; a ação já está registrada em assistente_acoes
  }
}
