// O Meta Ads (Instagram e Facebook) como fonte de gasto: o login do produtor, a troca do código pelo token, a lista de contas de anúncios e o gasto diário. SÓ LEITURA
// (permissão `ads_read`): o Jards nunca cria nem muda anúncio. Sem banco e sem imports de servidor: o `fetch` entra por parâmetro e roda nos testes (tests/ticketeria-meta.test.ts).
//
// A CONFERIR com uma resposta real da Meta antes de ir ao ar (as páginas oficiais lidas em 20/11/2026 não cobrem): a duração do token longo (~60 dias, troca `fb_exchange_token`),
// os campos de `/me/adaccounts` e se `spend` vem em reais (aqui lido como texto em reais: "5339.5" = R$ 5.339,50). A versão da API fica em META_GRAPH_VERSION.

import { ErroDeMidia } from "@/lib/ticketeria/midia/erro";

export { fraseDoErro } from "@/lib/ticketeria/midia/erro";
/** O erro da Meta é o erro genérico de mídia (o mesmo tipo serve ao Google). */
export { ErroDeMidia as ErroDaMeta } from "@/lib/ticketeria/midia/erro";

export const ESCOPO_DA_META = "ads_read";
export const VERSAO_PADRAO_DA_API = "v25.0";
const DIAS_DO_TOKEN_LONGO_SEM_AVISO = 60;

export type ConfigDaMeta = { appId: string; appSecret: string; versao: string; redirectUri: string };

/** As credenciais do app da Meta (variáveis do servidor). Sem elas o conector fica "Em breve". `origem` é o endereço do Jards (https://jards.com.br). */
export function configDaMeta(env: Record<string, string | undefined>, origem: string): ConfigDaMeta | null {
  const appId = env.META_APP_ID?.trim();
  const appSecret = env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  const versao = /^v\d{1,2}\.\d$/.test(env.META_GRAPH_VERSION?.trim() ?? "") ? (env.META_GRAPH_VERSION as string).trim() : VERSAO_PADRAO_DA_API;
  return { appId, appSecret, versao, redirectUri: `${origem.replace(/\/$/, "")}/api/ticketeria/conexoes/meta/retorno` };
}

/** O endereço do login da Meta (o produtor entra e autoriza a leitura dos anúncios). `state` volta intacto no retorno e prova que fomos nós que abrimos o login. */
export function urlDeLoginDaMeta(c: ConfigDaMeta, state: string): string {
  const p = new URLSearchParams({ client_id: c.appId, redirect_uri: c.redirectUri, state, scope: ESCOPO_DA_META, response_type: "code" });
  return `https://www.facebook.com/${c.versao}/dialog/oauth?${p.toString()}`;
}

export type RespostaHttp = { ok: boolean; status: number; json(): Promise<unknown> };
export type PedidoHttp = { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string };
export type BuscarHttp = (url: string, pedido?: PedidoHttp) => Promise<RespostaHttp>;

const CODIGOS_DE_TOKEN = new Set([190, 102, 463, 467, 459, 460]);
const CODIGOS_DE_LIMITE = new Set([4, 17, 32, 613, 80000, 80003, 80004, 80014]);

export function classificarErroDaMeta(corpo: unknown, status: number): ErroDeMidia {
  const erro = (corpo && typeof corpo === "object" ? (corpo as { error?: unknown }).error : null) as { code?: unknown; error_subcode?: unknown } | null;
  const codigo = typeof erro?.code === "number" ? erro.code : null;
  const subcodigo = typeof erro?.error_subcode === "number" ? erro.error_subcode : null;
  if ((codigo !== null && CODIGOS_DE_TOKEN.has(codigo)) || status === 401) return new ErroDeMidia("token", codigo, subcodigo);
  if ((codigo !== null && CODIGOS_DE_LIMITE.has(codigo)) || status === 429) return new ErroDeMidia("limite", codigo, subcodigo);
  return new ErroDeMidia("outro", codigo, subcodigo);
}

async function pedir(buscar: BuscarHttp, url: string): Promise<unknown> {
  let r: RespostaHttp;
  try { r = await buscar(url); } catch { throw new ErroDeMidia("outro", null, null); }
  let corpo: unknown = null;
  try { corpo = await r.json(); } catch { /* corpo ilegível */ }
  if (!r.ok) throw classificarErroDaMeta(corpo, r.status);
  return corpo;
}

export type TokenDaMeta = { token: string; expira_em: string };

/** O código do login vira o token curto e este vira o longo (cerca de 60 dias). Devolve o token longo e quando ele vence. */
export async function trocarCodigoPeloToken(c: ConfigDaMeta, codigo: string, buscar: BuscarHttp, agora: Date = new Date()): Promise<TokenDaMeta> {
  const base = `https://graph.facebook.com/${c.versao}/oauth/access_token`;
  const curto = (await pedir(buscar, `${base}?${new URLSearchParams({ client_id: c.appId, redirect_uri: c.redirectUri, client_secret: c.appSecret, code: codigo }).toString()}`)) as { access_token?: unknown };
  if (typeof curto.access_token !== "string" || curto.access_token.length < 20) throw new ErroDeMidia("outro", null, null);
  const longo = (await pedir(buscar, `${base}?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: c.appId, client_secret: c.appSecret, fb_exchange_token: curto.access_token }).toString()}`)) as { access_token?: unknown; expires_in?: unknown };
  const token = typeof longo.access_token === "string" && longo.access_token.length >= 20 ? longo.access_token : curto.access_token;
  const segundos = typeof longo.expires_in === "number" && longo.expires_in > 0 ? longo.expires_in : DIAS_DO_TOKEN_LONGO_SEM_AVISO * 86400;
  return { token, expira_em: new Date(agora.getTime() + segundos * 1000).toISOString() };
}

/** `gerente`: a conta gerente por onde se chega a esta conta (Google Ads), ou null/ausente quando a conta é acessada direto. */
export type ContaDeAnuncios = { id: string; nome: string; moeda: string; ativa: boolean; gerente?: string | null };

type PaginaDaMeta = { data?: unknown; paging?: { next?: unknown } };
const MAX_PAGINAS = 20;

async function todasAsPaginas(buscar: BuscarHttp, primeira: string): Promise<unknown[]> {
  const linhas: unknown[] = [];
  let url: string | null = primeira;
  for (let i = 0; url && i < MAX_PAGINAS; i++) {
    const pagina = (await pedir(buscar, url)) as PaginaDaMeta;
    if (Array.isArray(pagina.data)) linhas.push(...pagina.data);
    const proxima: unknown = pagina.paging?.next;
    // Só segue para a própria Meta: nunca para um endereço que a resposta mande (o token vai na consulta).
    url = typeof proxima === "string" && /^https:\/\/graph\.facebook\.com\//.test(proxima) ? proxima : null;
  }
  return linhas;
}

/** As contas de anúncios do produtor. `ativa` é a conta com situação 1 (ativa) na Meta. */
export async function listarContasDaMeta(c: ConfigDaMeta, token: string, buscar: BuscarHttp): Promise<ContaDeAnuncios[]> {
  const p = new URLSearchParams({ fields: "account_id,name,currency,account_status", limit: "100", access_token: token });
  const linhas = await todasAsPaginas(buscar, `https://graph.facebook.com/${c.versao}/me/adaccounts?${p.toString()}`);
  const contas: ContaDeAnuncios[] = [];
  for (const l of linhas) {
    const o = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
    const id = typeof o.account_id === "string" ? o.account_id : typeof o.account_id === "number" ? String(o.account_id) : "";
    if (!/^\d{3,30}$/.test(id)) continue;
    contas.push({ id, nome: typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 120) : `Conta ${id}`, moeda: typeof o.currency === "string" ? o.currency.toUpperCase() : "", ativa: o.account_status === 1 });
  }
  return contas;
}

export type DiaDeMidia = { dia: string; gasto_centavos: number; impressoes: number; alcance: number; cliques: number };

/** "5339.5" (reais, texto) em centavos inteiros. Valor torto vira 0. */
export function reaisEmCentavos(texto: unknown): number {
  const n = typeof texto === "number" ? texto : typeof texto === "string" ? Number(texto.trim()) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}
const inteiro = (v: unknown): number => { const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN; return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; };

/** O gasto de cada dia da conta, de `de` até `ate` (AAAA-MM-DD, incluindo os dois). Só dias que a Meta devolve (dia sem anúncio não vem). */
export async function lerGastoDiario(c: ConfigDaMeta, token: string, conta: string, de: string, ate: string, buscar: BuscarHttp): Promise<DiaDeMidia[]> {
  const p = new URLSearchParams({
    level: "account", time_increment: "1", time_range: JSON.stringify({ since: de, until: ate }), fields: "spend,impressions,reach,clicks,account_currency", limit: "500", access_token: token,
  });
  const linhas = await todasAsPaginas(buscar, `https://graph.facebook.com/${c.versao}/act_${conta}/insights?${p.toString()}`);
  const dias = new Map<string, DiaDeMidia>();
  for (const l of linhas) {
    const o = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
    const dia = typeof o.date_start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.date_start) ? o.date_start : null;
    if (!dia) continue;
    dias.set(dia, { dia, gasto_centavos: reaisEmCentavos(o.spend), impressoes: inteiro(o.impressions), alcance: inteiro(o.reach), cliques: inteiro(o.clicks) });
  }
  return [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}
