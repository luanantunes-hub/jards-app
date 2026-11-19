import {
  MICROSOFT_EMAIL_SCOPES,
  microsoftEmailClientId,
  microsoftEmailClientSecret,
  microsoftEmailConfigured,
  microsoftEmailRedirectUri,
  microsoftEmailTenant,
} from "./config";
import { casaComContato, GRAPH, mensagemDoGraph, urlDaPasta, type MensagemGraph, type PastaDoGraph } from "./graph";
import { emLotes } from "./lotes";
import type { BuscaDeEmails, MensagemDeEmail } from "./mensagem";
import { generateNonce, generatePkce, saveEmailOAuthSession } from "./oauth";

function urlDoToken(): string {
  return `https://login.microsoftonline.com/${microsoftEmailTenant()}/oauth2/v2.0/token`;
}

export function microsoftEmailAuthUrl(challenge: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: microsoftEmailClientId(),
    response_type: "code",
    redirect_uri: microsoftEmailRedirectUri(),
    response_mode: "query",
    scope: MICROSOFT_EMAIL_SCOPES.join(" "),
    state: nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `https://login.microsoftonline.com/${microsoftEmailTenant()}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function startMicrosoftEmailOAuth(userId: string, organizationId: string | null): Promise<string> {
  if (!microsoftEmailConfigured()) throw new Error("Microsoft E-mail não configurado");
  const { verifier, challenge } = generatePkce();
  const nonce = generateNonce();
  await saveEmailOAuthSession({ nonce, verifier, userId, organizationId, provider: "microsoft" });
  return microsoftEmailAuthUrl(challenge, nonce);
}

export async function exchangeMicrosoftEmailCode(
  code: string,
  verifier: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date; email: string | null; scopes: string[] }> {
  const body = new URLSearchParams({
    client_id: microsoftEmailClientId(),
    client_secret: microsoftEmailClientSecret(),
    code,
    redirect_uri: microsoftEmailRedirectUri(),
    grant_type: "authorization_code",
    code_verifier: verifier,
    scope: MICROSOFT_EMAIL_SCOPES.join(" "),
  });
  const res = await fetch(urlDoToken(), {
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
    throw new Error(json.error_description || json.error || "Falha ao trocar código Microsoft");
  }
  if (!json.refresh_token) {
    throw new Error("A Microsoft não devolveu o acesso contínuo. Confira a permissão offline_access do app.");
  }

  let email: string | null = null;
  const eu = await fetch(`${GRAPH}/me?$select=mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  if (eu.ok) {
    const perfil = (await eu.json()) as { mail?: string | null; userPrincipalName?: string | null };
    email = perfil.mail || perfil.userPrincipalName || null;
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    email,
    scopes: (json.scope ?? "").split(" ").filter(Boolean),
  };
}

export async function refreshMicrosoftEmailToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
  refreshToken?: string;
}> {
  const body = new URLSearchParams({
    client_id: microsoftEmailClientId(),
    client_secret: microsoftEmailClientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    // Sem `scope`: a Microsoft devolve exatamente o que a pessoa já autorizou. Pedir de novo a lista inteira
    // quebraria a renovação das conexões feitas antes de um escopo novo entrar na lista.
  });
  const res = await fetch(urlDoToken(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Falha ao renovar o acesso da Microsoft");
  }
  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    refreshToken: json.refresh_token,
  };
}

type PaginaGraph = { value?: MensagemGraph[]; "@odata.nextLink"?: string; error?: { message?: string } };

/** Segue as páginas do Graph até o limite, da mensagem mais nova para a mais antiga. */
async function lerPaginas(accessToken: string, urlInicial: string, maximoDePaginas: number): Promise<{ mensagens: MensagemGraph[]; cheia: boolean }> {
  const mensagens: MensagemGraph[] = [];
  let url: string | undefined = urlInicial;
  let paginas = 0;
  while (url && paginas < maximoDePaginas) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = (await res.json()) as PaginaGraph;
    if (!res.ok) throw new Error(json.error?.message || `Falha ao listar mensagens da Microsoft (${res.status})`);
    mensagens.push(...(json.value ?? []));
    url = json["@odata.nextLink"];
    paginas += 1;
  }
  return { mensagens, cheia: Boolean(url) };
}

/** Texto do corpo, sem HTML, só das mensagens de contatos. */
async function lerCorpo(accessToken: string, id: string): Promise<string | null> {
  const res = await fetch(`${GRAPH}/me/messages/${encodeURIComponent(id)}?$select=body`, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.body-content-type="text"' },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { body?: { content?: string | null } };
  return json.body?.content?.trim() || null;
}

/**
 * Mensagens trocadas com os endereços dados desde a data, da mais nova para a mais antiga.
 * O Graph não filtra por vários endereços de uma vez com segurança, então lê só o cabeçalho das mensagens
 * recentes (caixa de entrada, enviados e arquivo), descarta na hora o que não é de contato e só então lê o
 * corpo das que ficaram. Nada que não seja de contato é guardado.
 */
export async function buscarMensagensDeContatosMicrosoft(
  accessToken: string,
  emailDaConta: string,
  enderecos: readonly string[],
  desde: Date,
  opcoes: { limite?: number; paginasPorPasta?: number } = {},
): Promise<BuscaDeEmails> {
  const limite = opcoes.limite ?? 250;
  const paginasPorPasta = opcoes.paginasPorPasta ?? 10;
  const contatos = new Set(enderecos.map((endereco) => endereco.toLowerCase()));
  const achadas: MensagemDeEmail[] = [];
  let truncada = false;

  for (const pasta of ["inbox", "sentitems", "archive"] as PastaDoGraph[]) {
    let lidas: { mensagens: MensagemGraph[]; cheia: boolean };
    try {
      lidas = await lerPaginas(accessToken, urlDaPasta(pasta, desde), paginasPorPasta);
    } catch (erro) {
      if (pasta === "archive") continue; // nem toda conta tem a pasta Arquivo
      throw erro;
    }
    if (lidas.cheia) truncada = true;
    for (const bruta of lidas.mensagens) {
      const mensagem = mensagemDoGraph(bruta, emailDaConta, pasta);
      if (mensagem && casaComContato(mensagem, contatos)) achadas.push(mensagem);
    }
  }

  achadas.sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0));
  if (achadas.length > limite) truncada = true;
  const escolhidas = achadas.slice(0, limite);
  const corpos = await emLotes(escolhidas, 8, (mensagem) => lerCorpo(accessToken, mensagem.id));
  escolhidas.forEach((mensagem, i) => {
    mensagem.bodyText = corpos[i] ? corpos[i]!.slice(0, 2000) : null;
  });
  return { mensagens: escolhidas, encontradas: achadas.length, truncada };
}

/**
 * Mensagens recentes de qualquer pessoa (caixa de entrada e enviados), para a triagem de quem ainda não é contato.
 * Lê só o cabeçalho e o trecho, uma página por pasta, e nunca o corpo. Na caixa de entrada, o que o Outlook separou
 * como "Outros" (boletins e promoções) fica de fora. O filtro de quem entra na triagem é de quem chama.
 */
export async function buscarMensagensRecentesMicrosoft(
  accessToken: string,
  emailDaConta: string,
  desde: Date,
): Promise<MensagemDeEmail[]> {
  const achadas: MensagemDeEmail[] = [];
  for (const pasta of ["inbox", "sentitems"] as PastaDoGraph[]) {
    const lidas = await lerPaginas(accessToken, urlDaPasta(pasta, desde), 1);
    for (const bruta of lidas.mensagens) {
      if (pasta === "inbox" && bruta.inferenceClassification === "other") continue;
      const mensagem = mensagemDoGraph(bruta, emailDaConta, pasta);
      if (mensagem) achadas.push(mensagem);
    }
  }
  return achadas.sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0));
}
