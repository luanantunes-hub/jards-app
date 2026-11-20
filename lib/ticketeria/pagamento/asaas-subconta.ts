// O cadastro da subconta do produtor no Asaas (parte 2 do cadeado do repasse). Escrito pela documentação pública e conferido no sandbox em
// 19/11/2026: `POST /v3/accounts` cria a subconta e devolve `id`, `walletId` e `apiKey` (a chave aparece UMA vez); `POST /v3/pix/addressKeys`
// com `type: EVP` cria a chave Pix aleatória, que a subconta precisa para receber Pix; `GET /v3/myAccount/status` diz a situação cadastral.
// A conta principal precisa ser CNPJ, ter o Split habilitado e (no sandbox) a autoaprovação ligada; na produção a subconta passa pela análise do Asaas.
// A chave da subconta NUNCA é registrada em log nem devolvida: quem chama a entrega ao Vault (fn_ticketeria_registrar_conta_asaas).

import { ErroDoAsaas, URL_DO_SANDBOX } from "@/lib/ticketeria/pagamento/asaas";

const apenasNumeros = (texto: string) => texto.replace(/\D/g, "");

import { problemasDosDados, type DadosDoProdutor, type TipoDeEmpresa } from "@/lib/ticketeria/pagamento/dados-do-produtor";

export { TIPOS_DE_EMPRESA, problemasDosDados, type DadosDoProdutor, type TipoDeEmpresa } from "@/lib/ticketeria/pagamento/dados-do-produtor";

export type SituacaoDaSubconta = "pendente" | "aprovada" | "bloqueada";

/** A situação cadastral do Asaas (comercial, bancária, documentos e geral) vira a nossa: só aprovada com tudo aprovado; rejeitada, bloqueada. */
export function situacaoDoStatus(status: { commercialInfo?: string; bankAccountInfo?: string; documentation?: string; general?: string } | null): SituacaoDaSubconta {
  const valores = [status?.commercialInfo, status?.bankAccountInfo, status?.documentation, status?.general];
  if (valores.some(v => v === "REJECTED")) return "bloqueada";
  return status?.general === "APPROVED" && valores.every(v => v === "APPROVED") ? "aprovada" : "pendente";
}

/** Criar uma subconta leva uns 40 segundos no sandbox (visto em 20/11/2026): com menos que isso o Asaas cria a conta mas a resposta, com a chave que só aparece uma vez, se perde. */
export const TEMPO_DA_CRIACAO_DA_SUBCONTA_MS = 120_000;

/** Os avisos que a subconta manda ao Jards: pagamento, estorno, recusa e chargeback (os mesmos que `lerAviso` entende). */
export const EVENTOS_DO_WEBHOOK_DA_SUBCONTA = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED", "PAYMENT_REPROVED_BY_RISK_ANALYSIS", "PAYMENT_REFUNDED", "PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"] as const;

/** O Asaas só aceita token de webhook com 32 a 255 caracteres e sem mais de 4 iguais seguidos (visto no sandbox em 20/11/2026). */
export function tokenDeWebhookAceito(token: string): boolean {
  return token.length >= 32 && token.length <= 255 && !/(.)\1{4,}/.test(token);
}

export type WebhookDaSubconta = { url: string; authToken: string; email: string };

export type SubcontaCriada = { asaas_account_id: string; wallet_id: string; chave: string };

export class SubcontasAsaas {
  private readonly url: string;
  private readonly http: typeof fetch;

  constructor(private readonly config: { chaveDaConta: string; url?: string; fetch?: typeof fetch; tempoMaximoMs?: number }) {
    if (config.chaveDaConta.length < 20) throw new Error("a chave do Asaas parece curta demais");
    this.url = (config.url ?? URL_DO_SANDBOX).replace(/\/+$/, "");
    this.http = config.fetch ?? fetch;
  }

  private async chamar<T>(chave: string, metodo: "GET" | "POST", caminho: string, corpo?: unknown, tempoMs?: number): Promise<T> {
    const resposta = await this.http(`${this.url}${caminho}`, {
      method: metodo,
      headers: { access_token: chave, "content-type": "application/json", "user-agent": "Jards-Ticketeria/1.0" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(tempoMs ?? this.config.tempoMaximoMs ?? 20000),
    });
    const texto = await resposta.text();
    let dados: unknown = null;
    try { dados = texto ? JSON.parse(texto) : null; } catch { /* corpo que não é JSON: segue com null */ }
    if (!resposta.ok) {
      const lista = (dados as { errors?: { code?: unknown }[] } | { code?: unknown }[] | null);
      const erros = (Array.isArray(lista) ? lista : lista?.errors ?? []).map(erro => String(erro?.code ?? "")).filter(Boolean);
      throw new ErroDoAsaas(resposta.status, erros, `o Asaas recusou ${metodo} ${caminho}: ${resposta.status}${erros.length ? ` (${erros.join(", ")})` : ""}`);
    }
    return dados as T;
  }

  /** Cria a subconta (`POST /v3/accounts`). A chave volta uma única vez: quem chama tem de guardá-la na hora. */
  async criarSubconta(dados: DadosDoProdutor): Promise<SubcontaCriada> {
    const erros = problemasDosDados(dados);
    if (erros.length > 0) throw new Error(`dados do produtor inválidos: ${erros.join("; ")}`);
    const documento = apenasNumeros(dados.cpf_cnpj);
    const resposta = await this.chamar<{ id?: string; walletId?: string; apiKey?: string }>(this.config.chaveDaConta, "POST", "/accounts", {
      name: dados.nome.trim(), email: dados.email.trim(), cpfCnpj: documento, mobilePhone: apenasNumeros(dados.celular),
      postalCode: apenasNumeros(dados.cep), address: dados.endereco.trim(), addressNumber: dados.numero.trim(), province: dados.bairro.trim(),
      incomeValue: Number((dados.renda_mensal_centavos / 100).toFixed(2)),
      ...(dados.complemento ? { complement: dados.complemento.trim() } : {}),
      ...(documento.length === 14 ? { companyType: dados.tipo_empresa } : { birthDate: dados.data_nascimento }),
    }, this.config.tempoMaximoMs ?? TEMPO_DA_CRIACAO_DA_SUBCONTA_MS);
    if (!resposta.id || !resposta.walletId || !resposta.apiKey) throw new Error("o Asaas não devolveu a subconta completa (id, carteira e chave)");
    return { asaas_account_id: resposta.id, wallet_id: resposta.walletId, chave: resposta.apiKey };
  }

  /** Cria a chave Pix aleatória da subconta (a subconta precisa dela para receber Pix). */
  async criarChavePix(chaveDaSubconta: string): Promise<void> {
    await this.chamar(chaveDaSubconta, "POST", "/pix/addressKeys", { type: "EVP" });
  }

  /**
   * Liga o webhook da SUBCONTA ao Jards (`POST /v3/webhooks` com a chave dela). O aviso de pagamento de uma subconta vai para o webhook DELA, não para o da conta
   * principal (visto no sandbox em 20/11/2026): sem isto o Jards não fica sabendo que o ingresso foi pago.
   */
  async criarWebhook(chaveDaSubconta: string, webhook: WebhookDaSubconta): Promise<void> {
    if (!tokenDeWebhookAceito(webhook.authToken)) throw new Error("o token do webhook não é aceito pelo Asaas (32 a 255 caracteres, sem mais de 4 iguais seguidos)");
    await this.chamar(chaveDaSubconta, "POST", "/webhooks", {
      name: "Jards Ticketeria", url: webhook.url, email: webhook.email, enabled: true, interrupted: false, sendType: "NON_SEQUENTIALLY", events: [...EVENTOS_DO_WEBHOOK_DA_SUBCONTA], authToken: webhook.authToken,
    });
  }

  /** A situação cadastral da subconta, na linguagem do Jards. */
  async situacao(chaveDaSubconta: string): Promise<SituacaoDaSubconta> {
    return situacaoDoStatus(await this.chamar<{ commercialInfo?: string; bankAccountInfo?: string; documentation?: string; general?: string }>(chaveDaSubconta, "GET", "/myAccount/status"));
  }
}
