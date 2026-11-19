/**
 * Brilho da folha de criar: quando o botão principal (`PrimaryListAction`) abre uma folha que
 * desce do topo, uma luz violeta passa uma vez pela borda de cima dela e some (classe
 * `.brilho-da-folha`, em app/globals.css). O botão em si fica parado. Aqui fica só a escolha da
 * folha, para dar para testar sem navegador.
 */

/** Quadros que o botão espera, no máximo, a folha aparecer depois do clique. */
export const QUADROS_PARA_ACHAR_A_FOLHA = 8;

/** Tempo do brilho na tela (atraso de 160ms + passagem de 900ms, com folga), para desmontar depois. */
export const DURACAO_DO_BRILHO_MS = 1200;

/**
 * A folha que acabou de abrir: a primeira caixa de diálogo que não existia antes do clique e
 * começa no topo da tela. A folha que desce do topo nasce acima da tela (topo negativo) ou já
 * colada nele (topo 0). Folha que sobe de baixo ou modal no meio da tela: nenhuma.
 */
export function folhaQueDesceuDoTopo<T>(antes: ReadonlySet<T>, depois: Iterable<T>, topoDe: (folha: T) => number): T | null {
  for (const folha of depois) {
    if (antes.has(folha)) continue;
    if (topoDe(folha) <= 1) return folha;
  }
  return null;
}
