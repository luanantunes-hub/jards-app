import "server-only";
import type { TransactionalEmailResult } from "@/lib/email/transactional";

// O e-mail de DIVULGAÇÃO dos organizadores (o envio do Público da Ticketeria). Sai por um remetente próprio (`TICKETERIA_NOVIDADES_EMAIL_FROM`, de preferência num subdomínio), separado
// do remetente transacional dos ingressos e do login: se uma divulgação cair em spam, os e-mails que a pessoa precisa receber não pagam por isso. Cada e-mail leva o cabeçalho
// List-Unsubscribe (clique único, RFC 8058) que aponta para a rota de sair da lista. Sem a variável, o envio fica desligado: nada sai.

/** O envio de divulgação está ligado: a chave do Resend e o remetente próprio existem. */
export function divulgacaoConfigurada(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.TICKETERIA_NOVIDADES_EMAIL_FROM);
}

export type EmailDeDivulgacao = {
  to: string; subject: string; html: string; text: string;
  /** O endereço que recebe o POST de clique único de sair da lista (a rota, com o token). */
  enderecoDoCliqueUnico: string;
  idempotencyKey: string; replyTo?: string;
};

export async function enviarEmailDeDivulgacao(e: EmailDeDivulgacao): Promise<TransactionalEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TICKETERIA_NOVIDADES_EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, notConfigured: true, error: "Envio de divulgação não configurado" };
  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": e.idempotencyKey.slice(0, 256) },
      body: JSON.stringify({
        from, to: [e.to.trim().toLowerCase()], subject: e.subject, html: e.html, text: e.text,
        headers: { "List-Unsubscribe": `<${e.enderecoDoCliqueUnico}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        ...(e.replyTo ? { reply_to: e.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const corpo = (await resposta.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!resposta.ok || !corpo.id) return { ok: false, error: corpo.message ?? corpo.name ?? `Falha no envio (${resposta.status})` };
    return { ok: true, id: corpo.id };
  } catch (erro) {
    return { ok: false, error: erro instanceof Error ? erro.message : "Falha inesperada no envio" };
  }
}
