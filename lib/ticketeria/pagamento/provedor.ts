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
};

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
  /** Pede o estorno (total ou parcial) de uma cobrança paga. `ok: false` quando o provedor recusa (ex.: sem saldo); o motivo vai junto. */
  estornar(ref: string, valorCentavos: number): Promise<{ ok: boolean; motivo?: string }>;
  /** Cancela uma cobrança que ninguém pagou (a reserva venceu). Opcional: nem todo provedor deixa. */
  cancelarCobranca?(ref: string): Promise<{ ok: boolean }>;
  /** Confere a assinatura do aviso (webhook) e o traduz. Nunca confia no corpo sem a assinatura. */
  lerAviso(corpo: string, assinatura: string | null): LeituraDoAviso;
}
