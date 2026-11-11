// O robots.txt do site no domínio da pessoa: libera tudo e aponta o sitemap quando o site está no ar; fecha para os buscadores quando não.

import { createAdminClient } from "@/lib/supabase/admin";
import { paginasPublicadasDoDominio } from "@/lib/producao/site-publico";
import { hostDoPedido, robotsDoSite } from "@/lib/producao/site";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, rota: { params: Promise<{ host: string }> }) {
  const host = hostDoPedido(decodeURIComponent((await rota.params).host));
  let noAr = false;
  try {
    noAr = (await paginasPublicadasDoDominio(createAdminClient(), host)) !== null;
  } catch {
    noAr = false;
  }
  return new Response(robotsDoSite(host, noAr), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}
