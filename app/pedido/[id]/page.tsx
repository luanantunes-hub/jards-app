// Os ingressos de um pedido (sem login): /pedido/{id}. O id é um UUID sorteado: quem tem o link vê. Pago: os ingressos com QR Code. Ainda não pago: o aviso, que
// se atualiza sozinho quando o pagamento cai. Fora do índice dos buscadores e sem cache.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AtualizarQuandoPagar } from "@/components/ticketeria/AtualizarQuandoPagar";
import { TelaAviso, TelaIngressos, type ReembolsoDaPagina } from "@/components/ticketeria/CompraView";
import { PedirReembolso } from "@/components/ticketeria/ReembolsoDoPedido";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaTicketeria } from "@/lib/ticketeria/cliente";
import { diaEHoraDoEvento, type IngressosDoPedido } from "@/lib/ticketeria/pagamento/ingressos";
import { emailMascarado, podePedirReembolsoNaPagina } from "@/lib/ticketeria/pagamento/reembolso-pagina";
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
  const { data: pedido } = await t.from("ticketeria_pedidos").select("loja_id, situacao, meio, pago_em, reembolsado_em, total_centavos, provedor, comprador_email").eq("id", pedidoId).maybeSingle();
  if (!pedido) notFound();
  const site = await siteDaLoja(admin, pedido.loja_id);
  if (pedido.situacao !== "pago") {
    return (
      <>
        <AtualizarQuandoPagar pedido={pedidoId} />
        <TelaAviso site={site} titulo={pedido.situacao === "cancelado" ? "Este pedido foi cancelado" : pedido.meio === "cartao" ? "Ainda não vimos a aprovação" : "Ainda não vimos o pagamento"} texto={pedido.situacao === "cancelado" ? "Não há ingressos neste pedido." : pedido.meio === "cartao" ? "O pagamento no cartão pode levar alguns minutos para ser aprovado. Assim que for, esta página mostra os seus ingressos sozinha. Se você já pagou, aguarde um instante." : "Assim que o Pix cair, esta página mostra os seus ingressos sozinha. Se você já pagou, aguarde alguns instantes."} />
      </>
    );
  }
  const { data } = await t.rpc("fn_ticketeria_ingressos_do_pedido", { p_pedido: pedidoId });
  const dados = data as IngressosDoPedido | null;
  if (!dados) notFound();
  const quando = diaEHoraDoEvento(dados.inicio, dados.fuso);
  // O reembolso: pedir pela página (o botão manda um link ao e-mail da compra; o estorno só sai quando a pessoa confirma). O servidor confere tudo de novo ao pedir.
  const ingressoUsado = dados.ingressos.some(i => i.usado && !i.cancelado);
  const pode = podePedirReembolsoNaPagina({ situacao: pedido.situacao, pago_em: pedido.pago_em, reembolsado_em: pedido.reembolsado_em, total_centavos: pedido.total_centavos, provedor: pedido.provedor, ingresso_usado: ingressoUsado }, new Date());
  const passouDoPrazo = !pode && !ingressoUsado && !!pedido.pago_em && pedido.provedor === "asaas" && pedido.total_centavos > 0;
  const reembolso: ReembolsoDaPagina = pode ? { estado: "pode", acao: <PedirReembolso pedido={pedidoId} codigo={dados.codigo} emailMascarado={emailMascarado(pedido.comprador_email)} /> } : passouDoPrazo ? { estado: "prazo_passou" } : { estado: "indisponivel" };
  return (
    <TelaIngressos
      site={site}
      evento={{ titulo: dados.evento, quando: quando.charAt(0).toUpperCase() + quando.slice(1), local: [dados.local, [dados.cidade, dados.uf].filter(Boolean).join("/")].filter(Boolean).join(", ") }}
      comprador={dados.comprador_nome.split(" ")[0]}
      pedido={dados.codigo}
      ingressos={dados.ingressos.map(i => ({ codigo: i.codigo, nome: i.nome, assento: i.assento ?? null, usado: i.usado, cancelado: i.cancelado }))}
      emailDeReembolso={process.env.TICKETERIA_EMAIL_DE_REEMBOLSO || "luan.antunes@jards.com.br"}
      reembolso={reembolso}
    />
  );
}
