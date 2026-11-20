// Jards -> agenda: toda atividade marcada para sincronizar vira um evento no Google Agenda e/ou no Outlook de quem é o responsável. Com horário vira evento com horário;
// sem horário, evento de dia inteiro. Chamado pelo banco a cada mudança na atividade (rota /api/calendar/push). Substitui a função Deno calendar-sync-push, que nunca foi publicada.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getValidAccessToken } from "./connections";
import type { CalendarProvider } from "./config";
import { FUSO_PADRAO, fimPadrao, somarDias } from "./horario";

export type AtividadeParaAgenda = {
  id: string; account_id: string | null; responsavel_id: string | null;
  nome: string; nota: string | null; tipo: string | null;
  data_inicio: string | null; data_prevista: string | null; hora_inicio: string | null; hora_fim: string | null; feita: boolean;
  google_event_id: string | null; microsoft_event_id: string | null;
  calendar_sync_requested: boolean; sync_origin: string | null;
};
export type AvisoDoBanco = { type: "INSERT" | "UPDATE" | "DELETE"; record: AtividadeParaAgenda | null; old_record: AtividadeParaAgenda | null };

const COR_DO_GOOGLE: Record<string, string> = { reuniao: "5", evento: "7", email: "9", telefone: "10", linkedin: "1", outro: "8" };

function descricao(atividade: AtividadeParaAgenda): string {
  return `Atividade criada no Jards.${atividade.nota ? `\n\n${atividade.nota}` : ""}\n\nID Jards: ${atividade.id}`;
}

/** Começo e fim do evento: com hora, no horário marcado; sem hora, os dias inteiros (o fim do dia inteiro é exclusivo nas duas agendas). */
export function janelaDoEvento(atividade: AtividadeParaAgenda): { diaInteiro: true; inicio: string; fim: string } | { diaInteiro: false; inicio: { data: string; hora: string }; fim: { data: string; hora: string } } | null {
  const dataInicio = (atividade.data_inicio ?? atividade.data_prevista)?.slice(0, 10);
  const dataFim = (atividade.data_prevista ?? atividade.data_inicio)?.slice(0, 10);
  if (!dataInicio || !dataFim) return null;
  const horaInicio = atividade.hora_inicio?.slice(0, 5);
  if (!horaInicio) return { diaInteiro: true, inicio: dataInicio, fim: somarDias(dataFim, 1) };
  const horaFim = atividade.hora_fim?.slice(0, 5);
  const fimInformado = horaFim && `${dataFim}T${horaFim}` > `${dataInicio}T${horaInicio}` ? { data: dataFim, hora: horaFim } : null;
  return { diaInteiro: false, inicio: { data: dataInicio, hora: horaInicio }, fim: fimInformado ?? fimPadrao(dataInicio, horaInicio, 60) };
}

export function montarEvento(atividade: AtividadeParaAgenda, provider: CalendarProvider, fuso: string = FUSO_PADRAO): Record<string, unknown> | null {
  const janela = janelaDoEvento(atividade);
  if (!janela) return null;
  const marcaDoJards = { jards_atividade_id: atividade.id, jards_source: "jards" };
  if (provider === "google") {
    // no PATCH, o campo do formato antigo precisa ir nulo, senão o Google recusa a troca de dia inteiro para horário (e o contrário)
    const inicio = janela.diaInteiro ? { date: janela.inicio, dateTime: null, timeZone: null } : { dateTime: `${janela.inicio.data}T${janela.inicio.hora}:00`, timeZone: fuso, date: null };
    const fim = janela.diaInteiro ? { date: janela.fim, dateTime: null, timeZone: null } : { dateTime: `${janela.fim.data}T${janela.fim.hora}:00`, timeZone: fuso, date: null };
    return {
      summary: atividade.nome, description: descricao(atividade), start: inicio, end: fim,
      transparency: atividade.feita ? "transparent" : "opaque", colorId: COR_DO_GOOGLE[atividade.tipo ?? ""],
      extendedProperties: { private: marcaDoJards },
    };
  }
  return {
    subject: atividade.nome, body: { contentType: "text", content: descricao(atividade) }, isAllDay: janela.diaInteiro,
    start: janela.diaInteiro ? { dateTime: `${janela.inicio}T00:00:00`, timeZone: fuso } : { dateTime: `${janela.inicio.data}T${janela.inicio.hora}:00`, timeZone: fuso },
    end: janela.diaInteiro ? { dateTime: `${janela.fim}T00:00:00`, timeZone: fuso } : { dateTime: `${janela.fim.data}T${janela.fim.hora}:00`, timeZone: fuso },
    showAs: atividade.feita ? "free" : "busy", categories: ["Jards", atividade.tipo || "outro"],
    singleValueExtendedProperties: [{ id: "String {0eecadf5-7b24-4ec8-9f92-1a6b2ba1e6d3} Name jards_atividade_id", value: atividade.id }],
  };
}

type ConexaoDeEnvio = { provider: CalendarProvider; calendar_id: string };

function enderecoDosEventos(conexao: ConexaoDeEnvio): string {
  if (conexao.provider === "google") return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conexao.calendar_id)}/events`;
  return conexao.calendar_id === "primary" ? "https://graph.microsoft.com/v1.0/me/events" : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(conexao.calendar_id)}/events`;
}

async function sincronizarEvento(userId: string, conexao: ConexaoDeEnvio, atividade: AtividadeParaAgenda, acao: "gravar" | "apagar"): Promise<{ id: string; etag: string | null } | null> {
  const token = await getValidAccessToken(userId, conexao.provider);
  const eventoId = conexao.provider === "google" ? atividade.google_event_id : atividade.microsoft_event_id;
  const base = enderecoDosEventos(conexao);
  if (acao === "apagar") {
    if (!eventoId) return null;
    const resposta = await fetch(`${base}/${encodeURIComponent(eventoId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!resposta.ok && resposta.status !== 404 && resposta.status !== 410) throw new Error(`Falha ao apagar o evento (${resposta.status})`);
    return null;
  }
  const corpo = montarEvento(atividade, conexao.provider);
  if (!corpo) return null;
  if (!eventoId && conexao.provider === "google") {
    // evento novo: não há formato antigo para limpar, então os campos nulos saem
    for (const campo of ["start", "end"] as const) corpo[campo] = Object.fromEntries(Object.entries(corpo[campo] as Record<string, unknown>).filter(([, valor]) => valor !== null));
  }
  const resposta = await fetch(eventoId ? `${base}/${encodeURIComponent(eventoId)}` : base, {
    method: eventoId ? "PATCH" : "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo),
  });
  const lido = await resposta.json().catch(() => ({})) as { id?: string; etag?: string; changeKey?: string; error?: { message?: string } };
  if (!resposta.ok || !lido.id) throw new Error(lido.error?.message || `Falha ao sincronizar com a agenda (${resposta.status})`);
  return { id: lido.id, etag: lido.etag || lido.changeKey || null };
}

export type ResultadoDoEnvio = { resultado: string; sincronizadas?: number; falhas?: number };

/** Uma mudança de atividade vinda do banco. Atividade que nasceu na agenda (sync_origin google/microsoft) nunca volta para ela: o evento já existe lá e é de quem o criou. */
export async function enviarParaAgenda(admin: SupabaseClient, aviso: AvisoDoBanco): Promise<ResultadoDoEnvio> {
  const atividade = aviso.type === "DELETE" ? aviso.old_record : aviso.record;
  if (!atividade?.id) return { resultado: "aviso sem atividade" };
  if (atividade.sync_origin === "google" || atividade.sync_origin === "microsoft") return { resultado: "veio da agenda, não volta" };

  const atualizar = async (campos: Record<string, unknown>) => {
    const { error } = await admin.from("atividades").update(campos).eq("id", atividade.id);
    if (error) throw new Error(error.message);
  };
  const dono = atividade.responsavel_id || atividade.account_id;
  if (!dono) {
    if (aviso.type !== "DELETE") await atualizar({ calendar_sync_status: "skipped", calendar_sync_error: "Atividade sem responsável ou criador" });
    return { resultado: "sem responsável" };
  }
  const { data, error } = await admin.from("calendar_connections").select("provider, calendar_id").eq("user_id", dono).eq("sync_enabled", true);
  if (error) throw new Error(error.message);
  const conexoes = (data ?? []) as ConexaoDeEnvio[];
  const querSincronizar = atividade.calendar_sync_requested && Boolean(atividade.data_inicio || atividade.data_prevista);

  if (aviso.type !== "DELETE" && !querSincronizar) {
    await Promise.all(conexoes.map(conexao => sincronizarEvento(dono, conexao, atividade, "apagar")));
    await atualizar({ google_event_id: null, microsoft_event_id: null, calendar_sync_status: "skipped", calendar_sync_error: null });
    return { resultado: "sincronização não pedida ou sem data" };
  }
  if (conexoes.length === 0) {
    if (aviso.type !== "DELETE") await atualizar({ calendar_sync_status: "skipped", calendar_sync_error: "Nenhum calendário conectado para o responsável" });
    return { resultado: "sem agenda conectada" };
  }
  if (aviso.type === "DELETE") {
    await Promise.all(conexoes.map(conexao => sincronizarEvento(dono, conexao, atividade, "apagar")));
    return { resultado: "evento apagado" };
  }

  const resultados = await Promise.allSettled(conexoes.map(async conexao => ({ conexao, evento: await sincronizarEvento(dono, conexao, atividade, "gravar") })));
  const falhas = resultados.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  const campos: Record<string, unknown> = { calendar_synced_at: new Date().toISOString(), sync_origin: "jards" };
  for (const resultado of resultados) {
    if (resultado.status !== "fulfilled" || !resultado.value.evento) continue;
    campos[resultado.value.conexao.provider === "google" ? "google_event_id" : "microsoft_event_id"] = resultado.value.evento.id;
    campos.external_etag = resultado.value.evento.etag;
  }
  campos.calendar_sync_status = falhas.length === resultados.length ? "error" : "synced";
  campos.calendar_sync_error = falhas.length ? falhas.map(f => String(f.reason?.message || f.reason)).join(" | ").slice(0, 1000) : null;
  await atualizar(campos);
  return { resultado: "enviado", sincronizadas: resultados.length - falhas.length, falhas: falhas.length };
}
