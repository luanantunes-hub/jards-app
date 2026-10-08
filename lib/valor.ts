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

const VALOR_INTEIRO = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const VALOR_COMPACTO = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 });
const VALOR_COMPLETO = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Valor para resumos, indicadores e totais: inteiro até R$ 999.999 ("R$ 400.000")
 * e abreviado daí em diante ("R$ 1,5 mi", "R$ 13 bi"). Vazio vira "—".
 */
export function formatarValorCurto(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return Math.abs(valor) >= 1_000_000 ? VALOR_COMPACTO.format(valor) : VALOR_INTEIRO.format(valor);
}

/** Valor exato com centavos ("R$ 1.250.000,00"), para `title` de um valor abreviado. */
export function formatarValorCompleto(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return "—";
  return VALOR_COMPLETO.format(valor);
}
