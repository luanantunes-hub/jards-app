// A bilheteria (venda de ingressos na porta do evento): a conta ligada só à loja, fora dos papéis da organização. Só lógica: sem banco e sem tela.
// O banco decide (fn_ticketeria_bilheteiro_atual); aqui a resposta é conferida e as frases da tela de entrada ficam num lugar só.

export type BilheteiroDaLoja = { id: string; lojaId: string; loja: string; nome: string };

/** O que fn_ticketeria_bilheteiro_atual devolveu, conferido; item fora do formato é ignorado. */
export function lerBilheteiros(resposta: unknown): BilheteiroDaLoja[] {
  if (!Array.isArray(resposta)) return [];
  const saida: BilheteiroDaLoja[] = [];
  for (const bruto of resposta) {
    const b = (bruto && typeof bruto === "object" ? bruto : {}) as { id?: unknown; loja_id?: unknown; loja?: unknown; nome?: unknown };
    if (typeof b.id === "string" && typeof b.loja_id === "string" && typeof b.loja === "string" && typeof b.nome === "string") saida.push({ id: b.id, lojaId: b.loja_id, loja: b.loja, nome: b.nome });
  }
  return saida;
}

/** Os endereços da bilheteria. */
export const ENTRADA_DA_BILHETERIA = "/bilheteria/entrar";
export const INICIO_DA_BILHETERIA = "/bilheteria";

/** Por que a pessoa voltou para a tela de entrada (o `?motivo=` do endereço). */
export type MotivoDaEntrada = "outra-conta" | "desligada";

export function motivoDaEntrada(valor: string | null | undefined): MotivoDaEntrada | null {
  return valor === "outra-conta" || valor === "desligada" ? valor : null;
}

export function frasesDaEntrada(motivo: MotivoDaEntrada | null): string | null {
  if (motivo === "outra-conta") return "Esta conta não é de uma bilheteria. Peça a quem organiza o evento para cadastrar o seu e-mail.";
  if (motivo === "desligada") return "O seu acesso à bilheteria foi desligado. Fale com quem organiza o evento.";
  return null;
}

/** O erro do login numa frase (o Supabase devolve o código em inglês). */
export function mensagemDoLogin(erro: { code?: string; message?: string; status?: number }): string {
  if (erro.code === "invalid_credentials" || /invalid login credentials/i.test(erro.message ?? "")) return "E-mail ou senha incorretos.";
  if (erro.code === "email_not_confirmed") return "Confirme o e-mail antes de entrar.";
  if (erro.status === 429 || erro.code === "over_request_rate_limit") return "Muitas tentativas. Espere um minuto e tente de novo.";
  return "Não foi possível entrar agora. Tente de novo.";
}
