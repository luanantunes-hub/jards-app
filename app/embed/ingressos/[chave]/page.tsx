// Os ingressos da loja para embutir em outro site (iframe), pelo widget `/widget/ingressos.js`. É das poucas páginas que o navegador deixa abrir dentro de outro site (veja next.config.ts).
// Só dados públicos; chave que não vale mostra a mesma frase. A compra abre em outra aba, na página do Jards.

import type { Metadata } from "next";
import { IngressosEmbutidos } from "@/components/ticketeria/IngressosEmbutidos";
import { AjustarAltura } from "@/components/ticketeria/AjustarAltura";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/email/config";
import { UUID } from "@/lib/ticketeria/integracao";
import { eventosDaLoja, lojaDaChavePublica } from "@/lib/ticketeria/integracao-servidor";
import type { ListaDeEventosNaApi } from "@/lib/ticketeria/integracao";

export const metadata: Metadata = { title: "Ingressos", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function IngressosParaEmbutir({ params, searchParams }: { params: Promise<{ chave: string }>; searchParams: Promise<{ evento?: string | string[] }> }) {
  const { chave } = await params;
  const { evento } = await searchParams;
  const eventoId = typeof evento === "string" && UUID.test(evento) ? evento.toLowerCase() : null;
  let lista: ListaDeEventosNaApi | null = null;
  try {
    const admin = createAdminClient();
    const loja = await lojaDaChavePublica(admin, chave);
    lista = loja ? await eventosDaLoja(admin, loja.loja_id, appUrl()) : null;
  } catch {
    lista = null;
  }
  return (
    <main className="bg-transparent">
      <style>{"html,body{background:transparent!important}"}</style>
      {lista ? <IngressosEmbutidos lista={lista} eventoId={eventoId} /> : <p className="px-1 py-2 text-[0.8125rem] text-black/55">Ingressos indisponíveis no momento.</p>}
      <AjustarAltura />
    </main>
  );
}
