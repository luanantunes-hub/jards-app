// Peças comuns das planilhas que a produção exporta (CSV com ponto e vírgula e vírgula decimal, que o Excel em português abre direto). Sem tela e sem banco.

/** Texto de uma célula da planilha: entre aspas quando tem ; " ou quebra de linha, e sem fórmula escondida (= + - @ no começo). */
export function celula(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[;"\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** Centavos inteiros como "1234,56" (sem símbolo, para a planilha fazer conta). */
export const reaisNaPlanilha = (centavos: number) => (centavos / 100).toFixed(2).replace(".", ",");

/** Junta as linhas (cada uma, uma lista de textos: o escape é feito aqui) com o BOM que o Excel pede para ler os acentos. */
export function montarPlanilha(linhas: readonly (readonly string[])[]): string {
  return "\ufeff" + linhas.map(linha => linha.map(celula).join(";")).join("\r\n") + "\r\n";
}
