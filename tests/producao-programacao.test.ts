import assert from "node:assert/strict";
import test from "node:test";
import { faixaDaSessao, lerSessao, pautasQueAceitamSessao, sessoesComSala, sessoesDaSalaNoDia, sessoesEmConflito, type PautaDaSessao, type SessaoDaGrade } from "../lib/producao/programacao";

const pautas: PautaDaSessao[] = [
  { id: "p1", sala_id: "s1", titulo: "Festival", inicio: "2026-12-05", fim: "2026-12-07", situacao: "confirmada" },
  { id: "p2", sala_id: "s2", titulo: "Oficina", inicio: "2026-12-05", fim: "2026-12-05", situacao: "pre_reserva" },
  { id: "p3", sala_id: "s1", titulo: "Cancelada", inicio: "2026-12-06", fim: "2026-12-06", situacao: "cancelada" },
];
const sessao = (id: string, pauta: string, dia: string, inicio: string, fim: string, titulo: string | null = null): SessaoDaGrade => ({ id, pauta_id: pauta, dia, inicio, fim, titulo, notas: null });

test("a sessão herda a sala e o título da pauta; o título dela vale mais; sessão de pauta ausente some", () => {
  const lista = sessoesComSala([sessao("a", "p1", "2026-12-05", "18:00:00", "20:00:00"), sessao("b", "p1", "2026-12-05", "21:00", "22:00", "Peça B"), sessao("c", "px", "2026-12-05", "10:00", "11:00")], pautas);
  assert.deepEqual(lista.map(item => [item.id, item.sala_id, item.tituloFinal]), [["a", "s1", "Festival"], ["b", "s1", "Peça B"]]);
});

test("as sessões da sala no dia saem da mais cedo à mais tarde, só da sala e do dia", () => {
  const lista = sessoesComSala([
    sessao("a", "p1", "2026-12-05", "21:00", "22:00"), sessao("b", "p1", "2026-12-05", "09:00", "10:00"), sessao("c", "p1", "2026-12-06", "09:00", "10:00"), sessao("d", "p2", "2026-12-05", "09:00", "10:00"),
  ], pautas);
  assert.deepEqual(sessoesDaSalaNoDia(lista, "s1", "2026-12-05").map(item => item.id), ["b", "a"]);
});

test("conflito: mesma sala, mesmo dia, horas que se cruzam; encostar e salas diferentes não contam", () => {
  const lista = sessoesComSala([
    sessao("a", "p1", "2026-12-05", "18:00", "20:00"), sessao("b", "p1", "2026-12-05", "19:30", "21:00"), sessao("c", "p1", "2026-12-05", "21:00", "22:00"),
    sessao("d", "p2", "2026-12-05", "18:00", "20:00"), sessao("e", "p1", "2026-12-06", "18:00", "20:00"),
  ], pautas);
  assert.deepEqual([...sessoesEmConflito(lista)].sort(), ["a", "b"]);
});

test("a faixa da sessão tira os segundos que o banco devolve", () => {
  assert.equal(faixaDaSessao({ inicio: "18:00:00", fim: "20:30:00" }), "18:00–20:30");
});

test("a pauta aceita sessão no período dela; cancelada e outra sala não", () => {
  assert.deepEqual(pautasQueAceitamSessao(pautas, "s1", "2026-12-06").map(pauta => pauta.id), ["p1"]);
  assert.deepEqual(pautasQueAceitamSessao(pautas, "s1", "2026-12-08"), []);
  assert.deepEqual(pautasQueAceitamSessao(pautas, "s2", "2026-12-05").map(pauta => pauta.id), ["p2"]);
});

test("a sessão lida tem o formato do banco", () => {
  const campos = { pautaId: "p1", dia: "2026-12-06", inicio: "18:00:00", fim: "20:30", titulo: " Peça ", notas: " " };
  assert.deepEqual(lerSessao(campos, pautas), { ok: true, sessao: { pauta_id: "p1", dia: "2026-12-06", inicio: "18:00", fim: "20:30", titulo: "Peça", notas: null } });
  assert.deepEqual(lerSessao({ ...campos, titulo: "" }, pautas).ok && (lerSessao({ ...campos, titulo: "" }, pautas) as { sessao: { titulo: string | null } }).sessao.titulo, null);
});

test("o que o banco recusaria a tela recusa antes", () => {
  const campos = { pautaId: "p1", dia: "2026-12-06", inicio: "18:00", fim: "20:00", titulo: "", notas: "" };
  assert.equal(lerSessao({ ...campos, pautaId: "" }, pautas).ok, false);
  assert.equal(lerSessao({ ...campos, pautaId: "px" }, pautas).ok, false);
  assert.equal(lerSessao({ ...campos, dia: "" }, pautas).ok, false);
  assert.equal(lerSessao({ ...campos, dia: "2026-12-08" }, pautas).ok, false, "fora do período da pauta");
  assert.equal(lerSessao({ ...campos, inicio: "" }, pautas).ok, false);
  assert.equal(lerSessao({ ...campos, fim: "25:00" }, pautas).ok, false);
  assert.equal(lerSessao({ ...campos, fim: "18:00" }, pautas).ok, false);
  assert.equal(lerSessao({ ...campos, titulo: "x".repeat(201) }, pautas).ok, false);
  assert.equal(lerSessao({ ...campos, notas: "x".repeat(501) }, pautas).ok, false);
});
