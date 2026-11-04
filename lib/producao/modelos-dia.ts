// Modelos de dia da organização (plano do módulo, PD1.7): o dia de uma data guardado como lista de blocos
// (tipo, título, duração) e a volta, de modelo guardado a modelo de montar o dia. Sem tela e sem banco.

import { instanteParaHoraLocal } from "@/lib/producao/dia";
import type { ModeloDia } from "@/lib/producao/vocabulario";

export type BlocoDoModelo = { tipo: string; titulo: string; duracaoMin: number };

type BlocoDoDia = { inicio: string | null; fim: string | null; tipo: string; titulo: string | null; ordem: number };

const DURACAO_PADRAO_MIN = 60;

/**
 * Os blocos de um dia viram a lista do modelo, em ordem de hora. A duração é a do bloco (início a fim); o bloco sem
 * hora ou sem fim leva a duração padrão de uma hora. Bloco sem título não entra (o modelo exige título).
 */
export function blocosParaModelo(blocos: readonly BlocoDoDia[]): BlocoDoModelo[] {
  const ordenados = [...blocos].sort((a, b) => {
    if (a.inicio === null && b.inicio === null) return a.ordem - b.ordem;
    if (a.inicio === null) return 1;
    if (b.inicio === null) return -1;
    return a.inicio.localeCompare(b.inicio) || a.ordem - b.ordem;
  });
  return ordenados.flatMap(bloco => {
    const titulo = (bloco.titulo ?? "").trim();
    if (titulo === "") return [];
    const minutos = bloco.inicio && bloco.fim ? Math.round((Date.parse(bloco.fim) - Date.parse(bloco.inicio)) / 60_000) : DURACAO_PADRAO_MIN;
    return [{ tipo: bloco.tipo, titulo: titulo.slice(0, 120), duracaoMin: Math.min(1440, Math.max(1, minutos)) }];
  });
}

/** A hora de início do primeiro bloco (no lugar), para sugerir "a hora do primeiro bloco" ao montar o dia. */
export function horaDoPrimeiroBloco(blocos: readonly { inicio: string | null }[], fuso: string): string | null {
  const primeiro = blocos.map(bloco => bloco.inicio).filter((inicio): inicio is string => inicio !== null).sort()[0];
  return primeiro ? instanteParaHoraLocal(primeiro, fuso).hora : null;
}

export type ModeloGuardado = { id: string; nome: string; blocos: unknown };

/** Lê a lista guardada no banco; o que não tem a forma de um bloco do modelo é ignorado. */
export function lerBlocosDoModelo(blocos: unknown): BlocoDoModelo[] {
  if (!Array.isArray(blocos)) return [];
  return blocos.flatMap(item => {
    if (typeof item !== "object" || item === null) return [];
    const { tipo, titulo, duracaoMin } = item as Record<string, unknown>;
    if (typeof tipo !== "string" || typeof titulo !== "string" || typeof duracaoMin !== "number" || !Number.isFinite(duracaoMin)) return [];
    return [{ tipo, titulo, duracaoMin }];
  });
}

/** Um modelo guardado, no formato que `montarDiaDoModelo` usa (o `id` leva o prefixo da organização). */
export function modeloDaOrganizacao(modelo: ModeloGuardado, tipoDeDataPadrao: ModeloDia["tipoData"]): ModeloDia {
  return { id: `org-${modelo.id}`, nome: modelo.nome, tipoData: tipoDeDataPadrao, blocos: lerBlocosDoModelo(modelo.blocos) as ModeloDia["blocos"] };
}
