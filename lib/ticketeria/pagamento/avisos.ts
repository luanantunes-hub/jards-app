// Os avisos do provedor (webhooks), processados de forma idempotente (T4). O fluxo: conferir a assinatura (o provedor), registrar o
// aviso pelo id externo (o mesmo aviso de novo não faz nada), e, no pagamento confirmado, confirmar o pedido no banco
// (fn_ticketeria_confirmar_pagamento, que também é idempotente e grava o razão). As portas para o banco são injetadas: a lógica é
// testada sem banco (tests/ticketeria-pagamento.test.ts) e a porta de verdade é a do Supabase com a chave de serviço (T5 liga a rota).

import type { ProvedorDePagamento } from "@/lib/ticketeria/pagamento/provedor";

export type PortasDosAvisos = {
  /**
   * Grava o aviso (único por provedor e id externo). 'ja_processado' se ele já chegou E foi processado até o fim; o que chegou e
   * não terminou (o banco caiu no meio) volta como 'novo', para o reenvio do provedor terminar o serviço.
   */
  registrar(aviso: { provedor: string; id_externo: string; tipo: string; pedido_id: string; payload: unknown }): Promise<"novo" | "ja_processado">;
  /** fn_ticketeria_confirmar_pagamento_real: 'pago' ou 'ja_pago'; erro com a mensagem do banco. `liquidoCentavos` é o que o provedor deixou depois das taxas (null: vale a estimativa). */
  confirmar(pedidoId: string, provedor: string, ref: string, valorCentavos: number, liquidoCentavos: number | null): Promise<string>;
  /** Anota o resultado e a hora do processamento. */
  concluir(provedor: string, idExterno: string, resultado: string): Promise<void>;
  /** Depois que o pedido ficou pago (ou já estava): o que vem a seguir, como mandar os ingressos por e-mail. Falha aqui NÃO desfaz nem reprova o aviso. */
  aposPagamento?(pedidoId: string): Promise<void>;
};

export type ResultadoDoAviso =
  | { status: 401; resultado: "assinatura_invalida" }
  | { status: 400; resultado: "corpo_invalido" }
  | { status: 200; resultado: "repetido" | "pago" | "ja_pago" | "ignorado" | "estornar"; pedido_id?: string; motivo?: string };

/** Erros do banco que pedem o estorno do que o comprador pagou (o pedido não pode virar pago). */
const PEDEM_ESTORNO = ["reserva_expirada_sem_lugar", "pedido_cancelado", "valor_divergente", "liquido_invalido"];

export async function processarAviso(provedor: ProvedorDePagamento, portas: PortasDosAvisos, corpo: string, assinatura: string | null): Promise<ResultadoDoAviso> {
  const leitura = provedor.lerAviso(corpo, assinatura);
  if (!leitura.ok) {
    if (leitura.motivo === "assinatura_invalida") return { status: 401, resultado: "assinatura_invalida" };
    // Aviso verdadeiro que não é de um pedido nosso ou não muda nada: responde 200 (senão o provedor o reenvia sem fim) e não grava.
    if (leitura.motivo === "evento_irrelevante") return { status: 200, resultado: "ignorado" };
    return { status: 400, resultado: "corpo_invalido" };
  }
  const { aviso } = leitura;
  const registro = await portas.registrar({ provedor: provedor.nome, id_externo: aviso.id_externo, tipo: aviso.tipo, pedido_id: aviso.pedido_id, payload: JSON.parse(corpo) });
  if (registro === "ja_processado") return { status: 200, resultado: "repetido", pedido_id: aviso.pedido_id };
  if (aviso.tipo !== "pagamento_confirmado") {
    // Recusa e estorno chegam registrados; o que fazer com eles é da T7 (reembolso e conciliação diária).
    await portas.concluir(provedor.nome, aviso.id_externo, "ignorado");
    return { status: 200, resultado: "ignorado", pedido_id: aviso.pedido_id };
  }
  try {
    const situacao = await portas.confirmar(aviso.pedido_id, provedor.nome, aviso.ref, aviso.valor_centavos, aviso.liquido_centavos ?? null);
    const resultado = situacao === "ja_pago" ? "ja_pago" : "pago";
    await portas.concluir(provedor.nome, aviso.id_externo, resultado);
    // O pagamento está gravado: o e-mail dos ingressos é uma segunda etapa e não pode derrubar o aviso (o envio guarda a vaga e se refaz sozinho).
    try { await portas.aposPagamento?.(aviso.pedido_id); } catch { /* o próprio envio registra o erro */ }
    return { status: 200, resultado, pedido_id: aviso.pedido_id };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    const motivo = PEDEM_ESTORNO.find(nome => mensagem.includes(nome));
    if (motivo) {
      // O comprador pagou, mas o pedido não pode virar pago: o dinheiro volta (o provedor estorna). O aviso fica respondido (200),
      // senão o provedor o mandaria de novo sem fim.
      await provedor.estornar(aviso.ref, aviso.valor_centavos);
      await portas.concluir(provedor.nome, aviso.id_externo, `estornar: ${motivo}`);
      return { status: 200, resultado: "estornar", pedido_id: aviso.pedido_id, motivo };
    }
    throw erro; // falha passageira (banco fora do ar): sem resposta 200, o provedor manda de novo, e o aviso sem conclusão é reprocessado
  }
}
