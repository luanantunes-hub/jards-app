// A prévia do site (rascunho) para quem está logado e edita a produção. Fora do painel, para o site aparecer inteiro, como na
// casa da pessoa. Lê com as regras de acesso de quem está logado: quem não vê o site recebe "não encontrado".

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteView, type SiteParaDesenhar } from "@/components/producao/SiteView";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diasDaProgramacaoDoEspaco } from "@/lib/producao/programacao-publica";
import { blocosDoJson, corDoTema, ordemDasPaginas } from "@/lib/producao/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Prévia do site", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PreviaDoSite({ params }: { params: Promise<{ id: string; pagina?: string[] }> }) {
  const { id, pagina } = await params;
  if (!UUID.test(id) || (pagina && pagina.length > 1)) notFound();
  const producao = clienteDaProducao(await createClient());
  const { data: site } = await producao.from("producao_sites").select("id, organization_id, espaco_id, nome, titulo, cor").eq("id", id).maybeSingle();
  if (!site) notFound();
  const { data: pode } = await producao.rpc("auth_producao_pode", { p_org: site.organization_id, p_acao: "editar" });
  if (pode !== true) notFound();
  const { data: paginas } = await producao.from("producao_site_paginas").select("slug, titulo, ordem, blocos").eq("site_id", site.id);
  const ordenadas = ordemDasPaginas(paginas ?? []);
  const atual = ordenadas.find(item => item.slug === (pagina?.[0] ?? "inicio"));
  if (!atual) notFound();
  const blocos = blocosDoJson(atual.blocos);
  const [{ data: espaco }, dias] = await Promise.all([
    producao.from("producao_espacos").select("nome").eq("id", site.espaco_id).maybeSingle(),
    blocos.some(bloco => bloco.tipo === "programacao") ? diasDaProgramacaoDoEspaco(createAdminClient(), site.espaco_id) : Promise.resolve(null),
  ]);
  const desenho: SiteParaDesenhar = {
    titulo: site.titulo ?? site.nome, cor: corDoTema(site.cor), espaco: espaco?.nome ?? "",
    menu: ordenadas.map(item => ({ slug: item.slug, titulo: item.titulo })),
    pagina: { slug: atual.slug, titulo: atual.titulo, blocos }, programacao: dias ? dias.dias : null,
  };
  return <SiteView site={desenho} base={`/previa-site/${site.id}`} previa />;
}
