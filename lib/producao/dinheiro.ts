// Dinheiro na produção: centavos inteiros, o formato brasileiro e a leitura do que a pessoa digita. Sem tela e sem banco.
// (Estas três funções moravam em lib/producao/bordero.ts, que saiu da Produção na T1 da Ticketeria, 18/11/2026.)

/** Reais para centavos inteiros, sem erro de ponto flutuante (19,9 vira 1990). */
export const emCentavos = (reais: number) => Math.round(reais * 100);

const FORMATADOR = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
/** "R$ 1.234,56" a partir de centavos inteiros. */
export function formatarReais(centavos: number): string {
  return FORMATADOR.format(centavos / 100).replace(/ /g, " ");
}

/**
 * Lê um valor em reais como a pessoa digita: "50", "50,5", "1.234,56" ou "1234.56". Devolve o valor com no máximo duas casas, ou null se não for um
 * número válido não negativo. O ponto só vale como milhar quando há vírgula decimal (ou três dígitos depois dele sem vírgula).
 */
export function lerValorEmReais(texto: string): number | null {
  let bruto = texto.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (bruto === "") return null;
  if (bruto.includes(",")) bruto = bruto.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(bruto)) bruto = bruto.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(bruto)) return null;
  const numero = Number(bruto);
  return Number.isFinite(numero) ? numero : null;
}
