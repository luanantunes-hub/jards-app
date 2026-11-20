// A API pública da Ticketeria (I0, parte 1): o que um site de fora (WordPress, Wix, Webflow, o widget do Jards...) lê para mostrar os ingressos de uma loja. Só leitura, sem login:
// a loja é identificada pela CHAVE PÚBLICA, que não dá poder de escrita. Aqui só a forma da resposta e as contas (sem banco, sem servidor): a versão do formato, o estado de cada
// sessão, o preço "a partir de" e a ideia de "poucos ingressos" (a API não revela quantos ingressos restam, só se há e se são poucos).

import type { IngressoDaVitrine, VitrineDaSessao } from "@/lib/ticketeria/vitrine";

/** A versão do formato das respostas. Muda só quando algo deixa de ser compatível; campo novo não muda a versão. */
export const VERSAO_DA_API = 1;

/** `tkp_` mais 32 letras e números: a chave pública de uma loja. */
export const CHAVE_PUBLICA = /^tkp_[a-f0-9]{32}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Até quantas sessões a lista de eventos traz no total (cada uma pede a conta dos lotes). */
export const MAX_SESSOES_NA_LISTA = 40;
/** Até quantos ingressos restantes contam como "poucos". */
export const LIMITE_DE_POUCOS = 10;

export type EstadoPublicoDaSessao = "aberta" | "esgotada" | "vendas_pausadas" | "encerrada" | "cancelada";

export type SessaoNaApi = {
  id: string;
  /** Quando começa, em ISO 8601 (UTC). */
  inicio: string;
  /** Quando começa, por extenso, no fuso do local ("Sábado, 12 de dezembro, às 20h"). */
  quando: string;
  local: string;
  /** O nome do local e a cidade e o estado, separados (para o Google e para quem quer mostrar só o nome). */
  local_nome?: string;
  cidade?: string | null;
  uf?: string | null;
  estado: EstadoPublicoDaSessao;
  /** O menor preço à venda hoje, em centavos; nulo se não há ingresso à venda. */
  a_partir_de_centavos: number | null;
  /** Há ingresso à venda, mas são poucos (a API não diz quantos). */
  poucos: boolean;
  /** O endereço da página de compra (no Jards). */
  url: string;
};

export type EventoNaApi = { id: string; slug: string; titulo: string; descricao: string | null; classificacao: string | null; imagem: string | null; sessoes: SessaoNaApi[] };

export type ListaDeEventosNaApi = { versao: number; loja: { nome: string }; tema: { titulo: string; cor: string }; eventos: EventoNaApi[] };

export type IngressoNaApi = { id: string; nome: string; descricao: string | null; limite_por_pedido: number; numerado: boolean; setor: string | null; disponivel: boolean; poucos: boolean; preco_centavos: number | null };

export type SessaoDetalhadaNaApi = {
  versao: number;
  sessao: { id: string; url: string };
  estado: EstadoPublicoDaSessao;
  evento: { titulo: string; descricao: string | null; classificacao: string | null; quando: string; local: string };
  tema: { titulo: string; cor: string };
  parcelas_max: number;
  ingressos: IngressoNaApi[];
};

/** O endereço da página de compra de uma sessão, no endereço do Jards. */
export const urlDeCompra = (origem: string, sessaoId: string) => `${origem.replace(/\/$/, "")}/comprar/${sessaoId}`;

const restantes = (i: IngressoDaVitrine) => i.faixas.reduce((soma, f) => soma + f.livres, 0);

/** Um ingresso como a API o mostra: o preço da faixa da vez, se há e se são poucos; nunca quantos restam. */
export function ingressoNaApi(i: IngressoDaVitrine): IngressoNaApi {
  const n = restantes(i);
  return {
    id: i.id, nome: i.nome, descricao: i.descricao, limite_por_pedido: i.limite, numerado: Boolean(i.numerado), setor: i.numerado?.setor ?? null,
    disponivel: n > 0, poucos: n > 0 && n <= LIMITE_DE_POUCOS, preco_centavos: i.faixas[0]?.preco_centavos ?? null,
  };
}

/** O estado que a API mostra: o da vitrine, e "aberta" sem nenhum ingresso disponível vira "esgotada". */
export function estadoNaApi(vitrine: Pick<VitrineDaSessao, "estado" | "ingressos">): EstadoPublicoDaSessao {
  switch (vitrine.estado) {
    case "sessao_cancelada": return "cancelada";
    case "sessao_encerrada": return "encerrada";
    case "vendas_pausadas": return "vendas_pausadas";
    case "nao_publicado": return "vendas_pausadas";
    case "aberta": return vitrine.ingressos.some(i => restantes(i) > 0) ? "aberta" : "esgotada";
  }
}

/** A sessão está com poucos ingressos: há algum, e o total de todos os tipos não passa de LIMITE_DE_POUCOS. */
export function poucosNaSessao(ingressos: readonly IngressoDaVitrine[]): boolean {
  const total = ingressos.reduce((soma, i) => soma + restantes(i), 0);
  return total > 0 && total <= LIMITE_DE_POUCOS;
}

/** O menor preço à venda hoje entre os ingressos com vaga; nulo se não há. */
export function menorPreco(ingressos: readonly IngressoDaVitrine[]): number | null {
  const precos = ingressos.filter(i => restantes(i) > 0).map(i => i.faixas[0].preco_centavos);
  return precos.length === 0 ? null : Math.min(...precos);
}

export function sessaoDetalhada(vitrine: VitrineDaSessao, origem: string): SessaoDetalhadaNaApi {
  return {
    versao: VERSAO_DA_API,
    sessao: { id: vitrine.sessao_id, url: urlDeCompra(origem, vitrine.sessao_id) },
    estado: estadoNaApi(vitrine),
    evento: { titulo: vitrine.evento.titulo, descricao: vitrine.evento.descricao, classificacao: vitrine.evento.classificacao, quando: vitrine.evento.quando, local: vitrine.evento.local },
    tema: vitrine.site,
    parcelas_max: vitrine.parcelas_max,
    ingressos: vitrine.ingressos.map(ingressoNaApi),
  };
}

/** Os cabeçalhos das respostas públicas: leitura aberta a qualquer site (CORS), com cache curto para aguentar um site cheio. */
export const CABECALHOS_PUBLICOS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
  "cache-control": "public, s-maxage=30, stale-while-revalidate=60",
  "x-content-type-options": "nosniff",
};

/** A chave da loja como a tela do produtor a recebe: a chave, se está ligada e o endereço da API da loja. Nulo se o banco respondeu algo que não se entende. */
export function lerChaveDaLoja(resposta: unknown, origem: string): { chave: string; ativa: boolean; api: string } | null {
  const r = (resposta && typeof resposta === "object" && !Array.isArray(resposta) ? resposta : {}) as Record<string, unknown>;
  if (typeof r.chave !== "string" || !CHAVE_PUBLICA.test(r.chave) || typeof r.ativa !== "boolean") return null;
  return { chave: r.chave, ativa: r.ativa, api: `${origem.replace(/\/$/, "")}/api/ticketeria/publico/${r.chave}` };
}

/** A chave como a tela a mostra, sem exibi-la inteira: "tkp_9f3a…c21e". */
export const chaveResumida = (chave: string) => (CHAVE_PUBLICA.test(chave) ? `${chave.slice(0, 8)}…${chave.slice(-4)}` : "");

/** O código que o produtor cola no site dele: o script do widget com a chave da loja. */
export function codigoDoWidget(origem: string, chave: string): string {
  return `<script src="${origem.replace(/\/$/, "")}/widget/ingressos.js" data-chave="${chave}" async></script>`;
}
