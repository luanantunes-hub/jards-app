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
import type { AvisoDoProvedor, Cobranca, LeituraDoAviso, PedidoParaCobrar, ProvedorDePagamento } from "@/lib/ticketeria/pagamento/provedor";
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

  async criarCobranca(pedido: PedidoParaCobrar): Promise<Cobranca> {
    const documento = apenasNumeros(pedido.comprador_documento ?? "");
    if (documento.length !== 11 && documento.length !== 14) {
      throw new Error("o Asaas exige o CPF ou o CNPJ de quem paga: o pedido não tem");
    }
    // notificationDisabled: o ingresso e o aviso ao comprador são nossos, o Asaas não manda e-mail a ele.
    const cliente = await this.chamar<{ id: string }>("POST", "/customers", {
      name: pedido.comprador_nome, cpfCnpj: documento, email: pedido.comprador_email, externalReference: pedido.id, notificationDisabled: true,
    });
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
    return { ok: true, aviso: { id_externo: a.id, tipo, pedido_id: p.externalReference.toLowerCase(), ref: p.id, valor_centavos: centavos(p.value), liquido_centavos: liquido } };
  }
}

/**
 * O Asaas, só quando configurado: ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN. Sem ASAAS_AMBIENTE=producao, é o sandbox. A produção, que
 * move dinheiro de verdade, exige TRÊS coisas juntas: ASAAS_AMBIENTE=producao, ASAAS_URL (a base da API, com /v3, conferida no painel
 * do Asaas) e TICKETERIA_DINHEIRO_REAL=sim. O dono só liga isso depois do piloto de baixo valor e do parecer jurídico (D7 do plano).
 */
export function provedorAsaas(ambiente: Record<string, string | undefined> = process.env, http?: typeof fetch): ProvedorAsaas | null {
  const chave = ambiente.ASAAS_API_KEY ?? "";
  const token = ambiente.ASAAS_WEBHOOK_TOKEN ?? "";
  if (chave === "" || token === "") return null;
  const producao = ambiente.ASAAS_AMBIENTE === "producao";
  if (producao && (ambiente.TICKETERIA_DINHEIRO_REAL !== "sim" || !/^https:\/\/[^\s/]+\/v3\/?$/.test(ambiente.ASAAS_URL ?? ""))) return null;
  return new ProvedorAsaas({ chave, tokenDoWebhook: token, url: producao ? ambiente.ASAAS_URL : URL_DO_SANDBOX, fetch: http });
}
