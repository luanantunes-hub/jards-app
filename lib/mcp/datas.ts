/** Data de hoje (AAAA-MM-DD) no fuso de São Paulo: o prazo de um edital vence no dia, não às 21h do dia anterior. */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
