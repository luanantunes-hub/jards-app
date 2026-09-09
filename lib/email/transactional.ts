import "server-only";

type SendTransactionalEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

export type TransactionalEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string; notConfigured?: boolean };

function recipients(value: string | string[]) {
  return (Array.isArray(value) ? value : [value])
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Remetente transacional do produto. E-mails de autenticação continuam sendo
 * emitidos pelo Supabase Auth, usando o mesmo provedor via SMTP.
 */
export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<TransactionalEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.TRANSACTIONAL_EMAIL_FROM;
  const to = recipients(input.to);

  if (!apiKey || !from) {
    return {
      ok: false,
      notConfigured: true,
      error: "Servidor de e-mail transacional não configurado",
    };
  }
  if (!to.length) return { ok: false, error: "Destinatário ausente" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey
          ? { "Idempotency-Key": input.idempotencyKey.slice(0, 256) }
          : {}),
      },
      body: JSON.stringify({
        from,
        to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(process.env.TRANSACTIONAL_EMAIL_REPLY_TO
          ? { reply_to: process.env.TRANSACTIONAL_EMAIL_REPLY_TO }
          : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const body = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };
    if (!response.ok || !body.id) {
      return {
        ok: false,
        error: body.message ?? body.name ?? `Falha no envio (${response.status})`,
      };
    }
    return { ok: true, id: body.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Falha inesperada no envio",
    };
  }
}
