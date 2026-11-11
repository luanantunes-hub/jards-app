// O site de um espaço, no domínio da própria pessoa (PD12.1b). Esta rota nunca é aberta pelo endereço do Jards: o proxy.ts reescreve
// para cá o pedido que chega por um domínio que não é do Jards (e recusa o acesso direto a /dominio/...). Sem login: o servidor lê
// só o que está publicado, de um site publicado, num domínio ativo (DNS conferido e posse provada).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteView } from "@/components/producao/SiteView";
import { paginaPublicaDoDominio, type SitePublico } from "@/lib/producao/site-publico";
import { createAdminClient } from "@/lib/supabase/admin";

// O site muda a cada publicação: nunca vem pronto do cache da rota.
export const dynamic = "force-dynamic";

type Parametros = { params: Promise<{ host: string; pagina?: string[] }> };

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
  const site = await carregar(entrada);
  if (!site) return { title: "Página não encontrada", robots: { index: false, follow: false } };
  return { title: site.pagina.slug === "inicio" ? site.titulo : `${site.pagina.titulo} · ${site.titulo}` };
}

export default async function SiteDaPessoa(entrada: Parametros) {
  const site = await carregar(entrada);
  if (!site) notFound();
  return <SiteView site={site} base="" />;
}
