/**
 * A lista única de Conversas: e-mails e reuniões lado a lado, do mais recente para o mais antigo.
 * As duas coisas são o mesmo no CRM — o registro do que foi conversado com o patrocinador — e as duas
 * apontam para empresa e negociação. Aqui ficam só as regras puras; a tela e a busca ficam nos componentes.
 */
import type { Conversa } from "@/lib/email/conversas";

export type StatusDaReuniao = "agendada" | "bot_entrando" | "gravando" | "processando" | "concluida" | "falhou";

export type ReuniaoNaLista = {
  id: string;
  titulo: string;
  plataforma: "google_meet" | "teams";
  status: StatusDaReuniao;
  resumo_ia: string | null;
  empresa_crm_id: string | null;
  agendada_para: string | null;
  finalizada_em: string | null;
  created_at: string;
};

export type EmailAgendado = {
  id: string;
  provider: "google" | "microsoft";
  para: string[];
  assunto: string;
  enviar_em: string;
  estado: "pendente" | "enviando" | "falhou";
  erro: string | null;
};

export type ItemDaLista =
  | { tipo: "email"; chave: string; quando: number | null; conversa: Conversa }
  | { tipo: "reuniao"; chave: string; quando: number | null; reuniao: ReuniaoNaLista }
  | { tipo: "agendado"; chave: string; quando: number | null; agendado: EmailAgendado };

export type FiltroDasConversas = "tudo" | "aguardando" | "sem-contato" | "so-eu" | "reunioes" | "agendados";

export const FILTROS_DAS_CONVERSAS: ReadonlyArray<{ value: FiltroDasConversas; label: string }> = [
  { value: "tudo", label: "Tudo" },
  { value: "aguardando", label: "Aguardando resposta" },
  { value: "sem-contato", label: "Sem contato" },
  { value: "so-eu", label: "Só eu vejo" },
  { value: "reunioes", label: "Reuniões" },
  { value: "agendados", label: "Agendados" },
];

function instante(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const ms = Date.parse(valor);
  return Number.isFinite(ms) ? ms : null;
}

/** Quando a reunião aconteceu: o fim, a hora marcada ou, na falta das duas, quando foi criada. */
export function quandoDaReuniao(reuniao: ReuniaoNaLista): number | null {
  return instante(reuniao.finalizada_em) ?? instante(reuniao.agendada_para) ?? instante(reuniao.created_at);
}

/** Junta e-mails, reuniões e agendados numa lista só, do mais recente para o mais antigo. */
export function montarLista(
  conversas: readonly Conversa[],
  reunioes: readonly ReuniaoNaLista[],
  agendados: readonly EmailAgendado[] = [],
): ItemDaLista[] {
  const itens: ItemDaLista[] = [
    ...conversas.map((conversa): ItemDaLista => ({ tipo: "email", chave: `email:${conversa.chave}`, quando: conversa.ultimaEm, conversa })),
    ...reunioes.map((reuniao): ItemDaLista => ({ tipo: "reuniao", chave: `reuniao:${reuniao.id}`, quando: quandoDaReuniao(reuniao), reuniao })),
    ...agendados.map((agendado): ItemDaLista => ({ tipo: "agendado", chave: `agendado:${agendado.id}`, quando: instante(agendado.enviar_em), agendado })),
  ];
  return itens.sort((a, b) => {
    const ia = a.quando ?? Number.NEGATIVE_INFINITY;
    const ib = b.quando ?? Number.NEGATIVE_INFINITY;
    if (ia === ib) return a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0;
    return ib - ia;
  });
}

/**
 * O item entra neste filtro? "Agendados" é à parte: mostra só o que ainda não saiu, e some das outras listas,
 * porque um e-mail que ainda não foi enviado não é uma conversa.
 */
export function itemNoFiltro(item: ItemDaLista, filtro: FiltroDasConversas): boolean {
  if (filtro === "agendados") return item.tipo === "agendado";
  if (item.tipo === "agendado") return false;
  switch (filtro) {
    case "reunioes":
      return item.tipo === "reuniao";
    case "aguardando":
      return item.tipo === "email" && item.conversa.situacao?.tipo === "aguardando";
    case "sem-contato":
      return item.tipo === "email" && item.conversa.contatoIds.length === 0;
    case "so-eu":
      return item.tipo === "email" && item.conversa.privada;
    default:
      return true;
  }
}

export function contagemDosFiltros(itens: readonly ItemDaLista[]): Record<FiltroDasConversas, number> {
  const contagem = { tudo: 0, aguardando: 0, "sem-contato": 0, "so-eu": 0, reunioes: 0, agendados: 0 } as Record<FiltroDasConversas, number>;
  for (const filtro of Object.keys(contagem) as FiltroDasConversas[]) {
    contagem[filtro] = itens.filter((item) => itemNoFiltro(item, filtro)).length;
  }
  return contagem;
}

export const ROTULO_DA_PLATAFORMA: Record<ReuniaoNaLista["plataforma"], string> = {
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
};

export const SITUACAO_DA_REUNIAO: Record<StatusDaReuniao, { rotulo: string; cor: string }> = {
  agendada: { rotulo: "Agendada", cor: "#2D72B0" },
  bot_entrando: { rotulo: "Entrando", cor: "#B07A14" },
  gravando: { rotulo: "Gravando", cor: "#D94A4A" },
  processando: { rotulo: "Processando", cor: "#B07A14" },
  concluida: { rotulo: "Concluída", cor: "#2E8932" },
  falhou: { rotulo: "Falhou", cor: "#D94A4A" },
};

/** "14 nov" para datas deste ano; com o ano quando for de outro. */
export function dataCurta(ms: number | null, agora: Date = new Date()): string {
  if (ms === null) return "";
  const data = new Date(ms);
  const mesmoAno = data.getFullYear() === agora.getFullYear();
  return data.toLocaleDateString("pt-BR", mesmoAno ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "short", year: "2-digit" });
}

/**
 * O endereço do outro lado da conversa, para casar com a triagem: quem enviou, ou o primeiro destinatário
 * quando foi a pessoa quem escreveu por último.
 */
export function enderecoDoOutroLado(conversa: Conversa): string | null {
  const { ultima } = conversa;
  const bruto = ultima.direction === "outbound" ? (ultima.to_emails ?? [])[0] : ultima.from_email;
  const endereco = (bruto ?? "").trim().toLowerCase();
  return endereco || null;
}

/** Com quem é a conversa: os contatos quando existem; senão, quem está do outro lado. */
export function quemNaConversa(conversa: Conversa, nomesDosContatos: readonly string[]): string {
  if (nomesDosContatos.length > 0) return nomesDosContatos.join(", ");
  const { ultima } = conversa;
  const nome = ultima.direction === "outbound" ? null : ultima.from_name?.trim();
  return nome || enderecoDoOutroLado(conversa) || "Sem remetente";
}

