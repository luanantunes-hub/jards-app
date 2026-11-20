// A origem de uma compra: de qual link de divulgação a pessoa veio. Só rótulos de campanha (canal, nome da ação, utm_*) e o domínio de onde chegou; nenhum dado pessoal e nada
// guardado no navegador: o rótulo viaja pelo endereço da página de compra e segue junto com a compra. Sem banco e sem imports de servidor: roda nos testes
// (tests/ticketeria-origem.test.ts) e na página de compra. O mesmo recorte é refeito no servidor e no banco (fn_ticketeria_registrar_origem): nada que chega é confiável.

export const CAMPOS_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type CampoUtm = (typeof CAMPOS_UTM)[number];

export type OrigemDaCompra = {
  /** "instagram", "whatsapp", "email"…: o canal em minúsculas, até 30 letras, números, "-" e "_". */
  canal: string | null;
  /** O nome da ação ("stories-do-lote-2"), no mesmo formato, até 60. */
  acao: string | null;
  /** O domínio de onde a pessoa chegou ("l.instagram.com"), quando o navegador informa. */
  referencia: string | null;
  /** Só as cinco utm_*, cada valor com até 100 letras. */
  utm: Partial<Record<CampoUtm, string>> | null;
};

const MAX_CANAL = 30;
const MAX_ACAO = 60;
const MAX_REFERENCIA = 100;
const MAX_UTM = 100;

/** Minúsculas, sem acento, só letras, números, "-" e "_" (o resto vira "-"), sem "-" nas pontas. Vazio vira null. */
function rotulo(valor: unknown, max: number): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
  return limpo === "" ? null : limpo;
}

/** O mesmo recorte do canal e da ação, para quem monta o link de divulgação (lib/ticketeria/divulgacao.ts). */
export const rotuloDeCampanha = (valor: unknown, max: number): string | null => rotulo(valor, max);
export const MAX_CANAL_DA_ORIGEM = MAX_CANAL;
export const MAX_ACAO_DA_ORIGEM = MAX_ACAO;

function dominio(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const host = valor.trim().toLowerCase().replace(/[^a-z0-9.-]/g, "").slice(0, MAX_REFERENCIA).replace(/^[.-]+|[.-]+$/g, "");
  return host === "" ? null : host;
}

function textoDaUtm(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_UTM);
  return limpo === "" ? null : limpo;
}

/** O que chegou no corpo da compra, aparado. Nunca recusa: origem torta vira "sem origem", e a venda segue. */
export function lerOrigem(entrada: unknown): OrigemDaCompra | null {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return null;
  const e = entrada as Record<string, unknown>;
  const bruta = e.utm && typeof e.utm === "object" && !Array.isArray(e.utm) ? (e.utm as Record<string, unknown>) : {};
  const utm: Partial<Record<CampoUtm, string>> = {};
  for (const campo of CAMPOS_UTM) {
    const valor = textoDaUtm(bruta[campo]);
    if (valor) utm[campo] = valor;
  }
  const origem: OrigemDaCompra = {
    canal: rotulo(e.canal, MAX_CANAL), acao: rotulo(e.acao, MAX_ACAO), referencia: dominio(e.referencia), utm: Object.keys(utm).length > 0 ? utm : null,
  };
  return origem.canal || origem.acao || origem.referencia || origem.utm ? origem : null;
}

/**
 * O que a página de compra leva ao servidor: `?canal=` e `?acao=` do link de divulgação, as utm_* e o domínio de onde a pessoa chegou
 * (o do próprio site não conta). `busca` é `location.search`; `referrer` é `document.referrer`; `hostDaPagina` é `location.hostname`.
 */
export function origemDaPagina(busca: string, referrer: string, hostDaPagina: string): OrigemDaCompra | null {
  const parametros = new URLSearchParams(busca);
  const utm: Record<string, string> = {};
  for (const campo of CAMPOS_UTM) { const v = parametros.get(campo); if (v) utm[campo] = v; }
  let referencia: string | null = null;
  try { if (referrer) { const host = new URL(referrer).hostname; if (host && host.toLowerCase() !== hostDaPagina.toLowerCase()) referencia = host; } } catch { /* endereço torto: sem referência */ }
  return lerOrigem({ canal: parametros.get("canal"), acao: parametros.get("acao"), referencia, utm });
}
