// As vendas da loja para a tela do produtor (passo C3 da T5): transforma as linhas do banco no resumo, nas sessões e nas compras que a tela mostra.
// Só a conta, sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-vendas.test.ts). Quem lê as linhas é lib/ticketeria/vendas-servidor.ts.
//
// O repasse segue a mesma conta do banco (`fn_ticketeria_saldo_liberavel`): a parte do produtor (o preço menos a taxa do Jards) menos o custo REAL do
// Pix, quando o Asaas já o informou, ou a estimativa da tabela. Retido = repasse − o que já sacou − o que já pode sacar.

import type { CompraDaLista, DetalheDaCompra, ReembolsoDaLista, ResumoDasVendas, SessaoDeVendas, SituacaoDaCompra, SituacaoDaSessao, SituacaoDoReembolso } from "@/components/ticketeria/VendasView";
import { diaEHoraDoEvento } from "@/lib/ticketeria/pagamento/ingressos";

export type LinhaDePedido = {
  id: string; codigo: string; comprador_nome: string; comprador_email: string; sessao_id: string; situacao: string;
  total_centavos: number; taxa_centavos: number; produtor_centavos: number; custo_meio_centavos: number; custo_meio_real_centavos: number | null;
  pago_em: string | null; created_at: string;
};
export type LinhaDeSessao = { id: string; evento_id: string; local_id: string; inicio: string; cancelada_em: string | null };
export type LinhaDeIngressoEmitido = { codigo: string; nome: string; assento_rotulo?: string | null; pedido_id: string; usado_em: string | null; cancelado_em: string | null };

export type LinhaDeReembolso = { id: string; pedido_id: string | null; remetente: string; recebido_em: string; situacao: string; valor_centavos: number | null };

export type EntradaDasVendas = {
  pedidos: LinhaDePedido[];
  /** Quantos ingressos tem cada pedido (a soma dos itens), pelo id do pedido. */
  quantidadePorPedido: Record<string, number>;
  sessoes: LinhaDeSessao[];
  tituloDoEvento: Record<string, string>;
  fusoDoLocal: Record<string, string>;
  /** A capacidade de cada local (a soma dos lugares dos setores em uso), pelo id do local. */
  lugaresDoLocal: Record<string, number>;
  emitidos: LinhaDeIngressoEmitido[];
  /** O que o produtor já pode sacar agora (`fn_ticketeria_saldo_liberavel`: já descontado o que sacou). */
  /** Os pedidos de reembolso por e-mail dos pedidos da loja (a fila: o que foi devolvido e o que não). */
  reembolsos?: LinhaDeReembolso[];
  liberadoCentavos: number;
  /** O que o produtor já sacou (as transferências aprovadas pela validação de saque). */
  sacadoCentavos: number;
  agora?: number;
};

export type VendasDaLoja = { resumo: ResumoDasVendas; sessoes: SessaoDeVendas[]; reembolsos: ReembolsoDaLista[]; compras: (CompraDaLista & { detalhe: Omit<DetalheDaCompra, "endereco_do_pedido"> })[] };

const FUSO_PADRAO = "America/Sao_Paulo";
const partes = (iso: string, fuso: string, opcoes: Intl.DateTimeFormatOptions) => { try { return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, ...opcoes }).format(new Date(iso)); } catch { return iso; } };
/** "19/11 às 14:02" */
export const diaCurtoEHora = (iso: string, fuso: string = FUSO_PADRAO) => `${partes(iso, fuso, { day: "2-digit", month: "2-digit" })} às ${partes(iso, fuso, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** O que sobra ao produtor de um pedido pago: a parte dele menos o custo do Pix (o real, quando o Asaas já o informou). */
export const repasseDoPedido = (p: Pick<LinhaDePedido, "produtor_centavos" | "custo_meio_centavos" | "custo_meio_real_centavos">) =>
  p.produtor_centavos - (p.custo_meio_real_centavos ?? p.custo_meio_centavos);

export function situacaoDaSessao(s: { inicio: string; cancelada_em: string | null }, vendidos: number, lugares: number, agora: number): SituacaoDaSessao {
  if (s.cancelada_em) return "cancelada";
  if (Date.parse(s.inicio) <= agora) return "encerrada";
  if (lugares > 0 && vendidos >= lugares) return "esgotada";
  return "a_venda";
}

export function montarVendas(e: EntradaDasVendas): VendasDaLoja {
  const agora = e.agora ?? Date.now();
  const pagos = e.pedidos.filter(p => p.situacao === "pago");
  const validos = e.emitidos.filter(i => !i.cancelado_em);
  const sessaoPorId = new Map(e.sessoes.map(s => [s.id, s]));

  const vendido = pagos.reduce((soma, p) => soma + p.total_centavos, 0);
  const repasse = pagos.reduce((soma, p) => soma + repasseDoPedido(p), 0);
  const resumo: ResumoDasVendas = {
    vendido_centavos: vendido, ingressos: validos.length, compras: pagos.length, repasse_centavos: repasse,
    liberado_centavos: Math.max(0, e.liberadoCentavos), retido_centavos: Math.max(0, repasse - e.sacadoCentavos - e.liberadoCentavos),
  };

  const vendidosNaSessao = new Map<string, number>();
  for (const p of pagos) vendidosNaSessao.set(p.sessao_id, (vendidosNaSessao.get(p.sessao_id) ?? 0) + (e.quantidadePorPedido[p.id] ?? 0));
  const receitaNaSessao = new Map<string, number>();
  for (const p of pagos) receitaNaSessao.set(p.sessao_id, (receitaNaSessao.get(p.sessao_id) ?? 0) + p.total_centavos);
  // As que ainda vão acontecer, da mais próxima para a mais distante; depois as que já passaram, da mais recente para a mais antiga.
  const futuras = e.sessoes.filter(s => Date.parse(s.inicio) > agora).sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  const passadas = e.sessoes.filter(s => Date.parse(s.inicio) <= agora).sort((a, b) => Date.parse(b.inicio) - Date.parse(a.inicio));
  const sessoes: SessaoDeVendas[] = [...futuras, ...passadas].map(s => {
    const vendidos = vendidosNaSessao.get(s.id) ?? 0;
    const lugares = e.lugaresDoLocal[s.local_id] ?? 0;
    return {
      id: s.id, evento: e.tituloDoEvento[s.evento_id] ?? "Evento", quando: maiuscula(diaEHoraDoEvento(s.inicio, e.fusoDoLocal[s.local_id] ?? FUSO_PADRAO)),
      vendidos, lugares, receita_centavos: receitaNaSessao.get(s.id) ?? 0, situacao: situacaoDaSessao(s, vendidos, lugares, agora),
    };
  });

  const ingressosDoPedido = new Map<string, LinhaDeIngressoEmitido[]>();
  for (const i of e.emitidos) ingressosDoPedido.set(i.pedido_id, [...(ingressosDoPedido.get(i.pedido_id) ?? []), i]);
  const compras = [...e.pedidos].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(p => {
    const s = sessaoPorId.get(p.sessao_id);
    const fuso = s ? e.fusoDoLocal[s.local_id] ?? FUSO_PADRAO : FUSO_PADRAO;
    const evento = s ? e.tituloDoEvento[s.evento_id] ?? "Evento" : "Evento";
    const situacao: SituacaoDaCompra = p.situacao === "pago" ? "pago" : p.situacao === "cancelado" ? "cancelado" : "aguardando_pagamento";
    const custo = p.custo_meio_real_centavos ?? p.custo_meio_centavos;
    return {
      id: p.id, codigo: p.codigo, comprador: p.comprador_nome, email: p.comprador_email, evento, quando: s ? diaCurtoEHora(s.inicio, fuso) : "—",
      quantidade: e.quantidadePorPedido[p.id] ?? 0, valor_centavos: p.total_centavos, situacao, pago_em: p.pago_em ? diaCurtoEHora(p.pago_em) : null,
      detalhe: {
        codigo: p.codigo, comprador: p.comprador_nome, email: p.comprador_email, evento, quando: s ? maiuscula(diaEHoraDoEvento(s.inicio, fuso)) : "—", situacao,
        pago_em: p.pago_em ? `${partes(p.pago_em, FUSO_PADRAO, { day: "2-digit", month: "2-digit", year: "numeric" })} às ${partes(p.pago_em, FUSO_PADRAO, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}` : null,
        ingressos: (ingressosDoPedido.get(p.id) ?? []).map(i => ({ codigo: i.codigo, nome: i.nome, assento: i.assento_rotulo ?? null, usado: i.usado_em !== null, cancelado: i.cancelado_em !== null })),
        total_centavos: p.total_centavos, taxa_centavos: p.taxa_centavos, custo_do_pix_centavos: situacao === "pago" ? custo : null, repasse_centavos: situacao === "pago" ? repasseDoPedido(p) : 0,
      },
    };
  });
  const codigoDoPedido = new Map(e.pedidos.map(p => [p.id, p.codigo]));
  const SITUACOES: Record<string, SituacaoDoReembolso> = { recebido: "estornando", estornando: "estornando", estornado: "estornado", falhou: "falhou", fora_do_prazo: "fora_do_prazo", remetente_diferente: "remetente_diferente", nao_elegivel: "nao_elegivel", ja_reembolsado: "ja_reembolsado" };
  const reembolsos: ReembolsoDaLista[] = [...(e.reembolsos ?? [])]
    .filter(r => r.pedido_id !== null && codigoDoPedido.has(r.pedido_id) && r.situacao in SITUACOES)
    .sort((a, b) => Date.parse(b.recebido_em) - Date.parse(a.recebido_em))
    .map(r => ({ id: r.id, codigo: codigoDoPedido.get(r.pedido_id as string) ?? "", remetente: r.remetente, recebido: diaCurtoEHora(r.recebido_em), situacao: SITUACOES[r.situacao], motivo: null, valor_centavos: r.valor_centavos }));
  return { resumo, sessoes, reembolsos, compras };
}
