// Conciliação (P2.6): cada débito do extrato que paga despesa fica ligado aos
// pagamentos que ele quita (prestacao_pagamentos.lancamento_id, P2.5).
//
// Um lançamento pode quitar vários pagamentos (um TED para várias notas) e uma
// despesa pode ser paga em vários lançamentos (parcelas): a ligação fica no
// pagamento, e a situação do lançamento é a soma dos pagamentos ligados a ele.
// Débitos de tarifa, aplicação, transferência e afins não esperam despesa.
//
// sugerirConciliacoes acha os pares prováveis entre débitos e pagamentos ainda
// soltos: mesmo valor, e então mesmo número de documento, mesma data ou poucos
// dias de diferença, e o documento do favorecido no histórico. A pessoa
// confirma; nada é ligado sozinho. Sem React e sem Supabase.

import { normalizarDocumento } from "./extrato";
import type { MeioPagamento } from "./regimes/tipos";
import type { PrestacaoLancamento, PrestacaoPagamento } from "@/lib/supabase/types";

export type LancamentoParaConciliar = Pick<PrestacaoLancamento, "id" | "data" | "natureza" | "valor" | "historico" | "numero_documento" | "numero_normalizado" | "categoria">;
export type PagamentoParaConciliar = Pick<PrestacaoPagamento, "id" | "despesa_id" | "data" | "valor" | "numero_documento" | "favorecido_documento" | "lancamento_id">;

const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
const dias = (a: string, b: string) => Math.round(Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

/** Débitos de pagamento (ou sem categoria clara) esperam despesa; os demais não. */
export function lancamentoEsperaPagamento(l: Pick<PrestacaoLancamento, "natureza" | "categoria">): boolean {
  return l.natureza === "debito" && (l.categoria === "pagamento" || l.categoria === "outro");
}

export type SituacaoDoLancamento = "nao_se_aplica" | "pendente" | "parcial" | "conciliado" | "excedido";

/** Situação do lançamento pela soma dos pagamentos ligados a ele. */
export function situacaoDoLancamento(l: LancamentoParaConciliar, ligados: readonly Pick<PrestacaoPagamento, "valor">[]): SituacaoDoLancamento {
  if (!ligados.length) return lancamentoEsperaPagamento(l) ? "pendente" : "nao_se_aplica";
  const soma = ligados.reduce((s, p) => s + centavos(p.valor), 0);
  const alvo = centavos(l.valor);
  return soma === alvo ? "conciliado" : soma < alvo ? "parcial" : "excedido";
}

/** Meio de pagamento pelo histórico do banco; null quando não dá para dizer. */
export function formaPeloHistorico(historico: string): MeioPagamento | null {
  const t = historico.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/\bpix\b/.test(t)) return "pix";
  if (/\bted\b|\btransf\w* eletronica/.test(t)) return "ted";
  if (/\bdoc\b/.test(t)) return "doc";
  if (/\bboleto|\bcobranca|\btitulo|\bpagto? de? conta/.test(t)) return "boleto";
  if (/\bdeb\w* aut|\bdebito automatico/.test(t)) return "debito_automatico";
  if (/\bcheque|\bchq\b/.test(t)) return "cheque";
  if (/\bsaque/.test(t)) return "saque";
  if (/\bcartao|\bcompra com/.test(t)) return "cartao";
  return null;
}

export type SugestaoDeConciliacao = {
  lancamentoId: string;
  pagamentoId: string;
  pontos: number;
  /** "forte" quando o número confere ou a data é a mesma; a tela oferece conciliar todas as fortes. */
  forca: "forte" | "provavel";
  motivos: string[];
};

/**
 * Pares prováveis entre débitos e pagamentos ainda soltos (cada um entra em um
 * par só, o de mais pontos). Só valor igual vira sugestão; datas mais distantes
 * que a tolerância só contam quando o número do documento confere.
 */
export function sugerirConciliacoes(
  lancamentos: readonly LancamentoParaConciliar[],
  pagamentos: readonly PagamentoParaConciliar[],
  opcoes: { toleranciaDias?: number; jaLigados?: ReadonlySet<string> } = {},
): SugestaoDeConciliacao[] {
  const tolerancia = opcoes.toleranciaDias ?? 5;
  const ligados = opcoes.jaLigados ?? new Set(pagamentos.filter(p => p.lancamento_id).map(p => p.lancamento_id!));
  const debitos = lancamentos.filter(l => lancamentoEsperaPagamento(l) && !ligados.has(l.id));
  const soltos = pagamentos.filter(p => !p.lancamento_id);

  const candidatos: (SugestaoDeConciliacao & { distancia: number })[] = [];
  for (const l of debitos) {
    const numeroDoLancamento = l.numero_normalizado ?? normalizarDocumento(l.numero_documento);
    const digitosDoHistorico = l.historico.replace(/\D/g, "");
    for (const p of soltos) {
      if (centavos(p.valor) !== centavos(l.valor)) continue;
      const motivos = ["mesmo valor"];
      let pontos = 50;
      const numero = normalizarDocumento(p.numero_documento);
      const mesmoNumero = Boolean(numero && numeroDoLancamento && numero === numeroDoLancamento);
      if (mesmoNumero) { pontos += 40; motivos.push("mesmo número"); }
      const distancia = dias(l.data, p.data);
      if (distancia === 0) { pontos += 20; motivos.push("mesma data"); }
      else if (distancia <= tolerancia) { pontos += 10 - distancia; motivos.push(`${distancia} ${distancia === 1 ? "dia" : "dias"} de diferença`); }
      else if (!mesmoNumero) continue;
      else motivos.push(`${distancia} dias de diferença`);
      const favorecido = (p.favorecido_documento ?? "").replace(/\D/g, "");
      if (favorecido.length >= 11 && digitosDoHistorico.includes(favorecido)) { pontos += 10; motivos.push("favorecido no histórico"); }
      candidatos.push({ lancamentoId: l.id, pagamentoId: p.id, pontos, forca: mesmoNumero || distancia === 0 ? "forte" : "provavel", motivos, distancia });
    }
  }

  candidatos.sort((a, b) => b.pontos - a.pontos || a.distancia - b.distancia || a.lancamentoId.localeCompare(b.lancamentoId) || a.pagamentoId.localeCompare(b.pagamentoId));
  const usadosL = new Set<string>();
  const usadosP = new Set<string>();
  const escolhidas: SugestaoDeConciliacao[] = [];
  for (const c of candidatos) {
    if (usadosL.has(c.lancamentoId) || usadosP.has(c.pagamentoId)) continue;
    usadosL.add(c.lancamentoId);
    usadosP.add(c.pagamentoId);
    escolhidas.push({ lancamentoId: c.lancamentoId, pagamentoId: c.pagamentoId, pontos: c.pontos, forca: c.forca, motivos: c.motivos });
  }
  return escolhidas;
}

export type ResumoDaConciliacao = {
  debitos: number;
  conciliados: number;
  parciais: number;
  pendentes: number;
  valorPendente: number;
  pagamentosSoltos: number;
  valorSolto: number;
};

/** Números do topo da tela: débitos que esperam despesa e pagamentos ainda sem lançamento. */
export function resumoDaConciliacao(lancamentos: readonly LancamentoParaConciliar[], pagamentos: readonly PagamentoParaConciliar[]): ResumoDaConciliacao {
  const porLancamento = new Map<string, PagamentoParaConciliar[]>();
  for (const p of pagamentos) if (p.lancamento_id) porLancamento.set(p.lancamento_id, [...(porLancamento.get(p.lancamento_id) ?? []), p]);
  const r: ResumoDaConciliacao = { debitos: 0, conciliados: 0, parciais: 0, pendentes: 0, valorPendente: 0, pagamentosSoltos: 0, valorSolto: 0 };
  let pendente = 0;
  for (const l of lancamentos) {
    const situacao = situacaoDoLancamento(l, porLancamento.get(l.id) ?? []);
    if (situacao === "nao_se_aplica") continue;
    r.debitos++;
    if (situacao === "conciliado") r.conciliados++;
    else if (situacao === "pendente") { r.pendentes++; pendente += centavos(l.valor); }
    else r.parciais++;
  }
  const soltos = pagamentos.filter(p => !p.lancamento_id);
  r.valorPendente = pendente / 100;
  r.pagamentosSoltos = soltos.length;
  r.valorSolto = soltos.reduce((s, p) => s + centavos(p.valor), 0) / 100;
  return r;
}
