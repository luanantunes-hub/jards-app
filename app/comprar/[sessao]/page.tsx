// A página de compra de uma sessão (sem login): /comprar/{sessao}. O servidor lê a vitrine com a chave de serviço (só o que se pode mostrar) e entrega para a
// compra no navegador. Estados que não vendem (não publicado, cancelada, encerrada, vendas pausadas) mostram o aviso. Fora do índice dos buscadores.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompraDaSessao } from "@/components/ticketeria/CompraDaSessao";
import { TelaAviso } from "@/components/ticketeria/CompraView";
import { createAdminClient } from "@/lib/supabase/admin";
import { cupomDaBusca } from "@/lib/ticketeria/evento-site";
import { vitrineDaSessao } from "@/lib/ticketeria/vitrine-servidor";
import { AVISO_DO_ESTADO } from "@/lib/ticketeria/vitrine";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Parametros = { params: Promise<{ sessao: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function carregar({ params }: Parametros) {
  const { sessao } = await params;
  if (!UUID.test(sessao)) return null;
  try { return await vitrineDaSessao(createAdminClient(), sessao.toLowerCase()); } catch { return null; }
}

export async function generateMetadata(entrada: Parametros): Promise<Metadata> {
  const v = await carregar(entrada);
  return { title: v ? `Ingressos: ${v.evento.titulo}` : "Ingressos", robots: { index: false, follow: false } };
}

export default async function ComprarIngressos(entrada: Parametros) {
  const vitrine = await carregar(entrada);
  if (!vitrine) notFound();
  if (vitrine.estado !== "aberta") return <TelaAviso site={vitrine.site} {...AVISO_DO_ESTADO[vitrine.estado]} />;
  // O cupom do link de divulgação (`?cupom=VERAO`): a compra o confere e aplica sozinha, e mostra o aviso se não vale.
  return <CompraDaSessao vitrine={vitrine} cupomInicial={cupomDaBusca(await entrada.searchParams)} />;
}
