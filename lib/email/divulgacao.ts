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

const esperar = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Posta no Resend e tenta de novo (até duas vezes) quando ele pede calma (429) ou falha do lado dele (5xx), esperando o que o `retry-after` disser (no máximo 3 s). */
async function postar(caminho: string, corpo: unknown, chave: string, tempoMs: number): Promise<{ ok: true; corpo: unknown } | { ok: false; erro: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, erro: "Envio de divulgação não configurado" };
  let erro = "Falha inesperada no envio";
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const resposta = await fetch(`https://api.resend.com${caminho}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": chave.slice(0, 256) },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(tempoMs),
      });
      const lido = (await resposta.json().catch(() => ({}))) as { message?: string; name?: string };
      if (resposta.ok) return { ok: true, corpo: lido };
      erro = lido.message ?? lido.name ?? `Falha no envio (${resposta.status})`;
      if (resposta.status !== 429 && resposta.status < 500) return { ok: false, erro };
      await esperar(Math.min(3000, Math.max(500, Number(resposta.headers.get("retry-after") ?? 1) * 1000)));
    } catch (e) {
      erro = e instanceof Error ? e.message : erro;
      await esperar(500);
    }
  }
  return { ok: false, erro };
}

const itemDoEmail = (e: EmailDeDivulgacao, from: string) => ({
  from, to: [e.to.trim().toLowerCase()], subject: e.subject, html: e.html, text: e.text,
  headers: { "List-Unsubscribe": `<${e.enderecoDoCliqueUnico}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  ...(e.replyTo ? { reply_to: e.replyTo } : {}),
});

export async function enviarEmailDeDivulgacao(e: EmailDeDivulgacao): Promise<TransactionalEmailResult> {
  const from = process.env.TICKETERIA_NOVIDADES_EMAIL_FROM;
  if (!process.env.RESEND_API_KEY || !from) return { ok: false, notConfigured: true, error: "Envio de divulgação não configurado" };
  const r = await postar("/emails", itemDoEmail(e, from), e.idempotencyKey, 10_000);
  if (!r.ok) return { ok: false, error: r.erro };
  const id = (r.corpo as { id?: string }).id;
  return id ? { ok: true, id } : { ok: false, error: "O Resend não devolveu o id do e-mail" };
}

/** Até 100 e-mails numa chamada só (POST /emails/batch). `ids` voltam na mesma ordem. Se o lote inteiro falha, `ok: false`: quem chama manda um por um para achar o endereço que quebrou. */
export async function enviarLoteDeDivulgacao(emails: EmailDeDivulgacao[], idempotencyKey: string): Promise<{ ok: true; ids: string[] } | { ok: false; erro: string }> {
  const from = process.env.TICKETERIA_NOVIDADES_EMAIL_FROM;
  if (!process.env.RESEND_API_KEY || !from) return { ok: false, erro: "Envio de divulgação não configurado" };
  if (emails.length === 0 || emails.length > 100) return { ok: false, erro: "O lote tem de ter de 1 a 100 e-mails" };
  const r = await postar("/emails/batch", emails.map(e => itemDoEmail(e, from)), idempotencyKey, 30_000);
  if (!r.ok) return { ok: false, erro: r.erro };
  const dados = (r.corpo as { data?: { id?: string }[] }).data;
  if (!Array.isArray(dados) || dados.length !== emails.length || dados.some(d => typeof d?.id !== "string")) return { ok: false, erro: "O Resend devolveu uma resposta que não confere com o lote" };
  return { ok: true, ids: dados.map(d => d.id as string) };
}
