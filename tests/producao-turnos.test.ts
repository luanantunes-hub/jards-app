import assert from "node:assert/strict";
import test from "node:test";
import {
  cargasDaSemana, diasDaSemana, duracaoDoTurno, formatarDuracao, horarioCurto, lerTurno, LIMITE_SEMANAL_EM_MINUTOS, minutosDoHorario,
  segundaDaSemana, turnosDaPessoaNoDia, turnosSobrepostos, type TurnoDaCasa,
} from "../lib/producao/turnos";

const t = (id: string, pessoa: string, dia: string, inicio: string, fim: string): TurnoDaCasa =>
  ({ id, espaco_id: "e1", pessoa_id: pessoa, pauta_id: null, dia, inicio, fim, funcao: null, notas: null });

test("o horário do banco (com segundos) e o da tela viram minutos; o que não é horário vira NaN", () => {
  assert.equal(minutosDoHorario("18:00:00"), 1080);
  assert.equal(minutosDoHorario("09:30"), 570);
  assert.equal(minutosDoHorario("00:00"), 0);
  assert.ok(Number.isNaN(minutosDoHorario("24:00")));
  assert.ok(Number.isNaN(minutosDoHorario("9:30")));
  assert.ok(Number.isNaN(minutosDoHorario("")));
  assert.equal(horarioCurto("18:00:00"), "18:00");
});

test("a duração do turno e o texto dela", () => {
  assert.equal(duracaoDoTurno({ inicio: "18:00:00", fim: "23:30:00" }), 330);
  assert.equal(duracaoDoTurno({ inicio: "23:00", fim: "22:00" }), 0);
  assert.equal(formatarDuracao(450), "7h30");
  assert.equal(formatarDuracao(480), "8h");
  assert.equal(formatarDuracao(45), "45 min");
  assert.equal(formatarDuracao(0), "0h");
  assert.equal(formatarDuracao(125), "2h05");
});

test("a semana vai de segunda a domingo, inclusive na virada do mês", () => {
  assert.equal(segundaDaSemana("2026-11-09"), "2026-11-09", "segunda é a própria segunda");
  assert.equal(segundaDaSemana("2026-11-15"), "2026-11-09", "domingo pertence à semana que terminou nele");
  assert.equal(segundaDaSemana("2026-12-02"), "2026-11-30");
  assert.deepEqual(diasDaSemana("2026-11-30"), ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"]);
});

test("a carga semanal soma só a semana pedida, da maior para a menor, e avisa acima de 44 h", () => {
  const turnos = [
    t("a", "p1", "2026-11-09", "08:00", "17:00"), t("b", "p1", "2026-11-10", "08:00", "17:00"), t("c", "p1", "2026-11-11", "08:00", "17:00"),
    t("d", "p1", "2026-11-12", "08:00", "17:00"), t("e", "p1", "2026-11-13", "08:00", "17:00"), t("f", "p1", "2026-11-14", "08:00", "10:00"),
    t("g", "p2", "2026-11-09", "10:00", "14:00"),
    t("h", "p1", "2026-11-16", "08:00", "17:00"), t("i", "p2", "2026-11-08", "08:00", "17:00"),
  ];
  const cargas = cargasDaSemana(turnos, "2026-11-09");
  assert.deepEqual(cargas, [
    { pessoaId: "p1", minutos: 47 * 60, turnos: 6, acimaDoLimite: true },
    { pessoaId: "p2", minutos: 240, turnos: 1, acimaDoLimite: false },
  ]);
  assert.equal(cargasDaSemana(turnos, "2026-11-09", 48 * 60)[0].acimaDoLimite, false, "o limite pode ser outro");
  assert.equal(LIMITE_SEMANAL_EM_MINUTOS, 2640);
});

test("44 h exatas não passam do limite", () => {
  const turnos = [t("a", "p1", "2026-11-09", "08:00", "16:00"), t("b", "p1", "2026-11-10", "08:00", "16:00"), t("c", "p1", "2026-11-11", "08:00", "16:00"),
    t("d", "p1", "2026-11-12", "08:00", "16:00"), t("e", "p1", "2026-11-13", "08:00", "16:00"), t("f", "p1", "2026-11-14", "08:00", "12:00")];
  const [carga] = cargasDaSemana(turnos, "2026-11-09");
  assert.equal(carga.minutos, 44 * 60);
  assert.equal(carga.acimaDoLimite, false);
});

test("turnos que se cruzam: a mesma pessoa no mesmo dia; encostar não cruza", () => {
  const cruzados = turnosSobrepostos([
    t("a", "p1", "2026-11-09", "08:00", "12:00"), t("b", "p1", "2026-11-09", "11:00", "15:00"),
    t("c", "p1", "2026-11-09", "15:00", "18:00"), t("d", "p2", "2026-11-09", "08:00", "12:00"), t("e", "p1", "2026-11-10", "08:00", "12:00"),
  ]);
  assert.deepEqual([...cruzados].sort(), ["a", "b"]);
});

test("os turnos da pessoa no dia saem do mais cedo ao mais tarde", () => {
  const turnos = [t("a", "p1", "2026-11-09", "14:00", "18:00"), t("b", "p1", "2026-11-09", "08:00", "12:00"), t("c", "p2", "2026-11-09", "08:00", "12:00")];
  assert.deepEqual(turnosDaPessoaNoDia(turnos, "p1", "2026-11-09").map(x => x.id), ["b", "a"]);
});

test("o turno lido tem o formato do banco", () => {
  const campos = { pessoaId: "p1", dia: "2026-11-09", inicio: "08:00:00", fim: "12:30", funcao: " Técnico de som ", notas: " ", pautaId: "" };
  assert.deepEqual(lerTurno(campos), { ok: true, turno: { pessoa_id: "p1", dia: "2026-11-09", inicio: "08:00", fim: "12:30", funcao: "Técnico de som", notas: null, pauta_id: null } });
  const comPauta = lerTurno({ ...campos, pautaId: "pa1", notas: "Chegar 30 min antes" });
  assert.deepEqual(comPauta.ok && [comPauta.turno.pauta_id, comPauta.turno.notas], ["pa1", "Chegar 30 min antes"]);
});

test("o que o banco recusaria a tela recusa antes", () => {
  const campos = { pessoaId: "p1", dia: "2026-11-09", inicio: "08:00", fim: "12:00", funcao: "", notas: "", pautaId: "" };
  assert.equal(lerTurno({ ...campos, pessoaId: "" }).ok, false);
  assert.equal(lerTurno({ ...campos, dia: "" }).ok, false);
  assert.equal(lerTurno({ ...campos, inicio: "" }).ok, false);
  assert.equal(lerTurno({ ...campos, fim: "25:00" }).ok, false);
  assert.equal(lerTurno({ ...campos, fim: "08:00" }).ok, false);
  assert.equal(lerTurno({ ...campos, fim: "07:00" }).ok, false);
  assert.equal(lerTurno({ ...campos, funcao: "x".repeat(81) }).ok, false);
  assert.equal(lerTurno({ ...campos, funcao: "x".repeat(80) }).ok, true);
  assert.equal(lerTurno({ ...campos, notas: "x".repeat(501) }).ok, false);
});
