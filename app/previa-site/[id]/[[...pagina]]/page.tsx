// A prévia do site (rascunho) para quem está logado e edita a Ticketeria da organização. Fora do painel, para o site aparecer
// inteiro, como na casa da pessoa. Lê com as regras de acesso de quem está logado: quem não vê o site recebe "não encontrado".

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteView, type SiteParaDesenhar } from "@/components/ticketeria/SiteView";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { agendaDosBlocos, ingressosDosBlocos, programacoesDosBlocos } from "@/lib/ticketeria/site-publico";
import { blocosDoJson, corDoTema, ordemDasPaginas } from "@/lib/ticketeria/site";
import { lerAparencia } from "@/lib/ticketeria/aparencia";
import { agoraDoServidor } from "@/lib/ticketeria/contagem";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Prévia do site", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PreviaDoSite({ params }: { params: Promise<{ id: string; pagina?: string[] }> }) {
  const { id, pagina } = await params;
  if (!UUID.test(id) || (pagina && pagina.length > 1)) notFound();
  const ticketeria = clienteDaTicketeria(await createClient());
  const { data: site } = await ticketeria.from("ticketeria_sites").select("id, organization_id, loja_id, nome, titulo, cor, tema, aparencia").eq("id", id).maybeSingle();
  if (!site) notFound();
  const { data: pode } = await ticketeria.rpc("auth_ticketeria_pode", { p_org: site.organization_id, p_acao: "editar" });
  if (pode !== true) notFound();
  const { data: paginas } = await ticketeria.from("ticketeria_site_paginas").select("slug, titulo, ordem, blocos").eq("site_id", site.id);
  const ordenadas = ordemDasPaginas(paginas ?? []);
  const atual = ordenadas.find(item => item.slug === (pagina?.[0] ?? "inicio"));
  if (!atual) notFound();
  const blocos = blocosDoJson(atual.blocos);
  const desenho: SiteParaDesenhar = {
    titulo: site.titulo ?? site.nome, cor: corDoTema(site.cor), tema: site.tema,
    menu: ordenadas.map(item => ({ slug: item.slug, titulo: item.titulo })),
    pagina: { slug: atual.slug, titulo: atual.titulo, blocos },
    agora: agoraDoServidor(),
    // Na prévia o botão de ingressos aparece, mas não leva a lugar nenhum: a página do evento só existe no site no ar.
    aparencia: lerAparencia(site.aparencia), caminhoDoPrimeiroEvento: "#",
    programacoes: await programacoesDosBlocos(createAdminClient(), site.organization_id, blocos),
    ingressos: await ingressosDosBlocos(createAdminClient(), site.organization_id, blocos),
    agenda: (await agendaDosBlocos(createAdminClient(), site.loja_id, blocos)) ?? undefined,
  };
  return <SiteView site={desenho} base={`/previa-site/${site.id}`} previa />;
}
