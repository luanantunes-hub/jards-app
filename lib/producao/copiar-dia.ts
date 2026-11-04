// Copiar o dia de uma data para outras (plano do módulo, PD1.7). Sem tela e sem banco.

import { horaLocalParaInstante, instanteParaHoraLocal } from "@/lib/producao/dia";
import type { ExibicaoDoBloco } from "@/lib/producao/estados";

export type BlocoParaCopiar = {
  inicio: string | null; fim: string | null; exibicao: ExibicaoDoBloco; tipo: string; titulo: string | null;
  visivel_para: string[] | null; capacidade: number | null; ordem: number; notas: string | null;
};

function somarDiasAoDia(dia: string, dias: number): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, d + dias)).toISOString().slice(0, 10);
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

/**
 * Os blocos de um dia levados a outro dia: a mesma hora do relógio do lugar, no dia novo (a hora do lugar da origem
 * vira a hora do lugar do destino). Bloco que passa da meia-noite continua passando. Entram sem confirmação e sem
 * sala (a sala é do espaço da data de origem).
 */
export function copiarBlocosParaOutroDia(
  blocos: readonly BlocoParaCopiar[],
  diaDeOrigem: string, fusoDeOrigem: string, diaDeDestino: string, fusoDeDestino: string,
) {
  const delta = diasEntre(diaDeOrigem, diaDeDestino);
  const levar = (instante: string | null) => {
    if (instante === null) return null;
    const local = instanteParaHoraLocal(instante, fusoDeOrigem);
    return horaLocalParaInstante(somarDiasAoDia(local.dia, delta), local.hora, fusoDeDestino);
  };
  return blocos.map(bloco => ({
    dia: diaDeDestino, inicio: levar(bloco.inicio), fim: levar(bloco.fim), exibicao: bloco.exibicao, tipo: bloco.tipo, titulo: bloco.titulo,
    visivel_para: bloco.visivel_para, capacidade: bloco.capacidade, ordem: bloco.ordem, notas: bloco.notas, confirmado: false,
  }));
}
