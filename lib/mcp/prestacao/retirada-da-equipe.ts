import type { Admin } from "@/lib/mcp/crm";
import { retirarRegistro } from "@/lib/mcp/prestacao/desfazer";
import { ErroMcp } from "@/lib/mcp/validacao";

/**
 * A equipe retira, pelo app, uma despesa ou evidência que o assistente criou. O acesso é conferido com a sessão de quem
 * pediu (o RLS só mostra a prestação a quem a acessa; auth_prestacao_pode diz se edita); a retirada em si é a mesma do
 * conector (retirarRegistro), com a chave de serviço, que confere de novo: criada pelo assistente, ainda pendente,
 * não enviada ao órgão e sem pagamento, bem ou glosa ligados.
 */
export interface SessaoDaEquipe {
  userId: string;
  /** A prestação aparece para a pessoa? */
  enxerga(prestacaoId: string): Promise<boolean>;
  /** auth_prestacao_pode(prestação, 'editar') na sessão da pessoa. */
  podeEditar(prestacaoId: string): Promise<boolean>;
}

export async function retirarPelaEquipe(entrada: { sessao: SessaoDaEquipe; admin: Admin; prestacaoId: string; acaoId: string }) {
  const { sessao, admin, prestacaoId, acaoId } = entrada;
  if (!(await sessao.enxerga(prestacaoId))) throw new ErroMcp(404, "Prestação não encontrada.");
  if (!(await sessao.podeEditar(prestacaoId))) throw new ErroMcp(403, "Só quem edita a prestação pode retirar o que o assistente registrou.");
  try {
    return await retirarRegistro({ admin, prestacaoId, quem: { usuarioId: sessao.userId, chaveId: null, plataforma: "outro" }, acaoId, ferramenta: "retirada_pela_equipe" });
  } catch (erro) {
    // O texto de retirarRegistro fala com o assistente (cita ferramentas); a equipe lê outra frase.
    if (erro instanceof ErroMcp && erro.status === 404) throw new ErroMcp(404, "Esta ação não existe mais.");
    throw erro;
  }
}
