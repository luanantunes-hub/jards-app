/**
 * Agendar uma reunião pelo Jards: marca no calendário da pessoa (Google ou Outlook) e já cria a sala,
 * do Meet ou do Teams. Aqui ficam só as regras puras (validar o pedido, montar o evento, achar o link da sala).
 * A rede e o banco ficam na rota.
 */
import { enderecosParaBusca } from "@/lib/email/historico";

export type PlataformaDaReuniao = "google_meet" | "teams";
/** A sala do Meet nasce na agenda do Google; a do Teams, na do Outlook. */
export const CALENDARIO_DA_PLATAFORMA: Record<PlataformaDaReuniao, "google" | "microsoft"> = {
  google_meet: "google",
  teams: "microsoft",
};

export const DURACOES = [30, 45, 60, 90, 120] as const;
export const DURACAO_PADRAO = 60;
export const MAXIMO_DE_PARTICIPANTES = 25;
export const MAXIMO_DO_TITULO = 200;
/** Uma reunião pode ser marcada com até um ano de antecedência. */
export const ANTECEDENCIA_MAXIMA_MS = 366 * 24 * 60 * 60_000;

export type PedidoDeReuniao = {
  titulo: string;
  plataforma: PlataformaDaReuniao;
  /** Começo da reunião. */
  comeca: Date;
  duracaoMin: number;
  participantes: string[];
  empresaCrmId: string | null;
  captacaoId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ValidacaoDaReuniao = { ok: true; pedido: PedidoDeReuniao } | { ok: false; erro: string };

function uuidOuNulo(valor: unknown): string | null | undefined {
  if (valor === undefined || valor === null || valor === "") return null;
  return typeof valor === "string" && UUID.test(valor) ? valor : undefined;
}

/** Confere o que vem da tela. `agora` só existe para os testes. */
export function validarPedidoDeReuniao(corpo: unknown, agora: Date = new Date()): ValidacaoDaReuniao {
  if (!corpo || typeof corpo !== "object") return { ok: false, erro: "Pedido inválido." };
  const dados = corpo as Record<string, unknown>;

  const titulo = typeof dados.titulo === "string" ? dados.titulo.replace(/\s*[\r\n]+\s*/g, " ").trim() : "";
  if (!titulo) return { ok: false, erro: "Dê um nome à reunião." };
  if (titulo.length > MAXIMO_DO_TITULO) return { ok: false, erro: `O nome passa de ${MAXIMO_DO_TITULO} caracteres.` };

  const plataforma = dados.plataforma === "google_meet" || dados.plataforma === "teams" ? dados.plataforma : null;
  if (!plataforma) return { ok: false, erro: "Escolha entre Google Meet e Microsoft Teams." };

  const comeca = typeof dados.comeca === "string" ? new Date(dados.comeca) : null;
  if (!comeca || Number.isNaN(comeca.getTime())) return { ok: false, erro: "A data e a hora são inválidas." };
  const distancia = comeca.getTime() - agora.getTime();
  if (distancia < 0) return { ok: false, erro: "Escolha uma data e hora que ainda não passaram." };
  if (distancia > ANTECEDENCIA_MAXIMA_MS) return { ok: false, erro: "A reunião pode ser marcada com até um ano de antecedência." };

  const duracaoMin = typeof dados.duracaoMin === "number" ? dados.duracaoMin : DURACAO_PADRAO;
  if (!Number.isInteger(duracaoMin) || duracaoMin < 15 || duracaoMin > 480) return { ok: false, erro: "A duração precisa ficar entre 15 minutos e 8 horas." };

  const brutos = dados.participantes;
  if (brutos !== undefined && brutos !== null && (!Array.isArray(brutos) || brutos.some((item) => typeof item !== "string"))) {
    return { ok: false, erro: "Pedido inválido." };
  }
  const lista = (brutos as string[] | undefined) ?? [];
  const participantes = enderecosParaBusca(lista);
  const distintos = new Set(lista.map((item) => item.trim().toLowerCase()).filter(Boolean));
  if (participantes.length !== distintos.size) return { ok: false, erro: "Confira os e-mails dos participantes: algum não é um endereço válido." };
  if (participantes.length > MAXIMO_DE_PARTICIPANTES) return { ok: false, erro: `No máximo ${MAXIMO_DE_PARTICIPANTES} participantes.` };

  const empresaCrmId = uuidOuNulo(dados.empresaCrmId);
  const captacaoId = uuidOuNulo(dados.captacaoId);
  if (empresaCrmId === undefined || captacaoId === undefined) return { ok: false, erro: "Pedido inválido." };

  return { ok: true, pedido: { titulo, plataforma, comeca, duracaoMin, participantes, empresaCrmId, captacaoId } };
}

export function fimDaReuniao(comeca: Date, duracaoMin: number): Date {
  return new Date(comeca.getTime() + duracaoMin * 60_000);
}

/**
 * O evento como cada provedor quer, já pedindo a sala: `conferenceData` no Google (vira um Meet) e
 * `isOnlineMeeting` no Microsoft (vira um Teams). `idDoPedido` identifica o pedido de sala do Google.
 */
export function montarEventoDaReuniao(pedido: PedidoDeReuniao, idDoPedido: string): Record<string, unknown> {
  const fim = fimDaReuniao(pedido.comeca, pedido.duracaoMin);
  const descricao = "Reunião marcada pelo Jards.";
  if (pedido.plataforma === "google_meet") {
    return {
      summary: pedido.titulo,
      description: descricao,
      start: { dateTime: pedido.comeca.toISOString() },
      end: { dateTime: fim.toISOString() },
      attendees: pedido.participantes.map((email) => ({ email })),
      conferenceData: { createRequest: { requestId: idDoPedido, conferenceSolutionKey: { type: "hangoutsMeet" } } },
      extendedProperties: { private: { jards_source: "jards", jards_reuniao: "1" } },
    };
  }
  return {
    subject: pedido.titulo,
    body: { contentType: "text", content: descricao },
    start: { dateTime: pedido.comeca.toISOString().replace("Z", ""), timeZone: "UTC" },
    end: { dateTime: fim.toISOString().replace("Z", ""), timeZone: "UTC" },
    attendees: pedido.participantes.map((email) => ({ emailAddress: { address: email }, type: "required" })),
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
    categories: ["Jards"],
  };
}

type RespostaDoGoogle = { hangoutLink?: string | null; conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> } | null; htmlLink?: string | null };
type RespostaDaMicrosoft = { onlineMeeting?: { joinUrl?: string | null } | null; onlineMeetingUrl?: string | null; webLink?: string | null };

/** O endereço para entrar na reunião, dentro da resposta do provedor. Sem ele, não há sala e o agendamento falha. */
export function linkDaSala(plataforma: PlataformaDaReuniao, resposta: unknown): string | null {
  if (!resposta || typeof resposta !== "object") return null;
  if (plataforma === "google_meet") {
    const dados = resposta as RespostaDoGoogle;
    const porVideo = dados.conferenceData?.entryPoints?.find((ponto) => ponto.entryPointType === "video")?.uri;
    return dados.hangoutLink || porVideo || null;
  }
  const dados = resposta as RespostaDaMicrosoft;
  return dados.onlineMeeting?.joinUrl || dados.onlineMeetingUrl || null;
}
