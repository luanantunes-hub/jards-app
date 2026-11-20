// O Google Analytics 4 como fonte de VISITAS (não de gasto): o login do produtor (o mesmo cliente OAuth do Google Ads, com a permissão de leitura do Analytics), a lista de propriedades
// e as visitas por dia e por origem. SÓ LEITURA. Sem banco e sem imports de servidor: o `fetch` entra por parâmetro e roda nos testes (tests/ticketeria-ga4.test.ts).
//
// O token de renovação, o login e a renovação do acesso são os de lib/ticketeria/midia/google-ads.ts; aqui só mudam a permissão (`analytics.readonly`) e o que se lê.
// A CONFERIR com uma resposta real do Google (as páginas lidas em 20/11/2026 cobrem o formato abaixo, mas não foi testado): `accountSummaries` e `runReport` com as dimensões
// `date` e `sessionSourceMedium` e as métricas `sessions` e `totalUsers`. O GA4 só enxerga origens marcadas com utm_*: por isso o link de divulgação leva utm_source/utm_medium.

import { canalPeloTexto } from "@/lib/ticketeria/divulgacao";
import { ErroDeMidia } from "@/lib/ticketeria/midia/erro";
import { pedirAoGoogle, renovarAcessoDoGoogle, urlDeLoginDoGoogle, type ConfigDoGoogle } from "@/lib/ticketeria/midia/google-ads";
import type { BuscarHttp, ContaDeAnuncios } from "@/lib/ticketeria/midia/meta";

export const ESCOPO_DO_GA4 = "https://www.googleapis.com/auth/analytics.readonly";
const MAX_PAGINAS = 20;
const LINHAS_POR_PAGINA = 10000;
const MAX_PROPRIEDADES = 200;

export const urlDeLoginDoGa4 = (c: ConfigDoGoogle, state: string): string => urlDeLoginDoGoogle(c, state, ESCOPO_DO_GA4);

const cabecalhos = (acesso: string): Record<string, string> => ({ authorization: `Bearer ${acesso}`, "content-type": "application/json" });

const texto = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

/** As propriedades GA4 que o produtor pode ler. `id` é o número da propriedade; o nome leva a conta: "Cia Atores de Mar · Site". Sem moeda (o GA4 não precisa). */
export async function listarPropriedadesDoGa4(c: ConfigDoGoogle, renovacao: string, buscar: BuscarHttp): Promise<ContaDeAnuncios[]> {
  const acesso = await renovarAcessoDoGoogle(c, renovacao, buscar);
  const propriedades: ContaDeAnuncios[] = [];
  let pagina = "";
  for (let i = 0; i < MAX_PAGINAS && propriedades.length < MAX_PROPRIEDADES; i++) {
    const corpo = (await pedirAoGoogle(buscar, `https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200${pagina ? `&pageToken=${encodeURIComponent(pagina)}` : ""}`, { method: "GET", headers: cabecalhos(acesso) })) as { accountSummaries?: unknown; nextPageToken?: unknown };
    for (const conta of Array.isArray(corpo.accountSummaries) ? corpo.accountSummaries : []) {
      const c0 = (conta && typeof conta === "object" ? conta : {}) as { displayName?: unknown; propertySummaries?: unknown };
      for (const p of Array.isArray(c0.propertySummaries) ? c0.propertySummaries : []) {
        const o = (p && typeof p === "object" ? p : {}) as { property?: unknown; displayName?: unknown };
        const id = texto(o.property).replace(/^properties\//, "");
        if (!/^\d{3,20}$/.test(id) || propriedades.some(x => x.id === id)) continue;
        const nomeDaConta = texto(c0.displayName).trim();
        const nome = [nomeDaConta, texto(o.displayName).trim()].filter(Boolean).join(" · ").slice(0, 120) || `Propriedade ${id}`;
        propriedades.push({ id, nome, moeda: "", ativa: true });
      }
    }
    pagina = texto(corpo.nextPageToken);
    if (!pagina) break;
  }
  return propriedades;
}

export type VisitaDiaria = { dia: string; origem: string; canal: string; sessoes: number; usuarios: number };

/** O canal que o Jards reconhece numa origem do GA4 ("instagram / social" → instagram; "(direct) / (none)" → direto; o que não reconhece → outros). */
export function canalDaOrigem(origem: string): string {
  const o = origem.trim().toLowerCase();
  if (o === "" || o.startsWith("(not set)")) return "outros";
  if (o.startsWith("(direct)")) return "direto";
  return canalPeloTexto(o) ?? "outros";
}

const inteiro = (v: unknown): number => { const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : Number.NaN; return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; };
const DIA_YMD = /^(\d{4})(\d{2})(\d{2})$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** As visitas de cada dia e origem da propriedade, de `de` até `ate` (AAAA-MM-DD, incluindo os dois), em páginas de 10.000 linhas. */
export async function lerVisitasDoGa4(c: ConfigDoGoogle, renovacao: string, propriedade: string, de: string, ate: string, buscar: BuscarHttp): Promise<VisitaDiaria[]> {
  if (!/^\d{3,20}$/.test(propriedade) || !DIA.test(de) || !DIA.test(ate)) throw new ErroDeMidia("outro", null, null);
  const acesso = await renovarAcessoDoGoogle(c, renovacao, buscar);
  const visitas = new Map<string, VisitaDiaria>();
  for (let pagina = 0, deslocamento = 0; pagina < MAX_PAGINAS; pagina++) {
    const corpo = (await pedirAoGoogle(buscar, `https://analyticsdata.googleapis.com/v1beta/properties/${propriedade}:runReport`, {
      method: "POST", headers: cabecalhos(acesso),
      body: JSON.stringify({ dateRanges: [{ startDate: de, endDate: ate }], dimensions: [{ name: "date" }, { name: "sessionSourceMedium" }], metrics: [{ name: "sessions" }, { name: "totalUsers" }], limit: String(LINHAS_POR_PAGINA), offset: String(deslocamento) }),
    })) as { rows?: unknown; rowCount?: unknown };
    const linhas = Array.isArray(corpo.rows) ? corpo.rows : [];
    for (const l of linhas) {
      const o = (l && typeof l === "object" ? l : {}) as { dimensionValues?: { value?: unknown }[]; metricValues?: { value?: unknown }[] };
      const bruto = texto(o.dimensionValues?.[0]?.value);
      const m = DIA_YMD.exec(bruto);
      const origem = texto(o.dimensionValues?.[1]?.value).trim().slice(0, 100);
      if (!m || origem === "") continue;
      const dia = `${m[1]}-${m[2]}-${m[3]}`;
      const chave = `${dia}|${origem}`;
      const anterior = visitas.get(chave);
      visitas.set(chave, { dia, origem, canal: canalDaOrigem(origem), sessoes: (anterior?.sessoes ?? 0) + inteiro(o.metricValues?.[0]?.value), usuarios: (anterior?.usuarios ?? 0) + inteiro(o.metricValues?.[1]?.value) });
    }
    deslocamento += linhas.length;
    const total = inteiro(corpo.rowCount);
    if (linhas.length < LINHAS_POR_PAGINA || deslocamento >= total) break;
  }
  return [...visitas.values()].sort((a, b) => a.dia.localeCompare(b.dia) || a.origem.localeCompare(b.origem));
}
