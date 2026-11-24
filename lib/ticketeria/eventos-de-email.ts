// Os avisos do Resend sobre os e-mails de divulgação: o que cada evento quer dizer para o envio. Sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-eventos-de-email.test.ts).
// O aviso chega assinado (Svix) em /api/ticketeria/resend-eventos; só valem os cinco eventos abaixo, e o que não é deles volta "ignorado" (200) para o Resend não tentar de novo.

export type TipoDoEvento = "entregue" | "aberto" | "clicou" | "devolvido" | "reclamou";
export type EventoDoEmail = { tipo: TipoDoEvento; provedorId: string; quando: string | null; permanente: boolean };

const TIPOS: Record<string, TipoDoEvento> = {
  "email.delivered": "entregue", "email.opened": "aberto", "email.clicked": "clicou", "email.bounced": "devolvido", "email.complained": "reclamou",
};

/** O evento do Resend lido: o tipo, o id do e-mail (o `provedor_id` de quem recebeu), a hora e, na devolução, se é permanente. null se não é um dos cinco eventos ou não traz o id. */
export function lerEventoDoEmail(corpo: unknown): EventoDoEmail | null {
  if (!corpo || typeof corpo !== "object") return null;
  const e = corpo as { type?: unknown; created_at?: unknown; data?: { email_id?: unknown; created_at?: unknown; bounce?: { type?: unknown } } };
  const tipo = typeof e.type === "string" ? TIPOS[e.type] : undefined;
  const id = typeof e.data?.email_id === "string" ? e.data.email_id.trim() : "";
  if (!tipo || id === "" || id.length > 100) return null;
  const hora = [e.created_at, e.data?.created_at].find(h => typeof h === "string" && !Number.isNaN(Date.parse(h))) as string | undefined;
  const permanente = tipo === "devolvido" && typeof e.data?.bounce?.type === "string" && e.data.bounce.type.trim().toLowerCase() === "permanent";
  return { tipo, provedorId: id, quando: hora ? new Date(hora).toISOString() : null, permanente };
}

/** Porcentagem de `parte` sobre `total` (arredondada), ou null se não há total: a tela mostra "—". */
export function porcentagem(parte: number, total: number): number | null {
  return total > 0 ? Math.round((parte / total) * 100) : null;
}
