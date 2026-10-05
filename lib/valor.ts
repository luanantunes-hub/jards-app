/**
 * Valores em reais digitados à mão: aceita "150.000,00", "150000", "150.000"
 * e "1500,5". Devolve null para campo vazio; `valido` diz se o texto pôde ser lido.
 */
export function lerValorBRL(texto: string): { valor: number | null; valido: boolean } {
  const limpo = texto.replace(/R\$|\s/g, "");
  if (!limpo) return { valor: null, valido: true };
  if (!/^[\d.,]+$/.test(limpo)) return { valor: null, valido: false };
  let normal = limpo;
  if (normal.includes(",")) {
    // Vírgula é o decimal; pontos são milhar.
    if ((normal.match(/,/g) ?? []).length > 1) return { valor: null, valido: false };
    normal = normal.replace(/\./g, "").replace(",", ".");
  } else if ((normal.match(/\./g) ?? []).length > 1 || /^\d{1,3}\.\d{3}$/.test(normal)) {
    // "1.500.000" ou "150.000": pontos de milhar.
    normal = normal.replace(/\./g, "");
  }
  const valor = Number(normal);
  if (!Number.isFinite(valor)) return { valor: null, valido: false };
  return { valor: Math.round(valor * 100) / 100, valido: true };
}

export function formatarValorBRL(valor: number | null | undefined): string {
  return valor == null ? "" : valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const MENSAGEM_VALOR_INVALIDO = "Confira o valor: use só números, como 150.000,00.";
