import assert from "node:assert/strict";
import test from "node:test";
import { acharLinkDeVideo, eventoDaMicrosoft, eventoDoGoogle } from "../lib/reunioes/eventos-do-calendario";
import { decidirEntrada } from "../lib/reunioes/regra-do-calendario";
import { chaveDaReuniao, naJanelaDeEntrada } from "../lib/reunioes/calendario-sincronizar";

const contexto = { emailDaConta: "ana@platibanda.com", emailsDosMembros: ["ana@platibanda.com", "luan@platibanda.com"] };

test("link de vídeo: acha Meet e Teams, ignora Zoom e texto sem link", () => {
  assert.deepEqual(acharLinkDeVideo("Entre em https://meet.google.com/abc-defg-hij?authuser=0 agora"), { url: "https://meet.google.com/abc-defg-hij?authuser=0", plataforma: "google_meet" });
  assert.equal(acharLinkDeVideo(null, "<a href=\"https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d\">entrar</a>")?.plataforma, "teams");
  assert.equal(acharLinkDeVideo("https://zoom.us/j/123456789"), null);
  assert.equal(acharLinkDeVideo(undefined, ""), null);
});

test("Google: convidados, resposta própria, organizador de fora e link da sala", () => {
  const evento = eventoDoGoogle({
    id: "ev1", summary: "Proposta Rouanet", hangoutLink: "https://meet.google.com/abc-defg-hij",
    start: { dateTime: "2026-11-18T14:00:00-03:00" }, end: { dateTime: "2026-11-18T15:00:00-03:00" },
    organizer: { email: "cliente@empresa.com.br" },
    attendees: [{ email: "ana@platibanda.com", self: true, responseStatus: "accepted" }, { email: "sala1@resource.calendar.google.com", resource: true }],
  });
  assert.ok(evento);
  assert.equal(evento.inicio, "2026-11-18T17:00:00.000Z");
  assert.equal(evento.minhaResposta, "aceitou");
  assert.equal(evento.plataforma, "google_meet");
  assert.deepEqual(evento.convidados.map(pessoa => pessoa.email), ["ana@platibanda.com", "sala1@resource.calendar.google.com", "cliente@empresa.com.br"]);
  const decisao = decidirEntrada(evento, contexto);
  assert.deepEqual([decisao.entra, decisao.externos], [true, ["cliente@empresa.com.br"]]);
});

test("Google: dia inteiro, cancelado e sem id", () => {
  assert.equal(eventoDoGoogle({ id: "x", start: { date: "2026-11-18" } })?.diaInteiro, true);
  assert.equal(eventoDoGoogle({ id: "x", status: "cancelled", start: { dateTime: "2026-11-18T14:00:00Z" } })?.cancelado, true);
  assert.equal(eventoDoGoogle({ start: { dateTime: "2026-11-18T14:00:00Z" } }), null);
});

test("Microsoft: horário em UTC sem Z, link do Teams e quem organiza é a própria pessoa", () => {
  const evento = eventoDaMicrosoft({
    id: "AAMk1", subject: "Alinhamento com a agência", isOrganizer: true, onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_x%40thread.v2/0?context=1" },
    start: { dateTime: "2026-11-18T17:00:00.0000000" }, end: { dateTime: "2026-11-18T18:00:00.0000000" }, organizer: { emailAddress: { address: "ana@platibanda.com" } },
    attendees: [{ type: "required", emailAddress: { address: "ana@platibanda.com" } }, { type: "required", emailAddress: { address: "contato@agencia.com" } }, { type: "resource", emailAddress: { address: "sala@platibanda.com" } }],
  });
  assert.ok(evento);
  assert.equal(evento.inicio, "2026-11-18T17:00:00.000Z");
  assert.equal(evento.plataforma, "teams");
  assert.equal(evento.minhaResposta, null);
  assert.equal(decidirEntrada(evento, contexto).entra, true);
  const soDeDentro = eventoDaMicrosoft({ id: "2", start: { dateTime: "2026-11-18T17:00:00" }, onlineMeeting: { joinUrl: "https://teams.microsoft.com/meet/123456789?p=abc" }, attendees: [{ emailAddress: { address: "luan@platibanda.com" } }] });
  assert.equal(soDeDentro && decidirEntrada(soDeDentro, contexto).motivo, "so_gente_de_dentro");
  assert.equal(eventoDaMicrosoft({ id: "3", isAllDay: true, start: { dateTime: "2026-11-18T00:00:00" } })?.diaInteiro, true);
  assert.equal(eventoDaMicrosoft({ subject: "sem id", start: { dateTime: "2026-11-18T00:00:00" } }), null);
});

test("janela de entrada: de 4 minutos antes até 10 depois do começo", () => {
  const agora = new Date("2026-11-18T17:00:00Z");
  assert.equal(naJanelaDeEntrada("2026-11-18T17:03:00Z", agora), true);
  assert.equal(naJanelaDeEntrada("2026-11-18T17:05:00Z", agora), false, "ainda falta mais de 4 minutos");
  assert.equal(naJanelaDeEntrada("2026-11-18T16:52:00Z", agora), true);
  assert.equal(naJanelaDeEntrada("2026-11-18T16:49:00Z", agora), false, "começou há mais de 10 minutos");
});

test("chave da reunião: Meet sem parâmetros de rastreio, Teams inteiro", () => {
  assert.equal(chaveDaReuniao("https://meet.google.com/abc-defg-hij?authuser=1"), chaveDaReuniao("https://meet.google.com/abc-defg-hij"));
  assert.notEqual(chaveDaReuniao("https://teams.microsoft.com/meet/111?p=a"), chaveDaReuniao("https://teams.microsoft.com/meet/222?p=a"));
});
