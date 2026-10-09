// Grade horária dos recursos humanos (P8.7).
//
// A PCP da Lei de Incentivo ao Esporte leva, num modelo próprio da DPPIE, a
// grade horária da equipe (Portaria MESP 10/2026, art. 65, VII): por cargo,
// as atribuições, quantos são contratados, o horário de cada dia da semana, a
// carga horária semanal, a forma de contratação (CLT, RPA ou PJ) e a formação
// acadêmica. O cargo se liga ao item do orçamento que o paga, e isso permite
// comparar a grade com quem foi pago e com o documento do pagamento. Sem React
// e sem Supabase.

import { definida, type RegimeNormativo } from "./regimes";
import type { NoOrcamento } from "./orcamento";
import type { ContratacaoDoCargo, PrestacaoCargo, PrestacaoComprovante, PrestacaoFornecedor } from "@/lib/supabase/types";

export const CONTRATACOES: readonly { valor: ContratacaoDoCargo; rotulo: string; descricao: string }[] = [
  { valor: "clt", rotulo: "CLT", descricao: "empregado, pago em folha" },
  { valor: "rpa", rotulo: "RPA", descricao: "autônomo, pago por RPA" },
  { valor: "pj", rotulo: "PJ", descricao: "empresa, paga por nota fiscal" },
];

export const ROTULO_DA_CONTRATACAO: Record<ContratacaoDoCargo, string> = { clt: "CLT", rpa: "RPA", pj: "PJ" };

export const DIAS_DA_GRADE_RH = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"] as const;

export type CargoDaGrade = Pick<PrestacaoCargo, "id" | "no_id" | "cargo" | "quantidade" | "horarios" | "carga_semanal" | "contratacao">
  & Partial<Pick<PrestacaoCargo, "atribuicoes" | "formacao" | "ordem">>;

/** Os 7 dias, de segunda a domingo, mesmo quando o banco guardou menos. */
export function horariosDaSemana(horarios: readonly (string | null)[] | null | undefined): string[] {
  return Array.from({ length: 7 }, (_, i) => (horarios?.[i] ?? "").trim());
}

const INTERVALO = /(\d{1,2})(?:\s*[:hH]\s*(\d{2}))?\s*(?:h|hs|hrs)?\s*(?:-|–|—|até|às|as|a)\s*(\d{1,2})(?:\s*[:hH]\s*(\d{2}))?/gi;

/**
 * Horas de um dia escrito como as pessoas escrevem: "08:00-12:00",
 * "8h às 12h e 14h às 18h", "08:00–12:00 / 13:00–17:00". Dia vazio ou sem
 * número ("Folga") é zero; texto com número que não forma intervalo é null.
 */
export function horasDoDia(texto: string | null | undefined): number | null {
  const t = (texto ?? "").trim();
  if (!t || !/\d/.test(t)) return 0;
  let minutos = 0;
  let achou = false;
  for (const m of t.matchAll(INTERVALO)) {
    const [h1, m1, h2, m2] = [Number(m[1]), Number(m[2] ?? 0), Number(m[3]), Number(m[4] ?? 0)];
    if (h1 > 24 || h2 > 24 || m1 > 59 || m2 > 59) return null;
    const inicio = h1 * 60 + m1;
    const fim = h2 * 60 + m2;
    if (fim <= inicio) return null;
    minutos += fim - inicio;
    achou = true;
  }
  return achou ? minutos / 60 : null;
}

/** A soma dos horários da semana e os dias que não deu para ler. */
export function cargaDosHorarios(horarios: readonly (string | null)[] | null | undefined): { horas: number; ilegiveis: string[] } {
  const dias = horariosDaSemana(horarios);
  let horas = 0;
  const ilegiveis: string[] = [];
  dias.forEach((t, i) => {
    const h = horasDoDia(t);
    if (h === null) ilegiveis.push(DIAS_DA_GRADE_RH[i]);
    else horas += h;
  });
  return { horas: Math.round(horas * 10) / 10, ilegiveis };
}

export const numeroDaCarga = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** "20 h", "7,5 h". */
export const horasBr = (h: number) => `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;

const CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

/** "Seg a Sex 08:00-12:00 · Sáb 08:00-10:00": dias seguidos com o mesmo horário vão juntos. */
export function resumoDosHorarios(horarios: readonly (string | null)[] | null | undefined): string {
  const dias = horariosDaSemana(horarios);
  const partes: string[] = [];
  for (let i = 0; i < 7; ) {
    if (!dias[i]) { i++; continue; }
    let j = i;
    while (j + 1 < 7 && dias[j + 1] === dias[i]) j++;
    const quando = j === i ? CURTOS[i] : j === i + 1 ? `${CURTOS[i]} e ${CURTOS[j]}` : `${CURTOS[i]} a ${CURTOS[j]}`;
    partes.push(`${quando} ${dias[i]}`);
    i = j + 1;
  }
  return partes.join(" · ");
}

/** O que falta num cargo para a grade sair completa. */
export function faltasDoCargo(c: CargoDaGrade): string[] {
  return [
    !horariosDaSemana(c.horarios).some(Boolean) ? "os horários" : null,
    numeroDaCarga(c.carga_semanal) === null ? "a carga horária semanal" : null,
    !c.contratacao ? "a forma de contratação" : null,
  ].filter((x): x is string => Boolean(x));
}

/** A carga escrita e a soma dos horários não batem (meia hora de folga). */
export function cargaDivergente(c: CargoDaGrade): { escrita: number; somada: number } | null {
  const escrita = numeroDaCarga(c.carga_semanal);
  const { horas, ilegiveis } = cargaDosHorarios(c.horarios);
  if (escrita === null || ilegiveis.length || horas === 0) return null;
  return Math.abs(escrita - horas) > 0.5 ? { escrita, somada: horas } : null;
}

/** O regime pede a grade de RH no envio (a LIE pela Portaria 10/2026, documento "grade_rh"). */
export function regimePedeGradeRh(regime: RegimeNormativo | null | undefined): boolean {
  return Boolean(regime && definida(regime.envio)?.documentos.some(d => d.codigo === "grade_rh"));
}

// ─── Pagamentos × grade ─────────────────────────────────────────────────────

type DespesaDoCargo = Pick<PrestacaoComprovante, "id" | "tipo" | "no_id" | "fornecedor_id" | "status">;
type FornecedorDoCargo = Pick<PrestacaoFornecedor, "id" | "tipo_pessoa">;

const NOTAS = new Set(["nfe", "nfse", "fatura", "invoice", "cupom"]);

/** A forma de contratação que o documento do pagamento indica; null quando não diz (recibo, guia de encargos…). */
export function contratacaoDoPagamento(d: Pick<DespesaDoCargo, "tipo">, fornecedor?: FornecedorDoCargo | null): ContratacaoDoCargo | null {
  if (d.tipo === "folha_pagamento") return "clt";
  if (d.tipo === "rpa" || d.tipo === "rpci") return "rpa";
  if (d.tipo && NOTAS.has(d.tipo)) return fornecedor?.tipo_pessoa === "pf" ? null : "pj";
  return null;
}

/** Despesas que contam: as recusadas ficam de fora. */
const valida = (d: Pick<DespesaDoCargo, "status">) => d.status !== "rejeitado";

/** Quem foi pago pelo item do cargo, por fornecedor, com a forma que o documento indica. */
export function pagosDoCargo(c: Pick<CargoDaGrade, "no_id">, despesas: readonly DespesaDoCargo[], fornecedores: readonly FornecedorDoCargo[]) {
  if (!c.no_id) return [];
  const porId = new Map(fornecedores.map(f => [f.id, f]));
  const pessoas = new Map<string, { fornecedorId: string; despesas: DespesaDoCargo[]; formas: Set<ContratacaoDoCargo> }>();
  for (const d of despesas) {
    if (d.no_id !== c.no_id || !valida(d) || !d.fornecedor_id || d.tipo === "guia_tributo") continue;
    const atual = pessoas.get(d.fornecedor_id) ?? { fornecedorId: d.fornecedor_id, despesas: [], formas: new Set<ContratacaoDoCargo>() };
    atual.despesas.push(d);
    const forma = contratacaoDoPagamento(d, porId.get(d.fornecedor_id));
    if (forma) atual.formas.add(forma);
    pessoas.set(d.fornecedor_id, atual);
  }
  return [...pessoas.values()];
}

const RH = /recursos\s+humanos|\bRH\b|pessoal|equipe/i;

/**
 * Itens de recursos humanos do orçamento: os de um agrupador com "recursos
 * humanos", "RH", "pessoal" ou "equipe" no nome, e os pagos em folha ou RPA.
 */
export function itensDeRh(nos: readonly NoOrcamento[], despesas: readonly DespesaDoCargo[]): NoOrcamento[] {
  const porId = new Map(nos.map(n => [n.id, n]));
  const pagosComoPessoa = new Set(despesas.filter(d => valida(d) && (d.tipo === "folha_pagamento" || d.tipo === "rpa" || d.tipo === "rpci")).map(d => d.no_id));
  const noGrupoDeRh = (n: NoOrcamento) => {
    for (let p = n.parent_id ? porId.get(n.parent_id) : undefined; p; p = p.parent_id ? porId.get(p.parent_id) : undefined) {
      if (RH.test(p.nome)) return true;
    }
    return false;
  };
  // Na ordem da árvore: a do agrupador, depois a do item.
  const caminho = (n: NoOrcamento): number[] => {
    const pai = n.parent_id ? porId.get(n.parent_id) : undefined;
    return [...(pai ? caminho(pai) : []), n.ordem ?? 0];
  };
  const antes = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  };
  return nos
    .filter(n => n.tipo === "item" && (noGrupoDeRh(n) || pagosComoPessoa.has(n.id)))
    .map(n => ({ n, c: caminho(n) }))
    .sort((x, y) => antes(x.c, y.c))
    .map(x => x.n);
}

/** Itens de RH ainda sem cargo na grade, para trazer de uma vez. */
export function cargosSugeridos(nos: readonly NoOrcamento[], despesas: readonly DespesaDoCargo[], cargos: readonly Pick<CargoDaGrade, "no_id">[]) {
  const ligados = new Set(cargos.map(c => c.no_id).filter(Boolean));
  return itensDeRh(nos, despesas)
    .filter(n => !ligados.has(n.id))
    .map(n => ({ no_id: n.id, cargo: n.nome.trim(), quantidade: Math.max(1, Math.round(Number(n.quantidade) || 1)) }));
}

// ─── Planilha ───────────────────────────────────────────────────────────────

export type LinhaDaGradeRh = {
  cargo: string;
  atribuicoes: string;
  quantidade: number;
  horarios: string[];
  carga: number | null;
  contratacao: string;
  formacao: string;
};

export function linhasDaGradeRh(cargos: readonly CargoDaGrade[]): LinhaDaGradeRh[] {
  return linhasOrdenadas(cargos)
    .map(c => ({
      cargo: c.cargo.trim(),
      atribuicoes: c.atribuicoes?.trim() ?? "",
      quantidade: c.quantidade,
      horarios: horariosDaSemana(c.horarios),
      carga: numeroDaCarga(c.carga_semanal),
      contratacao: c.contratacao ? ROTULO_DA_CONTRATACAO[c.contratacao] : "",
      formacao: c.formacao?.trim() ?? "",
    }));
}

// ─── Críticas da planilha ───────────────────────────────────────────────────

export type CriticaDaGradeRh = { tipo: "corrigir" | "aviso"; campo: string; mensagem: string };

const juntar = (itens: readonly string[]) => (itens.length > 1 ? `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}` : itens[0] ?? "");

/** O que conferir antes de mandar a grade de RH: cargo incompleto, horário ilegível, carga que não bate. */
export function criticasDaGradeRh(cargos: readonly CargoDaGrade[], dados: { sli?: string | null; proponente?: string | null } = {}): CriticaDaGradeRh[] {
  const criticas: CriticaDaGradeRh[] = [];
  if (!dados.sli?.trim()) criticas.push({ tipo: "corrigir", campo: "Nº SLI", mensagem: "A prestação não tem o número do SLI: o cabeçalho sai sem ele." });
  if (!dados.proponente?.trim()) criticas.push({ tipo: "corrigir", campo: "Proponente", mensagem: "A prestação não tem proponente: o cabeçalho sai sem o nome." });
  if (!cargos.length) {
    criticas.push({ tipo: "aviso", campo: "Cargos", mensagem: "Nenhum cargo na grade de RH: o arquivo sai só com o cabeçalho." });
    return criticas;
  }
  for (const c of linhasOrdenadas(cargos)) {
    const faltas = faltasDoCargo(c);
    if (faltas.length) criticas.push({ tipo: "aviso", campo: "Cargo", mensagem: `${c.cargo}: falta${faltas.length > 1 ? "m" : ""} ${juntar(faltas)}.` });
    const { ilegiveis } = cargaDosHorarios(c.horarios);
    if (ilegiveis.length) {
      criticas.push({ tipo: "aviso", campo: "Horários", mensagem: `${c.cargo}: não deu para somar o horário de ${juntar(ilegiveis.map(d => d.toLowerCase()))}; escreva como 08:00-12:00 para o Jards conferir a carga.` });
    }
    const divergente = cargaDivergente(c);
    if (divergente) {
      criticas.push({ tipo: "aviso", campo: "Carga horária semanal", mensagem: `${c.cargo}: os horários somam ${horasBr(divergente.somada)} por semana, e a carga semanal diz ${horasBr(divergente.escrita)}.` });
    }
    if (!c.no_id) criticas.push({ tipo: "aviso", campo: "Item do orçamento", mensagem: `${c.cargo} não está ligado a um item do orçamento: o Jards não confere quem foi pago no cargo.` });
  }
  criticas.push({ tipo: "aviso", campo: "Nº do processo", mensagem: "O número do processo no SEI não fica na prestação: preencha no cabeçalho." });
  return criticas;
}

const linhasOrdenadas = <T extends CargoDaGrade>(cargos: readonly T[]) =>
  [...cargos].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.cargo.localeCompare(b.cargo, "pt-BR"));

/** "Grade_RH_2600123.xlsx". */
export const nomeDaGradeRh = (sli: string | null | undefined) => `Grade_RH_${(sli ?? "").replace(/\D/g, "") || "LIE"}.xlsx`;
