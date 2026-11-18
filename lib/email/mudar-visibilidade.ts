import { interacaoDoEmail, type EmailParaInteracao } from "./interacoes";
import { emPartes } from "./lotes";
import type { Visibilidade } from "./visibilidade";

const COLUNAS = "id, organization_id, thread_id, contato_id, empresa_crm_id, captacao_id, direction, subject, snippet, body_text, sent_at";

/** O que a regra precisa do banco: o cliente do Supabase com permissão de servidor (ou um falso, nos testes). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BancoDeEmails = { from: (tabela: string) => any };

type LinhaDoEmail = EmailParaInteracao & { organization_id: string; thread_id: string | null };

export type ResultadoDaVisibilidade =
  | { status: 200; corpo: { atualizados: number; visibilidade: Visibilidade } }
  | { status: 403 | 404; corpo: { error: string } };

/**
 * "Só eu vejo": decide se uma conversa de e-mail fica só com a pessoa ou aparece para a equipe.
 * A escolha vale para a conversa inteira (todas as mensagens da caixa dela no mesmo fio, mesmo as que a tela não
 * carregou) e só mexe em e-mails da própria caixa. Como a interação do CRM aparece para a organização inteira,
 * ela sai ao esconder a conversa e volta ao mostrá-la de novo.
 */
export async function mudarVisibilidadeDaConversa(
  banco: BancoDeEmails,
  usuarioId: string,
  emailIds: readonly string[],
  visibilidade: Visibilidade,
): Promise<ResultadoDaVisibilidade> {
  // O filtro por dono é a regra de segurança: ninguém muda a visibilidade da caixa de outra pessoa.
  const pedidas: LinhaDoEmail[] = [];
  for (const parte of emPartes(emailIds, 50)) {
    const { data, error } = await banco.from("emails").select(COLUNAS).eq("user_id", usuarioId).in("id", parte);
    if (error) throw new Error(error.message);
    pedidas.push(...((data ?? []) as LinhaDoEmail[]));
  }
  if (pedidas.length === 0) return { status: 404, corpo: { error: "Conversa não encontrada" } };

  // A conversa inteira: as outras mensagens da pessoa nos mesmos fios.
  const porId = new Map<string, LinhaDoEmail>(pedidas.map((linha) => [linha.id, linha]));
  const fios = [...new Set(pedidas.map((linha) => linha.thread_id).filter((fio): fio is string => Boolean(fio)))];
  for (const parte of emPartes(fios, 30)) {
    const { data, error } = await banco.from("emails").select(COLUNAS).eq("user_id", usuarioId).in("thread_id", parte);
    if (error) throw new Error(error.message);
    for (const linha of (data ?? []) as LinhaDoEmail[]) porId.set(linha.id, linha);
  }
  let linhas = [...porId.values()];

  // Mostrar à equipe só vale nas organizações de que a pessoa ainda faz parte.
  if (visibilidade === "organization") {
    const organizacoes = [...new Set(linhas.map((linha) => linha.organization_id))];
    const { data: vinculos, error } = await banco
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", usuarioId)
      .in("organization_id", organizacoes);
    if (error) throw new Error(error.message);
    const permitidas = new Set<string>(((vinculos ?? []) as Array<{ organization_id: string }>).map((vinculo) => vinculo.organization_id));
    linhas = linhas.filter((linha) => permitidas.has(linha.organization_id));
    if (linhas.length === 0) return { status: 403, corpo: { error: "Você não faz mais parte desta organização" } };
  }

  const ids = linhas.map((linha) => linha.id);
  for (const parte of emPartes(ids, 50)) {
    const { error } = await banco.from("emails").update({ visibility: visibilidade }).eq("user_id", usuarioId).in("id", parte);
    if (error) throw new Error(error.message);
  }

  if (visibilidade === "private") {
    for (const parte of emPartes(ids, 50)) {
      const { error } = await banco.from("crm_interacoes").delete().in("email_id", parte);
      if (error) throw new Error(error.message);
    }
  } else {
    for (const parte of emPartes(linhas, 50)) {
      const interacoes = parte.map((linha) => interacaoDoEmail(linha, linha.organization_id, usuarioId));
      const { error } = await banco.from("crm_interacoes").upsert(interacoes, { onConflict: "email_id" });
      if (error) throw new Error(error.message);
    }
  }

  return { status: 200, corpo: { atualizados: ids.length, visibilidade } };
}
