import assert from "node:assert/strict";
import test from "node:test";
import { fimPadrao, instanteLocal, partesLocais, somarDias } from "../lib/calendar/horario";
import { janelaDoEvento, montarEvento, type AtividadeParaAgenda } from "../lib/calendar/empurrar";
import { atividadeDoEvento, vinculoDosConvidados } from "../lib/calendar/importar";
import type { EventoLido } from "../lib/reunioes/eventos-do-calendario";

const base: AtividadeParaAgenda = {
  id: "a1", account_id: "u1", responsavel_id: "u1", nome: "Reunião com a Vale", nota: "Levar a proposta", tipo: "reuniao",
  data_inicio: "2026-11-20T00:00:00+00:00", data_prevista: "2026-11-20T00:00:00+00:00", hora_inicio: "14:00:00", hora_fim: "15:30:00", feita: false,
  google_event_id: null, microsoft_event_id: null, calendar_sync_requested: true, sync_origin: null,
};

test("horário: converte UTC para o relógio de São Paulo e volta", () => {
  assert.deepEqual(partesLocais("2026-11-18T17:00:00Z"), { data: "2026-11-18", hora: "14:00" });
  assert.deepEqual(partesLocais("2026-11-19T02:30:00Z"), { data: "2026-11-18", hora: "23:30" });
  assert.equal(instanteLocal("2026-11-18", "14:00").toISOString(), "2026-11-18T17:00:00.000Z");
  assert.equal(somarDias("2026-11-30", 1), "2026-12-01");
});

test("horário: fim padrão soma uma hora e passa para o dia seguinte quando precisa", () => {
  assert.deepEqual(fimPadrao("2026-11-18", "14:00"), { data: "2026-11-18", hora: "15:00" });
  assert.deepEqual(fimPadrao("2026-11-18", "23:30"), { data: "2026-11-19", hora: "00:30" });
});

test("envio: com horário vira evento com horário, sem horário vira dia inteiro", () => {
  const comHora = janelaDoEvento(base);
  assert.deepEqual(comHora, { diaInteiro: false, inicio: { data: "2026-11-20", hora: "14:00" }, fim: { data: "2026-11-20", hora: "15:30" } });
  const semHora = janelaDoEvento({ ...base, hora_inicio: null, hora_fim: null });
  assert.deepEqual(semHora, { diaInteiro: true, inicio: "2026-11-20", fim: "2026-11-21" });
  assert.equal(janelaDoEvento({ ...base, data_inicio: null, data_prevista: null }), null);
});

test("envio: hora de fim antes do começo cai na duração padrão de uma hora", () => {
  const janela = janelaDoEvento({ ...base, hora_inicio: "16:00:00", hora_fim: "15:00:00" });
  assert.deepEqual(janela, { diaInteiro: false, inicio: { data: "2026-11-20", hora: "16:00" }, fim: { data: "2026-11-20", hora: "17:00" } });
});

test("envio: corpo do Google e da Microsoft", () => {
  const google = montarEvento(base, "google") as { start: Record<string, unknown>; end: Record<string, unknown>; summary: string; extendedProperties: { private: Record<string, string> } };
  assert.deepEqual(google.start, { dateTime: "2026-11-20T14:00:00", timeZone: "America/Sao_Paulo", date: null });
  assert.deepEqual(google.end, { dateTime: "2026-11-20T15:30:00", timeZone: "America/Sao_Paulo", date: null });
  assert.equal(google.extendedProperties.private.jards_atividade_id, "a1");
  const diaInteiro = montarEvento({ ...base, hora_inicio: null }, "google") as { start: Record<string, unknown> };
  assert.deepEqual(diaInteiro.start, { date: "2026-11-20", dateTime: null, timeZone: null });
  const microsoft = montarEvento(base, "microsoft") as { isAllDay: boolean; start: { dateTime: string }; end: { dateTime: string } };
  assert.equal(microsoft.isAllDay, false);
  assert.equal(microsoft.start.dateTime, "2026-11-20T14:00:00");
  assert.equal(microsoft.end.dateTime, "2026-11-20T15:30:00");
});

const evento = (parcial: Partial<EventoLido> = {}): EventoLido => ({
  id: "ev1", titulo: "Alinhamento Rouanet", diaInteiro: false, linkDeVideo: "https://meet.google.com/abc-defg-hij", minhaResposta: "aceitou", convidados: [],
  inicio: "2026-11-20T17:00:00.000Z", fim: "2026-11-20T18:00:00.000Z", plataforma: "google_meet", cancelado: false, ...parcial,
});

test("importação: reunião com horário vira atividade no fuso de São Paulo, com o link na nota", () => {
  const dados = atividadeDoEvento(evento(), "google");
  assert.ok(dados);
  assert.deepEqual([dados.data_inicio, dados.hora_inicio, dados.data_prevista, dados.hora_fim, dados.tipo], ["2026-11-20", "14:00", "2026-11-20", "15:00", "reuniao"]);
  assert.match(dados.nota, /meet\.google\.com\/abc-defg-hij/);
  assert.match(dados.nota, /Google Agenda/);
});

test("importação: dia inteiro, cancelado e recusado ficam de fora; título vazio ganha nome", () => {
  assert.equal(atividadeDoEvento(evento({ diaInteiro: true }), "google"), null);
  assert.equal(atividadeDoEvento(evento({ cancelado: true }), "microsoft"), null);
  assert.equal(atividadeDoEvento(evento({ minhaResposta: "recusou" }), "microsoft"), null);
  assert.equal(atividadeDoEvento(evento({ titulo: "  " }), "google")?.nome, "Reunião sem título");
});

test("importação: vínculo com o CRM pelo e-mail dos convidados", () => {
  const contatos = [
    { id: "c1", email: "Ana@vale.com", empresa_crm_id: "e1" },
    { id: "c2", email: "bia@vale.com", empresa_crm_id: "e1" },
    { id: "c3", email: "caio@outra.com", empresa_crm_id: "e2" },
  ];
  assert.deepEqual(vinculoDosConvidados(["ana@vale.com"], contatos), { contato_id: "c1", empresa_crm_id: "e1" });
  assert.deepEqual(vinculoDosConvidados(["ana@vale.com", "bia@vale.com"], contatos), { contato_id: null, empresa_crm_id: "e1" });
  assert.deepEqual(vinculoDosConvidados(["ana@vale.com", "caio@outra.com"], contatos), { contato_id: null, empresa_crm_id: null });
  assert.deepEqual(vinculoDosConvidados(["desconhecido@x.com"], contatos), { contato_id: null, empresa_crm_id: null });
});
