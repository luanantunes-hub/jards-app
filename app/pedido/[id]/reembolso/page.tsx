// A página aberta pelo link de confirmação do reembolso (sem login): /pedido/{id}/reembolso?c={código do link}. Mostra o pedido e o valor e só estorna quando a pessoa toca em
// "Confirmar reembolso" (um POST): abrir a página, ou um programa de e-mail que abre o link, não gasta nada. O link é de uso único e vale pouco; link que não vale (não existe, é de
// outro pedido, já foi usado, foi trocado por outro ou venceu) recebe sempre a MESMA tela, numa moldura neutra: não diz se o pedido existe. Fora do índice dos buscadores e sem Referer.

import type { Metadata } from "next";
import { TelaAviso } from "@/components/ticketeria/CompraView";
import { ConfirmarReembolso } from "@/components/ticketeria/ReembolsoDoPedido";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { ehIdDePedido, lerCodigoDoLink, textoDaConfirmacao } from "@/lib/ticketeria/pagamento/reembolso-pagina";
import { verLinkDeReembolso } from "@/lib/ticketeria/pagamento/reembolso-pagina-servidor";
import { siteDaLoja } from "@/lib/ticketeria/vitrine-servidor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmar reembolso", robots: { index: false, follow: false }, referrer: "no-referrer" };

const NEUTRO = { titulo: "Ingressos" };

export default async function PaginaDoReembolso({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ c?: string | string[] }> }) {
  const { id } = await params;
  const { c } = await searchParams;
  const codigo = lerCodigoDoLink(Array.isArray(c) ? c[0] : c);
  const valido = ehIdDePedido(id) && codigo ? await verLinkDeReembolso(id.toLowerCase(), codigo) : null;
  if (!valido || !codigo) {
    const t = textoDaConfirmacao("link_invalido");
    return <TelaAviso site={NEUTRO} titulo={t.titulo} texto={t.texto} />;
  }
  const admin = createAdminClient();
  const pedidoId = id.toLowerCase();
  const { data: pedido } = await clienteDaTicketeria(admin).from("ticketeria_pedidos").select("loja_id").eq("id", pedidoId).maybeSingle();
  const site = pedido ? await siteDaLoja(admin, pedido.loja_id) : NEUTRO;
  const valeAte = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(valido.expira_em)).replace(", ", " às ");
  return <ConfirmarReembolso site={site} pedido={pedidoId} codigoDoLink={codigo} codigo={valido.codigo} totalCentavos={valido.total_centavos} valeAte={valeAte} />;
}
