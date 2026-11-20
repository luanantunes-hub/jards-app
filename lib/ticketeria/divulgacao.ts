// O painel "Divulgação": de onde vieram as vendas de cada sessão, e o link que o produtor cola onde for divulgar (o canal vai no endereço, ver lib/ticketeria/origem.ts).
// Só a conta, sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-divulgacao.test.ts). Quem lê as linhas é lib/ticketeria/divulgacao-servidor.ts.
//
// De qual canal é uma venda: o canal do link de divulgação (`?canal=`) vale mais; depois a utm_source, depois o site de onde a pessoa chegou, depois o cupom usado; sem
// nada disso, "sem origem conhecida". Só entram vendas pagas; ingressos e valor são o que o comprador pagou (já com o desconto do cupom).

import { MAX_ACAO_DA_ORIGEM, MAX_CANAL_DA_ORIGEM, rotuloDeCampanha } from "@/lib/ticketeria/origem";

/** Os canais que o produtor escolhe ao criar um link. */
export const CANAIS_DE_DIVULGACAO = [
  { valor: "instagram", rotulo: "Instagram" },
  { valor: "whatsapp", rotulo: "WhatsApp" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "anuncio-pago", rotulo: "Anúncio pago" },
  { valor: "parceiro", rotulo: "Parceiro ou influenciador" },
  { valor: "outro", rotulo: "Outro" },
] as const;

export const SEM_ORIGEM = "sem-origem";
export const ROTULO_SEM_ORIGEM = "Sem origem conhecida";

const ROTULOS: Record<string, string> = {
  instagram: "Instagram", whatsapp: "WhatsApp", email: "E-mail", "anuncio-pago": "Anúncio pago", parceiro: "Parceiro ou influenciador", outro: "Outro",
  facebook: "Facebook", google: "Google", tiktok: "TikTok", youtube: "YouTube", site: "Site do produtor",
};

/** Reconhece o canal pelo nome que as plataformas usam (utm_source "ig", site "l.instagram.com"…); null se não reconhece. */
export function canalPeloTexto(texto: string): string | null {
  const t = texto.trim().toLowerCase();
  if (t === "") return null;
  if (t === "ig" || t.includes("instagram")) return "instagram";
  if (t === "wa" || t.includes("whatsapp") || t.includes("wa.me")) return "whatsapp";
  if (t === "fb" || t.includes("facebook") || t.startsWith("fb.") || t.includes("fbclid")) return "facebook";
  if (t.includes("tiktok")) return "tiktok";
  if (t.includes("youtube") || t.includes("youtu.be")) return "youtube";
  if (t.includes("google")) return "google";
  if (t === "email" || t === "e-mail" || t.includes("newsletter") || t.includes("mail")) return "email";
  return null;
}

function bonito(slug: string): string {
  const texto = slug.replace(/[-_]+/g, " ").trim();
  return texto === "" ? slug : texto.charAt(0).toUpperCase() + texto.slice(1);
}

export type OrigemDoPedido = {
  origem_canal: string | null; origem_utm: Record<string, unknown> | null; origem_referencia: string | null; cupom_codigo: string | null;
};

/** O canal de uma venda: a chave (para somar) e o nome que a tela mostra. */
export function canalDoPedido(p: OrigemDoPedido): { chave: string; rotulo: string } {
  if (p.origem_canal) {
    const chave = canalPeloTexto(p.origem_canal) ?? p.origem_canal;
    return { chave, rotulo: ROTULOS[chave] ?? bonito(chave) };
  }
  const fonte = typeof p.origem_utm?.utm_source === "string" ? p.origem_utm.utm_source : "";
  if (fonte.trim() !== "") {
    const chave = canalPeloTexto(fonte) ?? rotuloDeCampanha(fonte, MAX_CANAL_DA_ORIGEM);
    if (chave) return { chave, rotulo: ROTULOS[chave] ?? bonito(chave) };
  }
  if (p.origem_referencia) {
    const chave = canalPeloTexto(p.origem_referencia);
    return chave ? { chave, rotulo: ROTULOS[chave] ?? bonito(chave) } : { chave: p.origem_referencia, rotulo: p.origem_referencia };
  }
  if (p.cupom_codigo) return { chave: `cupom:${p.cupom_codigo}`, rotulo: `Cupom ${p.cupom_codigo}` };
  return { chave: SEM_ORIGEM, rotulo: ROTULO_SEM_ORIGEM };
}

export type PedidoPagoParaOrigem = OrigemDoPedido & { id: string; sessao_id: string; total_centavos: number };
/** Vendas somadas por sessão e canal. */
export type LinhaDaDivulgacao = { sessao_id: string; chave: string; rotulo: string; ingressos: number; vendido_centavos: number };

export function agruparDivulgacao(pedidosPagos: PedidoPagoParaOrigem[], quantidadePorPedido: Record<string, number>): LinhaDaDivulgacao[] {
  const mapa = new Map<string, LinhaDaDivulgacao>();
  for (const p of pedidosPagos) {
    const canal = canalDoPedido(p);
    const chave = `${p.sessao_id}|${canal.chave}`;
    const linha = mapa.get(chave) ?? { sessao_id: p.sessao_id, chave: canal.chave, rotulo: canal.rotulo, ingressos: 0, vendido_centavos: 0 };
    linha.ingressos += quantidadePorPedido[p.id] ?? 0;
    linha.vendido_centavos += p.total_centavos;
    mapa.set(chave, linha);
  }
  return [...mapa.values()];
}

export type CanalResumido = { chave: string; rotulo: string; ingressos: number; vendido_centavos: number; porcento: number };
export type ResumoDaDivulgacao = { ingressos: number; vendido_centavos: number; sem_origem_porcento: number; canais: CanalResumido[] };

/** O painel de uma sessão (ou de todas, com `sessaoId` nulo): o total, a parte sem origem e a tabela por canal (a maior primeiro; "sem origem" por último). */
export function resumirDivulgacao(linhas: LinhaDaDivulgacao[], sessaoId: string | null): ResumoDaDivulgacao {
  const porCanal = new Map<string, CanalResumido>();
  for (const l of linhas) {
    if (sessaoId !== null && l.sessao_id !== sessaoId) continue;
    const c = porCanal.get(l.chave) ?? { chave: l.chave, rotulo: l.rotulo, ingressos: 0, vendido_centavos: 0, porcento: 0 };
    c.ingressos += l.ingressos;
    c.vendido_centavos += l.vendido_centavos;
    porCanal.set(l.chave, c);
  }
  const canais = [...porCanal.values()];
  const ingressos = canais.reduce((soma, c) => soma + c.ingressos, 0);
  const vendido = canais.reduce((soma, c) => soma + c.vendido_centavos, 0);
  for (const c of canais) c.porcento = ingressos > 0 ? Math.round((c.ingressos / ingressos) * 100) : 0;
  canais.sort((a, b) => (a.chave === SEM_ORIGEM ? 1 : 0) - (b.chave === SEM_ORIGEM ? 1 : 0) || b.ingressos - a.ingressos || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const sem = canais.find(c => c.chave === SEM_ORIGEM);
  return { ingressos, vendido_centavos: vendido, sem_origem_porcento: sem?.porcento ?? 0, canais };
}

/** O link de divulgação de uma sessão: a página de compra com o canal (e o nome da ação, se houver) no endereço. */
export function enderecoDeDivulgacao(origem: string, sessaoId: string, canal: string, acao: string): string {
  const base = `${origem.replace(/\/$/, "")}/comprar/${sessaoId}`;
  const parametros = new URLSearchParams();
  const c = rotuloDeCampanha(canal, MAX_CANAL_DA_ORIGEM);
  const a = rotuloDeCampanha(acao, MAX_ACAO_DA_ORIGEM);
  if (c) parametros.set("canal", c);
  if (a) parametros.set("acao", a);
  const busca = parametros.toString();
  return busca === "" ? base : `${base}?${busca}`;
}

export type SessaoParaDivulgar = { id: string; evento: string; quando: string; a_venda: boolean };
export type DivulgacaoDaLoja = { linhas: LinhaDaDivulgacao[]; sessoes: SessaoParaDivulgar[] };
