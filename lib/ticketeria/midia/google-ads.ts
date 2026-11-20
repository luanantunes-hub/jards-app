// O Google Ads como fonte de gasto: o login do produtor (OAuth com o escopo de leitura do Google Ads), o token de renovação, a lista de contas e o gasto diário. SÓ LEITURA: o Jards
// nunca cria nem muda anúncio. Sem banco e sem imports de servidor: o `fetch` entra por parâmetro e roda nos testes (tests/ticketeria-google-ads.test.ts).
//
// O que se guarda no Vault é o token de RENOVAÇÃO (não vence sozinho; só deixa de valer se o produtor retirar o acesso, ou em 7 dias se o app do Google ainda estiver "em teste");
// a cada leitura troca-se esse token por um de acesso de 1 hora.
//
// A CONFERIR com uma resposta real do Google antes de ir ao ar (as páginas oficiais lidas em 20/11/2026 não cobrem): o endereço de listar as contas acessíveis
// (`customers:listAccessibleCustomers`), os campos da consulta (`segments.date`, `metrics.cost_micros`, `customer.currency_code`) e que `cost_micros` é milionésimo da moeda
// (1 real = 1.000.000). O token de desenvolvedor foi descontinuado em 09/09/2026 (o cabeçalho é opcional e ignorado), por isso não é enviado. Versão da API: GOOGLE_ADS_API_VERSION.

import { ErroDeMidia } from "@/lib/ticketeria/midia/erro";
import type { BuscarHttp, ContaDeAnuncios, DiaDeMidia, RespostaHttp } from "@/lib/ticketeria/midia/meta";

export const ESCOPO_DO_GOOGLE_ADS = "https://www.googleapis.com/auth/adwords";
export const VERSAO_PADRAO_DO_GOOGLE_ADS = "v26";
const MAX_CONTAS_ACESSIVEIS = 30;
const MAX_CONTAS_POR_GERENTE = 50;

export type ConfigDoGoogle = { clientId: string; clientSecret: string; versao: string; redirectUri: string };

/** As credenciais do cliente OAuth do Google (variáveis do servidor). Sem elas o conector fica "Em breve". `origem` é o endereço do Jards. */
export function configDoGoogle(env: Record<string, string | undefined>, origem: string): ConfigDoGoogle | null {
  const clientId = env.GOOGLE_MARKETING_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_MARKETING_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const versao = /^v\d{1,2}$/.test(env.GOOGLE_ADS_API_VERSION?.trim() ?? "") ? (env.GOOGLE_ADS_API_VERSION as string).trim() : VERSAO_PADRAO_DO_GOOGLE_ADS;
  return { clientId, clientSecret, versao, redirectUri: `${origem.replace(/\/$/, "")}/api/ticketeria/conexoes/google/retorno` };
}

/** O endereço do login do Google. `access_type=offline` e `prompt=consent` fazem o Google devolver o token de renovação; `state` volta intacto no retorno. */
export function urlDeLoginDoGoogle(c: ConfigDoGoogle, state: string, escopo: string = ESCOPO_DO_GOOGLE_ADS): string {
  const p = new URLSearchParams({ client_id: c.clientId, redirect_uri: c.redirectUri, response_type: "code", scope: escopo, access_type: "offline", prompt: "consent", include_granted_scopes: "false", state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

type ErroDoGoogle = { error?: unknown; error_description?: unknown };

/** Por que o Google recusou: token (retirado, vencido, sem permissão), limite de chamadas ou outro. Aceita o corpo do OAuth e o da API do Google Ads (inclusive em lista). */
export function classificarErroDoGoogle(corpo: unknown, status: number): ErroDeMidia {
  const bruto = Array.isArray(corpo) ? corpo[0] : corpo;
  const o = (bruto && typeof bruto === "object" ? bruto : {}) as ErroDoGoogle;
  const oauth = typeof o.error === "string" ? o.error : null;
  const api = (o.error && typeof o.error === "object" ? o.error : null) as { code?: unknown; status?: unknown } | null;
  const situacao = typeof api?.status === "string" ? api.status : null;
  const codigo = typeof api?.code === "number" ? api.code : null;
  if (oauth === "invalid_grant" || oauth === "invalid_token" || oauth === "unauthorized_client" || situacao === "UNAUTHENTICATED" || situacao === "PERMISSION_DENIED" || status === 401 || status === 403) return new ErroDeMidia("token", codigo ?? status, null);
  if (situacao === "RESOURCE_EXHAUSTED" || status === 429) return new ErroDeMidia("limite", codigo ?? status, null);
  return new ErroDeMidia("outro", codigo ?? status, null);
}

export async function pedirAoGoogle(buscar: BuscarHttp, url: string, pedido?: Parameters<BuscarHttp>[1]): Promise<unknown> {
  let r: RespostaHttp;
  try { r = await buscar(url, pedido); } catch { throw new ErroDeMidia("outro", null, null); }
  let corpo: unknown = null;
  try { corpo = await r.json(); } catch { /* corpo ilegível */ }
  if (!r.ok) throw classificarErroDoGoogle(corpo, r.status);
  return corpo;
}

const FORMULARIO = { "content-type": "application/x-www-form-urlencoded" };

/** O código do login vira o token de renovação (que fica no Vault). Sem ele (o Google só o devolve na primeira autorização com `prompt=consent`), a conexão não vale. */
export async function trocarCodigoDoGoogle(c: ConfigDoGoogle, codigo: string, buscar: BuscarHttp): Promise<{ token: string; expira_em: null }> {
  const corpo = (await pedirAoGoogle(buscar, "https://oauth2.googleapis.com/token", { method: "POST", headers: FORMULARIO, body: new URLSearchParams({ code: codigo, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: c.redirectUri, grant_type: "authorization_code" }).toString() })) as { refresh_token?: unknown };
  if (typeof corpo.refresh_token !== "string" || corpo.refresh_token.length < 20) throw new ErroDeMidia("outro", null, null);
  return { token: corpo.refresh_token, expira_em: null };
}

/** O token de acesso (1 hora) a partir do de renovação. */
export async function renovarAcessoDoGoogle(c: ConfigDoGoogle, renovacao: string, buscar: BuscarHttp): Promise<string> {
  const corpo = (await pedirAoGoogle(buscar, "https://oauth2.googleapis.com/token", { method: "POST", headers: FORMULARIO, body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: renovacao, grant_type: "refresh_token" }).toString() })) as { access_token?: unknown };
  if (typeof corpo.access_token !== "string" || corpo.access_token.length < 20) throw new ErroDeMidia("outro", null, null);
  return corpo.access_token;
}

const url = (c: ConfigDoGoogle, caminho: string) => `https://googleads.googleapis.com/${c.versao}/${caminho}`;
const cabecalhos = (acesso: string, gerente: string | null): Record<string, string> => ({ authorization: `Bearer ${acesso}`, "content-type": "application/json", ...(gerente ? { "login-customer-id": gerente } : {}) });
const SO_NUMEROS = /^\d{3,20}$/;

/** As linhas de uma consulta (`searchStream` devolve uma lista de blocos, cada um com `results`). */
async function consultar(c: ConfigDoGoogle, buscar: BuscarHttp, acesso: string, conta: string, gerente: string | null, gaql: string): Promise<Record<string, unknown>[]> {
  const corpo = await pedirAoGoogle(buscar, url(c, `customers/${conta}/googleAds:searchStream`), { method: "POST", headers: cabecalhos(acesso, gerente), body: JSON.stringify({ query: gaql }) });
  const blocos = Array.isArray(corpo) ? corpo : [corpo];
  const linhas: Record<string, unknown>[] = [];
  for (const b of blocos) {
    const r = (b && typeof b === "object" ? (b as { results?: unknown }).results : null);
    if (Array.isArray(r)) for (const l of r) if (l && typeof l === "object") linhas.push(l as Record<string, unknown>);
  }
  return linhas;
}

const texto = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const dentro = (o: unknown, chave: string): Record<string, unknown> => ((o && typeof o === "object" ? (o as Record<string, unknown>)[chave] : null) ?? {}) as Record<string, unknown>;

/**
 * As contas de anúncios que o produtor pode ler: as contas diretas e, se ele tem conta GERENTE (MCC), as contas dela (ficam com `gerente`, o número que vai no cabeçalho
 * `login-customer-id`). A própria conta gerente não aparece (não tem gasto). `ativa` é a conta com situação ENABLED.
 */
export async function listarContasDoGoogleAds(c: ConfigDoGoogle, renovacao: string, buscar: BuscarHttp): Promise<ContaDeAnuncios[]> {
  const acesso = await renovarAcessoDoGoogle(c, renovacao, buscar);
  const lista = (await pedirAoGoogle(buscar, url(c, "customers:listAccessibleCustomers"), { method: "GET", headers: cabecalhos(acesso, null) })) as { resourceNames?: unknown };
  const ids = (Array.isArray(lista.resourceNames) ? lista.resourceNames : []).map(n => texto(n).replace(/^customers\//, "")).filter(i => SO_NUMEROS.test(i)).slice(0, MAX_CONTAS_ACESSIVEIS);
  const contas = new Map<string, ContaDeAnuncios>();
  for (const id of ids) {
    let linhas: Record<string, unknown>[];
    try { linhas = await consultar(c, buscar, acesso, id, null, "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager, customer.status FROM customer LIMIT 1"); } catch (erro) {
      if (erro instanceof ErroDeMidia && erro.tipo !== "outro") throw erro;
      continue; // conta que não se consulta direto (cancelada, sem acesso): fica de fora
    }
    const cliente = dentro(linhas[0], "customer");
    const nome = texto(cliente.descriptiveName).trim().slice(0, 120) || `Conta ${id}`;
    if (cliente.manager === true) {
      let filhas: Record<string, unknown>[] = [];
      try { filhas = await consultar(c, buscar, acesso, id, id, "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.level = 1"); } catch (erro) {
        if (erro instanceof ErroDeMidia && erro.tipo !== "outro") throw erro;
      }
      for (const f of filhas.slice(0, MAX_CONTAS_POR_GERENTE)) {
        const k = dentro(f, "customerClient");
        const filho = texto(k.id);
        if (!SO_NUMEROS.test(filho) || k.manager === true || contas.has(filho)) continue;
        contas.set(filho, { id: filho, nome: texto(k.descriptiveName).trim().slice(0, 120) || `Conta ${filho}`, moeda: texto(k.currencyCode).toUpperCase(), ativa: k.status === "ENABLED", gerente: id });
      }
      continue;
    }
    if (!contas.has(id)) contas.set(id, { id, nome, moeda: texto(cliente.currencyCode).toUpperCase(), ativa: cliente.status === "ENABLED", gerente: null });
  }
  return [...contas.values()];
}

/** `cost_micros` (milionésimos da moeda, texto inteiro) em centavos. Valor torto vira 0. */
export function microsEmCentavos(micros: unknown): number {
  const n = typeof micros === "number" ? micros : typeof micros === "string" ? Number(micros.trim()) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n / 10000) : 0;
}
const inteiro = (v: unknown): number => { const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN; return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; };
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** O gasto de cada dia da conta, de `de` até `ate` (AAAA-MM-DD, incluindo os dois). O Google Ads não dá alcance nesta consulta: vai zero. */
export async function lerGastoDoGoogleAds(c: ConfigDoGoogle, renovacao: string, conta: string, de: string, ate: string, gerente: string | null, buscar: BuscarHttp): Promise<DiaDeMidia[]> {
  if (!SO_NUMEROS.test(conta) || !DIA.test(de) || !DIA.test(ate) || (gerente !== null && !SO_NUMEROS.test(gerente))) throw new ErroDeMidia("outro", null, null);
  const acesso = await renovarAcessoDoGoogle(c, renovacao, buscar);
  const linhas = await consultar(c, buscar, acesso, conta, gerente, `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks FROM customer WHERE segments.date BETWEEN '${de}' AND '${ate}'`);
  const dias = new Map<string, DiaDeMidia>();
  for (const l of linhas) {
    const dia = texto(dentro(l, "segments").date);
    if (!DIA.test(dia)) continue;
    const m = dentro(l, "metrics");
    const anterior = dias.get(dia);
    dias.set(dia, { dia, gasto_centavos: (anterior?.gasto_centavos ?? 0) + microsEmCentavos(m.costMicros), impressoes: (anterior?.impressoes ?? 0) + inteiro(m.impressions), alcance: 0, cliques: (anterior?.cliques ?? 0) + inteiro(m.clicks) });
  }
  return [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}
