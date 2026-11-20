// Compromisso que veio do Google Agenda ou do Outlook, arrastado no calendário do Jards: o horário muda primeiro no evento de lá
// (só o começo e o fim; título, convidados e descrição ficam como estão) e depois na atividade. Se a agenda recusar, nada muda.
// A gravação no Jards não volta para a agenda pelo gatilho (atividade de origem externa não é reenviada), então não há eco.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "./connections";
import { janelaDoEvento } from "./empurrar";
import { FUSO_PADRAO } from "./horario";

export type MudancaDeHorario = { atividadeId: string; data_prevista: string; data_inicio: string | null; hora_inicio: string | null; hora_fim: string | null };
export type ResultadoDaMudanca = { ok: true } | { ok: false; status: number; erro: string };

type Provedor = "google" | "microsoft";

function enderecoDoEvento(provedor: Provedor, calendarId: string, eventoId: string): string {
  if (provedor === "google") return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventoId)}`;
  const base = calendarId === "primary" ? "https://graph.microsoft.com/v1.0/me/events" : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events`;
  return `${base}/${encodeURIComponent(eventoId)}`;
}

/** Corpo do PATCH: só o começo e o fim, no fuso de Brasília. */
export function corpoDoNovoHorario(provedor: Provedor, mudanca: MudancaDeHorario, fuso = FUSO_PADRAO): Record<string, unknown> | null {
  const janela = janelaDoEvento({
    id: mudanca.atividadeId, account_id: null, responsavel_id: null, nome: "", nota: null, tipo: null,
    data_inicio: mudanca.data_inicio ?? mudanca.data_prevista, data_prevista: mudanca.data_prevista,
    hora_inicio: mudanca.hora_inicio, hora_fim: mudanca.hora_fim, feita: false,
    google_event_id: null, microsoft_event_id: null, calendar_sync_requested: false, sync_origin: null,
  });
  if (!janela || janela.diaInteiro) return null;
  const ponta = (p: { data: string; hora: string }) => ({ dateTime: `${p.data}T${p.hora}:00`, timeZone: fuso });
  return provedor === "google"
    ? { start: { ...ponta(janela.inicio), date: null }, end: { ...ponta(janela.fim), date: null } }
    : { start: ponta(janela.inicio), end: ponta(janela.fim) };
}

export async function moverEventoDaAgenda(admin: SupabaseClient, userId: string, mudanca: MudancaDeHorario): Promise<ResultadoDaMudanca> {
  const { data: atividade, error } = await admin.from("atividades")
    .select("id, account_id, sync_origin, google_event_id, microsoft_event_id")
    .eq("id", mudanca.atividadeId).maybeSingle();
  if (error) return { ok: false, status: 500, erro: error.message };
  if (!atividade) return { ok: false, status: 404, erro: "Atividade não encontrada." };
  const provedor = atividade.sync_origin as Provedor;
  if (provedor !== "google" && provedor !== "microsoft") return { ok: false, status: 400, erro: "Esta atividade não veio de uma agenda conectada." };
  const nomeDaAgenda = provedor === "google" ? "Google Agenda" : "Outlook";
  if (atividade.account_id !== userId) return { ok: false, status: 403, erro: `Este compromisso veio do ${nomeDaAgenda} de outra pessoa: só ela pode mudar o horário.` };
  const eventoId = provedor === "google" ? atividade.google_event_id : atividade.microsoft_event_id;
  const corpo = corpoDoNovoHorario(provedor, mudanca);
  if (!eventoId || !corpo) return { ok: false, status: 400, erro: `Compromisso do ${nomeDaAgenda} precisa ficar com horário.` };

  const { data: conexao } = await admin.from("calendar_connections").select("calendar_id").eq("user_id", userId).eq("provider", provedor).maybeSingle();
  if (!conexao) return { ok: false, status: 409, erro: `O ${nomeDaAgenda} não está mais conectado. Conecte de novo em Configurações.` };

  let token: string;
  try { token = await getValidAccessToken(userId, provedor); }
  catch { return { ok: false, status: 409, erro: `A conexão com o ${nomeDaAgenda} expirou. Conecte de novo em Configurações.` }; }

  const resposta = await fetch(enderecoDoEvento(provedor, conexao.calendar_id || "primary", eventoId), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const lido = await resposta.json().catch(() => ({})) as { etag?: string; changeKey?: string; error?: { message?: string } };
  if (!resposta.ok) {
    if (resposta.status === 403) return { ok: false, status: 403, erro: `O ${nomeDaAgenda} não deixou mudar: só quem organizou a reunião pode mudar o horário.` };
    if (resposta.status === 404 || resposta.status === 410) return { ok: false, status: 404, erro: `O evento não existe mais no ${nomeDaAgenda}.` };
    return { ok: false, status: 502, erro: lido.error?.message || `O ${nomeDaAgenda} recusou a mudança (${resposta.status}).` };
  }

  const { error: falha } = await admin.from("atividades").update({
    data_prevista: mudanca.data_prevista, data_inicio: mudanca.data_inicio ?? mudanca.data_prevista,
    hora_inicio: mudanca.hora_inicio, hora_fim: mudanca.hora_fim,
    external_etag: lido.etag || lido.changeKey || null, calendar_synced_at: new Date().toISOString(),
  }).eq("id", atividade.id);
  if (falha) return { ok: false, status: 500, erro: `O horário mudou no ${nomeDaAgenda}, mas não no Jards: ${falha.message}. A próxima importação acerta.` };
  return { ok: true };
}
