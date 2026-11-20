// A interface do provedor de pagamento (PSP plugável, D4 do plano em docs/acoes-futuras/estudos/plano-modulo-ticketeria.md). O
// núcleo da Ticketeria fala só com esta interface; cada provedor (o de mentira hoje; o escolhido pelo dono na T5) a implementa.
// Nenhum provedor guarda saldo do Jards: o split manda o preço para a subconta do produtor e a taxa para o Jards (D3).

/** A cobrança aberta para um pedido: a referência do provedor e como o comprador paga (Pix, link). */
export type Cobranca = { ref: string; pix_copia_e_cola: string | null; url: string | null; expira_em: string };

/** Um aviso do provedor, já conferido e traduzido para o núcleo. */
export type AvisoDoProvedor = {
  /** O id do aviso no provedor: o mesmo aviso duas vezes não faz nada duas vezes. */
  id_externo: string;
  tipo: "pagamento_confirmado" | "pagamento_recusado" | "estorno_confirmado" | "chargeback_recebido";
  /** O pedido do Jards (a referência externa que o núcleo mandou ao abrir a cobrança). */
  pedido_id: string;
  ref: string;
  valor_centavos: number;
  /** O que sobrou depois das taxas do provedor (o valor líquido). Só no pagamento confirmado e só se o provedor o informa; o custo real do meio é valor − líquido. */
  liquido_centavos?: number | null;
  /** O parcelamento a que o pagamento pertence, quando é de uma parcela do cartão: o provedor manda um aviso por parcela, e o pedido é pago pelo parcelamento inteiro (veja `consultarParcelamento`). */
  parcelamento_id?: string;
};

/** O parcelamento inteiro como o provedor o vê: o total e o líquido de todas as parcelas juntas. */
export type ParcelamentoDoProvedor = { valor_centavos: number; liquido_centavos: number | null; parcelas: number };

/** `evento_irrelevante`: o aviso é verdadeiro, mas não é de um pedido nosso ou não muda nada para nós (cobrança criada, vencida, visualizada...). */
export type LeituraDoAviso = { ok: true; aviso: AvisoDoProvedor } | { ok: false; motivo: "assinatura_invalida" | "corpo_invalido" | "evento_irrelevante" };

/** O que o núcleo manda ao provedor para abrir a cobrança de um pedido. */
export type PedidoParaCobrar = {
  id: string; codigo: string; total_centavos: number; expira_em: string;
  comprador_nome: string; comprador_email: string;
  /** CPF ou CNPJ do comprador, só os números. Alguns provedores (o Asaas) o exigem; o pedido ainda não o guarda (decisão de dados da T5). */
  comprador_documento?: string | null;
  /** A divisão do valor: para qual carteira do provedor vai quanto. O que sobra fica com quem criou a cobrança. */
  split?: { carteira: string; valor_centavos: number }[];
};

export interface ProvedorDePagamento {
  /** O nome curto, gravado em `ticketeria_pedidos.provedor` (só minúsculas, números e _). */
  readonly nome: string;
  /** Abre a cobrança do pedido no provedor. */
  criarCobranca(pedido: PedidoParaCobrar): Promise<Cobranca>;
  /**
   * Abre a cobrança no CARTÃO: o comprador paga na página segura do provedor (os dados do cartão nunca passam pelo Jards). Devolve o endereço dessa página. Opcional: nem todo provedor tem.
   * `parcelas` 1 = à vista.
   */
  criarCobrancaCartao?(pedido: PedidoParaCobrar & { parcelas: number }): Promise<{ ref: string; url: string; expira_em: string }>;
  /** Lê o parcelamento inteiro (total e líquido), pelo id que veio no aviso de uma parcela. Opcional: só quem parcela. `null` se o provedor não o acha. */
  consultarParcelamento?(id: string): Promise<ParcelamentoDoProvedor | null>;
  /** Estorna o parcelamento inteiro (todas as parcelas) e cancela o que ainda não foi repassado. `ok: false` quando o provedor recusa. Opcional: só quem parcela. */
  estornarParcelamento?(id: string): Promise<{ ok: boolean; motivo?: string }>;
  /** Pede o estorno (total ou parcial) de uma cobrança paga. `ok: false` quando o provedor recusa (ex.: sem saldo); o motivo vai junto. */
  estornar(ref: string, valorCentavos: number): Promise<{ ok: boolean; motivo?: string }>;
  /** Cancela uma cobrança que ninguém pagou (a reserva venceu). Opcional: nem todo provedor deixa. */
  cancelarCobranca?(ref: string): Promise<{ ok: boolean }>;
  /** Confere a assinatura do aviso (webhook) e o traduz. Nunca confia no corpo sem a assinatura. */
  lerAviso(corpo: string, assinatura: string | null): LeituraDoAviso;
}
