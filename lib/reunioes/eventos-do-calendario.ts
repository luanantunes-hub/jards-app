// Leitura dos eventos do Google Agenda e do Outlook/Teams e conversão para o formato da regra de entrada (regra-do-calendario.ts).
// As funções "doGoogle"/"daMicrosoft" são puras (recebem o JSON que a API devolve) e têm teste; as "ler…" só fazem a chamada de rede.
// Só lê: nenhuma permissão nova, os convidados vêm junto com o evento nas permissões que o Jards já pede ao conectar a agenda.

import type { ConvidadoDoEvento, EventoDoCalendario } from "./regra-do-calendario";

export type PlataformaDaReuniao = "google_meet" | "teams";
export type EventoLido = EventoDoCalendario & {
  inicio: string; // ISO em UTC
  fim: string | null;
  plataforma: PlataformaDaReuniao | null;
  cancelado: boolean;
};

const PADRAO_MEET = /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}(?:\?[^\s"'<>]*)?/i;
const PADRAOES_TEAMS = [
  /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>]+/i,
  /https:\/\/teams\.microsoft\.com\/meet\/[^\s"'<>]+/i,
  /https:\/\/teams\.live\.com\/meet\/[^\s"'<>]+/i,
];

/** Acha o primeiro link de Meet ou Teams num texto (local, descrição, corpo). O robô só entra nessas duas plataformas. */
export function acharLinkDeVideo(...textos: Array<string | null | undefined>): { url: string; plataforma: PlataformaDaReuniao } | null {
  for (const texto of textos) {
    if (!texto) continue;
    const limpo = texto.replace(/&amp;/g, "&");
    const meet = limpo.match(PADRAO_MEET);
    if (meet) return { url: meet[0], plataforma: "google_meet" };
    for (const padrao of PADRAOES_TEAMS) {
      const teams = limpo.match(padrao);
      if (teams) return { url: teams[0].replace(/[.,;)]+$/, ""), plataforma: "teams" };
    }
  }
  return null;
}

type RespostaDoGoogle = "accepted" | "declined" | "tentative" | "needsAction" | undefined;
const respostaDoGoogle = (valor: RespostaDoGoogle): EventoDoCalendario["minhaResposta"] =>
  valor === "accepted" ? "aceitou" : valor === "declined" ? "recusou" : valor === "tentative" ? "talvez" : valor === "needsAction" ? "sem_resposta" : null;

export type EventoBrutoDoGoogle = {
  id?: string; status?: string; summary?: string; location?: string; description?: string; hangoutLink?: string;
  start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string };
  organizer?: { email?: string; self?: boolean };
  attendees?: Array<{ email?: string; self?: boolean; resource?: boolean; responseStatus?: RespostaDoGoogle }>;
  conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
};

/** Evento do Google Agenda → evento da regra. Nulo quando falta o essencial (id ou horário). */
export function eventoDoGoogle(bruto: EventoBrutoDoGoogle): EventoLido | null {
  if (!bruto.id || (!bruto.start?.dateTime && !bruto.start?.date)) return null;
  const video = bruto.conferenceData?.entryPoints?.find(ponto => ponto.entryPointType === "video")?.uri;
  const link = acharLinkDeVideo(bruto.hangoutLink, video, bruto.location, bruto.description);
  const convidados: ConvidadoDoEvento[] = (bruto.attendees ?? []).filter(pessoa => pessoa.email).map(pessoa => ({ email: pessoa.email as string, recurso: pessoa.resource === true }));
  // Quem organiza também é participante: um convidado de fora que marca a reunião conta como "de fora".
  if (bruto.organizer?.email && !bruto.organizer.self && !convidados.some(pessoa => pessoa.email.toLowerCase() === bruto.organizer?.email?.toLowerCase())) convidados.push({ email: bruto.organizer.email });
  const minha = (bruto.attendees ?? []).find(pessoa => pessoa.self);
  return {
    id: bruto.id,
    titulo: bruto.summary?.trim() || "Reunião",
    diaInteiro: !bruto.start?.dateTime,
    linkDeVideo: link?.url ?? null,
    plataforma: link?.plataforma ?? null,
    minhaResposta: minha ? respostaDoGoogle(minha.responseStatus) : null,
    convidados,
    inicio: bruto.start?.dateTime ? new Date(bruto.start.dateTime).toISOString() : new Date(`${bruto.start?.date}T00:00:00Z`).toISOString(),
    fim: bruto.end?.dateTime ? new Date(bruto.end.dateTime).toISOString() : null,
    cancelado: bruto.status === "cancelled",
  };
}

type RespostaDaMicrosoft = "none" | "organizer" | "tentativelyAccepted" | "accepted" | "declined" | "notResponded" | undefined;
const respostaDaMicrosoft = (valor: RespostaDaMicrosoft): EventoDoCalendario["minhaResposta"] =>
  valor === "accepted" ? "aceitou" : valor === "declined" ? "recusou" : valor === "tentativelyAccepted" ? "talvez" : valor === "none" || valor === "notResponded" ? "sem_resposta" : null;

export type EventoBrutoDaMicrosoft = {
  id?: string; subject?: string; isAllDay?: boolean; isCancelled?: boolean; isOrganizer?: boolean; bodyPreview?: string;
  start?: { dateTime?: string }; end?: { dateTime?: string };
  location?: { displayName?: string };
  onlineMeeting?: { joinUrl?: string } | null; onlineMeetingUrl?: string | null;
  organizer?: { emailAddress?: { address?: string } };
  responseStatus?: { response?: RespostaDaMicrosoft };
  attendees?: Array<{ type?: string; emailAddress?: { address?: string }; status?: { response?: RespostaDaMicrosoft } }>;
};

const comoUtc = (texto: string | undefined) => (texto ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(texto) ? texto : `${texto}Z`).toISOString() : null);

/** Evento do Outlook/Teams (Microsoft Graph, horários em UTC) → evento da regra. */
export function eventoDaMicrosoft(bruto: EventoBrutoDaMicrosoft): EventoLido | null {
  const inicio = comoUtc(bruto.start?.dateTime);
  if (!bruto.id || !inicio) return null;
  const link = acharLinkDeVideo(bruto.onlineMeeting?.joinUrl, bruto.onlineMeetingUrl, bruto.location?.displayName, bruto.bodyPreview);
  const convidados: ConvidadoDoEvento[] = (bruto.attendees ?? []).filter(pessoa => pessoa.emailAddress?.address).map(pessoa => ({ email: pessoa.emailAddress?.address as string, recurso: pessoa.type === "resource" }));
  const organizador = bruto.organizer?.emailAddress?.address;
  if (organizador && !bruto.isOrganizer && !convidados.some(pessoa => pessoa.email.toLowerCase() === organizador.toLowerCase())) convidados.push({ email: organizador });
  return {
    id: bruto.id,
    titulo: bruto.subject?.trim() || "Reunião",
    diaInteiro: bruto.isAllDay === true,
    linkDeVideo: link?.url ?? null,
    plataforma: link?.plataforma ?? null,
    minhaResposta: bruto.isOrganizer ? null : respostaDaMicrosoft(bruto.responseStatus?.response),
    convidados,
    inicio,
    fim: comoUtc(bruto.end?.dateTime),
    cancelado: bruto.isCancelled === true,
  };
}

async function pedir<T>(url: string, token: string, extras: Record<string, string> = {}): Promise<T> {
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}`, ...extras }, cache: "no-store" });
  const corpo = await resposta.json().catch(() => ({})) as T & { error?: { message?: string } | string };
  if (!resposta.ok) {
    const erro = corpo.error;
    throw new Error(typeof erro === "string" ? erro : erro?.message || `A agenda respondeu ${resposta.status}`);
  }
  return corpo;
}

/** Eventos do Google Agenda entre dois instantes (repetições já abertas em ocorrências). Até 250 por chamada, o bastante para a janela curta usada. */
export async function lerEventosDoGoogle(token: string, calendarioId: string, de: Date, ate: Date): Promise<EventoLido[]> {
  const parametros = new URLSearchParams({ timeMin: de.toISOString(), timeMax: ate.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250", conferenceDataVersion: "1" });
  const corpo = await pedir<{ items?: EventoBrutoDoGoogle[] }>(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarioId)}/events?${parametros}`, token);
  return (corpo.items ?? []).map(eventoDoGoogle).filter((evento): evento is EventoLido => evento !== null);
}

/** Eventos do Outlook/Teams entre dois instantes (calendarView abre as repetições), com horários em UTC. */
export async function lerEventosDaMicrosoft(token: string, calendarioId: string, de: Date, ate: Date): Promise<EventoLido[]> {
  const parametros = new URLSearchParams({
    startDateTime: de.toISOString(), endDateTime: ate.toISOString(), $top: "100",
    $select: "id,subject,start,end,isAllDay,isCancelled,isOrganizer,organizer,attendees,responseStatus,onlineMeeting,onlineMeetingUrl,location,bodyPreview",
  });
  const base = calendarioId && calendarioId !== "primary" ? `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarioId)}` : "https://graph.microsoft.com/v1.0/me";
  const corpo = await pedir<{ value?: EventoBrutoDaMicrosoft[] }>(`${base}/calendarView?${parametros}`, token, { Prefer: 'outlook.timezone="UTC"' });
  return (corpo.value ?? []).map(eventoDaMicrosoft).filter((evento): evento is EventoLido => evento !== null);
}
