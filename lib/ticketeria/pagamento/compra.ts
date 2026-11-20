// A compra de ingressos pelo Pix (passo C1 da T5), do lado do servidor: confere o que o comprador mandou, reserva os lugares, abre a cobrança Pix
// NA SUBCONTA do produtor com a comissão do Jards dividida para a carteira do Jards (D3, D13, D14) e devolve o "copia e cola". As portas (banco e
// Asaas) são injetadas: a lógica é testada sem rede e sem banco (tests/ticketeria-compra.test.ts).
//
// O CPF ou CNPJ do comprador é repassado ao Asaas e NÃO é guardado (D17: o Asaas exige, o Jards não precisa guardar).
// Quem paga é o comprador, e paga só o preço (D14): o custo do meio e a comissão saem do valor do produtor.

import { mensagemDoErroDaReserva, type PedidoReservado } from "@/lib/ticketeria/pagamento/reserva";
import type { ProvedorDePagamento } from "@/lib/ticketeria/pagamento/provedor";
import { VERSAO_DOS_TERMOS_DE_COMPRA } from "@/lib/ticketeria/termos-de-compra";
import { codigoDoCupomValido, normalizarCodigo } from "@/lib/ticketeria/cupom";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_ITENS_POR_COMPRA = 10;
export const MAX_QUANTIDADE_POR_ITEM = 20;
export const MINUTOS_DE_RESERVA = 15;
/** Até quantas parcelas a plataforma deixa oferecer. O parcelamento NÃO está liberado: o Asaas manda um aviso por parcela e o processamento do aviso ainda não os soma (o valor do aviso não bateria com o total do pedido). Liberar só depois de provar no sandbox. */
export const PARCELAMENTO_LIBERADO = false;
export const MAX_PARCELAS = 6;
export type MeioDaCompra = "pix" | "cartao";

export type ItemDaCompra = { ingresso_id: string; quantidade: number };
/** Os lugares escolhidos no mapa para um ingresso de setor numerado (um lugar por ingresso comprado). */
export type LugaresDoIngresso = { ingresso_id: string; assentos: { fileira: string; numero: number }[] };
/** `termos` é a versão dos Termos de compra que o comprador aceitou: precisa ser a atual (lib/ticketeria/termos-de-compra.ts). `cupom` é o código do cupom de desconto, em maiúsculas, ou null. */
export type CorpoDaCompra = { sessao_id: string; itens: ItemDaCompra[]; nome: string; email: string; documento: string; termos: string; meio: MeioDaCompra; parcelas: number; cupom: string | null; lugares: LugaresDoIngresso[] };

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

/** Os lugares do pedido, conferidos: cada ingresso do pedido aparece no máximo uma vez, com tantos lugares quanto ingressos, e nenhum lugar se repete. Nulo se estiver fora do formato. */
function lerLugares(bruto: unknown, itens: readonly ItemDaCompra[]): LugaresDoIngresso[] | null {
  if (bruto === undefined || bruto === null) return [];
  if (!Array.isArray(bruto) || bruto.length > MAX_ITENS_POR_COMPRA) return null;
  const saida: LugaresDoIngresso[] = [];
  const ingressos = new Set<string>();
  const lugares = new Set<string>();
  for (const entrada of bruto) {
    const x = (entrada && typeof entrada === "object" ? entrada : {}) as Record<string, unknown>;
    const id = typeof x.ingresso_id === "string" ? x.ingresso_id.trim().toLowerCase() : "";
    const item = itens.find(i => i.ingresso_id === id);
    if (!UUID.test(id) || !item || ingressos.has(id) || !Array.isArray(x.assentos) || x.assentos.length !== item.quantidade) return null;
    ingressos.add(id);
    const assentos: { fileira: string; numero: number }[] = [];
    for (const l of x.assentos) {
      const a = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
      const fileira = typeof a.fileira === "string" ? a.fileira.trim().toUpperCase() : "";
      const numero = a.numero;
      if (!/^[A-Z0-9]{1,4}$/.test(fileira) || typeof numero !== "number" || !Number.isInteger(numero) || numero < 1 || numero > 999 || lugares.has(`${fileira}|${numero}`)) return null;
      lugares.add(`${fileira}|${numero}`);
      assentos.push({ fileira, numero });
    }
    saida.push({ ingresso_id: id, assentos });
  }
  return saida;
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
  const meio = e.meio === undefined || e.meio === null || e.meio === "" ? "pix" : e.meio;
  if (meio !== "pix" && meio !== "cartao") problemas.push("forma de pagamento");
  const parcelas = e.parcelas === undefined || e.parcelas === null ? 1 : e.parcelas;
  if (typeof parcelas !== "number" || !Number.isInteger(parcelas) || parcelas < 1 || parcelas > MAX_PARCELAS || (meio === "pix" && parcelas !== 1) || (!PARCELAMENTO_LIBERADO && parcelas !== 1)) problemas.push("parcelas");
  const semCupom = e.cupom === undefined || e.cupom === null || (typeof e.cupom === "string" && e.cupom.trim() === "");
  const cupom = semCupom ? null : normalizarCodigo(e.cupom);
  if (!semCupom && (cupom === null || !codigoDoCupomValido(cupom))) problemas.push("cupom");
  const lugares = lerLugares(e.lugares, itens);
  if (lugares === null) problemas.push("lugares");
  if (problemas.length > 0) return { ok: false, problemas };
  return { ok: true, corpo: { sessao_id: sessao.toLowerCase(), itens, nome, email, documento, termos: VERSAO_DOS_TERMOS_DE_COMPRA, meio: meio as MeioDaCompra, parcelas: parcelas as number, cupom, lugares: lugares ?? [] } };
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
  /** fn_ticketeria_reservar (ou, com `corpo.cupom`, fn_ticketeria_reservar_com_cupom: a reserva e o desconto na mesma transação). Os erros do banco saem como ErroDaCompra("reserva_recusada") com a frase para o comprador. */
  reservar(corpo: CorpoDaCompra, minutos: number): Promise<PedidoReservado>;
  /** fn_ticketeria_registrar_aceite: o pedido guarda a versão dos Termos aceita e a hora. Falhar aqui falha a compra (sem aceite gravado, não há cobrança). */
  registrarAceite(pedido: string, versao: string): Promise<void>;
  /** fn_ticketeria_definir_meio. Meio ou parcelas que a loja não oferece (ou que o custo não deixa) saem como ErroDaCompra("meio_indisponivel"). */
  definirMeio(pedido: string, meio: MeioDaCompra, parcelas: number | null): Promise<void>;
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
  | { situacao: "aguardando_pagamento"; meio: "pix"; pedido_id: string; codigo: string; total_centavos: number; reservado_ate: string; pix_copia_e_cola: string }
  /** Cartão: a pessoa paga na página segura do provedor (`url_de_pagamento`). */
  | { situacao: "aguardando_pagamento"; meio: "cartao"; pedido_id: string; codigo: string; total_centavos: number; reservado_ate: string; url_de_pagamento: string };

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
    await portas.definirMeio(pedido.pedido_id, corpo.meio, corpo.meio === "cartao" ? corpo.parcelas : null);
  } catch (erro) {
    if (erro instanceof ErroDaCompra) throw erro;
    portas.registrarErro?.(erro);
    throw new ErroDaCompra("meio_indisponivel", "Não foi possível abrir o pagamento. Tente de novo.");
  }
  const paraCobrar = {
    id: pedido.pedido_id, codigo: pedido.codigo, total_centavos: pedido.total_centavos, expira_em: pedido.reservado_ate,
    comprador_nome: corpo.nome, comprador_email: corpo.email, comprador_documento: corpo.documento,
    ...(pedido.taxa_centavos > 0 && portas.carteiraDoJards ? { split: [{ carteira: portas.carteiraDoJards, valor_centavos: pedido.taxa_centavos }] } : {}),
  };
  try {
    const provedor = portas.provedor(conta.chave);
    if (corpo.meio === "cartao") {
      if (!provedor.criarCobrancaCartao) throw new Error("o provedor não tem cartão");
      const cobranca = await provedor.criarCobrancaCartao({ ...paraCobrar, parcelas: corpo.parcelas });
      return { situacao: "aguardando_pagamento", meio: "cartao", pedido_id: pedido.pedido_id, codigo: pedido.codigo, total_centavos: pedido.total_centavos, reservado_ate: pedido.reservado_ate, url_de_pagamento: cobranca.url };
    }
    const cobranca = await provedor.criarCobranca(paraCobrar);
    if (!cobranca.pix_copia_e_cola) throw new Error("a cobrança nasceu sem o copia e cola do Pix");
    return { situacao: "aguardando_pagamento", meio: "pix", pedido_id: pedido.pedido_id, codigo: pedido.codigo, total_centavos: pedido.total_centavos, reservado_ate: pedido.reservado_ate, pix_copia_e_cola: cobranca.pix_copia_e_cola };
  } catch (erro) {
    // A reserva vence sozinha em 15 minutos e devolve os lugares; o comprador pode tentar de novo.
    portas.registrarErro?.(erro);
    throw new ErroDaCompra("cobranca_falhou", corpo.meio === "cartao" ? "Não foi possível abrir o pagamento no cartão agora. Tente de novo ou pague com Pix." : "Não foi possível gerar o Pix agora. Tente de novo em instantes.");
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
