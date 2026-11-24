// Desfazer e refazer, sem estado escondido: o histórico é um valor e cada função devolve um novo (testes em tests/ticketeria-desfazer-refazer.test.ts). Serve ao editor do desenho
// do mapa, mas não sabe nada dele: guarda "versões" de qualquer coisa que só muda por cópia.

export type Versoes<T> = {
  passado: readonly T[];
  atual: T;
  futuro: readonly T[];
  /** Quando foi o último registro agrupado (null se o último não foi agrupado, ou se acabou de desfazer). */
  ultimo: number | null;
};

/** Quantos passos para trás ficam guardados. */
export const LIMITE_DE_VERSOES = 60;
/** Mudanças agrupadas que chegam com menos que isto entre uma e outra (um arraste dispara dezenas) viram um passo só. */
export const JANELA_DE_AGRUPAR_MS = 400;

export const versoesNovas = <T,>(atual: T): Versoes<T> => ({ passado: [], atual, futuro: [], ultimo: null });

const igual = (a: unknown, b: unknown) => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);

/**
 * Registra a versão nova. Igual à atual: nada muda. Com `agrupar`, se o registro anterior também foi agrupado e foi há pouco, a versão nova toma o lugar da atual em vez de
 * abrir um passo (um arraste inteiro desfaz de uma vez). Registrar algo novo apaga o que havia para refazer.
 */
export function registrar<T>(v: Versoes<T>, novo: T, agora: number, agrupar = false): Versoes<T> {
  if (igual(novo, v.atual)) return v;
  const junta = agrupar && v.ultimo !== null && agora - v.ultimo <= JANELA_DE_AGRUPAR_MS;
  const passado = junta ? v.passado : [...v.passado, v.atual].slice(-LIMITE_DE_VERSOES);
  return { passado, atual: novo, futuro: [], ultimo: agrupar ? agora : null };
}

export const podeDesfazer = <T,>(v: Versoes<T>) => v.passado.length > 0;
export const podeRefazer = <T,>(v: Versoes<T>) => v.futuro.length > 0;

export function desfazer<T>(v: Versoes<T>): Versoes<T> {
  if (v.passado.length === 0) return v;
  return { passado: v.passado.slice(0, -1), atual: v.passado[v.passado.length - 1], futuro: [v.atual, ...v.futuro], ultimo: null };
}

export function refazer<T>(v: Versoes<T>): Versoes<T> {
  if (v.futuro.length === 0) return v;
  return { passado: [...v.passado, v.atual], atual: v.futuro[0], futuro: v.futuro.slice(1), ultimo: null };
}
