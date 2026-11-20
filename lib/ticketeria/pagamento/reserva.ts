// A reserva de um pedido (T4), do lado do servidor: chama fn_ticketeria_reservar com a chave de serviço e traduz a resposta e os
// erros para a página de compra (T5). O banco decide tudo (lote da vez, estoque, taxa, limite); aqui só se lê e se explica.

import { mensagemDoErroDoCupom } from "@/lib/ticketeria/cupom";
import type { SituacaoDoPedido } from "@/lib/ticketeria/estados";

export type PedidoReservado = {
  pedido_id: string; codigo: string; situacao: SituacaoDoPedido; reservado_ate: string;
  total_centavos: number; taxa_centavos: number; produtor_centavos: number;
};

/** A resposta de fn_ticketeria_reservar, conferida; null se veio algo que não se entende. */
export function lerPedidoReservado(resposta: unknown): PedidoReservado | null {
  const r = (resposta && typeof resposta === "object" ? resposta : {}) as Record<string, unknown>;
  const numero = (valor: unknown) => (typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0 ? valor : null);
  const [total, taxa, produtor] = [numero(r.total_centavos), numero(r.taxa_centavos), numero(r.produtor_centavos)];
  if (typeof r.pedido_id !== "string" || typeof r.codigo !== "string" || typeof r.reservado_ate !== "string") return null;
  if (r.situacao !== "aguardando_pagamento" && r.situacao !== "pago") return null;
  if (total === null || taxa === null || produtor === null || total !== taxa + produtor) return null;
  return { pedido_id: r.pedido_id, codigo: r.codigo, situacao: r.situacao, reservado_ate: r.reservado_ate, total_centavos: total, taxa_centavos: taxa, produtor_centavos: produtor };
}

/** O erro da reserva numa frase para o comprador. */
export function mensagemDoErroDaReserva(erro: { message?: string }): string {
  const m = erro.message ?? "";
  const cupom = mensagemDoErroDoCupom(m);
  if (cupom) return cupom;
  if (m.includes("lugar_ocupado")) return "Alguém acabou de escolher um desses lugares. Escolha de novo.";
  if (m.includes("lugar_indisponivel")) return "Um desses lugares não está mais à venda. Escolha de novo.";
  if (m.includes("lugares_obrigatorios")) return "Escolha os lugares no mapa.";
  if (m.includes("lugares_quantidade") || m.includes("lugares_invalidos") || m.includes("ingresso_sem_mapa")) return "Escolha os lugares de novo.";
  if (m.includes("esgotado")) return "Não há mais lugares nesta quantidade. Escolha menos ingressos ou outra sessão.";
  if (m.includes("sessao_indisponivel")) return "Esta sessão não está mais à venda.";
  if (m.includes("evento_nao_publicado")) return "Este evento ainda não está à venda.";
  if (m.includes("limite_por_pedido")) return "Essa quantidade passa do limite por pedido.";
  if (m.includes("ingresso_indisponivel") || m.includes("ingresso_de_outro_local")) return "Esse ingresso não está à venda nesta sessão.";
  if (m.includes("comprador_invalido")) return "Confira o nome e o e-mail.";
  if (m.includes("itens_invalidos")) return "Escolha os ingressos de novo.";
  return "Não foi possível reservar agora. Tente de novo em instantes.";
}
