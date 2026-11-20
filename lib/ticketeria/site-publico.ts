import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diasDaProgramacaoDoEspaco } from "@/lib/producao/programacao-publica";
import type { DiaPublico } from "@/lib/producao/programacao";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { blocosDoJson, corDoTema, espacosDosBlocos, eventosDosBlocos, hostDoPedido, ordemDasPaginas, type Bloco } from "@/lib/ticketeria/site";
import { appUrl } from "@/lib/email/config";
import { diaEHoraDoEvento } from "@/lib/ticketeria/pagamento/ingressos";
import type { Database } from "@/lib/supabase/types";

// O site público da loja (Ticketeria, T1; desenho da PD12.1): o que a página de um domínio da pessoa mostra. Sem login: o servidor
// lê com a chave de serviço e só devolve o que está PUBLICADO (nunca o rascunho), de um site publicado, num domínio ativo
// (conferido o DNS e a posse). O que não existe ou não está no ar responde igual: "não encontrado".

type Admin = SupabaseClient<Database>;

/** A programação de cada espaço citado num bloco, pelo id do espaço. */
export type ProgramacoesDoSite = Record<string, DiaPublico[]>;

/** Uma sessão à venda mostrada num bloco de ingressos: quando, onde e o endereço da página de compra (no endereço do Jards, não no do site da pessoa). */
export type SessaoParaComprar = { id: string; quando: string; local: string; url: string };
export type IngressosDoSite = Record<string, SessaoParaComprar[]>;

export type SitePublico = {
  titulo: string; cor: string; organizacao: string;
  menu: { slug: string; titulo: string }[];
  pagina: { slug: string; titulo: string; blocos: Bloco[]; descricao: string | null; imagem: string | null };
  /** As sessões confirmadas dos espaços que os blocos de programação citam (só os da organização do site). */
  programacoes: ProgramacoesDoSite;
  /** As sessões que ainda vão acontecer de cada evento citado num bloco de ingressos, pelo id do evento. */
  ingressos: IngressosDoSite;
};

/**
 * As programações que os blocos da página mostram. Só entra espaço da Produção da MESMA organização do site: um bloco que cite o
 * espaço de outra organização (o JSON não tem chave no banco) fica vazio.
 */
export async function programacoesDosBlocos(admin: Admin, organizationId: string, blocos: readonly Bloco[]): Promise<ProgramacoesDoSite> {
  const ids = espacosDosBlocos(blocos);
  if (ids.length === 0) return {};
  const { data: espacos } = await clienteDaProducao(admin).from("producao_espacos").select("id").in("id", ids).eq("organization_id", organizationId);
  const daOrganizacao = (espacos ?? []).map(espaco => espaco.id);
  const listas = await Promise.all(daOrganizacao.map(async id => [id, (await diasDaProgramacaoDoEspaco(admin, id)).dias] as const));
  return Object.fromEntries(listas);
}

/**
 * As sessões que os blocos de ingressos mostram. Só entra evento PUBLICADO da MESMA organização do site (o JSON do bloco não tem chave no banco); as sessões são as que ainda vão
 * acontecer e não foram canceladas, as próximas primeiro, até 12 por evento. Cada uma leva ao endereço da página de compra.
 */
export async function ingressosDosBlocos(admin: Admin, organizationId: string, blocos: readonly Bloco[], origem: string = appUrl()): Promise<IngressosDoSite> {
  const ids = eventosDosBlocos(blocos);
  if (ids.length === 0) return {};
  const t = clienteDaTicketeria(admin);
  const { data: eventos } = await t.from("ticketeria_eventos").select("id").in("id", ids).eq("organization_id", organizationId).eq("situacao", "publicado");
  const publicados = (eventos ?? []).map(e => e.id);
  if (publicados.length === 0) return {};
  const { data: sessoes } = await t.from("ticketeria_sessoes").select("id, evento_id, local_id, inicio").in("evento_id", publicados).is("cancelada_em", null).gt("inicio", new Date().toISOString()).order("inicio");
  const idsDosLocais = [...new Set((sessoes ?? []).map(s => s.local_id))];
  const { data: locais } = idsDosLocais.length > 0 ? await t.from("ticketeria_locais").select("id, nome, cidade, uf, fuso").in("id", idsDosLocais) : { data: [] };
  const local = new Map((locais ?? []).map(l => [l.id, l]));
  const saida: IngressosDoSite = {};
  for (const s of sessoes ?? []) {
    const l = local.get(s.local_id);
    const lista = (saida[s.evento_id] ??= []);
    if (lista.length >= 12) continue;
    const quando = diaEHoraDoEvento(s.inicio, l?.fuso ?? "America/Sao_Paulo");
    lista.push({ id: s.id, quando: quando.charAt(0).toUpperCase() + quando.slice(1), local: [l?.nome, [l?.cidade, l?.uf].filter(Boolean).join("/")].filter(Boolean).join(", "), url: `${origem.replace(/\/$/, "")}/comprar/${s.id}` });
  }
  return saida;
}

/** O site publicado num domínio ativo, ou null. */
async function siteNoAr(admin: Admin, host: string) {
  const dominio = hostDoPedido(host);
  if (dominio === "") return null;
  const ticketeria = clienteDaTicketeria(admin);
  const { data: registro, error } = await ticketeria.from("ticketeria_site_dominios").select("site_id, situacao").eq("dominio", dominio).maybeSingle();
  if (error) throw new Error("não foi possível conferir o domínio");
  if (!registro || registro.situacao !== "ativo") return null;
  const { data: site } = await ticketeria.from("ticketeria_sites").select("id, organization_id, nome, titulo, cor, situacao").eq("id", registro.site_id).maybeSingle();
  if (!site || site.situacao !== "publicado") return null;
  return site;
}

/** A página `slug` do site que está no ar no domínio `host`, ou null. */
export async function paginaPublicaDoDominio(admin: Admin, host: string, slug: string): Promise<SitePublico | null> {
  const site = await siteNoAr(admin, host);
  if (!site) return null;
  const { data: paginas } = await clienteDaTicketeria(admin).from("ticketeria_site_paginas").select("slug, titulo, ordem, blocos_publicados, descricao, imagem_url, publicada_em").eq("site_id", site.id).not("blocos_publicados", "is", null);
  const publicadas = ordemDasPaginas(paginas ?? []);
  const atual = publicadas.find(pagina => pagina.slug === slug);
  if (!atual) return null;
  const blocos = blocosDoJson(atual.blocos_publicados);
  const [organizacao, programacoes, ingressos] = await Promise.all([
    admin.from("organizations").select("nome").eq("id", site.organization_id).maybeSingle(),
    programacoesDosBlocos(admin, site.organization_id, blocos),
    ingressosDosBlocos(admin, site.organization_id, blocos),
  ]);
  return {
    titulo: site.titulo ?? site.nome,
    cor: corDoTema(site.cor),
    organizacao: (organizacao.data as { nome?: string | null } | null)?.nome ?? "",
    menu: publicadas.map(pagina => ({ slug: pagina.slug, titulo: pagina.titulo })),
    pagina: { slug: atual.slug, titulo: atual.titulo, blocos, descricao: atual.descricao, imagem: atual.imagem_url },
    programacoes,
    ingressos,
  };
}

/** As páginas publicadas do site que está no ar no domínio (para o sitemap), ou null se o domínio não tem site no ar. */
export async function paginasPublicadasDoDominio(admin: Admin, host: string): Promise<{ slug: string; publicada_em: string | null }[] | null> {
  const site = await siteNoAr(admin, host);
  if (!site) return null;
  const { data: paginas } = await clienteDaTicketeria(admin).from("ticketeria_site_paginas").select("slug, titulo, ordem, publicada_em").eq("site_id", site.id).not("blocos_publicados", "is", null);
  return ordemDasPaginas(paginas ?? []).map(pagina => ({ slug: pagina.slug, publicada_em: pagina.publicada_em }));
}
