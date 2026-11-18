/**
 * Partes puras da leitura de e-mail pelo Microsoft Graph (Outlook.com, Hotmail e Microsoft 365):
 * endereços das consultas, conversão da mensagem do Graph e a regra "é de um contato?".
 * A rede fica em microsoft.ts.
 */
import type { MensagemDeEmail } from "./mensagem";

export const GRAPH = "https://graph.microsoft.com/v1.0";

const CAMPOS = "id,conversationId,internetMessageId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,isDraft";

type EnderecoGraph = { emailAddress?: { name?: string | null; address?: string | null } | null } | null;

export type MensagemGraph = {
  id: string;
  conversationId?: string | null;
  internetMessageId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  from?: EnderecoGraph;
  toRecipients?: EnderecoGraph[];
  ccRecipients?: EnderecoGraph[];
  receivedDateTime?: string | null;
  sentDateTime?: string | null;
  isDraft?: boolean;
};

/** As pastas lidas: caixa de entrada, enviados e arquivo. Lixo e excluídos ficam de fora. */
export type PastaDoGraph = "inbox" | "sentitems" | "archive";

/** O Graph quer a data em UTC, sem milésimos: 2026-05-01T00:00:00Z. */
export function dataParaGraph(data: Date): string {
  return data.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Primeira página das mensagens da pasta desde a data, da mais nova para a mais antiga, só com os campos usados. */
export function urlDaPasta(pasta: PastaDoGraph, desde: Date): string {
  const campo = pasta === "sentitems" ? "sentDateTime" : "receivedDateTime";
  const filtro = encodeURIComponent(`${campo} ge ${dataParaGraph(desde)}`);
  const ordem = encodeURIComponent(`${campo} desc`);
  return `${GRAPH}/me/mailFolders/${pasta}/messages?$filter=${filtro}&$orderby=${ordem}&$top=100&$select=${CAMPOS}`;
}

function endereco(item: EnderecoGraph | undefined): string | null {
  const valor = (item?.emailAddress?.address ?? "").trim().toLowerCase();
  return valor || null;
}

function enderecos(lista: EnderecoGraph[] | undefined): string[] {
  return (lista ?? []).map(endereco).filter((valor): valor is string => valor !== null);
}

/** A mensagem do Graph no formato do Jards, ainda sem o corpo (só se lê o corpo das que são de contatos). */
export function mensagemDoGraph(bruta: MensagemGraph, emailDaConta: string, pasta: PastaDoGraph): MensagemDeEmail | null {
  if (bruta.isDraft || !bruta.id) return null;
  const de = endereco(bruta.from);
  const quando = new Date(bruta.sentDateTime ?? bruta.receivedDateTime ?? "");
  return {
    id: bruta.id,
    threadId: bruta.conversationId || bruta.id,
    internetMessageId: bruta.internetMessageId ?? null,
    from: de,
    fromName: bruta.from?.emailAddress?.name?.trim() || null,
    to: enderecos(bruta.toRecipients),
    cc: enderecos(bruta.ccRecipients),
    subject: bruta.subject ?? null,
    snippet: bruta.bodyPreview ?? null,
    bodyText: null,
    sentAt: Number.isNaN(quando.getTime()) ? null : quando,
    direction: pasta === "sentitems" || de === emailDaConta.trim().toLowerCase() ? "outbound" : "inbound",
  };
}

/** É de um contato? Recebida: o remetente. Enviada: algum dos destinatários (Para ou Cc). */
export function casaComContato(mensagem: MensagemDeEmail, contatos: ReadonlySet<string>): boolean {
  const participantes = mensagem.direction === "outbound" ? [...mensagem.to, ...mensagem.cc] : [mensagem.from ?? ""];
  return participantes.some((participante) => contatos.has(participante.toLowerCase()));
}
