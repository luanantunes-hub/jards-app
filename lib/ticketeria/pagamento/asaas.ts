// O adaptador do Asaas (provedor escolhido pelo dono em 19/11/2026): implementa ProvedorDePagamento para o Pix. Escrito a partir da
// documentação pública da API v3 (docs.asaas.com), conferida em 19/11/2026, e provado só com respostas falsas: nenhuma chamada de
// verdade foi feita. O cartão fica para a T5 (os dados do cartão pedem tratamento próprio); o split e a garantia de subconta
// negativa dependem da resposta do comercial do Asaas (docs/acoes-futuras/estudos/plano-modulo-ticketeria.md, seção 7).
//
// O que a documentação diz e este arquivo segue:
//   - a chave vai no cabeçalho `access_token`; o sandbox é https://api-sandbox.asaas.com/v3;
//   - a cobrança exige um cliente (`customer`), e o cliente exige nome e `cpfCnpj`: sem o CPF ou CNPJ do comprador, a cobrança não nasce;
//   - o Pix (copia e cola e QR) vem de GET /payments/{id}/pixQrCode, depois de criar a cobrança;
//   - o aviso (webhook) traz o `authToken` que definimos no cabeçalho `asaas-access-token` (não há assinatura HMAC), tem um `id` de
//     evento que se repete no reenvio (entrega "pelo menos uma vez") e o nosso pedido volta em `payment.externalReference`;
//   - PAYMENT_RECEIVED e PAYMENT_CONFIRMED são pagamento; PAYMENT_REFUNDED e _PARTIALLY_REFUNDED, estorno; PAYMENT_CHARGEBACK_REQUESTED,
//     chargeback; o resto (criada, vencida, visualizada...) não muda nada para nós;
//   - o estorno integral de um Pix logo depois de recebido pode falhar com 400 por falta de saldo (as taxas não voltam).

import { timingSafeEqual } from "node:crypto";
import type { AvisoDoProvedor, Cobranca, LeituraDoAviso, ParcelamentoDoProvedor, PedidoParaCobrar, ProvedorDePagamento } from "@/lib/ticketeria/pagamento/provedor";
import { partesNoFuso } from "@/lib/ticketeria/eventos";

export const URL_DO_SANDBOX = "https://api-sandbox.asaas.com/v3";

export type ConfiguracaoDoAsaas = {
  chave: string;
  /** O token que o Asaas devolve no cabeçalho `asaas-access-token` de cada aviso (32 a 255 letras, definido por nós ao criar o webhook). */
  tokenDoWebhook: string;
  /** Base da API, com /v3. O sandbox por padrão. */
  url?: string;
  /** Para os testes. */
  fetch?: typeof fetch;
  /** Tempo máximo de cada chamada, em milissegundos. */
  tempoMaximoMs?: number;
  /** Quanto esperar antes de pedir o QR de novo, em milissegundos (a primeira vez de uma conta sem chave Pix). Para os testes: 0. */
  esperaDoQrMs?: number;
};

/** O erro de uma chamada ao Asaas: o status e os códigos que ele devolveu (nunca a chave nem o corpo da resposta inteiro). */
export class ErroDoAsaas extends Error {
  constructor(readonly status: number, readonly codigos: string[], mensagem: string) {
    super(mensagem);
    this.name = "ErroDoAsaas";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** O `provedor_ref` de um pedido parcelado no cartão é o id do parcelamento (um UUID); o de uma cobrança única é `pay_...`. */
export const ehParcelamentoDoAsaas = (ref: string) => UUID.test(ref);
const reais = (centavos: number) => Number((centavos / 100).toFixed(2));
const centavos = (valorEmReais: number) => Math.round(valorEmReais * 100);
const apenasNumeros = (texto: string) => texto.replace(/\D/g, "");

const EVENTOS: Record<string, AvisoDoProvedor["tipo"]> = {
  PAYMENT_RECEIVED: "pagamento_confirmado",
  PAYMENT_CONFIRMED: "pagamento_confirmado",
  PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: "pagamento_recusado",
  PAYMENT_REPROVED_BY_RISK_ANALYSIS: "pagamento_recusado",
  PAYMENT_REFUNDED: "estorno_confirmado",
  PAYMENT_PARTIALLY_REFUNDED: "estorno_confirmado",
  PAYMENT_CHARGEBACK_REQUESTED: "chargeback_recebido",
};

export class ProvedorAsaas implements ProvedorDePagamento {
  readonly nome = "asaas";
  private readonly url: string;
  private readonly http: typeof fetch;
  private readonly tempoMaximoMs: number;
  private readonly esperaDoQrMs: number;

  constructor(private readonly config: ConfiguracaoDoAsaas) {
    if (config.chave.length < 20) throw new Error("a chave do Asaas parece curta demais");
    if (config.tokenDoWebhook.length < 32 || config.tokenDoWebhook.length > 255 || /\s/.test(config.tokenDoWebhook)) {
      throw new Error("o token do webhook do Asaas tem de ter de 32 a 255 letras, sem espaços");
    }
    this.url = (config.url ?? URL_DO_SANDBOX).replace(/\/+$/, "");
    this.http = config.fetch ?? fetch;
    this.tempoMaximoMs = config.tempoMaximoMs ?? 20000;
    this.esperaDoQrMs = config.esperaDoQrMs ?? 2000;
  }

  private async chamar<T>(metodo: "GET" | "POST" | "DELETE", caminho: string, corpo?: unknown): Promise<T> {
    const resposta = await this.http(`${this.url}${caminho}`, {
      method: metodo,
      headers: { access_token: this.config.chave, "content-type": "application/json", "user-agent": "Jards-Ticketeria/1.0" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(this.tempoMaximoMs),
    });
    const texto = await resposta.text();
    let dados: unknown = null;
    try { dados = texto ? JSON.parse(texto) : null; } catch { /* corpo que não é JSON: segue com null */ }
    if (!resposta.ok) {
      const erros = ((dados as { errors?: { code?: unknown }[] } | null)?.errors ?? []).map(erro => String(erro?.code ?? "")).filter(Boolean);
      throw new ErroDoAsaas(resposta.status, erros, `o Asaas recusou ${metodo} ${caminho}: ${resposta.status}${erros.length ? ` (${erros.join(", ")})` : ""}`);
    }
    return dados as T;
  }

  /** O cliente do Asaas para a cobrança: o CPF ou CNPJ é exigido e só passa por aqui (nunca é guardado). */
  private async criarCliente(pedido: PedidoParaCobrar): Promise<{ id: string }> {
    const documento = apenasNumeros(pedido.comprador_documento ?? "");
    if (documento.length !== 11 && documento.length !== 14) {
      throw new Error("o Asaas exige o CPF ou o CNPJ de quem paga: o pedido não tem");
    }
    // notificationDisabled: o ingresso e o aviso ao comprador são nossos, o Asaas não manda e-mail a ele.
    return this.chamar<{ id: string }>("POST", "/customers", {
      name: pedido.comprador_nome, cpfCnpj: documento, email: pedido.comprador_email, externalReference: pedido.id, notificationDisabled: true,
    });
  }

  async criarCobranca(pedido: PedidoParaCobrar): Promise<Cobranca> {
    const cliente = await this.criarCliente(pedido);
    const cobranca = await this.chamar<{ id: string; invoiceUrl?: string }>("POST", "/payments", {
      customer: cliente.id,
      billingType: "PIX",
      value: reais(pedido.total_centavos),
      dueDate: partesNoFuso(pedido.expira_em, "America/Sao_Paulo").dia,
      externalReference: pedido.id,
      description: `Ingressos, pedido ${pedido.codigo}`.slice(0, 500),
      ...(pedido.split && pedido.split.length > 0 ? { split: pedido.split.map(parte => ({ walletId: parte.carteira, fixedValue: reais(parte.valor_centavos) })) } : {}),
    });
    const qr = await this.qrDoPix(cobranca.id);
    return { ref: cobranca.id, pix_copia_e_cola: qr.payload, url: cobranca.invoiceUrl ?? null, expira_em: pedido.expira_em };
  }

  /**
   * A cobrança no CARTÃO: o Asaas devolve o endereço da página segura (`invoiceUrl`), onde a pessoa digita o cartão; nenhum dado de cartão passa pelo Jards.
   * À vista (1x): uma cobrança com `value` e a comissão em `fixedValue`. Parcelado: `installmentCount` e `totalValue`, com a comissão em `totalFixedValue` (o Asaas divide
   * pelas parcelas). Provado no sandbox em 20/11/2026: 3x de R$ 100,00 viram parcelas de 33,33 / 33,33 / 33,34, todas confirmadas de uma vez, cada uma com o seu aviso; o
   * `netValue` do parcelamento (GET /installments/{id}) é o líquido de todas juntas e não desconta o split. O aviso de cada parcela traz `payment.installment`; veja `lerAviso`.
   * O `ref` devolvido é o do PARCELAMENTO (o id que o Asaas põe em `installment`), e não o da primeira parcela: é com ele que o pedido é estornado inteiro.
   */
  async criarCobrancaCartao(pedido: PedidoParaCobrar & { parcelas: number }): Promise<{ ref: string; url: string; expira_em: string }> {
    const cliente = await this.criarCliente(pedido);
    const parcelado = pedido.parcelas > 1;
    const cobranca = await this.chamar<{ id: string; invoiceUrl?: string; installment?: string }>("POST", "/payments", {
      customer: cliente.id,
      billingType: "CREDIT_CARD",
      ...(parcelado ? { installmentCount: pedido.parcelas, totalValue: reais(pedido.total_centavos) } : { value: reais(pedido.total_centavos) }),
      dueDate: partesNoFuso(pedido.expira_em, "America/Sao_Paulo").dia,
      externalReference: pedido.id,
      description: `Ingressos, pedido ${pedido.codigo}`.slice(0, 500),
      ...(pedido.split && pedido.split.length > 0 ? { split: pedido.split.map(parte => ({ walletId: parte.carteira, ...(parcelado ? { totalFixedValue: reais(parte.valor_centavos) } : { fixedValue: reais(parte.valor_centavos) }) })) } : {}),
    });
    if (typeof cobranca.invoiceUrl !== "string" || !/^https:\/\//.test(cobranca.invoiceUrl)) throw new Error("o Asaas não devolveu a página de pagamento do cartão");
    return { ref: parcelado && typeof cobranca.installment === "string" ? cobranca.installment : cobranca.id, url: cobranca.invoiceUrl, expira_em: pedido.expira_em };
  }

  /** O parcelamento inteiro: o total, o líquido de todas as parcelas e quantas são. A chave tem de ser a da subconta, onde ele nasceu. */
  async consultarParcelamento(id: string): Promise<ParcelamentoDoProvedor | null> {
    if (!UUID.test(id)) return null;
    try {
      const p = await this.chamar<{ value?: unknown; netValue?: unknown; installmentCount?: unknown }>("GET", `/installments/${encodeURIComponent(id)}`);
      if (typeof p.value !== "number" || !Number.isFinite(p.value) || p.value <= 0 || typeof p.installmentCount !== "number" || !Number.isInteger(p.installmentCount)) return null;
      const liquido = typeof p.netValue === "number" && Number.isFinite(p.netValue) && p.netValue >= 0 ? centavos(p.netValue) : null;
      return { valor_centavos: centavos(p.value), liquido_centavos: liquido, parcelas: p.installmentCount };
    } catch (erro) {
      if (erro instanceof ErroDoAsaas && erro.status === 404) return null;
      throw erro;
    }
  }

  /**
   * O estorno do parcelamento INTEIRO (POST /installments/{id}/refund): o comprador recebe tudo de volta e o que ainda não foi repassado (as parcelas do cartão só caem
   * mês a mês) é cancelado, a comissão do Jards junto; provado no sandbox em 20/11/2026. Só 4xx vira `ok: false`.
   */
  async estornarParcelamento(id: string): Promise<{ ok: boolean; motivo?: string }> {
    if (!UUID.test(id)) return { ok: false, motivo: "parcelamento_invalido" };
    try {
      await this.chamar("POST", `/installments/${encodeURIComponent(id)}/refund`, {});
      return { ok: true };
    } catch (erro) {
      if (erro instanceof ErroDoAsaas && erro.status >= 400 && erro.status < 500) return { ok: false, motivo: erro.codigos.join(", ") || `http_${erro.status}` };
      throw erro;
    }
  }

  /**
   * O QR do Pix. Achado no sandbox (19/11/2026): numa conta sem chave Pix, o primeiro pedido do QR volta 400 `invalid_action` enquanto o
   * Asaas cria sozinho a chave aleatória, e o seguinte já funciona. Por isso tenta de novo, até 3 vezes, só nesse erro.
   */
  private async qrDoPix(cobrancaId: string): Promise<{ payload: string; expirationDate?: string }> {
    for (let tentativa = 1; ; tentativa++) {
      try {
        return await this.chamar<{ payload: string; expirationDate?: string }>("GET", `/payments/${encodeURIComponent(cobrancaId)}/pixQrCode`);
      } catch (erro) {
        const primeiraVez = erro instanceof ErroDoAsaas && erro.status === 400 && erro.codigos.includes("invalid_action");
        if (!primeiraVez || tentativa >= 3) throw erro;
        await new Promise(resolve => setTimeout(resolve, this.esperaDoQrMs));
      }
    }
  }

  async estornar(ref: string, valorCentavos: number): Promise<{ ok: boolean; motivo?: string }> {
    try {
      await this.chamar("POST", `/payments/${encodeURIComponent(ref)}/refund`, { value: reais(valorCentavos), description: "Estorno do pedido" });
      return { ok: true };
    } catch (erro) {
      // 400: sem saldo para o estorno integral logo após o recebimento (as taxas não voltam), ou cobrança que não pode ser estornada.
      if (erro instanceof ErroDoAsaas && erro.status >= 400 && erro.status < 500) return { ok: false, motivo: erro.codigos.join(", ") || `http_${erro.status}` };
      throw erro;
    }
  }

  /**
   * O estorno do Pix INTEIRO de um pedido, com a comissão do Jards saindo da carteira do Jards (D5 do plano): o Asaas aceita `splitRefunds` com o id do split da cobrança
   * (provado no sandbox em 19/11/2026: R$ 50,00 estornados, R$ 1,25 debitados da carteira do Jards e R$ 48,75 da subconta). Sem o split da comissão achado na cobrança,
   * NÃO estorna (a comissão ficaria com o Jards, contra a regra): devolve `ok: false` e o pedido vai para a fila. A chave é a da SUBCONTA, onde a cobrança nasceu.
   */
  async estornarPixComComissao(ref: string, totalCentavos: number, comissaoCentavos: number, carteiraDoJards: string | null): Promise<{ ok: boolean; motivo?: string; ref?: string }> {
    try {
      const corpo: { value: number; description: string; splitRefunds?: { id: string; value: number }[] } = { value: reais(totalCentavos), description: "Reembolso do pedido" };
      if (comissaoCentavos > 0) {
        const cobranca = await this.chamar<{ split?: { id?: string; walletId?: string }[] }>("GET", `/payments/${encodeURIComponent(ref)}`);
        const parte = (cobranca.split ?? []).find(s => typeof s.id === "string" && (carteiraDoJards === null || s.walletId === carteiraDoJards));
        if (!parte?.id) return { ok: false, motivo: "split_da_comissao_nao_encontrado" };
        corpo.splitRefunds = [{ id: parte.id, value: reais(comissaoCentavos) }];
      }
      await this.chamar("POST", `/payments/${encodeURIComponent(ref)}/refund`, corpo);
      return { ok: true, ref };
    } catch (erro) {
      if (erro instanceof ErroDoAsaas && erro.status >= 400 && erro.status < 500) return { ok: false, motivo: erro.codigos.join(", ") || `http_${erro.status}` };
      throw erro;
    }
  }

  async cancelarCobranca(ref: string): Promise<{ ok: boolean }> {
    try {
      await this.chamar("DELETE", `/payments/${encodeURIComponent(ref)}`);
      return { ok: true };
    } catch (erro) {
      if (erro instanceof ErroDoAsaas && erro.status >= 400 && erro.status < 500) return { ok: false };
      throw erro;
    }
  }

  /** `assinatura` é o valor do cabeçalho `asaas-access-token` do pedido HTTP do aviso. */
  lerAviso(corpo: string, assinatura: string | null): LeituraDoAviso {
    const esperado = Buffer.from(this.config.tokenDoWebhook);
    const recebido = Buffer.from(assinatura ?? "");
    if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return { ok: false, motivo: "assinatura_invalida" };
    let dados: unknown;
    try { dados = JSON.parse(corpo); } catch { return { ok: false, motivo: "corpo_invalido" }; }
    const a = (dados && typeof dados === "object" ? dados : {}) as Record<string, unknown>;
    if (typeof a.id !== "string" || a.id === "" || a.id.length > 200 || typeof a.event !== "string") return { ok: false, motivo: "corpo_invalido" };
    const tipo = EVENTOS[a.event];
    if (!tipo) return { ok: false, motivo: "evento_irrelevante" };
    const p = (a.payment && typeof a.payment === "object" ? a.payment : {}) as Record<string, unknown>;
    if (typeof p.id !== "string" || p.id === "" || p.id.length > 200) return { ok: false, motivo: "corpo_invalido" };
    // Cobrança sem o nosso pedido (criada à mão no painel do Asaas, por exemplo): não é nossa.
    if (typeof p.externalReference !== "string" || !UUID.test(p.externalReference)) return { ok: false, motivo: "evento_irrelevante" };
    if (typeof p.value !== "number" || !Number.isFinite(p.value) || p.value < 0) return { ok: false, motivo: "corpo_invalido" };
    // O valor líquido (`netValue`): o que o Asaas deixou depois das taxas dele. Sem ele (ou fora de um pagamento), o núcleo usa a estimativa da tabela.
    const liquido = tipo === "pagamento_confirmado" && typeof p.netValue === "number" && Number.isFinite(p.netValue) && p.netValue >= 0 ? centavos(p.netValue) : null;
    // Parcela de um parcelamento no cartão: o aviso diz só o valor DAQUELA parcela. Quem processa lê o parcelamento inteiro e o pedido é pago por ele; o `ref` do pedido é o do parcelamento.
    const parcelamento = tipo === "pagamento_confirmado" && typeof p.installment === "string" && UUID.test(p.installment) ? p.installment : null;
    return { ok: true, aviso: { id_externo: a.id, tipo, pedido_id: p.externalReference.toLowerCase(), ref: parcelamento ?? p.id, valor_centavos: centavos(p.value), liquido_centavos: liquido, ...(parcelamento ? { parcelamento_id: parcelamento } : {}) } };
  }
}

/**
 * O Asaas, só quando configurado: ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN. Sem ASAAS_AMBIENTE=producao, é o sandbox. A produção, que
 * move dinheiro de verdade, exige TRÊS coisas juntas: ASAAS_AMBIENTE=producao, ASAAS_URL (a base da API, com /v3, conferida no painel
 * do Asaas) e TICKETERIA_DINHEIRO_REAL=sim. O dono só liga isso depois do piloto de baixo valor e do parecer jurídico (D7 do plano).
 */
/**
 * A base e a chave do Asaas, só quando configurado: ASAAS_API_KEY. Sem ASAAS_AMBIENTE=producao, é o sandbox. A produção exige TRÊS coisas
 * juntas: ASAAS_AMBIENTE=producao, ASAAS_URL (a base da API, com /v3) e TICKETERIA_DINHEIRO_REAL=sim. Serve ao provedor e ao cadastro de subconta.
 */
export function ambienteDoAsaas(ambiente: Record<string, string | undefined> = process.env): { chave: string; url: string } | null {
  const chave = ambiente.ASAAS_API_KEY ?? "";
  if (chave === "") return null;
  const producao = ambiente.ASAAS_AMBIENTE === "producao";
  if (producao && (ambiente.TICKETERIA_DINHEIRO_REAL !== "sim" || !/^https:\/\/[^\s/]+\/v3\/?$/.test(ambiente.ASAAS_URL ?? ""))) return null;
  return { chave, url: producao ? (ambiente.ASAAS_URL as string) : URL_DO_SANDBOX };
}

export function provedorAsaas(ambiente: Record<string, string | undefined> = process.env, http?: typeof fetch): ProvedorAsaas | null {
  const base = ambienteDoAsaas(ambiente);
  const token = ambiente.ASAAS_WEBHOOK_TOKEN ?? "";
  if (!base || token === "") return null;
  return new ProvedorAsaas({ chave: base.chave, tokenDoWebhook: token, url: base.url, fetch: http });
}
