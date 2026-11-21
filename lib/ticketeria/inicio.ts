// A página inicial da Ticketeria (estilo painel do Stripe): o que entrou hoje e ontem, os saldos, e a visão geral por período (vendas por situação,
// volume, ingressos, repasse, maiores compradores) mais as listas curtas (sessões, reembolsos, compras não concluídas).
// Só a conta, sem banco e sem imports de servidor: roda nos testes (tests/ticketeria-inicio.test.ts). Quem lê as linhas é lib/ticketeria/vendas-servidor.ts.
// Os dias e as horas seguem o horário de Brasília (UTC-3, sem horário de verão desde 2019).

import type { ReembolsoDaLista, SessaoDeVendas } from "@/components/ticketeria/VendasView";
import { montarVendas, repasseDoPedido, type EntradaDasVendas, type LinhaDePedido } from "@/lib/ticketeria/vendas";

export type PeriodoDoInicio = "tudo" | "30d" | "7d";
export type Parcela = { quantidade: number; valor_centavos: number };
export type Comprador = { nome: string; email: string; compras: number; valor_centavos: number };
export type DadosDoPeriodo = {
  vendas: { pagas: Parcela; aguardando: Parcela; canceladas: Parcela; reembolsadas: Parcela };
  vendido: { total_centavos: number; serie: number[]; de: string; ate: string };
  ingressos: { total: number; serie: number[]; de: string; ate: string };
  repasse_centavos: number;
  compradores: Comprador[];
};
export type NaoConcluida = { id: string; codigo: string; comprador: string; email: string; quando: string; valor_centavos: number; situacao: "aguardando_pagamento" | "cancelado" };
export type InicioDaLoja = {
  hoje: { vendido_centavos: number; ingressos: number; ontem_vendido_centavos: number; ontem_ingressos: number; hora: string; serie_hoje: (number | null)[]; serie_ontem: number[] };
  saldos: { liberado_centavos: number; retido_centavos: number };
  proxima: { evento: string; quando: string; vendidos: number; lugares: number } | null;
  periodos: Record<PeriodoDoInicio, DadosDoPeriodo>;
  sessoes: SessaoDeVendas[];
  reembolsos: ReembolsoDaLista[];
  nao_concluidas: NaoConcluida[];
  tem_pedidos: boolean;
  /** A conta de recebimento da loja (Asaas). Sem ela ativa as vendas ficam pausadas; quem a rota não preencheu (testes) não mostra o aviso. */
  conta_situacao?: "sem_conta" | "pendente" | "aprovada" | "bloqueada";
};

const BRASILIA = -3 * 3_600_000;
const DIA = 86_400_000;
const local = (t: number) => t + BRASILIA;
/** Meia-noite (de Brasília) do dia de `t`, em ms UTC. */
const inicioDoDia = (t: number) => Math.floor(local(t) / DIA) * DIA - BRASILIA;
const MESES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const rotuloDoMes = (t: number) => { const d = new Date(local(t)); return `${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`; };
const rotuloDoDia = (t: number) => { const d = new Date(local(t)); return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`; };
const hhmm = (t: number) => { const d = new Date(local(t)); return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const chaveDoMes = (t: number) => { const d = new Date(local(t)); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };

type Pago = { t: number; valor: number; qtd: number; pedido: LinhaDePedido };

function soma(itens: { valor_centavos: number }[]): Parcela { return { quantidade: itens.length, valor_centavos: itens.reduce((s, i) => s + i.valor_centavos, 0) }; }

export function montarInicio(e: EntradaDasVendas): InicioDaLoja {
  const agora = e.agora ?? Date.now();
  const vendas = montarVendas({ ...e, agora });
  const pagos: Pago[] = e.pedidos
    .filter(p => p.situacao === "pago" && p.pago_em)
    .map(p => ({ t: Date.parse(p.pago_em as string), valor: p.total_centavos, qtd: e.quantidadePorPedido[p.id] ?? 0, pedido: p }));

  // Hoje e ontem, hora a hora e acumulado (a linha de hoje para na hora atual).
  const hojeInicio = inicioDoDia(agora);
  const ontemInicio = hojeInicio - DIA;
  const horaAtual = Math.floor((agora - hojeInicio) / 3_600_000);
  const doDia = (inicio: number) => pagos.filter(p => p.t >= inicio && p.t < inicio + DIA);
  const acumulado = (itens: Pago[], inicio: number, ate: number) => {
    const porHora = new Array<number>(24).fill(0);
    for (const p of itens) porHora[Math.min(23, Math.floor((p.t - inicio) / 3_600_000))] += p.valor;
    let corrente = 0;
    return porHora.map((v, h) => { corrente += v; return h <= ate ? corrente : null; });
  };
  const hoje = doDia(hojeInicio);
  const ontem = doDia(ontemInicio);
  const serieOntem = acumulado(ontem, ontemInicio, 23) as number[];

  // Visão geral por período.
  const estornados = (e.reembolsos ?? []).filter(r => r.situacao === "estornado" && r.pedido_id);
  const idsEstornados = new Set(estornados.map(r => r.pedido_id as string));
  const primeiraVenda = pagos.length > 0 ? Math.min(...pagos.map(p => p.t)) : agora;

  function periodo(de: number | null, passos: "mes" | "dia", quantos: number): DadosDoPeriodo {
    const dentro = (t: number) => (de === null || t >= de) && t <= agora;
    const dosPagos = pagos.filter(p => dentro(p.t));
    // As colunas do gráfico: um valor por mês (desde o início) ou por dia.
    let serieV: number[]; let serieI: number[]; let rotDe: string; let rotAte: string;
    if (passos === "mes") {
      const fim = chaveDoMes(agora);
      const ini = Math.min(chaveDoMes(primeiraVenda), fim - 1);
      serieV = new Array(fim - ini + 1).fill(0); serieI = new Array(fim - ini + 1).fill(0);
      for (const p of dosPagos) { const i = chaveDoMes(p.t) - ini; serieV[i] += p.valor; serieI[i] += p.qtd; }
      rotDe = rotuloDoMes(Date.UTC(Math.floor(ini / 12), ini % 12, 15)); rotAte = rotuloDoMes(agora);
    } else {
      const primeiro = hojeInicio - (quantos - 1) * DIA;
      serieV = new Array(quantos).fill(0); serieI = new Array(quantos).fill(0);
      for (const p of dosPagos) { const i = Math.floor((p.t - primeiro) / DIA); if (i >= 0 && i < quantos) { serieV[i] += p.valor; serieI[i] += p.qtd; } }
      rotDe = rotuloDoDia(primeiro); rotAte = rotuloDoDia(hojeInicio);
    }
    const porComprador = new Map<string, Comprador>();
    for (const p of dosPagos) {
      const chave = p.pedido.comprador_email.trim().toLowerCase();
      const atual = porComprador.get(chave) ?? { nome: p.pedido.comprador_nome, email: p.pedido.comprador_email, compras: 0, valor_centavos: 0 };
      atual.compras += 1; atual.valor_centavos += p.valor;
      porComprador.set(chave, atual);
    }
    const naoPagos = e.pedidos.filter(p => p.situacao !== "pago" && dentro(Date.parse(p.created_at)));
    return {
      vendas: {
        pagas: soma(dosPagos.map(p => ({ valor_centavos: p.valor }))),
        aguardando: soma(naoPagos.filter(p => p.situacao === "aguardando_pagamento").map(p => ({ valor_centavos: p.total_centavos }))),
        canceladas: soma(naoPagos.filter(p => p.situacao !== "aguardando_pagamento" && !idsEstornados.has(p.id)).map(p => ({ valor_centavos: p.total_centavos }))),
        reembolsadas: soma(estornados.filter(r => dentro(Date.parse(r.recebido_em))).map(r => ({ valor_centavos: r.valor_centavos ?? 0 }))),
      },
      vendido: { total_centavos: dosPagos.reduce((s, p) => s + p.valor, 0), serie: serieV, de: rotDe, ate: rotAte },
      ingressos: { total: dosPagos.reduce((s, p) => s + p.qtd, 0), serie: serieI, de: rotDe, ate: rotAte },
      repasse_centavos: dosPagos.reduce((s, p) => s + repasseDoPedido(p.pedido), 0),
      compradores: [...porComprador.values()].sort((a, b) => b.valor_centavos - a.valor_centavos || a.nome.localeCompare(b.nome, "pt-BR")).slice(0, 4),
    };
  }

  const aVender = vendas.sessoes.filter(s => s.situacao === "a_venda" || s.situacao === "esgotada");
  const proxima = aVender[0] ?? null;
  const naoConcluidas: NaoConcluida[] = [...e.pedidos]
    .filter(p => p.situacao !== "pago" && !idsEstornados.has(p.id))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 4)
    .map(p => ({ id: p.id, codigo: p.codigo, comprador: p.comprador_nome, email: p.comprador_email, quando: `${rotuloDoDia(Date.parse(p.created_at))} ${hhmm(Date.parse(p.created_at))}`, valor_centavos: p.total_centavos, situacao: p.situacao === "aguardando_pagamento" ? "aguardando_pagamento" : "cancelado" }));

  return {
    hoje: {
      vendido_centavos: hoje.reduce((s, p) => s + p.valor, 0), ingressos: hoje.reduce((s, p) => s + p.qtd, 0),
      ontem_vendido_centavos: ontem.reduce((s, p) => s + p.valor, 0), ontem_ingressos: ontem.reduce((s, p) => s + p.qtd, 0),
      hora: hhmm(agora), serie_hoje: acumulado(hoje, hojeInicio, horaAtual), serie_ontem: serieOntem,
    },
    saldos: { liberado_centavos: vendas.resumo.liberado_centavos, retido_centavos: vendas.resumo.retido_centavos },
    proxima: proxima ? { evento: proxima.evento, quando: proxima.quando, vendidos: proxima.vendidos, lugares: proxima.lugares } : null,
    periodos: { tudo: periodo(null, "mes", 0), "30d": periodo(hojeInicio - 29 * DIA, "dia", 30), "7d": periodo(hojeInicio - 6 * DIA, "dia", 7) },
    sessoes: aVender.slice(0, 4),
    reembolsos: vendas.reembolsos.slice(0, 4),
    nao_concluidas: naoConcluidas,
    tem_pedidos: e.pedidos.length > 0,
  };
}
