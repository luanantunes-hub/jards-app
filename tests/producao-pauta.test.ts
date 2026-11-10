import assert from "node:assert/strict";
import test from "node:test";
import { filaDePreReservas, ocupacaoDoAno, proximaOrdemNaFila, diasDaJanela, lerPauta, pautasEmConflito, pautasNoDia, preReservasVencendo, type PautaDaGrade } from "../lib/producao/pauta";

const base = { contratante: null, ordem_na_fila: null, valida_ate: null };
const p = (id: string, sala: string, inicio: string, fim: string, situacao: PautaDaGrade["situacao"], extra: Partial<PautaDaGrade> = {}): PautaDaGrade =>
  ({ id, sala_id: sala, titulo: id, inicio, fim, situacao, ...base, ...extra });

test("a janela tem os dias em sequência, inclusive na virada do mês", () => {
  assert.deepEqual(diasDaJanela("2026-11-29", 4), ["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
});

test("a pauta ocupa os dias do início ao fim, e a cancelada não ocupa", () => {
  const pautas = [p("a", "s1", "2026-12-05", "2026-12-07", "confirmada"), p("b", "s1", "2026-12-06", "2026-12-06", "cancelada"), p("c", "s2", "2026-12-06", "2026-12-06", "consulta")];
  assert.deepEqual(pautasNoDia(pautas, "s1", "2026-12-06").map(x => x.id), ["a"]);
  assert.deepEqual(pautasNoDia(pautas, "s1", "2026-12-08").map(x => x.id), []);
  assert.deepEqual(pautasNoDia(pautas, "s2", "2026-12-06").map(x => x.id), ["c"]);
});

test("conflito: duas confirmadas na mesma sala com dias em comum; consulta, pré-reserva e outra sala não contam", () => {
  const pautas = [
    p("a", "s1", "2026-12-05", "2026-12-07", "confirmada"),
    p("b", "s1", "2026-12-07", "2026-12-09", "confirmada"),
    p("c", "s1", "2026-12-08", "2026-12-08", "pre_reserva"),
    p("d", "s2", "2026-12-05", "2026-12-07", "confirmada"),
    p("e", "s1", "2026-12-20", "2026-12-21", "confirmada"),
  ];
  assert.deepEqual([...pautasEmConflito(pautas)].sort(), ["a", "b"]);
});

test("pré-reserva vencida ou vencendo em 3 dias, da mais urgente à menos", () => {
  const pautas = [
    p("a", "s1", "2026-12-05", "2026-12-05", "pre_reserva", { valida_ate: "2026-11-09" }),
    p("b", "s1", "2026-12-05", "2026-12-05", "pre_reserva", { valida_ate: "2026-11-05" }),
    p("c", "s1", "2026-12-05", "2026-12-05", "pre_reserva", { valida_ate: "2026-11-20" }),
    p("d", "s1", "2026-12-05", "2026-12-05", "pre_reserva"),
    p("e", "s1", "2026-12-05", "2026-12-05", "confirmada", { valida_ate: "2026-11-01" }),
  ];
  assert.deepEqual(preReservasVencendo(pautas, "2026-11-07").map(x => x.id), ["b", "a"]);
});

test("a pauta lida tem o formato do banco", () => {
  const campos = { titulo: " Show ", contratante: " ", inicio: "2026-12-05", fim: "", situacao: "consulta" as const, ordem: "2", validade: "2026-11-30" };
  assert.deepEqual(lerPauta(campos), { ok: true, pauta: { titulo: "Show", contratante: null, inicio: "2026-12-05", fim: "2026-12-05", situacao: "consulta", ordem_na_fila: null, valida_ate: null } });
  const pre = lerPauta({ ...campos, situacao: "pre_reserva" });
  assert.deepEqual(pre.ok && [pre.pauta.ordem_na_fila, pre.pauta.valida_ate], [2, "2026-11-30"]);
});

test("o que o banco recusaria a tela recusa antes", () => {
  const campos = { titulo: "x", contratante: "", inicio: "2026-12-05", fim: "2026-12-06", situacao: "consulta" as const, ordem: "", validade: "" };
  assert.equal(lerPauta({ ...campos, titulo: " " }).ok, false);
  assert.equal(lerPauta({ ...campos, inicio: "" }).ok, false);
  assert.equal(lerPauta({ ...campos, fim: "2026-12-04" }).ok, false);
  assert.equal(lerPauta({ ...campos, fim: "2027-12-07" }).ok, false);
  assert.equal(lerPauta({ ...campos, fim: "2027-12-05" }).ok, true);
  assert.equal(lerPauta({ ...campos, situacao: "pre_reserva", ordem: "100" }).ok, false);
  assert.equal(lerPauta({ ...campos, situacao: "pre_reserva", ordem: "0" }).ok, false);
});

test("a próxima posição na fila olha só as pré-reservas da mesma sala que se cruzam com o período", () => {
  const pautas = [
    p("a", "s1", "2026-12-01", "2026-12-03", "pre_reserva", { ordem_na_fila: 1 }),
    p("b", "s1", "2026-12-02", "2026-12-04", "pre_reserva", { ordem_na_fila: 2 }),
    p("c", "s1", "2026-12-20", "2026-12-21", "pre_reserva", { ordem_na_fila: 1 }),
    p("d", "s2", "2026-12-01", "2026-12-03", "pre_reserva", { ordem_na_fila: 1 }),
    p("e", "s1", "2026-12-01", "2026-12-03", "consulta"),
  ];
  assert.equal(proximaOrdemNaFila(pautas, "s1", "2026-12-03", "2026-12-05"), 3);
  assert.equal(proximaOrdemNaFila(pautas, "s1", "2026-12-10", "2026-12-11"), 1);
  assert.equal(proximaOrdemNaFila(pautas, "s1", "2026-12-20", "2026-12-20"), 2);
  assert.equal(proximaOrdemNaFila(pautas, "s1", "2026-12-01", "2026-12-03", "b"), 2, "ao editar, a própria pauta não conta");
  assert.equal(proximaOrdemNaFila(pautas, "s3", "2026-12-01", "2026-12-03"), 1);
});

test("a fila: livre quando nenhuma confirmada ocupa o período; a vez é da 1ª livre", () => {
  const fila = filaDePreReservas([
    p("a", "s1", "2026-12-01", "2026-12-03", "pre_reserva", { ordem_na_fila: 1 }),
    p("b", "s1", "2026-12-02", "2026-12-04", "pre_reserva", { ordem_na_fila: 2 }),
    p("c", "s2", "2026-12-01", "2026-12-03", "pre_reserva", { ordem_na_fila: 1 }),
    p("x", "s2", "2026-12-03", "2026-12-03", "confirmada"),
    p("y", "s1", "2026-12-10", "2026-12-10", "consulta"),
  ]);
  assert.deepEqual(fila.map(item => [item.pauta.id, item.posicao, item.livre, item.vez]), [["a", 1, true, true], ["b", 2, true, false], ["c", 1, false, false]]);
});

test("a visão de 12 meses conta cada dia uma vez pela situação mais firme, corta no ano e ignora a cancelada", () => {
  const ocupacao = ocupacaoDoAno([
    p("a", "s1", "2026-12-28", "2027-01-03", "confirmada"),
    p("b", "s1", "2026-12-30", "2026-12-31", "pre_reserva"),
    p("c", "s1", "2026-03-01", "2026-03-02", "pre_reserva"),
    p("d", "s1", "2026-03-02", "2026-03-04", "consulta"),
    p("e", "s1", "2026-05-10", "2026-05-12", "cancelada"),
    p("f", "s2", "2026-03-01", "2026-03-31", "confirmada"),
  ], "s1", 2026);
  assert.deepEqual(ocupacao[11], { mes: 12, confirmados: 4, preReservas: 0, consultas: 0 });
  assert.deepEqual(ocupacao[2], { mes: 3, confirmados: 0, preReservas: 2, consultas: 2 });
  assert.deepEqual(ocupacao[4], { mes: 5, confirmados: 0, preReservas: 0, consultas: 0 });
  assert.equal(ocupacao.length, 12);
  assert.deepEqual(ocupacaoDoAno([p("a", "s1", "2026-12-28", "2027-01-03", "confirmada")], "s1", 2027)[0], { mes: 1, confirmados: 3, preReservas: 0, consultas: 0 });
});
