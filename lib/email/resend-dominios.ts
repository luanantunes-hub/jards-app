import "server-only";

// Os domínios de e-mail dos produtores no Resend (API de Domains): o Jards cria o domínio do produtor na conta do Jards, devolve os registros de DNS que ele precisa criar no provedor dele e
// pede a conferência. O produtor nunca entra no Resend. A chave precisa de acesso total (criar domínio): `RESEND_DOMAINS_API_KEY`, ou a `RESEND_API_KEY` se ela já for de acesso total.

import { situacaoDoDominio, registrosDoProvedor, type RegistroDeDns } from "@/lib/ticketeria/remetente";
import type { SituacaoDoRemetente } from "@/lib/ticketeria/estados";

export type DominioNoProvedor = { id: string; situacao: SituacaoDoRemetente; registros: RegistroDeDns[] };
type Falha = { ok: false; erro: string; semChave?: boolean; jaExiste?: boolean };

const chave = () => process.env.RESEND_DOMAINS_API_KEY || process.env.RESEND_API_KEY || null;

/** As contas de domínio estão ligadas: existe uma chave do Resend. */
export const dominiosConfigurados = (): boolean => Boolean(chave());

async function chamar(metodo: "GET" | "POST" | "PATCH", caminho: string, corpo?: unknown): Promise<{ ok: true; corpo: Record<string, unknown> } | Falha> {
  const apiKey = chave();
  if (!apiKey) return { ok: false, erro: "Resend não configurado", semChave: true };
  try {
    const resposta = await fetch(`https://api.resend.com${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(15_000),
    });
    const lido = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
    if (resposta.ok) return { ok: true, corpo: lido };
    const mensagem = typeof lido.message === "string" ? lido.message : `Falha no provedor (${resposta.status})`;
    return { ok: false, erro: mensagem, jaExiste: resposta.status === 403 || resposta.status === 409 || /already/i.test(mensagem) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha ao falar com o provedor" };
  }
}

const doProvedor = (c: Record<string, unknown>): DominioNoProvedor | null => typeof c.id === "string" ? { id: c.id, situacao: situacaoDoDominio(c.status), registros: registrosDoProvedor(c.records) } : null;

/** Cria o domínio no provedor (com a leitura de aberturas e cliques ligada) e devolve o id e os registros de DNS. */
export async function criarDominio(nome: string): Promise<{ ok: true; dominio: DominioNoProvedor } | Falha> {
  const r = await chamar("POST", "/domains", { name: nome });
  if (!r.ok) return r;
  const d = doProvedor(r.corpo);
  if (!d) return { ok: false, erro: "O provedor não devolveu o domínio" };
  // Abertura e clique por domínio: se o provedor recusar, o envio continua, só sem essas duas contagens.
  await chamar("PATCH", `/domains/${encodeURIComponent(d.id)}`, { open_tracking: true, click_tracking: true });
  return { ok: true, dominio: d };
}

/** Pede ao provedor que confira os registros agora e lê a situação (o provedor também confere sozinho de tempos em tempos). */
export async function conferirDominio(id: string): Promise<{ ok: true; dominio: DominioNoProvedor } | Falha> {
  await chamar("POST", `/domains/${encodeURIComponent(id)}/verify`);
  const r = await chamar("GET", `/domains/${encodeURIComponent(id)}`);
  if (!r.ok) return r;
  const d = doProvedor(r.corpo);
  return d ? { ok: true, dominio: d } : { ok: false, erro: "O provedor não devolveu o domínio" };
}
