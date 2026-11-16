import assert from "node:assert/strict";
import test from "node:test";
import { comASessaoNoDia, diasDaProgramacaoPublica, faixaDaSessao, lerSessao, pautasQueAceitamSessao, podeMoverParaODia, sessoesComSala, sessoesDaSalaNoDia, sessoesEmConflito, type PautaDaSessao, type SessaoDaGrade } from "../lib/producao/programacao";

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

test("a programação pública: só pauta confirmada, de hoje em diante, por dia e por hora, sem nada além de hora, título e sala", () => {
  const todas: PautaDaSessao[] = [
    ...pautas,
    { id: "p4", sala_id: "s1", titulo: "Ainda em conversa", inicio: "2026-12-05", fim: "2026-12-07", situacao: "consulta" },
  ];
  const sessoes: SessaoDaGrade[] = [
    sessao("a", "p1", "2026-12-06", "21:00:00", "22:00:00"), sessao("b", "p1", "2026-12-06", "18:00:00", "20:00:00", "Peça B"), sessao("c", "p1", "2026-12-05", "10:00", "11:00"),
    sessao("d", "p4", "2026-12-06", "10:00", "11:00", "Não confirmada"), sessao("e", "p2", "2026-12-05", "09:00", "10:00"), sessao("f", "p1", "2026-11-01", "18:00", "20:00"),
    { ...sessao("g", "p1", "2026-12-07", "18:00", "20:00"), notas: "segredo" },
  ];
  const dias = diasDaProgramacaoPublica(sessoes, todas, [{ id: "s1", nome: "Sala Grande" }, { id: "s2", nome: "Sala Pequena" }], "2026-12-01");
  assert.deepEqual(dias.map(dia => dia.dia), ["2026-12-05", "2026-12-06", "2026-12-07"]);
  assert.deepEqual(dias[0].sessoes, [{ inicio: "10:00", fim: "11:00", titulo: "Festival", sala: "Sala Grande", marca: null }]);
  assert.deepEqual(dias[1].sessoes.map(item => [item.inicio, item.titulo]), [["18:00", "Peça B"], ["21:00", "Festival"]]);
  assert.equal(JSON.stringify(dias).includes("segredo"), false, "as notas não saem");
  assert.equal(JSON.stringify(dias).includes("Não confirmada"), false, "pauta que não é confirmada não sai");
  assert.equal(JSON.stringify(dias).includes("Oficina"), false, "a pré-reserva de outra sala não sai");
  assert.deepEqual(Object.keys(dias[0].sessoes[0]).sort(), ["fim", "inicio", "marca", "sala", "titulo"]);
});

test("a programação pública mostra a marca que apresenta a sessão, só com nome, site e logo, e esconde a marca arquivada", () => {
  const marcas = new Map([
    ["m1", { nome: "Banco Central", site_url: "https://bc.example.com", logo_url: "https://bc.example.com/logo.png", arquivada: false }],
    ["m2", { nome: "Marca antiga", site_url: null, logo_url: null, arquivada: true }],
  ]);
  const sessoes: SessaoDaGrade[] = [
    { ...sessao("a", "p1", "2026-12-05", "10:00", "11:00"), marca_id: "m1" },
    { ...sessao("b", "p1", "2026-12-05", "12:00", "13:00"), marca_id: "m2" },
    { ...sessao("c", "p1", "2026-12-05", "14:00", "15:00"), marca_id: "some" },
    sessao("d", "p1", "2026-12-05", "16:00", "17:00"),
  ];
  const dias = diasDaProgramacaoPublica(sessoes, pautas, [{ id: "s1", nome: "Sala Grande" }], "2026-12-01", marcas);
  assert.deepEqual(dias[0].sessoes.map(item => item.marca), [{ nome: "Banco Central", site: "https://bc.example.com", logo: "https://bc.example.com/logo.png" }, null, null, null]);
  assert.deepEqual(Object.keys(dias[0].sessoes[0].marca ?? {}).sort(), ["logo", "nome", "site"]);
});

test("arrastar: a sessão só vai para outro dia dentro do período da pauta dela, nunca para o mesmo dia", () => {
  const a = { pauta_id: "p1", dia: "2026-12-05" };
  assert.equal(podeMoverParaODia(a, pautas, "2026-12-06"), true);
  assert.equal(podeMoverParaODia(a, pautas, "2026-12-07"), true);
  assert.equal(podeMoverParaODia(a, pautas, "2026-12-05"), false, "o mesmo dia não é mudança");
  assert.equal(podeMoverParaODia(a, pautas, "2026-12-08"), false, "depois do fim da pauta");
  assert.equal(podeMoverParaODia(a, pautas, "2026-12-04"), false, "antes do início da pauta");
  assert.equal(podeMoverParaODia({ pauta_id: "sumiu", dia: "2026-12-05" }, pautas, "2026-12-06"), false, "pauta que não veio");
});

test("arrastar: só a sessão escolhida muda de dia (a hora fica), e dá para ver se o novo dia cria um cruzamento", () => {
  const brutas = [sessao("a", "p1", "2026-12-05", "18:00", "20:00"), sessao("b", "p1", "2026-12-06", "19:00", "21:00"), sessao("c", "p1", "2026-12-07", "10:00", "11:00")];
  const depois = comASessaoNoDia(brutas, "a", "2026-12-06");
  assert.deepEqual(depois.map(item => [item.id, item.dia, item.inicio]), [["a", "2026-12-06", "18:00"], ["b", "2026-12-06", "19:00"], ["c", "2026-12-07", "10:00"]]);
  assert.equal(brutas[0].dia, "2026-12-05", "a lista de antes não muda");
  assert.deepEqual([...sessoesEmConflito(sessoesComSala(depois, pautas))].sort(), ["a", "b"], "a e b passam a se cruzar no dia 06");
  assert.equal(sessoesEmConflito(sessoesComSala(comASessaoNoDia(brutas, "a", "2026-12-07"), pautas)).size, 0, "no dia 07 não cruza com ninguém");
});
