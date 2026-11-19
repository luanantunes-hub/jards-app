import type { EmailProvider } from "./config";

/**
 * Conversas de e-mail no CRM: junta as mensagens sincronizadas em fios e diz quem está esperando resposta.
 * Lógica pura (sem banco nem rede), usada pela aba Interações, pela negociação e pelo painel.
 */

/** Passado esse prazo, o fio esfriou: deixa de contar como "aguardando" e quem cuida dele são os follow-ups. */
export const JANELA_AGUARDANDO_DIAS = 30;

const DIA_MS = 86_400_000;

/** As colunas da tabela `emails` que formam uma `EmailDeConversa`. O texto completo (`body_text`) fica de fora: só a folha da conversa o lê. */
export const COLUNAS_DO_EMAIL_DE_CONVERSA =
  "id,message_id,thread_id,subject,snippet,from_email,from_name,to_emails,sent_at,direction,visibility,user_id,contato_id,empresa_crm_id,captacao_id";

export type EmailDeConversa = {
  id: string;
  message_id: string;
  thread_id: string | null;
  subject: string | null;
  snippet: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  sent_at: string | null;
  direction: string | null;
  visibility: string;
  user_id: string;
  contato_id: string | null;
  empresa_crm_id: string | null;
  captacao_id: string | null;
};

export type SituacaoDaConversa = {
  /** `aguardando`: a equipe escreveu por último. `respondeu`: o contato escreveu por último. */
  tipo: "aguardando" | "respondeu";
  /** Dias inteiros desde a última mensagem. */
  dias: number;
};

export type Conversa = {
  /** Identifica a conversa na lista: caixa de e-mail + fio do provedor. */
  chave: string;
  assunto: string;
  /** Da mais antiga para a mais nova. */
  mensagens: EmailDeConversa[];
  ultima: EmailDeConversa;
  /** Instante da última mensagem, em milissegundos; nulo quando nenhuma tem data. */
  ultimaEm: number | null;
  situacao: SituacaoDaConversa | null;
  /** Todas as mensagens estão como "Só eu vejo". */
  privada: boolean;
  contatoIds: string[];
  /** Quem sincronizou as mensagens (donos das caixas de e-mail). */
  donoIds: string[];
};

const PREFIXO_DE_RESPOSTA = /^\s*((re|res|enc|fwd|fw|rv|aw|sv)\s*:\s*)+/i;

/** O assunto da conversa, sem "Re:", "RES:", "Enc:" e parecidos que cada resposta acrescenta. */
export function assuntoSemPrefixo(assunto: string | null | undefined): string {
  const limpo = (assunto ?? "").replace(PREFIXO_DE_RESPOSTA, "").trim();
  return limpo || "E-mail sem assunto";
}

function instante(valor: string | null): number | null {
  if (!valor) return null;
  const ms = Date.parse(valor);
  return Number.isFinite(ms) ? ms : null;
}

/** Mais antigas primeiro; as sem data vêm antes de todas. */
function porData(a: EmailDeConversa, b: EmailDeConversa): number {
  const ia = instante(a.sent_at) ?? Number.NEGATIVE_INFINITY;
  const ib = instante(b.sent_at) ?? Number.NEGATIVE_INFINITY;
  if (ia === ib) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  return ia < ib ? -1 : 1;
}

/**
 * `jaEscrevemos` diz se alguém da equipe já escreveu nesse fio: sem isso, uma mensagem recebida é o primeiro
 * contato de alguém, e não uma resposta — a conversa fica sem etiqueta em vez de dizer "Respondeu".
 */
export function situacaoDaConversa(
  ultima: Pick<EmailDeConversa, "direction">,
  ultimaEm: number | null,
  agora: number,
  jaEscrevemos = true,
): SituacaoDaConversa | null {
  if (ultimaEm === null) return null;
  const dias = Math.max(0, Math.floor((agora - ultimaEm) / DIA_MS));
  if (dias > JANELA_AGUARDANDO_DIAS) return null;
  if (ultima.direction === "outbound") return { tipo: "aguardando", dias };
  if (ultima.direction === "inbound") return jaEscrevemos ? { tipo: "respondeu", dias } : null;
  return null;
}

function unicos<T>(valores: Iterable<T | null>): T[] {
  const vistos = new Set<T>();
  for (const valor of valores) if (valor !== null) vistos.add(valor);
  return [...vistos];
}

/**
 * Agrupa as mensagens em conversas, da mais recente para a mais antiga.
 * O fio do provedor só vale dentro de uma caixa de e-mail, por isso a conversa é caixa + fio;
 * mensagem sem fio fica sozinha.
 */
export function agruparConversas(emails: readonly EmailDeConversa[], agora: number = Date.now()): Conversa[] {
  const grupos = new Map<string, EmailDeConversa[]>();
  for (const email of emails) {
    const chave = `${email.user_id}|${email.thread_id ?? email.id}`;
    const lista = grupos.get(chave);
    if (lista) lista.push(email);
    else grupos.set(chave, [email]);
  }

  const conversas: Conversa[] = [];
  for (const [chave, lista] of grupos) {
    const mensagens = [...lista].sort(porData);
    const ultima = mensagens[mensagens.length - 1];
    const ultimaEm = instante(ultima.sent_at);
    const primeiraComAssunto = mensagens.find((mensagem) => mensagem.subject?.trim());
    conversas.push({
      chave,
      assunto: assuntoSemPrefixo(primeiraComAssunto?.subject),
      mensagens,
      ultima,
      ultimaEm,
      situacao: situacaoDaConversa(ultima, ultimaEm, agora, mensagens.some((mensagem) => mensagem.direction === "outbound")),
      privada: mensagens.every((mensagem) => mensagem.visibility === "private"),
      contatoIds: unicos(mensagens.map((mensagem) => mensagem.contato_id)),
      donoIds: unicos(mensagens.map((mensagem) => mensagem.user_id)),
    });
  }

  return conversas.sort((a, b) => {
    const ia = a.ultimaEm ?? Number.NEGATIVE_INFINITY;
    const ib = b.ultimaEm ?? Number.NEGATIVE_INFINITY;
    if (ia === ib) return a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0;
    return ia > ib ? -1 : 1;
  });
}

/** "Aguardando resposta · 4 dias" (ou "· hoje", "· 1 dia"). */
export function rotuloAguardando(dias: number): string {
  if (dias <= 0) return "Aguardando resposta · hoje";
  return `Aguardando resposta · ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/** As conversas em que a equipe escreveu por último e ninguém respondeu: a que espera há mais tempo vem primeiro. */
export function aguardandoResposta(conversas: readonly Conversa[], minimoDeDias = 0): Conversa[] {
  return conversas
    .filter((conversa) => conversa.situacao?.tipo === "aguardando" && conversa.situacao.dias >= minimoDeDias)
    .sort((a, b) => {
      const diasA = a.situacao?.dias ?? 0;
      const diasB = b.situacao?.dias ?? 0;
      if (diasA !== diasB) return diasB - diasA;
      return (a.ultimaEm ?? 0) - (b.ultimaEm ?? 0);
    });
}

/**
 * De qual provedor é a mensagem. O Gmail identifica as mensagens por um código hexadecimal curto;
 * o Microsoft Graph usa um código longo em base 64.
 */
export function provedorDaMensagem(messageId: string): EmailProvider {
  return /^[0-9a-f]{8,20}$/i.test(messageId) ? "google" : "microsoft";
}

export const NOME_DO_PROVEDOR: Record<EmailProvider, string> = { google: "Gmail", microsoft: "Outlook" };
