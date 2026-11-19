// A compra de ingressos pelo Pix (passo C1 da T5), do lado do servidor: confere o que o comprador mandou, reserva os lugares, abre a cobrança Pix
// NA SUBCONTA do produtor com a comissão do Jards dividida para a carteira do Jards (D3, D13, D14) e devolve o "copia e cola". As portas (banco e
// Asaas) são injetadas: a lógica é testada sem rede e sem banco (tests/ticketeria-compra.test.ts).
//
// O CPF ou CNPJ do comprador é repassado ao Asaas e NÃO é guardado (D17: o Asaas exige, o Jards não precisa guardar).
// Quem paga é o comprador, e paga só o preço (D14): o custo do meio e a comissão saem do valor do produtor.

import { mensagemDoErroDaReserva, type PedidoReservado } from "@/lib/ticketeria/pagamento/reserva";
import type { ProvedorDePagamento } from "@/lib/ticketeria/pagamento/provedor";
import { VERSAO_DOS_TERMOS_DE_COMPRA } from "@/lib/ticketeria/termos-de-compra";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_ITENS_POR_COMPRA = 10;
export const MAX_QUANTIDADE_POR_ITEM = 20;
export const MINUTOS_DE_RESERVA = 15;

export type ItemDaCompra = { ingresso_id: string; quantidade: number };
/** `termos` é a versão dos Termos de compra que o comprador aceitou: precisa ser a atual (lib/ticketeria/termos-de-compra.ts). */
export type CorpoDaCompra = { sessao_id: string; itens: ItemDaCompra[]; nome: string; email: string; documento: string; termos: string };

/** CPF (11) ou CNPJ (14) com os dígitos verificadores certos; só os números. */
export function documentoValido(bruto: string): boolean {
  const d = (bruto ?? "").replace(/\D/g, "");
  if (/^(\d)\1+$/.test(d)) return false;
  const digito = (base: string, pesos: number[]) => {
    const soma = [...base].reduce((acc, n, i) => acc + Number(n) * pesos[i], 0) % 11;
    return soma < 2 ? 0 : 11 - soma;
  };
  if (d.length === 11) return digito(d.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[9]) && digito(d.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[10]);
  if (d.length === 14) {
    const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    return digito(d.slice(0, 12), p1) === Number(d[12]) && digito(d.slice(0, 13), [6, ...p1]) === Number(d[13]);
  }
  return false;
}

export type LeituraDaCompra = { ok: true; corpo: CorpoDaCompra } | { ok: false; problemas: string[] };

/** O corpo do pedido HTTP, conferido. Nada aqui vem confiável: tudo é lido de novo e aparado. */
export function lerCorpoDaCompra(entrada: unknown): LeituraDaCompra {
  const e = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
  const problemas: string[] = [];
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const sessao = texto(e.sessao_id);
  if (!UUID.test(sessao)) problemas.push("sessão");
  const itens: ItemDaCompra[] = [];
  if (!Array.isArray(e.itens) || e.itens.length === 0 || e.itens.length > MAX_ITENS_POR_COMPRA) problemas.push("ingressos");
  else {
    const vistos = new Set<string>();
    for (const bruto of e.itens) {
      const i = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
      const id = texto(i.ingresso_id);
      const q = i.quantidade;
      if (!UUID.test(id) || vistos.has(id.toLowerCase()) || typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > MAX_QUANTIDADE_POR_ITEM) { problemas.push("ingressos"); break; }
      vistos.add(id.toLowerCase());
      itens.push({ ingresso_id: id.toLowerCase(), quantidade: q });
    }
  }
  const nome = texto(e.nome).replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 120) problemas.push("nome");
  const email = texto(e.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) problemas.push("e-mail");
  const documento = texto(e.documento).replace(/\D/g, "");
  if (!documentoValido(documento)) problemas.push("CPF ou CNPJ");
  if (texto(e.termos) !== VERSAO_DOS_TERMOS_DE_COMPRA) problemas.push("aceite dos Termos de compra");
  if (problemas.length > 0) return { ok: false, problemas };
  return { ok: true, corpo: { sessao_id: sessao.toLowerCase(), itens, nome, email, documento, termos: VERSAO_DOS_TERMOS_DE_COMPRA } };
}

/** O que o comprador precisa entender quando a compra não segue. */
export class ErroDaCompra extends Error {
  constructor(readonly codigo: "vendas_indisponiveis" | "reserva_recusada" | "cobranca_falhou" | "meio_indisponivel", readonly mensagem: string) {
    super(codigo);
    this.name = "ErroDaCompra";
  }
}

export type PortasDaCompra = {
  /** A conta de recebimento da loja da sessão: a chave da subconta e se está aprovada. Nulo se a sessão não existe ou a loja não tem conta. */
  contaDaSessao(sessao: string): Promise<{ chave: string; aprovada: boolean } | null>;
  /** fn_ticketeria_reservar. Os erros do banco saem como ErroDaCompra("reserva_recusada") com a frase para o comprador. */
  reservar(corpo: CorpoDaCompra, minutos: number): Promise<PedidoReservado>;
  /** fn_ticketeria_registrar_aceite: o pedido guarda a versão dos Termos aceita e a hora. Falhar aqui falha a compra (sem aceite gravado, não há cobrança). */
  registrarAceite(pedido: string, versao: string): Promise<void>;
  /** fn_ticketeria_definir_meio (Pix). */
  definirMeioPix(pedido: string): Promise<void>;
  /** O provedor que abre a cobrança na subconta (com a chave dela). */
  provedor(chaveDaSubconta: string): ProvedorDePagamento;
  /** A carteira do Jards no provedor, para onde vai a comissão. Nulo se não configurada. */
  carteiraDoJards: string | null;
  registrarErro?(erro: unknown): void;
  /** Depois que o pedido já nasceu pago (gratuito): como mandar os ingressos por e-mail. Falha aqui não derruba a compra. */
  aposPagamento?(pedido: string): Promise<void>;
};

export type CompraIniciada =
  | { situacao: "pago"; pedido_id: string; codigo: string; total_centavos: 0 }
  | { situacao: "aguardando_pagamento"; pedido_id: string; codigo: string; total_centavos: number; reservado_ate: string; pix_copia_e_cola: string };

export async function iniciarCompra(corpo: CorpoDaCompra, portas: PortasDaCompra): Promise<CompraIniciada> {
  const conta = await portas.contaDaSessao(corpo.sessao_id);
  if (!conta || !conta.aprovada) throw new ErroDaCompra("vendas_indisponiveis", "As vendas deste evento estão pausadas. Tente mais tarde.");

  // Sem a carteira do Jards a comissão não tem para onde ir: nem reserva (nada fica preso).
  if (!portas.carteiraDoJards) {
    portas.registrarErro?.(new Error("carteira do Jards não configurada (ASAAS_WALLET_JARDS): a comissão não tem para onde ir"));
    throw new ErroDaCompra("vendas_indisponiveis", "As vendas deste evento estão pausadas. Tente mais tarde.");
  }
  const pedido = await portas.reservar(corpo, MINUTOS_DE_RESERVA);
  await portas.registrarAceite(pedido.pedido_id, corpo.termos);
  // Gratuito: o banco já o marca como pago, sem cobrança.
  if (pedido.situacao === "pago") {
    try { await portas.aposPagamento?.(pedido.pedido_id); } catch (erro) { portas.registrarErro?.(erro); }
    return { situacao: "pago", pedido_id: pedido.pedido_id, codigo: pedido.codigo, total_centavos: 0 };
  }

  try {
    await portas.definirMeioPix(pedido.pedido_id);
  } catch (erro) {
    portas.registrarErro?.(erro);
    throw new ErroDaCompra("meio_indisponivel", "Não foi possível abrir o pagamento. Tente de novo.");
  }
  try {
    const cobranca = await portas.provedor(conta.chave).criarCobranca({
      id: pedido.pedido_id, codigo: pedido.codigo, total_centavos: pedido.total_centavos, expira_em: pedido.reservado_ate,
      comprador_nome: corpo.nome, comprador_email: corpo.email, comprador_documento: corpo.documento,
      ...(pedido.taxa_centavos > 0 && portas.carteiraDoJards ? { split: [{ carteira: portas.carteiraDoJards, valor_centavos: pedido.taxa_centavos }] } : {}),
    });
    if (!cobranca.pix_copia_e_cola) throw new Error("a cobrança nasceu sem o copia e cola do Pix");
    return { situacao: "aguardando_pagamento", pedido_id: pedido.pedido_id, codigo: pedido.codigo, total_centavos: pedido.total_centavos, reservado_ate: pedido.reservado_ate, pix_copia_e_cola: cobranca.pix_copia_e_cola };
  } catch (erro) {
    // A reserva vence sozinha em 15 minutos e devolve os lugares; o comprador pode tentar de novo.
    portas.registrarErro?.(erro);
    throw new ErroDaCompra("cobranca_falhou", "Não foi possível gerar o Pix agora. Tente de novo em instantes.");
  }
}

export { mensagemDoErroDaReserva };

/** A situação do pedido como o comprador a vê: reserva vencida sem pagamento é "expirada" (o banco só a marca quando alguém precisa do lugar). */
export function situacaoParaOComprador(situacao: string, reservadoAte: string, agora: Date = new Date()): "aguardando_pagamento" | "pago" | "expirada" | "cancelada" | "outra" {
  if (situacao === "pago") return "pago";
  if (situacao === "cancelado") return "cancelada";
  if (situacao === "aguardando_pagamento") return new Date(reservadoAte).getTime() <= agora.getTime() ? "expirada" : "aguardando_pagamento";
  return "outra";
}
