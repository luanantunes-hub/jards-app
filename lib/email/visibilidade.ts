/**
 * Quem pode ver um e-mail sincronizado: a equipe (`organization`) ou só quem o sincronizou (`private`, "Só eu vejo").
 * A escolha vale para a conversa inteira.
 */
export type Visibilidade = "private" | "organization";

export type EmailExistente = { message_id: string; thread_id: string | null; visibility: string };

/**
 * Monta a função que decide a visibilidade das mensagens que chegam pela sincronização, a partir do que a pessoa
 * já tem gravado. Mensagem nova de uma conversa "Só eu vejo" nasce privada, e a que já existe não volta a ser da
 * equipe só porque foi lida de novo. Sem nada gravado, a mensagem é da equipe, como sempre foi.
 */
export function decisorDeVisibilidade(existentes: readonly EmailExistente[]) {
  const fiosPrivados = new Set<string>();
  const mensagensPrivadas = new Set<string>();
  for (const email of existentes) {
    if (email.visibility !== "private") continue;
    mensagensPrivadas.add(email.message_id);
    if (email.thread_id) fiosPrivados.add(email.thread_id);
  }
  return (mensagem: { id: string; threadId: string | null }): Visibilidade =>
    mensagensPrivadas.has(mensagem.id) || (mensagem.threadId !== null && fiosPrivados.has(mensagem.threadId))
      ? "private"
      : "organization";
}
