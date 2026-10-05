// Pagamentos da despesa (P2.5): quanto já saiu, por qual meio e para quem.
//
// alertasDosPagamentos junta o que a pessoa precisa resolver ou justificar:
// despesa sem pagamento, pagamentos acima do líquido, pagamento antes da
// emissão do documento, meio que o regime veda ou não lista, favorecido que
// não é o fornecedor e pagamento sem o número do documento (que o Salic
// compara com o extrato). Os códigos seguem o catálogo de checagens; a
// conciliação com o extrato é a P2.6. Sem React e sem Supabase.

import { ehDespesa, type AlertaDespesa } from "./despesas";
import { limparDocumento } from "./fornecedores";
import type { MeioPagamento, PagamentosRegime } from "./regimes/tipos";
import type { PrestacaoFornecedor, PrestacaoPagamento, TipoComprovante } from "@/lib/supabase/types";

export const FORMAS_PAGAMENTO: { id: MeioPagamento; rotulo: string }[] = [
  { id: "pix", rotulo: "PIX" },
  { id: "ted", rotulo: "TED" },
  { id: "doc", rotulo: "DOC" },
  { id: "boleto", rotulo: "Boleto" },
  { id: "debito_automatico", rotulo: "Débito automático" },
  { id: "cheque", rotulo: "Cheque" },
  { id: "saque", rotulo: "Saque" },
  { id: "cartao", rotulo: "Cartão" },
  { id: "cambio", rotulo: "Câmbio" },
];

export function rotuloDaForma(forma: string): string {
  return FORMAS_PAGAMENTO.find(f => f.id === forma)?.rotulo ?? forma;
}

/** Sem regime: meios que pedem justificativa na maioria das normas. */
const MEIOS_QUE_PEDEM_JUSTIFICATIVA: MeioPagamento[] = ["saque", "cheque", "cartao"];

export type PagamentoParaChecar = Pick<PrestacaoPagamento, "forma" | "data" | "valor" | "favorecido_documento" | "numero_documento">;

const centavos = (v: unknown) => Math.round((Number(v) || 0) * 100);
const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export type SituacaoPagamento = "sem_pagamento" | "parcial" | "pago" | "excedido";

/** Quanto já foi pago da despesa e quanto falta, em reais. `falta` é null sem valor líquido. */
export function situacaoDosPagamentos(liquido: number | null | undefined, pagamentos: readonly Pick<PrestacaoPagamento, "valor">[]): {
  pago: number;
  falta: number | null;
  situacao: SituacaoPagamento;
} {
  const pago = pagamentos.reduce((soma, p) => soma + centavos(p.valor), 0);
  if (!pagamentos.length) return { pago: 0, falta: liquido === null || liquido === undefined ? null : centavos(liquido) / 100, situacao: "sem_pagamento" };
  if (liquido === null || liquido === undefined) return { pago: pago / 100, falta: null, situacao: "parcial" };
  const alvo = centavos(liquido);
  const situacao: SituacaoPagamento = pago < alvo ? "parcial" : pago === alvo ? "pago" : "excedido";
  return { pago: pago / 100, falta: Math.max(alvo - pago, 0) / 100, situacao };
}

/** Os meios do regime: permitidos (null quando qualquer meio bancário serve) e vedados. */
function avaliarMeio(forma: string, regime: PagamentosRegime | null): { nivel: "alerta" | "info"; texto: string } | null {
  const rotulo = rotuloDaForma(forma);
  if (!regime) {
    return MEIOS_QUE_PEDEM_JUSTIFICATIVA.includes(forma as MeioPagamento)
      ? { nivel: "info", texto: `${rotulo} costuma pedir justificativa; confira o regime.` }
      : null;
  }
  if (regime.meiosVedados.includes(forma as MeioPagamento)) return { nivel: "alerta", texto: `O regime veda pagamento por ${rotulo.toLowerCase()}.` };
  if (regime.meiosPermitidos && !regime.meiosPermitidos.includes(forma as MeioPagamento)) {
    const lista = regime.meiosPermitidos.map(rotuloDaForma).join(", ");
    return { nivel: "alerta", texto: `${rotulo} não está entre os meios do regime (${lista}): justifique.` };
  }
  return null;
}

/**
 * O que os pagamentos da despesa têm a resolver ou justificar. Vazio para
 * documento complementar, que não é a despesa.
 */
export function alertasDosPagamentos(p: {
  despesa: { tipo: TipoComprovante; data_doc: string | null };
  /** Valor líquido da despesa (bruto menos retenções). */
  liquido: number | null;
  fornecedor: Pick<PrestacaoFornecedor, "tipo_pessoa" | "documento"> | null;
  pagamentos: readonly PagamentoParaChecar[];
  regime: PagamentosRegime | null;
}): AlertaDespesa[] {
  if (!ehDespesa(p.despesa.tipo)) return [];
  const alertas: AlertaDespesa[] = [];
  const add = (codigo: AlertaDespesa["codigo"], nivel: AlertaDespesa["nivel"], texto: string) => alertas.push({ codigo, nivel, texto });

  if (!p.pagamentos.length) {
    add("PAGAMENTO_FALTANDO", "info", "Registre o pagamento: forma, data, valor e o número do documento, igual ao do extrato.");
    return alertas;
  }

  const { pago, situacao } = situacaoDosPagamentos(p.liquido, p.pagamentos);
  if (situacao === "excedido") {
    add("PAGAMENTO_EXCEDE", "alerta", `Os pagamentos somam ${reais(centavos(pago))}, acima do líquido da despesa (${reais(centavos(p.liquido))}).`);
  }

  const documentoDoFornecedor = p.fornecedor ? limparDocumento(p.fornecedor.documento) : "";
  const vistos = new Set<string>();
  for (const pag of p.pagamentos) {
    const quando = dataBr(pag.data);
    if (p.despesa.data_doc && pag.data < p.despesa.data_doc) {
      add("PAGAMENTO_ANTECIPADO", "alerta", `Pagamento de ${quando} antes da emissão do documento (${dataBr(p.despesa.data_doc)}).`);
    }
    const meio = avaliarMeio(pag.forma, p.regime);
    if (meio && !vistos.has(`meio:${pag.forma}`)) {
      vistos.add(`meio:${pag.forma}`);
      add("PAGAMENTO_MEIO", meio.nivel, meio.texto);
    }
    const favorecido = limparDocumento(pag.favorecido_documento);
    // MEI pode receber na conta do CPF do titular.
    const meiNoCpf = p.fornecedor?.tipo_pessoa === "mei" && favorecido.length === 11;
    if (favorecido && documentoDoFornecedor && favorecido !== documentoDoFornecedor && !meiNoCpf && !vistos.has(`fav:${favorecido}`)) {
      vistos.add(`fav:${favorecido}`);
      add("FAVORECIDO_DIFERENTE", "alerta", `O pagamento de ${quando} foi para outro CPF ou CNPJ, não para o fornecedor.`);
    }
    if (!(pag.numero_documento ?? "").trim() && !vistos.has("sem_numero")) {
      vistos.add("sem_numero");
      add("PAGAMENTO_SEM_NUMERO", "info", "Informe o número do documento de pagamento, igual ao do extrato (sem ponto nem vírgula).");
    }
  }
  return alertas;
}
