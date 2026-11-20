import { tituloDaChecagem } from "@/lib/prestacao/checagens";

/**
 * Verificações cuja mensagem cita o histórico do extrato bancário (quem pagou ou recebeu) ou beneficiados pelo nome e a idade.
 * O assistente é um serviço de terceiros (Anthropic, OpenAI): para estas, ele recebe só o título e o detalhe fica no app. A lista é
 * conferida contra o código das checagens em tests/mcp-prestacao-seguranca.test.ts, então uma checagem nova que cite o extrato
 * ou um beneficiado sem entrar aqui reprova o teste.
 */
export const CODIGOS_COM_DADO_PESSOAL: ReadonlySet<string> = new Set([
  "BENEFICIADO_REPETIDO",
  "SAQUE_NO_EXTRATO",
  "APORTE_FORA_DA_CAPTACAO",
  "DEBITO_FORA_DA_VIGENCIA",
  "TARIFA_GLOSAVEL",
  "DEBITO_SEM_COMPROVANTE",
  "LANCAMENTO_EXCEDIDO",
]);

/** Verificação sobre uma linha do extrato ou sobre beneficiados: o texto delas fala de pessoas e contas, qualquer que seja o código. */
const ENTIDADES_COM_DADO_PESSOAL: ReadonlySet<string> = new Set(["lancamento", "beneficiado", "beneficiario"]);

export function mensagemParaOAssistente(v: { check_codigo: string; mensagem: string; entidade_tipo?: string | null }): string {
  if (CODIGOS_COM_DADO_PESSOAL.has(v.check_codigo) || (v.entidade_tipo && ENTIDADES_COM_DADO_PESSOAL.has(v.entidade_tipo))) {
    return `${tituloDaChecagem(v.check_codigo)}. O detalhe traz dados do extrato ou de beneficiados e fica no app.`;
  }
  return v.mensagem;
}
