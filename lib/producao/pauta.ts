// A pauta do espaço (plano do módulo, PD1.5): a grade sala × dia, o conflito (aviso, não trava) e a pré-reserva
// vencendo. Sem tela e sem banco.

import type { SituacaoDaPauta } from "@/lib/producao/estados";
import { somarDias } from "@/lib/producao/tarefas";

export type PautaDaGrade = {
  id: string; sala_id: string; titulo: string; contratante: string | null; inicio: string; fim: string;
  situacao: SituacaoDaPauta; ordem_na_fila: number | null; valida_ate: string | null;
};

export const ROTULO_DA_SITUACAO_DA_PAUTA: Record<SituacaoDaPauta, string> = {
  consulta: "Consulta", pre_reserva: "Pré-reserva", confirmada: "Confirmada", cancelada: "Cancelada",
};

/** Os `quantos` dias a partir de `inicio`, em "AAAA-MM-DD". */
export function diasDaJanela(inicio: string, quantos: number): string[] {
  return Array.from({ length: quantos }, (_, indice) => somarDias(inicio, indice));
}

/** As pautas que ocupam o dia na sala (sem as canceladas). */
export function pautasNoDia(pautas: readonly PautaDaGrade[], salaId: string, dia: string): PautaDaGrade[] {
  return pautas.filter(pauta => pauta.sala_id === salaId && pauta.situacao !== "cancelada" && pauta.inicio <= dia && dia <= pauta.fim);
}

/**
 * Os ids das pautas em conflito: duas confirmadas na mesma sala com dias em comum. É aviso na tela; nem a tela nem o
 * banco impedem (um espaço pode ter dois eventos no mesmo dia em horários diferentes).
 */
export function pautasEmConflito(pautas: readonly PautaDaGrade[]): Set<string> {
  const confirmadas = pautas.filter(pauta => pauta.situacao === "confirmada");
  const emConflito = new Set<string>();
  for (let i = 0; i < confirmadas.length; i++) {
    for (let j = i + 1; j < confirmadas.length; j++) {
      const a = confirmadas[i], b = confirmadas[j];
      if (a.sala_id === b.sala_id && a.inicio <= b.fim && b.inicio <= a.fim) { emConflito.add(a.id); emConflito.add(b.id); }
    }
  }
  return emConflito;
}

/** As pré-reservas vencidas ou que vencem em até `dias` dias (inclusive hoje). */
export function preReservasVencendo(pautas: readonly PautaDaGrade[], hoje: string, dias = 3): PautaDaGrade[] {
  const limite = somarDias(hoje, dias);
  return pautas
    .filter(pauta => pauta.situacao === "pre_reserva" && pauta.valida_ate !== null && pauta.valida_ate <= limite)
    .sort((a, b) => (a.valida_ate ?? "").localeCompare(b.valida_ate ?? ""));
}

export type LeituraDaPauta =
  | { ok: true; pauta: { titulo: string; contratante: string | null; inicio: string; fim: string; situacao: SituacaoDaPauta; ordem_na_fila: number | null; valida_ate: string | null } }
  | { ok: false; erro: string };

/** A pauta como o banco aceita: título até 200, período de até 366 dias, fila (1 a 99) e validade só na pré-reserva. */
export function lerPauta(campos: { titulo: string; contratante: string; inicio: string; fim: string; situacao: SituacaoDaPauta; ordem: string; validade: string }): LeituraDaPauta {
  const titulo = campos.titulo.trim();
  if (titulo === "") return { ok: false, erro: "Informe o título da pauta." };
  if (titulo.length > 200) return { ok: false, erro: "O título pode ter até 200 letras." };
  const contratante = campos.contratante.trim();
  if (contratante.length > 200) return { ok: false, erro: "O contratante pode ter até 200 letras." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(campos.inicio)) return { ok: false, erro: "Informe o primeiro dia." };
  const fim = campos.fim === "" ? campos.inicio : campos.fim;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fim)) return { ok: false, erro: "Informe o último dia." };
  if (fim < campos.inicio) return { ok: false, erro: "O último dia vem antes do primeiro." };
  if (somarDias(campos.inicio, 365) < fim) return { ok: false, erro: "A pauta pode durar até 366 dias." };
  let ordem: number | null = null;
  let validade: string | null = null;
  if (campos.situacao === "pre_reserva") {
    if (campos.ordem.trim() !== "") {
      if (!/^\d{1,2}$/.test(campos.ordem.trim()) || Number(campos.ordem) < 1) return { ok: false, erro: "A ordem na fila é um número de 1 a 99." };
      ordem = Number(campos.ordem);
    }
    if (campos.validade !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(campos.validade)) return { ok: false, erro: "Informe a validade da pré-reserva." };
      validade = campos.validade;
    }
  }
  return { ok: true, pauta: { titulo, contratante: contratante === "" ? null : contratante, inicio: campos.inicio, fim, situacao: campos.situacao, ordem_na_fila: ordem, valida_ate: validade } };
}

const seCruzam = (a: { inicio: string; fim: string }, b: { inicio: string; fim: string }) => a.inicio <= b.fim && b.inicio <= a.fim;

/**
 * A próxima posição na fila de pré-reservas de uma sala: depois da última que se cruza com o período (a 1ª se não há
 * nenhuma). Sobe no máximo a 99, que é o limite do banco.
 */
export function proximaOrdemNaFila(pautas: readonly PautaDaGrade[], salaId: string, inicio: string, fim: string, exceto?: string): number {
  const ordens = pautas
    .filter(pauta => pauta.id !== exceto && pauta.sala_id === salaId && pauta.situacao === "pre_reserva" && pauta.ordem_na_fila !== null && seCruzam(pauta, { inicio, fim }))
    .map(pauta => pauta.ordem_na_fila as number);
  return Math.min(99, (ordens.length > 0 ? Math.max(...ordens) : 0) + 1);
}

export type PreReservaNaFila = { pauta: PautaDaGrade; posicao: number; livre: boolean; vez: boolean };

/**
 * As pré-reservas com o lugar na fila: `livre` quando nenhuma confirmada ocupa o período, e `vez` quando é a 1ª e está
 * livre (é quem deve ser avisado: o contratante pode confirmar). Ordem: sala, 1ª antes da 2ª, e a vez primeiro.
 */
export function filaDePreReservas(pautas: readonly PautaDaGrade[]): PreReservaNaFila[] {
  const confirmadas = pautas.filter(pauta => pauta.situacao === "confirmada");
  return pautas
    .filter(pauta => pauta.situacao === "pre_reserva")
    .map(pauta => {
      const livre = !confirmadas.some(outra => outra.sala_id === pauta.sala_id && seCruzam(outra, pauta));
      const posicao = pauta.ordem_na_fila ?? 99;
      return { pauta, posicao, livre, vez: livre && posicao === 1 };
    })
    .sort((a, b) => a.pauta.sala_id.localeCompare(b.pauta.sala_id) || a.pauta.inicio.localeCompare(b.pauta.inicio) || a.posicao - b.posicao);
}

export type OcupacaoDoMes = { mes: number; confirmados: number; preReservas: number; consultas: number };

/**
 * A ocupação de uma sala mês a mês em um ano (a visão de 12 meses): quantos dias estão confirmados, quantos só têm
 * pré-reserva e quantos só têm consulta. Cada dia conta uma vez, pela situação mais firme que o ocupa; cancelada não conta.
 */
export function ocupacaoDoAno(pautas: readonly PautaDaGrade[], salaId: string, ano: number): OcupacaoDoMes[] {
  const meses: OcupacaoDoMes[] = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, confirmados: 0, preReservas: 0, consultas: 0 }));
  const doAno = pautas.filter(pauta => pauta.sala_id === salaId && pauta.situacao !== "cancelada" && pauta.fim >= `${ano}-01-01` && pauta.inicio <= `${ano}-12-31`);
  const peso: Record<string, number> = { consulta: 1, pre_reserva: 2, confirmada: 3 };
  const dias = new Map<string, number>();
  for (const pauta of doAno) {
    const de = pauta.inicio < `${ano}-01-01` ? `${ano}-01-01` : pauta.inicio;
    const ate = pauta.fim > `${ano}-12-31` ? `${ano}-12-31` : pauta.fim;
    for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) dias.set(dia, Math.max(dias.get(dia) ?? 0, peso[pauta.situacao] ?? 0));
  }
  for (const [dia, valor] of dias) {
    const mes = meses[Number(dia.slice(5, 7)) - 1];
    if (valor === 3) mes.confirmados++;
    else if (valor === 2) mes.preReservas++;
    else mes.consultas++;
  }
  return meses;
}
