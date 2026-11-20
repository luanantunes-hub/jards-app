// A página de cada evento no site da loja e a Agenda (C2; desenho aprovado pelo dono em 20/11/2026): o endereço (/e/<slug>), os dados estruturados que o Google lê (schema.org/Event),
// o resumo para o cartão de compartilhamento, o estado do evento e a lista da Agenda. Só lógica e dados (sem banco, sem tela e sem servidor): roda no navegador e nos testes.

import type { EventoNaApi, SessaoNaApi } from "@/lib/ticketeria/integracao";
import { codigoDoCupomValido, normalizarCodigo } from "@/lib/ticketeria/cupom";
import { origemDaPagina } from "@/lib/ticketeria/origem";

/** O endereço público da página do evento no domínio do produtor. */
export const enderecoDoEvento = (host: string, slug: string) => `https://${host}/e/${slug}`;

/** O caminho da página do evento a partir da base do site ("" no domínio da pessoa). */
export const caminhoDoEvento = (base: string, slug: string) => `${base}/e/${slug}`;

/** O slug de um evento como o banco o guarda (a regra de formato do banco). */
export const SLUG_DO_EVENTO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** O resumo da descrição para o cartão de compartilhamento: até `max` letras, cortado numa palavra, em uma linha só; nulo se não há descrição. */
export function descricaoResumida(descricao: string | null, max = 160): string | null {
  const limpa = (descricao ?? "").replace(/\s+/g, " ").trim();
  if (limpa === "") return null;
  if (limpa.length <= max) return limpa;
  const corte = limpa.slice(0, max - 1);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > max * 0.6 ? corte.slice(0, espaco) : corte).replace(/[.,;:!?\s]+$/, "")}…`;
}

export type EstadoDoEvento = "aberta" | "esgotado" | "indisponivel";

/** O estado do evento, pelas sessões: alguma à venda = "aberta"; todas esgotadas = "esgotado"; o resto (pausadas, nenhuma) = "indisponivel". */
export function estadoDoEvento(sessoes: readonly Pick<SessaoNaApi, "estado">[]): EstadoDoEvento {
  if (sessoes.some(s => s.estado === "aberta")) return "aberta";
  if (sessoes.length > 0 && sessoes.every(s => s.estado === "esgotada")) return "esgotado";
  return "indisponivel";
}

export type ItemDaAgenda = { slug: string; titulo: string; imagem: string | null; classificacao: string | null; proxima: { quando: string; local: string } | null; estado: EstadoDoEvento; a_partir_de_centavos: number | null; sessoes: number };

/** A Agenda: um item por evento com sessão por vir, na ordem da primeira sessão. A "próxima" é a primeira sessão à venda (ou, sem nenhuma, a primeira); o preço é o menor entre as sessões à venda. */
export function agendaDosEventos(eventos: readonly EventoNaApi[]): ItemDaAgenda[] {
  return eventos.filter(e => e.sessoes.length > 0).map(e => {
    const proxima = e.sessoes.find(s => s.estado === "aberta") ?? e.sessoes[0];
    const precos = e.sessoes.filter(s => s.estado === "aberta" && s.a_partir_de_centavos !== null).map(s => s.a_partir_de_centavos as number);
    return { slug: e.slug, titulo: e.titulo, imagem: e.imagem, classificacao: e.classificacao, proxima: { quando: proxima.quando, local: proxima.local }, estado: estadoDoEvento(e.sessoes), a_partir_de_centavos: precos.length > 0 ? Math.min(...precos) : null, sessoes: e.sessoes.length };
  });
}

const DISPONIBILIDADE: Partial<Record<SessaoNaApi["estado"], string>> = { aberta: "https://schema.org/InStock", esgotada: "https://schema.org/SoldOut" };

/** Os dados estruturados do evento para o Google (schema.org/Event): um Event por sessão que ainda vai acontecer e não foi cancelada, com local, preço e disponibilidade. */
export function dadosEstruturadosDoEvento(evento: Pick<EventoNaApi, "titulo" | "descricao" | "imagem" | "sessoes">, url: string, organizador: string): Record<string, unknown>[] {
  return evento.sessoes.filter(s => s.estado !== "cancelada" && s.estado !== "encerrada").map(s => {
    const lugar: Record<string, unknown> = { "@type": "Place", name: s.local_nome || s.local };
    if (s.cidade || s.uf) lugar.address = { "@type": "PostalAddress", ...(s.cidade ? { addressLocality: s.cidade } : {}), ...(s.uf ? { addressRegion: s.uf } : {}), addressCountry: "BR" };
    const dados: Record<string, unknown> = {
      "@context": "https://schema.org", "@type": "Event", name: evento.titulo, startDate: s.inicio, eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", location: lugar, url, organizer: { "@type": "Organization", name: organizador },
    };
    const resumo = descricaoResumida(evento.descricao, 300);
    if (resumo) dados.description = resumo;
    if (evento.imagem && /^https:\/\//.test(evento.imagem)) dados.image = [evento.imagem];
    const disponibilidade = DISPONIBILIDADE[s.estado];
    if (disponibilidade) dados.offers = { "@type": "Offer", url: s.url, priceCurrency: "BRL", availability: disponibilidade, ...(s.a_partir_de_centavos !== null ? { price: (s.a_partir_de_centavos / 100).toFixed(2) } : {}) };
    return dados;
  });
}

/** O JSON para dentro de um <script type="application/ld+json">: sem "<" (nada fecha a tag antes da hora) e sem os separadores de linha que quebram o script. */
export function jsonParaScript(dados: unknown): string {
  return JSON.stringify(dados).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

// ─── O que viaja do link da página do evento para a compra (C2b-1) ──────────

/** A busca de uma página (`searchParams` do Next ou `location.search`): um valor, uma lista deles ou nada. */
export type BuscaDaPagina = Record<string, string | string[] | undefined>;

const primeiro = (v: string | string[] | undefined): string | null => (Array.isArray(v) ? v[0] : v) ?? null;

/**
 * Os parâmetros que o link de divulgação traz e a compra precisa receber: o cupom (`?cupom=VERAO`, conferido no formato) e a origem da divulgação (`canal`, `acao` e as `utm_*`, recortados
 * como a compra os recorta). Só estes: nada mais que esteja na busca da página vai para a compra. O cupom só é CONFERIDO de verdade na compra (se existe, se vale para a sessão).
 */
export function parametrosParaACompra(busca: BuscaDaPagina): URLSearchParams {
  const saida = new URLSearchParams();
  const cupom = normalizarCodigo(primeiro(busca.cupom));
  if (codigoDoCupomValido(cupom)) saida.set("cupom", cupom);
  const entrada = new URLSearchParams();
  for (const [chave, valor] of Object.entries(busca)) { const v = primeiro(valor); if (v !== null) entrada.set(chave, v); }
  const origem = origemDaPagina(entrada.toString(), "", "");
  if (origem?.canal) saida.set("canal", origem.canal);
  if (origem?.acao) saida.set("acao", origem.acao);
  for (const [campo, valor] of Object.entries(origem?.utm ?? {})) saida.set(campo, valor);
  return saida;
}

/** O endereço da compra (`/comprar/<sessão>`) com o que veio no link da página do evento. Sem nada a levar, o próprio endereço. */
export function enderecoDaCompra(url: string, busca: BuscaDaPagina): string {
  const extra = parametrosParaACompra(busca);
  if (extra.size === 0) return url;
  try {
    const u = new URL(url);
    for (const [chave, valor] of extra) u.searchParams.set(chave, valor);
    return u.toString();
  } catch {
    return url;
  }
}

/** O cupom que a página de compra recebe na busca (`?cupom=`), no formato do banco; nulo se não veio ou não é um código. */
export function cupomDaBusca(busca: BuscaDaPagina): string | null {
  const c = normalizarCodigo(primeiro(busca.cupom));
  return codigoDoCupomValido(c) ? c : null;
}

// ─── A contagem na página do evento (C2b-1) ─────────────────────────────────

const FUSO_DA_CONTAGEM = "America/Sao_Paulo";
const diaNoFuso = (instante: number) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_DA_CONTAGEM, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instante));

/**
 * Quanto falta para a próxima sessão que ainda vai acontecer (não cancelada, não encerrada), contando DIAS DO CALENDÁRIO no horário de Brasília: "A próxima sessão é hoje", "...é amanhã",
 * "Faltam 5 dias para a próxima sessão". Nulo se não há sessão por vir. `agora` vem de fora (a página o lê uma vez), para o texto não depender do relógio de quem desenha.
 */
export function contagemParaOEvento(sessoes: readonly Pick<SessaoNaApi, "inicio" | "estado">[], agora: number): { dias: number; frase: string } | null {
  const hoje = Date.parse(diaNoFuso(agora));
  let menor: number | null = null;
  for (const s of sessoes) {
    if (s.estado === "cancelada" || s.estado === "encerrada") continue;
    const inicio = Date.parse(s.inicio);
    if (!Number.isFinite(inicio)) continue;
    const dias = Math.round((Date.parse(diaNoFuso(inicio)) - hoje) / 86_400_000);
    if (dias < 0) continue;
    if (menor === null || dias < menor) menor = dias;
  }
  if (menor === null) return null;
  return { dias: menor, frase: menor === 0 ? "A próxima sessão é hoje" : menor === 1 ? "A próxima sessão é amanhã" : `Faltam ${menor} dias para a próxima sessão` };
}
