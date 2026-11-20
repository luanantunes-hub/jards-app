// As listas e os limites dos webhooks que a TELA também usa. Sem nenhum import de servidor ou de "node:": roda no navegador (o resto da lógica, com assinatura e conferência de endereço, está em webhooks.ts e não vai para o navegador).

export const EVENTOS_DO_WEBHOOK = ["pedido.pago", "pedido.reembolsado", "ingresso.lido", "sessao.cancelada"] as const;
export type EventoDoWebhook = (typeof EVENTOS_DO_WEBHOOK)[number];

export const ROTULO_DO_EVENTO: Record<EventoDoWebhook, string> = {
  "pedido.pago": "Venda paga", "pedido.reembolsado": "Reembolso", "ingresso.lido": "Ingresso lido na porta", "sessao.cancelada": "Sessão cancelada",
};

export const MAX_WEBHOOKS_POR_LOJA = 5;
/** Quantas tentativas cada aviso tem (a sexta falha encerra); a espera entre elas está no banco. */
export const MAX_TENTATIVAS = 6;
