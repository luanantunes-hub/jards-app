import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { lerReuniaoDoVexa, lerTrechos } from "../lib/reunioes/vexa";
import { assinaturaValida, decidirAcao, lerAviso } from "../lib/reunioes/vexa-webhook";

const assinar = (segredo: string, horario: string, corpo: string) => `sha256=${createHmac("sha256", segredo).update(`${horario}.${corpo}`).digest("hex")}`;

test("assinatura: HMAC do horário mais o corpo, dentro da janela de 5 minutos", () => {
  const corpo = '{"event_id":"evt_1"}', horario = "1800000000", agoraMs = 1800000100 * 1000;
  assert.equal(assinaturaValida({ segredo: "s", corpo, horario, assinatura: assinar("s", horario, corpo), agoraMs }), true);
  assert.equal(assinaturaValida({ segredo: "outro", corpo, horario, assinatura: assinar("s", horario, corpo), agoraMs }), false, "segredo errado");
  assert.equal(assinaturaValida({ segredo: "s", corpo: corpo + " ", horario, assinatura: assinar("s", horario, corpo), agoraMs }), false, "corpo alterado");
  assert.equal(assinaturaValida({ segredo: "s", corpo, horario, assinatura: assinar("s", horario, corpo), agoraMs: agoraMs + 400_000 }), false, "aviso antigo");
  assert.equal(assinaturaValida({ segredo: "s", corpo, horario: null, assinatura: assinar("s", horario, corpo), agoraMs }), false);
  assert.equal(assinaturaValida({ segredo: "s", corpo, horario, assinatura: "sha256=abc", agoraMs }), false);
  assert.equal(assinaturaValida({ segredo: "", corpo, horario, assinatura: assinar("", horario, corpo), agoraMs }), false, "sem segredo configurado nada vale");
});

const concluido = { event_id: "evt_5f3c", event_type: "meeting.completed", api_version: "2026-03-01", created_at: "2026-06-18T10:42:00.000Z", data: { meeting: { id: 11367, platform: "google_meet", native_meeting_id: "abc-defg-hij", status: "completed", completion_reason: "stopped", service_provenance: { bot_admitted_at: "2026-06-18T10:00:00.000Z", bot_departed_at: "2026-06-18T10:42:00.000Z" }, start_time: "2026-06-18T09:58:00.000Z", end_time: "2026-06-18T10:43:00.000Z" } } };

test("aviso: lê o número da reunião e prefere o tempo observado pelo robô", () => {
  const aviso = lerAviso(concluido);
  assert.deepEqual(aviso, { eventId: "evt_5f3c", tipo: "meeting.completed", vexaId: "11367", comecouEm: "2026-06-18T10:00:00.000Z", terminouEm: "2026-06-18T10:42:00.000Z", motivo: "stopped" });
  const semProveniencia = lerAviso({ ...concluido, data: { meeting: { id: 7, start_time: "2026-06-18T09:58:00.000Z", end_time: "2026-06-18T10:43:00.000Z" } } });
  assert.deepEqual([semProveniencia?.comecouEm, semProveniencia?.terminouEm], ["2026-06-18T09:58:00.000Z", "2026-06-18T10:43:00.000Z"]);
  const falha = lerAviso({ event_id: "evt_a1", event_type: "bot.failed", data: { meeting: { id: 11368, failure_stage: "awaiting_admission" }, status_change: { reason: "host denied admission" } } });
  assert.equal(falha?.motivo, "host denied admission");
  assert.equal(lerAviso({ ...concluido, event_type: "meeting.status_change" }), null, "tipo que o Jards não usa");
  assert.equal(lerAviso({ ...concluido, event_id: "" }), null);
  assert.equal(lerAviso({ event_id: "e", event_type: "meeting.completed", data: {} }), null, "sem número da reunião");
  assert.equal(lerAviso(null), null);
});

test("ação: o aviso repetido não faz nada de novo", () => {
  assert.equal(decidirAcao({ tipo: "meeting.started" }, "bot_entrando"), "iniciar");
  assert.equal(decidirAcao({ tipo: "meeting.started" }, "gravando"), "ignorar");
  assert.equal(decidirAcao({ tipo: "meeting.completed" }, "gravando"), "concluir");
  assert.equal(decidirAcao({ tipo: "meeting.completed" }, "processando"), "concluir", "reenvio depois de uma falha ao buscar a transcrição");
  assert.equal(decidirAcao({ tipo: "meeting.completed" }, "concluida"), "ignorar");
  assert.equal(decidirAcao({ tipo: "bot.failed" }, "bot_entrando"), "falhar");
  assert.equal(decidirAcao({ tipo: "bot.failed" }, "falhou"), "ignorar");
  assert.equal(decidirAcao({ tipo: "bot.failed" }, "concluida"), "ignorar");
});

test("reunião do Vexa: o id numérico vira texto e sem id é erro", () => {
  assert.deepEqual(lerReuniaoDoVexa({ id: 42, platform: "teams", native_meeting_id: "397421056486982", status: "requested" }), { id: "42", plataforma: "teams", nativeMeetingId: "397421056486982", status: "requested", motivo: null });
  assert.throws(() => lerReuniaoDoVexa({ status: "requested" }), /número da reunião/);
  assert.throws(() => lerReuniaoDoVexa(null), /número da reunião/);
});

test("trechos: segundos viram milissegundos, rascunho e texto vazio ficam de fora, fala sem nome fica com falante nulo", () => {
  const trechos = lerTrechos({ segments: [
    { speaker: "Jane Liu", text: " Vamos fechar a Rouanet. ", start: 12.4, end: 15.1, completed: true, confidence: 0.93 },
    { speaker: "", text: "sem nome", start: 3, end: 4, completed: true },
    { speaker: "Jane Liu", text: "rascunho", start: 20, end: 21, completed: false },
    { speaker: "Jane Liu", text: "   ", start: 22, end: 23, completed: true },
    { speaker: "Jane Liu", text: "sem tempo", completed: true },
  ] });
  assert.deepEqual(trechos, [
    { falante: null, texto: "sem nome", inicio_ms: 3000, fim_ms: 4000, confianca: null },
    { falante: "Jane Liu", texto: "Vamos fechar a Rouanet.", inicio_ms: 12400, fim_ms: 15100, confianca: 0.93 },
  ]);
  assert.deepEqual(lerTrechos({}), []);
  assert.deepEqual(lerTrechos(null), []);
});
