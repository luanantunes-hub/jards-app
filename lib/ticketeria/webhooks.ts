// Os webhooks de saída da Ticketeria (I0, parte 3): o Jards avisa um endereço https do produtor quando algo acontece na loja. Aqui só a lógica pura (sem banco e sem rede): os eventos, a
// assinatura, o envelope do aviso, o que se aceita como endereço (nada de rede interna) e a leitura do que o produtor cadastra. O envio de verdade está em webhooks-envio.ts.

import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

export const EVENTOS_DO_WEBHOOK = ["pedido.pago", "pedido.reembolsado", "ingresso.lido", "sessao.cancelada"] as const;
export type EventoDoWebhook = (typeof EVENTOS_DO_WEBHOOK)[number];

export const ROTULO_DO_EVENTO: Record<EventoDoWebhook, string> = {
  "pedido.pago": "Venda paga", "pedido.reembolsado": "Reembolso", "ingresso.lido": "Ingresso lido na porta", "sessao.cancelada": "Sessão cancelada",
};

export const VERSAO_DO_AVISO = 1;
export const MAX_WEBHOOKS_POR_LOJA = 5;
/** Quantas tentativas cada aviso tem (a sexta falha encerra); a espera entre elas está no banco. */
export const MAX_TENTATIVAS = 6;
export const TEMPO_MAXIMO_DO_ENVIO_MS = 8000;

// ─── A assinatura ───────────────────────────────────────────────────────────

/** O valor do cabeçalho `X-Jards-Assinatura`: `t=<segundos>,v1=<HMAC-SHA256 de "t.corpo" com o segredo>`. Quem recebe recalcula e compara, e confere que `t` é recente. */
export function assinaturaDoAviso(segredo: string, corpo: string, segundos: number): string {
  return `t=${segundos},v1=${createHmac("sha256", segredo).update(`${segundos}.${corpo}`).digest("hex")}`;
}

/** Para a documentação e os testes: confere uma assinatura como quem recebe deve fazer (comparação em tempo constante e tolerância de `toleranciaSegundos` para o relógio). */
export function assinaturaConfere(segredo: string, corpo: string, cabecalho: string, agoraSegundos: number, toleranciaSegundos = 300): boolean {
  const m = /^t=(\d{1,12}),v1=([a-f0-9]{64})$/.exec(cabecalho);
  if (!m) return false;
  const t = Number(m[1]);
  if (Math.abs(agoraSegundos - t) > toleranciaSegundos) return false;
  const esperado = Buffer.from(assinaturaDoAviso(segredo, corpo, t).split("v1=")[1], "hex");
  const recebido = Buffer.from(m[2], "hex");
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

export type EntregaParaEnviar = { entrega: string; webhook: string; url: string; segredo: string; tipo: string; dados: unknown; tentativa: number; criado_em: string };

/** O corpo do aviso: o mesmo `id` em todas as tentativas (quem recebe usa o id para não tratar duas vezes). */
export function corpoDoAviso(e: EntregaParaEnviar): string {
  return JSON.stringify({ id: e.entrega, tipo: e.tipo, versao: VERSAO_DO_AVISO, criado_em: e.criado_em, tentativa: e.tentativa, dados: e.dados });
}

export function cabecalhosDoAviso(e: EntregaParaEnviar, corpo: string, segundos: number): Record<string, string> {
  return {
    "content-type": "application/json; charset=utf-8",
    "user-agent": "Jards-Webhooks/1.0",
    "x-jards-evento": e.tipo,
    "x-jards-entrega": e.entrega,
    "x-jards-assinatura": assinaturaDoAviso(e.segredo, corpo, segundos),
  };
}

/** A resposta do banco ao reivindicar: só as entregas bem formadas (o resto é descartado, nunca enviado). */
export function lerEntregas(resposta: unknown): EntregaParaEnviar[] {
  if (!Array.isArray(resposta)) return [];
  const saida: EntregaParaEnviar[] = [];
  for (const x of resposta) {
    const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    if (typeof r.entrega !== "string" || typeof r.webhook !== "string" || typeof r.url !== "string" || typeof r.segredo !== "string" || typeof r.tipo !== "string" || typeof r.criado_em !== "string" || typeof r.tentativa !== "number") continue;
    saida.push({ entrega: r.entrega, webhook: r.webhook, url: r.url, segredo: r.segredo, tipo: r.tipo, dados: r.dados ?? null, tentativa: r.tentativa, criado_em: r.criado_em });
  }
  return saida;
}

// ─── O endereço ─────────────────────────────────────────────────────────────

/** Endereço de rede interna ou reservada (IPv4 e IPv6): nunca se envia nada para ele. */
export function enderecoPrivado(endereco: string): boolean {
  const ip = endereco.replace(/^\[|\]$/g, "").toLowerCase();
  const familia = isIP(ip);
  if (familia === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (familia === 6) {
    if (ip === "::" || ip === "::1") return true;
    const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
    if (mapeado) return enderecoPrivado(mapeado[1]);
    const mapeadoHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(ip);
    if (mapeadoHex) { const n = (parseInt(mapeadoHex[1], 16) << 16) | parseInt(mapeadoHex[2], 16); return enderecoPrivado([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".")); }
    return /^(fc|fd)/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith("ff") || ip.startsWith("64:ff9b") || ip.startsWith("2001:db8");
  }
  return false;
}

type Resolvedor = (host: string, opcoes: { all?: boolean; family?: number; hints?: number }, cb: (erro: NodeJS.ErrnoException | null, resposta: unknown, familia?: number) => void) => void;

/** A função de resolução que a conexão usa (a opção `lookup` do https): recusa o nome que aponte para QUALQUER endereço interno ou reservado, e devolve o endereço conferido, que é o mesmo que a conexão usa. `resolver` traz os endereços do nome. */
export function resolverSemRedeInterna(resolver: (host: string) => Promise<{ address: string; family: number }[]>): Resolvedor {
  return (host, opcoes, cb) => {
    resolver(host).then(enderecos => {
      if (enderecos.length === 0 || enderecos.some(a => enderecoPrivado(a.address))) { cb(new Error("endereco_interno") as NodeJS.ErrnoException, undefined); return; }
      if (opcoes.all) cb(null, enderecos);
      else cb(null, enderecos[0].address, enderecos[0].family);
    }, erro => cb(erro as NodeJS.ErrnoException, undefined));
  };
}

export type LeituraDoEndereco = { ok: true; url: string } | { ok: false; erro: string };

const SUFIXOS_INTERNOS = [".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".intranet", ".private"];

/** O endereço que o produtor cadastra: https, sem usuário e senha, porta 443 (ou 8443), um nome de site (nunca um número de IP nem nome interno), até 500 letras. */
export function lerEnderecoDoWebhook(bruto: unknown): LeituraDoEndereco {
  const texto = typeof bruto === "string" ? bruto.trim() : "";
  if (texto === "" || texto.length > 500) return { ok: false, erro: "Escreva o endereço, com até 500 letras." };
  let url: URL;
  try { url = new URL(texto); } catch { return { ok: false, erro: "Esse endereço não é válido." }; }
  if (url.protocol !== "https:") return { ok: false, erro: "O endereço tem de começar com https://." };
  if (url.username !== "" || url.password !== "") return { ok: false, erro: "O endereço não pode ter usuário e senha." };
  if (url.port !== "" && url.port !== "443" && url.port !== "8443") return { ok: false, erro: "Use a porta 443 (a padrão) ou a 8443." };
  const host = url.hostname.toLowerCase();
  if (host === "" || isIP(host.replace(/^\[|\]$/g, "")) !== 0 || !host.includes(".") || host === "localhost" || SUFIXOS_INTERNOS.some(s => host.endsWith(s))) return { ok: false, erro: "Use o endereço de um site na internet, não um número de IP nem um nome interno." };
  if (url.hash !== "") url.hash = "";
  return { ok: true, url: url.toString() };
}

// ─── O que o produtor cadastra ──────────────────────────────────────────────

export type CorpoDoWebhook = { url?: string; eventos?: EventoDoWebhook[]; ativo?: boolean };
export type LeituraDoCorpo = { ok: true; corpo: CorpoDoWebhook } | { ok: false; erro: string };

/** O corpo da criação (`completo`: endereço e eventos obrigatórios) ou da mudança (o que não vier não muda). */
export function lerCorpoDoWebhook(entrada: unknown, completo: boolean): LeituraDoCorpo {
  const e = (entrada && typeof entrada === "object" && !Array.isArray(entrada) ? entrada : {}) as Record<string, unknown>;
  const corpo: CorpoDoWebhook = {};
  if (completo || e.url !== undefined) {
    const u = lerEnderecoDoWebhook(e.url);
    if (!u.ok) return u;
    corpo.url = u.url;
  }
  if (completo || e.eventos !== undefined) {
    if (!Array.isArray(e.eventos) || e.eventos.length === 0 || e.eventos.some(x => !(EVENTOS_DO_WEBHOOK as readonly unknown[]).includes(x))) return { ok: false, erro: "Escolha ao menos um dos acontecimentos." };
    corpo.eventos = [...new Set(e.eventos as EventoDoWebhook[])];
  }
  if (e.ativo !== undefined) {
    if (typeof e.ativo !== "boolean") return { ok: false, erro: "Ligado ou desligado." };
    corpo.ativo = e.ativo;
  }
  if (!completo && corpo.url === undefined && corpo.eventos === undefined && corpo.ativo === undefined) return { ok: false, erro: "Nada para mudar." };
  return { ok: true, corpo };
}

/** O erro do banco ao cadastrar, numa frase. */
export function mensagemDoErroDoWebhook(erro: { code?: string; message?: string }): string {
  const m = erro.message ?? "";
  if (m.includes("limite_de_webhooks")) return `Cada loja tem até ${MAX_WEBHOOKS_POR_LOJA} endereços. Apague um para criar outro.`;
  if (m.includes("url_invalida")) return "Esse endereço não é válido.";
  if (m.includes("eventos_invalidos")) return "Escolha ao menos um dos acontecimentos.";
  return "Não foi possível salvar o endereço. Tente de novo.";
}
