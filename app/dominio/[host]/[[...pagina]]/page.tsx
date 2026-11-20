// O site da loja (Ticketeria), no domínio da própria pessoa (desenho da PD12.1b). Esta rota nunca é aberta pelo endereço do Jards: o proxy.ts reescreve
// para cá o pedido que chega por um domínio que não é do Jards (e recusa o acesso direto a /dominio/...). Sem login: o servidor lê
// só o que está publicado, de um site publicado, num domínio ativo (DNS conferido e posse provada).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventoDoSiteView } from "@/components/ticketeria/EventoDoSiteView";
import { SiteView } from "@/components/ticketeria/SiteView";
import { eventoPublicoDoDominio, paginaPublicaDoDominio, type EventoPublicoDoDominio, type SitePublico } from "@/lib/ticketeria/site-publico";
import { descricaoResumida, enderecoDoEvento } from "@/lib/ticketeria/evento-site";
import { enderecoDaPagina, hostDoPedido } from "@/lib/ticketeria/site";
import { createAdminClient } from "@/lib/supabase/admin";

// O site muda a cada publicação: nunca vem pronto do cache da rota.
export const dynamic = "force-dynamic";

type Parametros = { params: Promise<{ host: string; pagina?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** A página do evento (/e/<slug>) em vez de uma página do site. */
const ehEvento = (pagina?: string[]) => pagina?.length === 2 && pagina[0] === "e";

async function carregarEvento({ params }: Parametros): Promise<EventoPublicoDoDominio | null> {
  const { host, pagina } = await params;
  if (!ehEvento(pagina)) return null;
  try {
    return await eventoPublicoDoDominio(createAdminClient(), decodeURIComponent(host), pagina![1]);
  } catch {
    return null;
  }
}

async function carregar({ params }: Parametros): Promise<SitePublico | null> {
  const { host, pagina } = await params;
  if (pagina && pagina.length > 1) return null;
  try {
    return await paginaPublicaDoDominio(createAdminClient(), decodeURIComponent(host), pagina?.[0] ?? "inicio");
  } catch {
    return null;
  }
}

export async function generateMetadata(entrada: Parametros): Promise<Metadata> {
  if (ehEvento((await entrada.params).pagina)) {
    const dados = await carregarEvento(entrada);
    if (!dados) return { title: "Página não encontrada", robots: { index: false, follow: false } };
    const dominio = hostDoPedido(decodeURIComponent((await entrada.params).host));
    const titulo = `${dados.evento.titulo} · ${dados.titulo}`;
    const endereco = enderecoDoEvento(dominio, dados.evento.slug);
    const descricao = descricaoResumida(dados.evento.descricao) ?? undefined;
    const imagens = dados.evento.imagem && /^https:\/\//.test(dados.evento.imagem) ? [{ url: dados.evento.imagem }] : undefined;
    return {
      title: titulo, description: descricao, alternates: { canonical: endereco },
      openGraph: { type: "website", url: endereco, title: titulo, description: descricao, siteName: dados.titulo, locale: "pt_BR", images: imagens },
      twitter: { card: imagens ? "summary_large_image" : "summary", title: titulo, description: descricao, images: imagens?.map(i => i.url) },
    };
  }
  const site = await carregar(entrada);
  if (!site) return { title: "Página não encontrada", robots: { index: false, follow: false } };
  const { host } = await entrada.params;
  const dominio = hostDoPedido(decodeURIComponent(host));
  const titulo = site.pagina.slug === "inicio" ? site.titulo : `${site.pagina.titulo} · ${site.titulo}`;
  const endereco = enderecoDaPagina(dominio, site.pagina.slug);
  const imagens = site.pagina.imagem ? [{ url: site.pagina.imagem }] : undefined;
  return {
    title: titulo,
    description: site.pagina.descricao ?? undefined,
    alternates: { canonical: endereco },
    openGraph: { type: "website", url: endereco, title: titulo, description: site.pagina.descricao ?? undefined, siteName: site.titulo, locale: "pt_BR", images: imagens },
    twitter: { card: imagens ? "summary_large_image" : "summary", title: titulo, description: site.pagina.descricao ?? undefined, images: imagens?.map(imagem => imagem.url) },
  };
}

export default async function SiteDaPessoa(entrada: Parametros) {
  if (ehEvento((await entrada.params).pagina)) {
    const dados = await carregarEvento(entrada);
    if (!dados) notFound();
    return <EventoDoSiteView dados={dados} host={hostDoPedido(decodeURIComponent((await entrada.params).host))} busca={await entrada.searchParams} />;
  }
  const site = await carregar(entrada);
  if (!site) notFound();
  return <SiteView site={site} base="" />;
}
