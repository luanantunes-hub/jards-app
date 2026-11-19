import assert from "node:assert/strict";
import test from "node:test";
import { CALENDARIO_DA_PLATAFORMA, fimDaReuniao, linkDaSala, montarEventoDaReuniao, validarPedidoDeReuniao } from "../lib/reunioes/agendar";

const AGORA = new Date("2026-11-19T12:00:00Z");
const DEPOIS = new Date("2026-11-20T15:00:00Z").toISOString();
const base = { titulo: "Alinhamento de cotas", plataforma: "google_meet", comeca: DEPOIS };

function ok(corpo: unknown) {
  const r = validarPedidoDeReuniao(corpo, AGORA);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.ok ? r.pedido : (undefined as never);
}
function erro(corpo: unknown): string {
  const r = validarPedidoDeReuniao(corpo, AGORA);
  assert.equal(r.ok, false);
  return r.ok ? "" : r.erro;
}

test("pedido válido: título limpo, duração padrão e participantes em minúsculas", () => {
  const p = ok({ ...base, titulo: "  Alinhamento\n de cotas ", participantes: ["Marina@Aurora.com.br", "paulo@x.com"] });
  assert.equal(p.titulo, "Alinhamento de cotas");
  assert.equal(p.duracaoMin, 60);
  assert.deepEqual(p.participantes, ["marina@aurora.com.br", "paulo@x.com"]);
  assert.equal(p.empresaCrmId, null);
});

test("recusa sem nome, sem plataforma, com data passada ou longe demais", () => {
  assert.match(erro({ ...base, titulo: " " }), /nome/i);
  assert.match(erro({ ...base, plataforma: "zoom" }), /Meet e Microsoft Teams/);
  assert.match(erro({ ...base, comeca: "2026-11-18T10:00:00Z" }), /não passaram/);
  assert.match(erro({ ...base, comeca: "2028-01-01T10:00:00Z" }), /um ano/);
  assert.match(erro({ ...base, comeca: "amanhã" }), /inválidas/);
  assert.match(erro(null), /inválido/i);
});

test("limites de duração e de participantes", () => {
  assert.match(erro({ ...base, duracaoMin: 10 }), /15 minutos/);
  assert.match(erro({ ...base, duracaoMin: 600 }), /8 horas/);
  assert.match(erro({ ...base, duracaoMin: 45.5 }), /15 minutos/);
  assert.match(erro({ ...base, participantes: ["ana@x.com", "sem-arroba"] }), /participantes/);
  assert.match(erro({ ...base, participantes: Array.from({ length: 26 }, (_, i) => `p${i}@x.com`) }), /25 participantes/);
});

test("vínculos só aceitam identificador do Jards", () => {
  assert.equal(ok({ ...base, empresaCrmId: "aaaaaaaa-0000-4000-8000-000000000001" }).empresaCrmId, "aaaaaaaa-0000-4000-8000-000000000001");
  assert.equal(ok({ ...base, empresaCrmId: "" }).empresaCrmId, null);
  assert.match(erro({ ...base, captacaoId: "nao-e-id" }), /inválido/i);
});

test("a sala do Meet nasce na agenda do Google; a do Teams, na do Outlook", () => {
  assert.equal(CALENDARIO_DA_PLATAFORMA.google_meet, "google");
  assert.equal(CALENDARIO_DA_PLATAFORMA.teams, "microsoft");
});

test("o fim sai do começo mais a duração", () => {
  assert.equal(fimDaReuniao(new Date("2026-11-20T15:00:00Z"), 90).toISOString(), "2026-11-20T16:30:00.000Z");
});

test("evento do Google pede um Meet e leva os participantes", () => {
  const evento = montarEventoDaReuniao(ok({ ...base, participantes: ["ana@x.com"] }), "pedido-1") as any;
  assert.equal(evento.summary, "Alinhamento de cotas");
  assert.deepEqual(evento.attendees, [{ email: "ana@x.com" }]);
  assert.equal(evento.conferenceData.createRequest.conferenceSolutionKey.type, "hangoutsMeet");
  assert.equal(evento.conferenceData.createRequest.requestId, "pedido-1");
  assert.equal(evento.start.dateTime, "2026-11-20T15:00:00.000Z");
  assert.equal(evento.end.dateTime, "2026-11-20T16:00:00.000Z");
});

test("evento da Microsoft pede um Teams e manda a hora sem o Z, com o fuso à parte", () => {
  const evento = montarEventoDaReuniao(ok({ ...base, plataforma: "teams", duracaoMin: 30, participantes: ["ana@x.com"] }), "pedido-2") as any;
  assert.equal(evento.subject, "Alinhamento de cotas");
  assert.equal(evento.isOnlineMeeting, true);
  assert.equal(evento.onlineMeetingProvider, "teamsForBusiness");
  assert.deepEqual(evento.attendees, [{ emailAddress: { address: "ana@x.com" }, type: "required" }]);
  assert.equal(evento.start.dateTime, "2026-11-20T15:00:00.000");
  assert.equal(evento.start.timeZone, "UTC");
  assert.equal(evento.end.dateTime, "2026-11-20T15:30:00.000");
});

test("o link da sala é lido da resposta de cada provedor", () => {
  assert.equal(linkDaSala("google_meet", { hangoutLink: "https://meet.google.com/abc-defg-hij" }), "https://meet.google.com/abc-defg-hij");
  assert.equal(linkDaSala("google_meet", { conferenceData: { entryPoints: [{ entryPointType: "phone", uri: "tel:+55" }, { entryPointType: "video", uri: "https://meet.google.com/xyz" }] } }), "https://meet.google.com/xyz");
  assert.equal(linkDaSala("teams", { onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/meetup-join/x" } }), "https://teams.microsoft.com/l/meetup-join/x");
  // sem sala não dá para entrar: quem chama trata como falha, em vez de gravar uma reunião sem link
  assert.equal(linkDaSala("google_meet", { htmlLink: "https://calendar.google.com/evento" }), null);
  assert.equal(linkDaSala("teams", { webLink: "https://outlook.office.com/evento" }), null);
  assert.equal(linkDaSala("teams", null), null);
});
