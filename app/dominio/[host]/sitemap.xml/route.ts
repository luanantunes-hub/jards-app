// O sitemap.xml do site no domínio da pessoa: as páginas publicadas (com a data da última publicação) e as páginas dos eventos publicados.

import { createAdminClient } from "@/lib/supabase/admin";
import { eventosPublicadosDoDominio, paginasPublicadasDoDominio } from "@/lib/ticketeria/site-publico";
import { hostDoPedido, sitemapDoSite } from "@/lib/ticketeria/site";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, rota: { params: Promise<{ host: string }> }) {
  const host = hostDoPedido(decodeURIComponent((await rota.params).host));
  let paginas: Awaited<ReturnType<typeof paginasPublicadasDoDominio>> = null;
  let eventos: Awaited<ReturnType<typeof eventosPublicadosDoDominio>> = null;
  try {
    const admin = createAdminClient();
    paginas = await paginasPublicadasDoDominio(admin, host);
    eventos = await eventosPublicadosDoDominio(admin, host);
  } catch {
    paginas = null;
  }
  if (!paginas) return new Response("Não encontrado", { status: 404 });
  return new Response(sitemapDoSite(host, paginas, eventos ?? []), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
}
