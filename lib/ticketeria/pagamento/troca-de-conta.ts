// Trocar a conta de saques do produtor: código por e-mail, 24 horas de espera e aviso (passo B do cadeado do repasse; a regra está em
// supabase/migrations/20261119270000_ticketeria_troca_de_conta_de_saque.sql). Aqui mora a lógica, com as portas injetadas: testa-se sem rede e sem
// banco (tests/ticketeria-troca-de-conta.test.ts). Sem nenhum import de servidor além do `node:crypto`: a rota entrega as portas reais.

import { createHash, randomInt } from "node:crypto";
import { problemasDaContaBancaria, type ContaBancaria } from "@/lib/ticketeria/pagamento/dados-do-produtor";
import { resumoDaContaDeSaque } from "@/lib/ticketeria/recebimentos";
import { dataEHora, type ResultadoDaConfirmacao } from "@/lib/ticketeria/pagamento/troca-de-conta-textos";

export { frasesDaConfirmacao, mensagemDoErroDaTroca, type EstadoDaTroca, type ResultadoDaConfirmacao } from "@/lib/ticketeria/pagamento/troca-de-conta-textos";

export const VALIDADE_DO_CODIGO_EM_MINUTOS = 15;

/** Seis dígitos, sorteados com `crypto.randomInt` (zeros à esquerda valem). */
export function gerarCodigo(sorteio: (menor: number, maior: number) => number = randomInt): string {
  return String(sorteio(0, 1_000_000)).padStart(6, "0");
}

/** O hash que o banco guarda: do código, da loja e de quem pediu (o código de um pedido não serve em outro). */
export function hashDoCodigo(codigo: string, loja: string, usuario: string): string {
  return createHash("sha256").update(`${codigo}:${loja}:${usuario}`).digest("hex");
}

/** Os erros que a pessoa precisa entender (a rota os transforma em frase). */
export type CodigoDoErroDaTroca =
  | "dados_invalidos" | "mesma_conta" | "conta_inexistente" | "conta_bloqueada" | "email_nao_enviado" | "codigo_invalido";

export class ErroDaTroca extends Error {
  constructor(readonly codigo: CodigoDoErroDaTroca, readonly problemas: readonly string[] = []) {
    super(codigo);
    this.name = "ErroDaTroca";
  }
}

export type PortasDaTroca = {
  /** fn_ticketeria_troca_pedir. Os erros do banco (mesma_conta, conta_inexistente, conta_bloqueada) saem como ErroDaTroca. */
  pedir(loja: string, usuario: string, conta: ContaBancaria, hash: string, expiraEm: Date): Promise<void>;
  /** fn_ticketeria_troca_confirmar. */
  confirmar(loja: string, usuario: string, hash: string): Promise<ResultadoDaConfirmacao>;
  /** fn_ticketeria_troca_cancelar. */
  cancelar(loja: string): Promise<number>;
  /** O e-mail transacional. Devolve false se não saiu. */
  enviarEmail(para: string, mensagem: { assunto: string; texto: string; html: string }): Promise<boolean>;
};

const escapar = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function emHtml(paragrafos: readonly string[]): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#282525">${paragrafos.map(p => `<p style="margin:0 0 14px">${p}</p>`).join("")}</div>`;
}

export function emailDoCodigo(codigo: string): { assunto: string; texto: string; html: string } {
  const texto = [
    `Seu código para trocar a conta de saques: ${codigo}`,
    `Ele vale por ${VALIDADE_DO_CODIGO_EM_MINUTOS} minutos. Digite-o na tela da Ticketeria do Jards para confirmar a troca.`,
    "Se não foi você, ignore este e-mail: nada muda sem o código.",
  ].join("\n\n");
  return {
    assunto: `Código ${codigo} para trocar a conta de saques`,
    texto,
    html: emHtml([
      "Seu código para trocar a conta de saques:",
      `<span style="font-size:28px;font-weight:bold;letter-spacing:6px">${escapar(codigo)}</span>`,
      `Ele vale por ${VALIDADE_DO_CODIGO_EM_MINUTOS} minutos. Digite-o na tela da Ticketeria do Jards para confirmar a troca.`,
      "Se não foi você, ignore este e-mail: nada muda sem o código.",
    ]),
  };
}

/** O aviso depois de confirmar: diz o que muda, quando, e como desfazer. */
export function emailDoAviso(entrada: { conta: ContaBancaria; efetivaEm: Date; imediata: boolean }): { assunto: string; texto: string; html: string } {
  const resumo = resumoDaContaDeSaque({ banco_codigo: entrada.conta.banco, agencia: entrada.conta.agencia, conta: entrada.conta.conta, conta_digito: entrada.conta.digito ?? null }) ?? "a conta nova";
  const quando = dataEHora(entrada.efetivaEm);
  const linhas = entrada.imediata
    ? [`A conta de saques da sua Ticketeria no Jards foi definida: ${resumo}.`, "Os saques passam a sair só para ela."]
    : [
      `Pediram para trocar a conta de saques da sua Ticketeria no Jards para: ${resumo}.`,
      `A troca só vale em ${quando}. Até lá, os saques continuam saindo só para a conta atual.`,
      "Se não foi você, abra Ticketeria > Recebimentos e cancele a troca agora, e troque sua senha.",
    ];
  return { assunto: entrada.imediata ? "Conta de saques definida" : "Troca da conta de saques pedida", texto: linhas.join("\n\n"), html: emHtml(linhas.map(escapar)) };
}

/** Pede a troca: confere a conta, sorteia o código, grava o hash e manda o código por e-mail. Se o e-mail não sai, o pedido é cancelado. */
export async function pedirTrocaDeConta(entrada: {
  loja: string; usuario: string; email: string; conta: ContaBancaria; portas: PortasDaTroca; agora?: Date; codigo?: string;
}): Promise<{ expira_em: string }> {
  const problemas = problemasDaContaBancaria(entrada.conta);
  if (problemas.length > 0) throw new ErroDaTroca("dados_invalidos", problemas);
  const codigo = entrada.codigo ?? gerarCodigo();
  const expiraEm = new Date((entrada.agora ?? new Date()).getTime() + VALIDADE_DO_CODIGO_EM_MINUTOS * 60_000);
  await entrada.portas.pedir(entrada.loja, entrada.usuario, entrada.conta, hashDoCodigo(codigo, entrada.loja, entrada.usuario), expiraEm);
  const enviado = await entrada.portas.enviarEmail(entrada.email, emailDoCodigo(codigo));
  if (!enviado) {
    await entrada.portas.cancelar(entrada.loja).catch(() => 0);
    throw new ErroDaTroca("email_nao_enviado");
  }
  return { expira_em: expiraEm.toISOString() };
}

/** Confirma com o código. Com a troca confirmada, manda o aviso (que não vale como condição: se o e-mail falhar, a troca segue confirmada). */
export async function confirmarTrocaDeConta(entrada: {
  loja: string; usuario: string; email: string; codigo: string; conta: ContaBancaria; portas: PortasDaTroca;
}): Promise<ResultadoDaConfirmacao & { aviso_enviado?: boolean }> {
  const codigo = (entrada.codigo ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(codigo)) throw new ErroDaTroca("codigo_invalido");
  const resultado = await entrada.portas.confirmar(entrada.loja, entrada.usuario, hashDoCodigo(codigo, entrada.loja, entrada.usuario));
  if (resultado.resultado !== "confirmada") return resultado;
  const avisado = await entrada.portas.enviarEmail(entrada.email, emailDoAviso({ conta: entrada.conta, efetivaEm: new Date(resultado.efetiva_em), imediata: resultado.imediata })).catch(() => false);
  return { ...resultado, aviso_enviado: avisado };
}

