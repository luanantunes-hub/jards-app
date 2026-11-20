// Planilhas da prestação da saúde (P9.3): Pronon e Pronas/PCD.
//
// O Manual Orientativo do Anexo LXXXVI-A, que traria os modelos novos, ainda
// não foi publicado (Portaria GM/MS 8.031/2025, art. 2º). Até lá, as colunas
// seguem o roteiro de análise dos aspectos contábeis e financeiros do MS
// (manual de 2019, Anexo III, seções 14 a 16), que é como o Ministério confere:
//  * Planilha II, conciliação bancária: cada despesa com o documento, o
//    imposto retido, o valor e a data do pagamento e os requisitos do
//    documento (em nome da instituição, nome do projeto e número do processo);
//  * Tabela 1, rendimentos de aplicação financeira: o rendimento líquido de
//    cada mês, com o total;
//  * informações compiladas: recursos, despesas e saldos;
//  * relação de bens e equipamentos com a identificação do projeto e o
//    inventário físico (minuta do Termo de Compromisso, documentos IX e XI).
// O período é um exercício (prestação anual) ou a execução inteira (final).
// Sem React e sem Supabase.

import { ehDespesa } from "./despesas";
import type { DespesaDoEstado, EstadoDaPrestacao } from "./checagens/catalogo";
import type { PrestacaoBem } from "@/lib/supabase/types";

const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
const reais = (c: number) => c / 100;

const TIPO_DO_DOCUMENTO: Record<string, string> = {
  nfe: "NF-e", nfse: "NFS-e", cupom: "Cupom fiscal", recibo: "Recibo", rpa: "RPA", rpci: "RPCI", invoice: "Invoice",
  fatura: "Fatura", nota_debito: "Nota de débito", folha_pagamento: "Folha de pagamento", guia_tributo: "Guia de tributo", apolice: "Apólice",
};

export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"] as const;

/** Período das planilhas: o ano da prestação anual, ou null para a execução inteira. */
export type PeriodoDasPlanilhas = number | null;

const noPeriodo = (data: string | null | undefined, ano: PeriodoDasPlanilhas) => ano === null || (Boolean(data) && data!.slice(0, 4) === String(ano));

// ─── Planilha II: conciliação ───────────────────────────────────────────────

export type Requisito = "Sim" | "Não" | "Declaração";

export type LinhaDaPlanilhaII = {
  n: number;
  despesaId: string;
  favorecido: string;
  descricao: string;
  tipo: string;
  numero: string;
  emissao: string | null;
  /** Página no processo SEI: o sistema não sabe, a pessoa completa. */
  paginaSei: string;
  /** Em centavos. */
  valorDocumento: number;
  impostoRetido: number;
  valorPago: number;
  /** A data do pagamento; com mais de um, a do último. */
  dataPagamento: string | null;
  pagamentos: number;
  requisitos: { nomeInstituicao: Requisito; nomeProjeto: Requisito; processo: Requisito };
  /** O que a análise do MS apontaria nesta linha. */
  criticas: string[];
};


const requisitoDoProjeto = (d: DespesaDoEstado): Requisito =>
  d.identificacao_projeto === "presente" ? "Sim" : d.identificacao_projeto === "declaracao" ? "Declaração" : "Não";

export function planilhaII(estado: Pick<EstadoDaPrestacao, "despesas" | "fornecedores" | "pagamentos" | "nos">, ano: PeriodoDasPlanilhas, tomadoresDivergentes: ReadonlySet<string> = new Set()): LinhaDaPlanilhaII[] {
  const fornecedores = new Map(estado.fornecedores.map(f => [f.id, f]));
  const itens = new Map((estado.nos ?? []).map(n => [n.id, n.nome]));
  const pagamentosDe = new Map<string, { data: string; valor: number }[]>();
  for (const p of estado.pagamentos) {
    const lista = pagamentosDe.get(p.despesa_id) ?? [];
    lista.push({ data: p.data, valor: centavos(p.valor) });
    pagamentosDe.set(p.despesa_id, lista);
  }
  const despesas = estado.despesas
    .filter(d => d.status !== "rejeitado" && ehDespesa(d.tipo))
    .filter(d => {
      const pagos = pagamentosDe.get(d.id) ?? [];
      return pagos.length ? pagos.some(p => noPeriodo(p.data, ano)) : noPeriodo(d.data_doc, ano);
    })
    .sort((a, b) => (a.data_doc ?? "9999").localeCompare(b.data_doc ?? "9999") || a.id.localeCompare(b.id));

  return despesas.map((d, i) => {
    const f = d.fornecedor_id ? fornecedores.get(d.fornecedor_id) : undefined;
    const pagos = (pagamentosDe.get(d.id) ?? []).filter(p => noPeriodo(p.data, ano)).sort((a, b) => a.data.localeCompare(b.data));
    const valorDocumento = centavos(d.valor_extraido);
    const impostoRetido = centavos(d.iss) + centavos(d.inss) + centavos(d.irrf) + centavos(d.outras_retencoes);
    const valorPago = pagos.reduce((s, p) => s + p.valor, 0);
    const projeto = requisitoDoProjeto(d);
    const criticas: string[] = [];
    if (!pagos.length) criticas.push("sem pagamento registrado");
    else if (ano === null && valorPago !== valorDocumento - impostoRetido) {
      criticas.push(`valor pago difere do documento menos o imposto retido em R$ ${Math.abs(reais(valorDocumento - impostoRetido - valorPago)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    }
    if (!f) criticas.push("sem favorecido");
    if (projeto === "Não") criticas.push("sem o nome do projeto e o número do processo no documento");
    if (tomadoresDivergentes.has(d.id)) criticas.push("documento em nome de outra pessoa");
    return {
      n: i + 1,
      despesaId: d.id,
      favorecido: f ? (f.razao_social || f.nome || f.documento || "").trim() : "",
      descricao: d.descricao_servico?.trim() || (d.no_id ? itens.get(d.no_id) ?? "" : "") || d.nome_arquivo,
      tipo: TIPO_DO_DOCUMENTO[d.tipo] ?? d.tipo,
      numero: [d.numero_documento?.trim(), d.serie?.trim() ? `série ${d.serie.trim()}` : null].filter(Boolean).join(" ") || "",
      emissao: d.data_doc ?? null,
      paginaSei: "",
      valorDocumento,
      impostoRetido,
      valorPago,
      dataPagamento: pagos.at(-1)?.data ?? null,
      pagamentos: pagos.length,
      requisitos: { nomeInstituicao: tomadoresDivergentes.has(d.id) ? "Não" : "Sim", nomeProjeto: projeto, processo: projeto },
      criticas,
    };
  });
}

// ─── Tabela 1: rendimentos ──────────────────────────────────────────────────

export type LinhaDaTabela1 = { ano: number; mes: number; rendimento: number; impostos: number; liquido: number };

/** Imposto sobre o rendimento no extrato: IR e IOF da aplicação. */
const IMPOSTO_DO_RENDIMENTO = /\bir\b|\birrf\b|imposto de renda|\biof\b/i;

type Lancamento = EstadoDaPrestacao["lancamentos"][number];

const doRendimento = (l: Lancamento): "rendimento" | "imposto" | null =>
  l.natureza === "credito" && l.categoria === "rendimento" ? "rendimento"
    : l.natureza === "debito" && (l.categoria === "tarifa" || l.categoria === "outro") && IMPOSTO_DO_RENDIMENTO.test(l.historico) ? "imposto"
      : null;

/**
 * O rendimento líquido de cada mês: os créditos de rendimento menos o IR e o
 * IOF debitados. Um bloco de 12 meses por ano do período.
 */
export function tabela1(lancamentos: EstadoDaPrestacao["lancamentos"], anos: readonly number[]): LinhaDaTabela1[] {
  const porMes = new Map<string, { rendimento: number; impostos: number }>();
  for (const l of lancamentos) {
    const tipo = doRendimento(l);
    if (!tipo) continue;
    const chave = l.data.slice(0, 7);
    const atual = porMes.get(chave) ?? { rendimento: 0, impostos: 0 };
    if (tipo === "rendimento") atual.rendimento += centavos(l.valor);
    else atual.impostos += centavos(l.valor);
    porMes.set(chave, atual);
  }
  return anos.flatMap(ano => MESES.map((_, i) => {
    const m = porMes.get(`${ano}-${String(i + 1).padStart(2, "0")}`) ?? { rendimento: 0, impostos: 0 };
    return { ano, mes: i + 1, rendimento: m.rendimento, impostos: m.impostos, liquido: m.rendimento - m.impostos };
  }));
}

/** Os anos do período: o da prestação anual, ou os anos com lançamento do extrato. */
export function anosDoPeriodo(lancamentos: EstadoDaPrestacao["lancamentos"], ano: PeriodoDasPlanilhas): number[] {
  if (ano !== null) return [ano];
  const anos = [...new Set(lancamentos.map(l => Number(l.data.slice(0, 4))).filter(Number.isFinite))].sort();
  return anos.length ? anos : [];
}

// ─── Informações compiladas ─────────────────────────────────────────────────

export type InformacoesCompiladas = {
  /** Em centavos. Na prestação anual, o saldo que veio dos exercícios anteriores; null na final. */
  saldoAnterior: number | null;
  /** O que entrou na Conta Movimento (transferências e aportes), os rendimentos líquidos e o total de recursos. */
  recursosRecebidos: number;
  rendimentos: number;
  totalDeRecursos: number;
  totalDeDespesas: number;
  /** Saldo anterior mais o total de recursos, menos as despesas pagas. */
  saldoRemanescente: number;
  /** Saldo da Conta Captação pelos lançamentos importados, até o fim do período; null sem a conta. */
  saldoDaCaptacao: number | null;
  /** O período não tem lançamento na Conta Movimento. */
  semMovimento: boolean;
};

/** Os lançamentos da Conta Movimento; sem contas cadastradas, todos os do extrato. */
function lancamentosDaMovimento(estado: Pick<EstadoDaPrestacao, "lancamentos" | "contas">): EstadoDaPrestacao["lancamentos"] {
  const tipoDe = new Map((estado.contas ?? []).map(c => [c.id, c.tipo]));
  return (estado.contas ?? []).some(c => c.tipo === "movimento")
    ? estado.lancamentos.filter(l => l.conta_id && tipoDe.get(l.conta_id) === "movimento")
    : estado.lancamentos;
}

/** Recursos recebidos e rendimento líquido de um conjunto de lançamentos da Conta Movimento. */
function recursosDe(lancamentos: EstadoDaPrestacao["lancamentos"]) {
  let recebidos = 0, rendimentos = 0;
  for (const l of lancamentos) {
    if (l.natureza === "credito" && (l.categoria === "transferencia" || l.categoria === "aporte")) recebidos += centavos(l.valor);
    const tipo = doRendimento(l);
    if (tipo) rendimentos += (tipo === "rendimento" ? 1 : -1) * centavos(l.valor);
  }
  return { recebidos, rendimentos };
}

export function informacoesCompiladas(estado: Pick<EstadoDaPrestacao, "lancamentos" | "contas" | "despesas" | "pagamentos">, linhas: readonly LinhaDaPlanilhaII[], ano: PeriodoDasPlanilhas): InformacoesCompiladas {
  const movimento = lancamentosDaMovimento(estado);
  const doPeriodo = movimento.filter(l => noPeriodo(l.data, ano));
  const { recebidos: recursosRecebidos, rendimentos } = recursosDe(doPeriodo);
  const totalDeRecursos = recursosRecebidos + rendimentos;
  const totalDeDespesas = linhas.reduce((s, l) => s + l.valorPago, 0);

  // Na anual, o que sobrou dos exercícios anteriores, pela mesma conta: recursos e rendimentos menos os pagamentos.
  let saldoAnterior: number | null = null;
  if (ano !== null) {
    const inicio = `${ano}-01-01`;
    const anteriores = recursosDe(movimento.filter(l => l.data < inicio));
    const validas = new Set(estado.despesas.filter(d => d.status !== "rejeitado" && ehDespesa(d.tipo)).map(d => d.id));
    const pagos = estado.pagamentos.filter(p => validas.has(p.despesa_id) && p.data < inicio).reduce((s, p) => s + centavos(p.valor), 0);
    saldoAnterior = anteriores.recebidos + anteriores.rendimentos - pagos;
  }

  const tipoDe = new Map((estado.contas ?? []).map(c => [c.id, c.tipo]));
  const captacao = (estado.contas ?? []).some(c => c.tipo === "captacao")
    ? estado.lancamentos.filter(l => l.conta_id && tipoDe.get(l.conta_id) === "captacao" && (ano === null || l.data <= `${ano}-12-31`))
      .reduce((s, l) => s + (l.natureza === "credito" ? 1 : -1) * centavos(l.valor), 0)
    : null;
  return {
    saldoAnterior, recursosRecebidos, rendimentos, totalDeRecursos, totalDeDespesas,
    saldoRemanescente: (saldoAnterior ?? 0) + totalDeRecursos - totalDeDespesas,
    saldoDaCaptacao: captacao,
    semMovimento: doPeriodo.length === 0,
  };
}

// ─── Relação de bens ────────────────────────────────────────────────────────

export type BemDaRelacao = Pick<PrestacaoBem, "id" | "tipo" | "descricao" | "quantidade" | "valor" | "numero_patrimonio" | "despesa_id" | "destinacao" | "beneficiario">;

export type LinhaDosBens = {
  n: number;
  descricao: string;
  quantidade: number;
  valor: number | null;
  /** Número de patrimônio ou plaqueta: a identificação do projeto no inventário físico. */
  identificacao: string;
  documento: string;
  fornecedor: string;
  destinacao: string;
  criticas: string[];
};

const DESTINACAO: Record<string, string> = { doacao: "Doação", proponente: "Fica com a instituição", outra: "Outra" };

export function relacaoDosBens(bens: readonly BemDaRelacao[], estado: Pick<EstadoDaPrestacao, "despesas" | "fornecedores">, ano: PeriodoDasPlanilhas): LinhaDosBens[] {
  const despesas = new Map(estado.despesas.map(d => [d.id, d]));
  const fornecedores = new Map(estado.fornecedores.map(f => [f.id, f]));
  return bens
    .filter(b => {
      const d = b.despesa_id ? despesas.get(b.despesa_id) : undefined;
      return ano === null || !d || noPeriodo(d.data_doc, ano);
    })
    .map((b, i) => {
      const d = b.despesa_id ? despesas.get(b.despesa_id) : undefined;
      const f = d?.fornecedor_id ? fornecedores.get(d.fornecedor_id) : undefined;
      const criticas = [
        b.numero_patrimonio?.trim() ? null : "sem número de patrimônio no inventário",
        d ? null : "sem a nota fiscal da compra",
      ].filter((c): c is string => Boolean(c));
      return {
        n: i + 1,
        descricao: b.descricao,
        quantidade: Number(b.quantidade) || 1,
        valor: b.valor === null || b.valor === undefined ? null : centavos(b.valor),
        identificacao: b.numero_patrimonio?.trim() ?? "",
        documento: d ? [TIPO_DO_DOCUMENTO[d.tipo] ?? d.tipo, d.numero_documento?.trim(), d.data_doc ? d.data_doc.slice(0, 10).split("-").reverse().join("/") : null].filter(Boolean).join(" · ") : "",
        fornecedor: f ? (f.razao_social || f.nome || "").trim() : "",
        destinacao: b.destinacao ? [DESTINACAO[b.destinacao], b.beneficiario?.trim()].filter(Boolean).join(": ") : "",
        criticas,
      };
    });
}

// ─── O conjunto ─────────────────────────────────────────────────────────────

export type PlanilhasDaSaude = {
  ano: PeriodoDasPlanilhas;
  planilhaII: LinhaDaPlanilhaII[];
  tabela1: LinhaDaTabela1[];
  compiladas: InformacoesCompiladas;
  bens: LinhaDosBens[];
  /** Linhas com crítica, nas três listas. */
  criticas: number;
};

export function planilhasDaSaude(estado: EstadoDaPrestacao, bens: readonly BemDaRelacao[], ano: PeriodoDasPlanilhas, tomadoresDivergentes: ReadonlySet<string> = new Set()): PlanilhasDaSaude {
  // Os rendimentos da Tabela 1 são os da Conta Movimento.
  const daMovimento = lancamentosDaMovimento(estado);
  const linhas = planilhaII(estado, ano, tomadoresDivergentes);
  const relacao = relacaoDosBens(bens, estado, ano);
  return {
    ano,
    planilhaII: linhas,
    tabela1: tabela1(daMovimento, anosDoPeriodo(daMovimento, ano)),
    compiladas: informacoesCompiladas(estado, linhas, ano),
    bens: relacao,
    criticas: linhas.filter(l => l.criticas.length).length + relacao.filter(b => b.criticas.length).length,
  };
}

/** "Planilhas_Saude_25000123456202591_2026.xlsx". */
export const nomeDasPlanilhas = (nup: string | null | undefined, ano: PeriodoDasPlanilhas) =>
  `Planilhas_Saude_${(nup ?? "").replace(/\D/g, "") || "projeto"}_${ano ?? "final"}.xlsx`;
