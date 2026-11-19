// Os ingressos de um pedido (sem login): /pedido/{id}. O id é um UUID sorteado: quem tem o link vê. Pago: os ingressos com QR Code. Ainda não pago: o aviso, que
// se atualiza sozinho quando o pagamento cai. Fora do índice dos buscadores e sem cache.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AtualizarQuandoPagar } from "@/components/ticketeria/AtualizarQuandoPagar";
import { TelaAviso, TelaIngressos } from "@/components/ticketeria/CompraView";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaEHoraDoEvento, type IngressosDoPedido } from "@/lib/ticketeria/pagamento/ingressos";
import { siteDaLoja } from "@/lib/ticketeria/vitrine-servidor";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const metadata: Metadata = { title: "Seus ingressos", robots: { index: false, follow: false } };

export default async function PaginaDoPedido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const admin = createAdminClient();
  const t = clienteDaTicketeria(admin);
  const pedidoId = id.toLowerCase();
  const { data: pedido } = await t.from("ticketeria_pedidos").select("loja_id, situacao").eq("id", pedidoId).maybeSingle();
  if (!pedido) notFound();
  const site = await siteDaLoja(admin, pedido.loja_id);
  if (pedido.situacao !== "pago") {
    return (
      <>
        <AtualizarQuandoPagar pedido={pedidoId} />
        <TelaAviso site={site} titulo={pedido.situacao === "cancelado" ? "Este pedido foi cancelado" : "Ainda não vimos o pagamento"} texto={pedido.situacao === "cancelado" ? "Não há ingressos neste pedido." : "Assim que o Pix cair, esta página mostra os seus ingressos sozinha. Se você já pagou, aguarde alguns instantes."} />
      </>
    );
  }
  const { data } = await t.rpc("fn_ticketeria_ingressos_do_pedido", { p_pedido: pedidoId });
  const dados = data as IngressosDoPedido | null;
  if (!dados) notFound();
  const quando = diaEHoraDoEvento(dados.inicio, dados.fuso);
  return (
    <TelaIngressos
      site={site}
      evento={{ titulo: dados.evento, quando: quando.charAt(0).toUpperCase() + quando.slice(1), local: [dados.local, [dados.cidade, dados.uf].filter(Boolean).join("/")].filter(Boolean).join(", ") }}
      comprador={dados.comprador_nome.split(" ")[0]}
      pedido={dados.codigo}
      ingressos={dados.ingressos.map(i => ({ codigo: i.codigo, nome: i.nome, usado: i.usado, cancelado: i.cancelado }))}
      emailDeReembolso={process.env.TICKETERIA_EMAIL_DE_REEMBOLSO || "luan.antunes@jards.com.br"}
    />
  );
}
