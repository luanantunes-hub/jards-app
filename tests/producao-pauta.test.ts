import assert from "node:assert/strict";
import test from "node:test";
import { diasDaJanela, lerPauta, pautasEmConflito, pautasNoDia, preReservasVencendo, type PautaDaGrade } from "../lib/producao/pauta";

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
