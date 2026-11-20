/** Uma mensagem de e-mail no formato do Jards, venha ela do Gmail ou da Microsoft. */
export type MensagemDeEmail = {
  id: string;
  threadId: string;
  internetMessageId: string | null;
  from: string | null;
  fromName: string | null;
  to: string[];
  cc: string[];
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  sentAt: Date | null;
  direction: "inbound" | "outbound";
};

export type BuscaDeEmails = {
  mensagens: MensagemDeEmail[];
  /** Quantas mensagens de contatos o provedor achou, antes do limite desta rodada. */
  encontradas: number;
  /** Havia mais mensagens ou consultas do que cabe numa rodada: o resto vem nas próximas. */
  truncada: boolean;
};

/** Endereços de um cabeçalho De, Para ou Cc, em minúsculas e sem repetição (aguenta vírgula dentro do nome). */
export function enderecosDoCabecalho(bruto: string | null): string[] {
  const achados = (bruto ?? "").match(/[^\s<>,;"'()]+@[^\s<>,;"'()]+/g) ?? [];
  return [...new Set(achados.map((endereco) => endereco.toLowerCase()))];
}
