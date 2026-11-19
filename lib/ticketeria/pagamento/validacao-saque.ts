// A validação de saque do Asaas (o CADEADO do repasse, D11 do plano em docs/acoes-futuras/estudos/plano-modulo-ticketeria.md): a cada saque,
// o Asaas manda um POST ao Jards cerca de 5 segundos depois e espera `{"status": "APPROVED"}` ou `{"status": "REFUSED", "refuseReason": "..."}`.
// A decisão está no banco (fn_ticketeria_validar_saque); aqui só se lê o aviso e se monta a resposta.
//
// Formato do aviso (documentação do Asaas, conferida em 19/11/2026): `{ "type": "TRANSFER" | "BILL" | "PIX_QR_CODE" | "MOBILE_PHONE_RECHARGE" |
// "PIX_REFUND" | "PAYMENT_SPLIT", "<objeto>": { ... } }`, com o objeto `transfer`, `bill`, `pixQrCode`, `mobilePhoneRecharge`, `pixRefund` ou
// `paymentSplit`. **Nenhum campo diz de qual subconta vem a operação**: só o destino (`transfer.bankAccount`). E o CPF/CNPJ do destino vem
// **mascarado** (`***.715.637-**`, visto no teste de verdade em 19/11/2026), então o produtor é identificado pela **conta bancária de destino**
// (banco, agência, conta e dígito, que vêm inteiros), que o banco confere em fn_ticketeria_validar_saque lendo o próprio aviso. O valor vem em reais.

import { timingSafeEqual } from "node:crypto";

export type DestinoDoSaque = "conta_bancaria" | "conta_asaas" | "outro";

export type PedidoDeSaque = {
  tipo: string;
  id_externo: string;
  destino: DestinoDoSaque;
  /** CPF ou CNPJ de quem recebe, só os números (11 ou 14); null quando o aviso não traz ou vem mascarado (o caso do saque). */
  cpf_cnpj: string | null;
  valor_centavos: number;
};

const OBJETO_DO_TIPO: Record<string, string> = {
  TRANSFER: "transfer",
  BILL: "bill",
  PIX_QR_CODE: "pixQrCode",
  MOBILE_PHONE_RECHARGE: "mobilePhoneRecharge",
  PIX_REFUND: "pixRefund",
  PAYMENT_SPLIT: "paymentSplit",
};

const registro = (valor: unknown): Record<string, unknown> | null => (valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null);
const apenasNumeros = (texto: unknown) => (typeof texto === "string" ? texto.replace(/\D/g, "") : "");

/** Lê o aviso. `ok: false` quando não dá para saber o tipo, o id ou o valor: o chamador responde erro e o Asaas cancela a operação. */
export function lerPedidoDeSaque(corpo: string): { ok: true; pedido: PedidoDeSaque; payload: unknown } | { ok: false } {
  let dados: unknown;
  try { dados = JSON.parse(corpo); } catch { return { ok: false }; }
  const raiz = registro(dados);
  if (!raiz || typeof raiz.type !== "string" || !/^[A-Z_]{1,40}$/.test(raiz.type)) return { ok: false };
  const tipo = raiz.type;
  const objeto = registro(raiz[OBJETO_DO_TIPO[tipo] ?? ""]);
  if (!objeto || typeof objeto.id !== "string" || objeto.id === "" || objeto.id.length > 200) return { ok: false };
  const reais = typeof objeto.value === "number" ? objeto.value : typeof objeto.totalValue === "number" ? objeto.totalValue : typeof objeto.fixedValue === "number" ? objeto.fixedValue : NaN;
  if (!Number.isFinite(reais) || reais < 0) return { ok: false };

  let destino: DestinoDoSaque = "outro";
  let documento = "";
  if (tipo === "TRANSFER") {
    const banco = registro(objeto.bankAccount);
    if (objeto.type === "ASAAS_ACCOUNT") destino = "conta_asaas";
    else if (banco) destino = "conta_bancaria";
    documento = apenasNumeros(banco?.cpfCnpj);
  } else if (tipo === "PIX_REFUND") {
    documento = apenasNumeros(registro(objeto.externalAccount)?.cpfCnpj);
  }
  return {
    ok: true,
    payload: dados,
    pedido: { tipo, id_externo: objeto.id, destino, cpf_cnpj: documento.length === 11 || documento.length === 14 ? documento : null, valor_centavos: Math.round(reais * 100) },
  };
}

export type DecisaoDeSaque = { status: "APPROVED" | "REFUSED"; motivo: string };

const TEXTOS: Record<string, string> = {
  retido_ate_depois_do_evento: "Valor retido até as 18h do dia seguinte ao evento.",
  destino_nao_e_de_produtor_cadastrado: "O destino não é a conta de um produtor cadastrado.",
  transferencia_sem_ordem_registrada: "Transferência sem ordem registrada.",
  estorno_sem_ordem_registrada: "Estorno sem ordem registrada.",
  valor_invalido: "Valor inválido.",
};

/** O motivo que o Asaas mostra (sem dado de ninguém): o texto conhecido, ou um genérico. */
export const textoDaRecusa = (motivo: string) => TEXTOS[motivo] ?? "Operação não permitida pelo Jards.";

export type RespostaDaValidacao = { status: number; corpo: { status?: "APPROVED" | "REFUSED"; refuseReason?: string; error?: string } };

/** O maior corpo aceito. Os avisos do Asaas têm poucos KB. */
export const TAMANHO_MAXIMO_DO_PEDIDO_DE_SAQUE = 64 * 1024;

/**
 * Trata o pedido HTTP do Asaas. Falha fechada: sem o token configurado, 503; token errado, 401; corpo que não se entende, 400; erro do banco,
 * 500. Em todos esses casos o Asaas **cancela a operação** (a documentação: resposta que não é APPROVED nem REFUSED, ou três falhas seguidas),
 * então nada sai por engano. Só o banco aprova.
 */
export async function tratarPedidoDeSaque(entrada: {
  tokenEsperado: string | null;
  assinatura: string | null;
  corpo: string;
  validar: (pedido: PedidoDeSaque, payload: unknown) => Promise<DecisaoDeSaque>;
  registrarErro?: (erro: unknown) => void;
  /** Quando o token não bate: só o TAMANHO do que chegou (0 = o Asaas não mandou token), para achar o desencontro sem expor segredo. */
  registrarTokenRecusado?: (tamanhoRecebido: number) => void;
}): Promise<RespostaDaValidacao> {
  const esperado = entrada.tokenEsperado;
  if (!esperado || esperado.length < 32) return { status: 503, corpo: { error: "validacao_nao_configurada" } };
  const recebido = Buffer.from(entrada.assinatura ?? "");
  const certo = Buffer.from(esperado);
  if (recebido.length !== certo.length || !timingSafeEqual(recebido, certo)) {
    entrada.registrarTokenRecusado?.(recebido.length);
    return { status: 401, corpo: { error: "token_invalido" } };
  }
  if (new TextEncoder().encode(entrada.corpo).length > TAMANHO_MAXIMO_DO_PEDIDO_DE_SAQUE) return { status: 413, corpo: { error: "corpo_grande_demais" } };
  const leitura = lerPedidoDeSaque(entrada.corpo);
  if (!leitura.ok) return { status: 400, corpo: { error: "pedido_ilegivel" } };
  try {
    const decisao = await entrada.validar(leitura.pedido, leitura.payload);
    return decisao.status === "APPROVED"
      ? { status: 200, corpo: { status: "APPROVED" } }
      : { status: 200, corpo: { status: "REFUSED", refuseReason: textoDaRecusa(decisao.motivo) } };
  } catch (erro) {
    entrada.registrarErro?.(erro);
    return { status: 500, corpo: { error: "falha_ao_validar" } };
  }
}
