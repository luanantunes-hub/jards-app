/**
 * Conversas tem dois ambientes: o e-mail (esta lista) e as reuniões (components/conversas/ListaDeReunioes).
 * Aqui ficam as regras puras da lista de e-mail — as conversas em fio e os e-mails que ainda não saíram —
 * e os tipos das reuniões, que a tabela do outro ambiente usa.
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
  /** E-mails convidados, como foram enviados ao calendário. */
  participantes?: string[] | null;
  /** Quanto tempo o assistente gravou, em segundos (só nas reuniões já gravadas). */
  duracao_bot_s?: number | null;
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
  | { tipo: "agendado"; chave: string; quando: number | null; agendado: EmailAgendado };

export type FiltroDasConversas = "tudo" | "aguardando" | "sem-contato" | "so-eu" | "agendados";

export const FILTROS_DAS_CONVERSAS: ReadonlyArray<{ value: FiltroDasConversas; label: string }> = [
  { value: "tudo", label: "Tudo" },
  { value: "aguardando", label: "Aguardando resposta" },
  { value: "sem-contato", label: "Sem contato" },
  { value: "so-eu", label: "Só eu vejo" },
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

/** Junta as conversas e os e-mails agendados numa lista só, do mais recente para o mais antigo. */
export function montarLista(
  conversas: readonly Conversa[],
  agendados: readonly EmailAgendado[] = [],
): ItemDaLista[] {
  const itens: ItemDaLista[] = [
    ...conversas.map((conversa): ItemDaLista => ({ tipo: "email", chave: `email:${conversa.chave}`, quando: conversa.ultimaEm, conversa })),
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
  const contagem = { tudo: 0, aguardando: 0, "sem-contato": 0, "so-eu": 0, agendados: 0 } as Record<FiltroDasConversas, number>;
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

/** "09:00": a hora do envio. Na lista, a data já aparece ao lado, então a linha mostra só a hora. */
export function horaCurta(ms: number | null): string {
  if (ms === null) return "";
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Os recortes do ambiente de reuniões. */
export type RecorteDasReunioes = "proximas" | "gravadas" | "todas";

export const RECORTES_DAS_REUNIOES: ReadonlyArray<{ value: RecorteDasReunioes; label: string }> = [
  { value: "proximas", label: "Próximas" },
  { value: "gravadas", label: "Gravadas" },
  { value: "todas", label: "Todas" },
];

export type ReuniaoComQuando = { reuniao: ReuniaoNaLista; quando: number | null };

/**
 * As reuniões de um recorte, já ordenadas: as próximas da mais perto para a mais longe (é o que se faz a seguir),
 * as outras da mais recente para a mais antiga. "Próximas" são as marcadas que ainda não aconteceram.
 */
export function recortarReunioes(
  reunioes: readonly ReuniaoNaLista[],
  recorte: RecorteDasReunioes,
  agora: number = Date.now(),
): { visiveis: ReuniaoComQuando[]; contagem: Record<RecorteDasReunioes, number> } {
  const todas: ReuniaoComQuando[] = reunioes.map((reuniao) => ({ reuniao, quando: quandoDaReuniao(reuniao) }));
  const proximas = todas.filter(({ reuniao, quando }) => reuniao.status === "agendada" && (quando ?? 0) >= agora);
  const gravadas = todas.filter(({ reuniao }) => reuniao.status === "concluida");
  const escolhidas = recorte === "proximas" ? proximas : recorte === "gravadas" ? gravadas : todas;
  const visiveis = [...escolhidas].sort((a, b) =>
    recorte === "proximas"
      ? (a.quando ?? Number.POSITIVE_INFINITY) - (b.quando ?? Number.POSITIVE_INFINITY)
      : (b.quando ?? Number.NEGATIVE_INFINITY) - (a.quando ?? Number.NEGATIVE_INFINITY),
  );
  return { visiveis, contagem: { proximas: proximas.length, gravadas: gravadas.length, todas: todas.length } };
}

function contem(texto: string | null | undefined, procurado: string): boolean {
  return (texto ?? "").toLowerCase().includes(procurado);
}

/** A busca da lista de e-mail: olha quem, assunto, trecho e endereços. Busca vazia devolve tudo. */
export function itemNaBusca(item: ItemDaLista, busca: string, nomesDosContatos: readonly string[] = []): boolean {
  const procurado = busca.trim().toLowerCase();
  if (!procurado) return true;
  if (item.tipo === "agendado") {
    return contem(item.agendado.assunto, procurado) || item.agendado.para.some((endereco) => contem(endereco, procurado));
  }
  const { conversa } = item;
  if (contem(conversa.assunto, procurado) || nomesDosContatos.some((nome) => contem(nome, procurado))) return true;
  return conversa.mensagens.some((mensagem) =>
    contem(mensagem.from_name, procurado) ||
    contem(mensagem.from_email, procurado) ||
    contem(mensagem.snippet, procurado) ||
    (mensagem.to_emails ?? []).some((endereco) => contem(endereco, procurado)));
}

/** A busca das reuniões: olha o nome e os convidados. */
export function reuniaoNaBusca(reuniao: ReuniaoNaLista, busca: string, nomeDaEmpresa?: string): boolean {
  const procurado = busca.trim().toLowerCase();
  if (!procurado) return true;
  return contem(reuniao.titulo, procurado)
    || contem(nomeDaEmpresa, procurado)
    || (reuniao.participantes ?? []).some((endereco) => contem(endereco, procurado));
}

/** "1h 30min" a partir de segundos; vazio quando não há duração gravada. */
export function duracaoEmTexto(segundos: number | null | undefined): string {
  if (!segundos || segundos <= 0) return "";
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas}h ${resto}min` : `${horas}h`;
}

