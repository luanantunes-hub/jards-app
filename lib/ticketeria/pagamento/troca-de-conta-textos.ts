// O que a tela de Recebimentos e a rota da troca da conta de saques compartilham: os tipos do que o banco devolve, a data para a pessoa e as frases.
// Sem nenhum import de servidor (nada de node:*): roda no navegador, na rota e nos testes. A lógica está em troca-de-conta.ts.

export type EstadoDaTroca = {
  id: string; banco: string; agencia: string; conta: string; digito: string | null;
  confirmada: boolean; efetiva_em: string | null; codigo_expira_em: string; pedida_por: string;
};

export type ResultadoDaConfirmacao =
  | { resultado: "confirmada"; efetiva_em: string; imediata: boolean }
  | { resultado: "codigo_errado"; restantes: number }
  | { resultado: "sem_pedido" | "codigo_expirado" | "tentativas_esgotadas" };

const FUSO = "America/Sao_Paulo";
export const dataEHora = (quando: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(quando).replace(", ", " às ");

/** As frases para a pessoa, para o que a rota devolve. */
export function mensagemDoErroDaTroca(status: number, erro: string | undefined, problemas: readonly string[] = []): string {
  if (erro === "dados_invalidos" && problemas.length > 0) return `Confira: ${problemas.join("; ")}.`;
  if (erro === "mesma_conta") return "Esta já é a conta de saques.";
  if (erro === "conta_inexistente") return "Cadastre a conta de recebimento antes.";
  if (erro === "conta_bloqueada") return "A conta de recebimento precisa de atenção antes de trocar a conta de saques.";
  if (erro === "email_nao_enviado") return "Não foi possível enviar o código por e-mail. Tente de novo.";
  if (erro === "codigo_invalido") return "O código tem 6 números.";
  if (erro === "sem_permissao" || status === 403) return "Você não pode trocar a conta de saques desta loja.";
  if (erro === "muitas_tentativas" || status === 429) return "Muitas tentativas. Espere um pouco e tente de novo.";
  return "Não foi possível concluir. Tente de novo.";
}

/** O que a tela diz depois de tentar confirmar o código. */
export function frasesDaConfirmacao(r: ResultadoDaConfirmacao): string | null {
  if (r.resultado === "confirmada") return null;
  if (r.resultado === "codigo_errado") return `Código errado. ${r.restantes === 1 ? "Resta 1 tentativa." : `Restam ${r.restantes} tentativas.`}`;
  if (r.resultado === "codigo_expirado") return "O código venceu. Peça a troca de novo.";
  if (r.resultado === "tentativas_esgotadas") return "Foram 5 tentativas erradas. Peça a troca de novo.";
  return "Não há troca esperando código. Peça a troca de novo.";
}
