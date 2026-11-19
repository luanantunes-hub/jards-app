import {
  GMAIL_SCOPES,
  googleEmailClientId,
  googleEmailClientSecret,
  googleEmailConfigured,
  googleEmailRedirectUri,
} from "./config";
import { generateNonce, generatePkce, saveEmailOAuthSession } from "./oauth";
import { consultasDeContatos, filtroDesde } from "./historico";
import { emLotes } from "./lotes";
import { enderecosDoCabecalho, type BuscaDeEmails, type MensagemDeEmail } from "./mensagem";

export function googleEmailAuthUrl(challenge: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: googleEmailClientId(),
    redirect_uri: googleEmailRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function startGoogleEmailOAuth(
  userId: string,
  organizationId: string | null,
): Promise<string> {
  if (!googleEmailConfigured()) throw new Error("Google Email não configurado");
  const { verifier, challenge } = generatePkce();
  const nonce = generateNonce();
  await saveEmailOAuthSession({ nonce, verifier, userId, organizationId });
  return googleEmailAuthUrl(challenge, nonce);
}

export async function exchangeGoogleEmailCode(
  code: string,
  verifier: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string | null;
  scopes: string[];
}> {
  const body = new URLSearchParams({
    code,
    client_id: googleEmailClientId(),
    client_secret: googleEmailClientSecret(),
    redirect_uri: googleEmailRedirectUri(),
    grant_type: "authorization_code",
    code_verifier: verifier,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || "Falha ao trocar código Google",
    );
  }
  if (!json.refresh_token) {
    throw new Error(
      "Google não devolveu refresh token. Revogue o acesso em myaccount.google.com/permissions e tente novamente.",
    );
  }

  let email: string | null = null;
  const me = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  if (me.ok) {
    const profile = (await me.json()) as { email?: string };
    email = profile.email ?? null;
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    email,
    scopes: (json.scope ?? "").split(" ").filter(Boolean),
  };
}

export async function refreshGoogleEmailToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
  refreshToken?: string;
}> {
  const body = new URLSearchParams({
    client_id: googleEmailClientId(),
    client_secret: googleEmailClientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || "Falha ao renovar token Gmail",
    );
  }
  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    refreshToken: json.refresh_token,
  };
}

export type GmailMessage = MensagemDeEmail;

function parseEmailAddress(raw: string | null): {
  name: string | null;
  email: string | null;
} {
  if (!raw) return { name: null, email: null };
  const m = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim() };
  return { name: null, email: raw.trim() };
}

function getHeader(
  headers: Array<{ name: string; value: string }>,
  name: string,
): string | null {
  return (
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    null
  );
}

function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBodyText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as {
    mimeType?: string;
    body?: { data?: string };
    parts?: unknown[];
  };
  if (p.mimeType === "text/plain" && p.body?.data) {
    return decodeBase64Url(p.body.data);
  }
  if (p.parts) {
    for (const part of p.parts) {
      const text = extractBodyText(part);
      if (text) return text;
    }
  }
  return null;
}

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

type PaginaDeIds = {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  error?: { message?: string };
};

/** Ids que o Gmail acha para a consulta, da mais nova para a mais antiga, até o limite. */
async function listarIds(accessToken: string, consulta: string, limite: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < limite) {
    const params = new URLSearchParams({ q: consulta, maxResults: String(Math.min(100, limite - ids.length)) });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${GMAIL_API}/messages?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await res.json()) as PaginaDeIds;
    if (!res.ok) throw new Error(json.error?.message || "Falha ao listar mensagens Gmail");
    for (const mensagem of json.messages ?? []) ids.push(mensagem.id);
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

async function lerMensagem(accessToken: string, id: string, userEmail: string, soCabecalho = false): Promise<GmailMessage | null> {
  // Na triagem de desconhecidos só o cabeçalho e o trecho: o corpo da mensagem não é lido.
  const formato = soCabecalho
    ? "format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=Message-ID"
    : "format=full";
  const res = await fetch(`${GMAIL_API}/messages/${id}?${formato}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const msg = (await res.json()) as {
    id: string;
    threadId: string;
    snippet?: string;
    payload?: {
      headers?: Array<{ name: string; value: string }>;
      mimeType?: string;
      body?: { data?: string };
      parts?: unknown[];
    };
  };

  const headers = msg.payload?.headers ?? [];
  const dateRaw = getHeader(headers, "Date");
  const { name: fromName, email: fromEmail } = parseEmailAddress(getHeader(headers, "From"));
  const bodyText = extractBodyText(msg.payload);
  const sentAt = dateRaw ? new Date(dateRaw) : null;

  return {
    id: msg.id,
    threadId: msg.threadId,
    internetMessageId: getHeader(headers, "Message-ID"),
    from: fromEmail,
    fromName,
    to: enderecosDoCabecalho(getHeader(headers, "To")),
    cc: enderecosDoCabecalho(getHeader(headers, "Cc")),
    subject: getHeader(headers, "Subject"),
    snippet: msg.snippet ?? null,
    bodyText: bodyText ? bodyText.slice(0, 2000) : null,
    sentAt: sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : null,
    direction: fromEmail?.toLowerCase() === userEmail.toLowerCase() ? "outbound" : "inbound",
  };
}

export type BuscaGmail = BuscaDeEmails;

/**
 * Mensagens trocadas com os endereços dados (De, Para ou Cc) no período, da mais nova para a mais antiga.
 * O Jards não varre a caixa: o Gmail só devolve o que casa com um contato, e só essas mensagens são lidas.
 */
export async function buscarMensagensDeContatos(
  accessToken: string,
  userEmail: string,
  enderecos: readonly string[],
  periodo: string,
  opcoes: { limite?: number; maximoDeConsultas?: number } = {},
): Promise<BuscaGmail> {
  const limite = opcoes.limite ?? 250;
  const todas = consultasDeContatos(enderecos, periodo);
  const consultas = todas.slice(0, opcoes.maximoDeConsultas ?? 40);
  let truncada = todas.length > consultas.length;

  const ids = new Set<string>();
  for (const consulta of consultas) {
    if (ids.size >= limite) {
      truncada = true;
      break;
    }
    for (const id of await listarIds(accessToken, consulta, limite - ids.size + 1)) ids.add(id);
  }
  if (ids.size > limite) truncada = true;

  const lidas = await emLotes([...ids].slice(0, limite), 8, (id) => lerMensagem(accessToken, id, userEmail));
  const mensagens = lidas
    .filter((mensagem): mensagem is GmailMessage => mensagem !== null)
    .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0));
  return { mensagens, encontradas: ids.size, truncada };
}

/**
 * Mensagens recentes de qualquer pessoa (caixa de entrada e enviados), para a triagem de quem ainda não é contato.
 * Fora ficam as abas Promoções, Social, Atualizações e Fóruns do Gmail. Lê só o cabeçalho e o trecho, nunca o corpo.
 * O filtro de quem entra na triagem é de quem chama.
 */
export async function buscarMensagensRecentesGmail(
  accessToken: string,
  userEmail: string,
  desde: Date,
  limite = 150,
): Promise<GmailMessage[]> {
  const consulta = `(in:inbox OR in:sent) -category:promotions -category:social -category:updates -category:forums ${filtroDesde(desde)}`;
  const ids = await listarIds(accessToken, consulta, limite);
  const lidas = await emLotes(ids, 8, (id) => lerMensagem(accessToken, id, userEmail, true));
  return lidas
    .filter((mensagem): mensagem is GmailMessage => mensagem !== null)
    .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0));
}
