import assert from "node:assert/strict";
import test from "node:test";
import { conflitosDasEscalas, cruzam, type EscalaComPeriodo } from "../lib/producao/conflitos";
import { CONFIRMACOES_DA_ESCALA } from "../lib/producao/estados";
import { horarioDaEscala, ROTULO_DA_CONFIRMACAO, rotuloDoHorario } from "../lib/producao/escala";

// PD1.10: o horário da escala na hora do lugar e os conflitos (a mesma pessoa em duas datas que se cruzam).

const SP = "America/Sao_Paulo";

function escala(parcial: Partial<EscalaComPeriodo> & Pick<EscalaComPeriodo, "id">): EscalaComPeriodo {
  return { pessoaId: "ana", dataId: `data-${parcial.id}`, dia: "2026-12-01", diaFim: null, chamada: null, saida: null, ...parcial };
}

test("toda resposta da escala tem rótulo", () => {
  assert.deepEqual(Object.keys(ROTULO_DA_CONFIRMACAO).sort(), [...CONFIRMACOES_DA_ESCALA].sort());
});

test("o horário digitado vira instante na hora do lugar, e a saída antes da chamada é do dia seguinte", () => {
  assert.deepEqual(horarioDaEscala("2026-12-01", "14:00", "23:30", SP), { chamada: "2026-12-01T17:00:00.000Z", saida: "2026-12-02T02:30:00.000Z" });
  assert.deepEqual(horarioDaEscala("2026-12-01", "22:00", "02:00", SP), { chamada: "2026-12-02T01:00:00.000Z", saida: "2026-12-02T05:00:00.000Z" });
  assert.deepEqual(horarioDaEscala("2026-12-31", "20:00", "01:00", SP), { chamada: "2026-12-31T23:00:00.000Z", saida: "2027-01-01T04:00:00.000Z" }, "a virada do ano");
  assert.deepEqual(horarioDaEscala("2026-12-01", "14:00", "14:00", SP).saida, "2026-12-02T17:00:00.000Z", "a saída na mesma hora é um dia depois");
  assert.deepEqual(horarioDaEscala("2026-12-01", "14:00", "", SP), { chamada: "2026-12-01T17:00:00.000Z", saida: null });
  assert.deepEqual(horarioDaEscala("2026-12-01", "", "23:00", SP), { chamada: null, saida: null }, "sem chamada não há horário");
  assert.deepEqual(horarioDaEscala("2026-12-01", "14:00", "18:00", "America/Manaus"), { chamada: "2026-12-01T18:00:00.000Z", saida: "2026-12-01T22:00:00.000Z" }, "outro fuso");
});

test("o rótulo mostra a chamada, a saída e o dia seguinte", () => {
  assert.equal(rotuloDoHorario({ chamada: "2026-12-01T17:00:00.000Z", saida: "2026-12-02T02:30:00.000Z" }, SP), "chamada 14:00 · saída 23:30");
  assert.equal(rotuloDoHorario({ chamada: "2026-12-02T01:00:00.000Z", saida: "2026-12-02T05:00:00.000Z" }, SP), "chamada 22:00 · saída 02:00 (+1)");
  assert.equal(rotuloDoHorario({ chamada: "2026-12-01T17:00:00.000Z", saida: null }, SP), "chamada 14:00");
  assert.equal(rotuloDoHorario({ chamada: null, saida: null }, SP), "");
  // O horário digitado volta igual pelo rótulo, em qualquer fuso.
  for (const fuso of [SP, "America/Manaus", "America/Rio_Branco", "America/Noronha"]) {
    assert.equal(rotuloDoHorario(horarioDaEscala("2026-12-01", "21:15", "01:45", fuso), fuso), "chamada 21:15 · saída 01:45 (+1)", fuso);
  }
});

test("com chamada e saída nas duas, vale o horário: a manhã e a noite do mesmo dia não se cruzam, e encostar não é cruzar", () => {
  const manha = escala({ id: "m", chamada: "2026-12-01T12:00:00.000Z", saida: "2026-12-01T15:00:00.000Z" });
  const noite = escala({ id: "n", chamada: "2026-12-01T21:00:00.000Z", saida: "2026-12-02T02:00:00.000Z" });
  const tarde = escala({ id: "t", chamada: "2026-12-01T14:00:00.000Z", saida: "2026-12-01T18:00:00.000Z" });
  const emSeguida = escala({ id: "s", chamada: "2026-12-01T15:00:00.000Z", saida: "2026-12-01T17:00:00.000Z" });
  assert.equal(cruzam(manha, noite), false);
  assert.equal(cruzam(manha, tarde), true);
  assert.equal(cruzam(tarde, manha), true, "a ordem não importa");
  assert.equal(cruzam(manha, emSeguida), false, "a saída às 15h e a chamada às 15h só encostam");
});

test("sem horário numa delas, valem os dias da data, inclusive a data de vários dias", () => {
  const semHora = escala({ id: "a", dia: "2026-12-01" });
  const comHoraNoMesmoDia = escala({ id: "b", dia: "2026-12-01", chamada: "2026-12-01T12:00:00.000Z", saida: "2026-12-01T15:00:00.000Z" });
  const outroDia = escala({ id: "c", dia: "2026-12-02" });
  const festival = escala({ id: "d", dia: "2026-11-30", diaFim: "2026-12-02" });
  const depois = escala({ id: "e", dia: "2026-12-03" });
  assert.equal(cruzam(semHora, comHoraNoMesmoDia), true);
  assert.equal(cruzam(semHora, outroDia), false);
  assert.equal(cruzam(festival, semHora), true);
  assert.equal(cruzam(outroDia, festival), true, "o último dia do festival conta");
  assert.equal(cruzam(festival, depois), false);
});

test("os conflitos: a mesma pessoa em outra data que se cruza, em ordem, sem contar a própria data nem outra pessoa", () => {
  const daData = [
    escala({ id: "ana-aqui", pessoaId: "ana", dataId: "d1" }),
    escala({ id: "bia-aqui", pessoaId: "bia", dataId: "d1" }),
    escala({ id: "caio-aqui", pessoaId: "caio", dataId: "d1", chamada: "2026-12-01T12:00:00.000Z", saida: "2026-12-01T15:00:00.000Z" }),
  ];
  const outras = [
    escala({ id: "ana-turne", pessoaId: "ana", dataId: "d9", chamada: "2026-12-01T22:00:00.000Z", saida: "2026-12-02T03:00:00.000Z" }),
    escala({ id: "ana-ensaio", pessoaId: "ana", dataId: "d8", chamada: "2026-12-01T13:00:00.000Z", saida: "2026-12-01T16:00:00.000Z" }),
    escala({ id: "ana-semana-que-vem", pessoaId: "ana", dataId: "d7", dia: "2026-12-08" }),
    escala({ id: "bia-outra-pessoa", pessoaId: "caio", dataId: "d6", chamada: "2026-12-01T21:00:00.000Z", saida: "2026-12-01T23:00:00.000Z" }),
    escala({ id: "caio-mesma-data", pessoaId: "caio", dataId: "d1" }),
  ];
  const conflitos = conflitosDasEscalas(daData, outras);
  assert.deepEqual([...conflitos.keys()], ["ana-aqui"]);
  assert.deepEqual(conflitos.get("ana-aqui")!.map(c => c.id), ["ana-ensaio", "ana-turne"], "pela chamada, no mesmo dia");
  assert.equal(conflitos.has("bia-aqui"), false, "bia não está em outra data");
  assert.equal(conflitos.has("caio-aqui"), false, "caio da manhã não cruza com o da noite, e a própria data não conta");
});
