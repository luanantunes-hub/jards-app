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

/** Valor para o campo ("150.000,00"); vazio quando não há valor. Aceita o numeric do banco em texto. */
export function formatarValorBRL(valor: number | string | null | undefined): string {
  if (valor == null || valor === "") return "";
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

export const MENSAGEM_VALOR_INVALIDO = "Confira o valor: use só números, como 150.000,00.";

/** Parte inteira aceita no campo de valor: até R$ 999 bilhões. */
const MAX_DIGITOS_INTEIROS = 12;

/**
 * Máscara do campo de valor enquanto a pessoa digita: pontos de milhar e a
 * vírgula dos centavos aparecem na hora ("1234,5" vira "1.234,5"), com no
 * máximo dois centavos. Os pontos são sempre refeitos pela máscara; a vírgula
 * é digitada por quem preenche (o campo troca o ponto do teclado numérico por
 * vírgula antes de chamar). Devolve também onde o cursor fica, para ele não
 * pular para o fim quando a pessoa edita no meio do número.
 */
export function mascararValorBRL(texto: string, cursor: number = texto.length): { texto: string; cursor: number } {
  let inteiro = "";
  let centavos = "";
  let temVirgula = false;
  // Caracteres que ficam (algarismos e a vírgula) antes do cursor.
  let antes = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    const antesDoCursor = i < cursor;
    if (c >= "0" && c <= "9") {
      if (!temVirgula) {
        if (inteiro.replace(/^0+/, "").length >= MAX_DIGITOS_INTEIROS) continue;
        inteiro += c;
        if (antesDoCursor) antes++;
      } else if (centavos.length < 2) {
        centavos += c;
        if (antesDoCursor) antes++;
      }
    } else if (c === "," && !temVirgula) {
      temVirgula = true;
      if (antesDoCursor) antes++;
    }
  }

  // Zeros à esquerda saem ("007" vira "7"); vírgula sem inteiro ganha o zero (",5" vira "0,5").
  const zeros = inteiro.length - inteiro.replace(/^0+(?=\d)/, "").length;
  inteiro = inteiro.slice(zeros);
  antes = Math.max(0, antes - zeros);
  if (temVirgula && !inteiro) {
    inteiro = "0";
    if (antes > 0) antes++;
  }
  if (!inteiro && !temVirgula) return { texto: "", cursor: 0 };

  const formatado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (temVirgula ? `,${centavos}` : "");
  let posicao = 0;
  for (let contados = 0; posicao < formatado.length && contados < antes; posicao++) {
    if (formatado[posicao] !== ".") contados++;
  }
  return { texto: formatado, cursor: posicao };
}

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
