import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPACIDADE_DE_GRANDE_PORTE, TIPOS_RESERVADOS, ehLugarReservado, fraseDoLugarReservado, horasDeReserva, podeComprarLugarReservado, reservaTerminaEm,
} from "../lib/ticketeria/mapa-reserva";

const inicio = new Date("2026-12-20T23:00:00Z");
const horas = (n: number) => n * 3600 * 1000;
const antes = (h: number) => new Date(inicio.getTime() - horas(h));

test("quais tipos a lei reserva: cadeira de rodas, mobilidade reduzida e pessoa obesa; o acompanhante e o lugar comum, não", () => {
  assert.deepEqual([...TIPOS_RESERVADOS], ["cadeira_rodas", "mobilidade_reduzida", "obeso"]);
  for (const t of TIPOS_RESERVADOS) assert.equal(ehLugarReservado(t), true, t);
  for (const t of ["comum", "acompanhante", "vip", null, undefined, 3]) assert.equal(ehLugarReservado(t), false, String(t));
});

test("a reserva termina 24 horas antes, 72 acima de dez mil pessoas e meia hora no cinema (art. 23-A, §§ 1º, 2º e 4º)", () => {
  assert.equal(horasDeReserva({ capacidade: 600 }), 24);
  assert.equal(horasDeReserva({ capacidade: CAPACIDADE_DE_GRANDE_PORTE }), 24, "dez mil exatos não passam de dez mil");
  assert.equal(horasDeReserva({ capacidade: CAPACIDADE_DE_GRANDE_PORTE + 1 }), 72);
  assert.equal(horasDeReserva({ capacidade: 200, cinema: true }), 0.5);
  assert.equal(horasDeReserva({ capacidade: 50000, cinema: true }), 0.5, "o cinema manda (o texto só fala dele no § 4º)");
  assert.equal(reservaTerminaEm(inicio, { capacidade: 600 }).getTime(), antes(24).getTime());
  assert.equal(reservaTerminaEm(inicio, { capacidade: 600, cinema: true }).getTime(), antes(0.5).getTime());
});

test("quem declara precisar do lugar pode comprá-lo a qualquer momento, mesmo com outros lugares livres", () => {
  const espaco = { capacidade: 600 };
  for (const agora of [antes(500), antes(30), antes(24), antes(1)]) {
    assert.deepEqual(podeComprarLugarReservado({ agora, inicio, espaco, outrosLivres: 200, declarou: true }), { pode: true, motivo: "declarou" });
  }
});

test("quem não declara: antes do prazo, não; depois do prazo, só se os demais lugares do setor esgotaram", () => {
  const espaco = { capacidade: 600 };
  const sem = (agora: Date, outrosLivres: number) => podeComprarLugarReservado({ agora, inicio, espaco, outrosLivres, declarou: false });
  assert.deepEqual(sem(antes(100), 0), { pode: false, motivo: "reservado_ate_o_prazo" }, "mesmo com o setor esgotado, antes do prazo é reservado");
  assert.deepEqual(sem(antes(24.01), 0), { pode: false, motivo: "reservado_ate_o_prazo" });
  assert.deepEqual(sem(antes(24), 5), { pode: false, motivo: "ainda_ha_outros_lugares" }, "no instante do prazo a reserva acabou, mas ainda há outros lugares");
  assert.deepEqual(sem(antes(2), 1), { pode: false, motivo: "ainda_ha_outros_lugares" });
  assert.deepEqual(sem(antes(24), 0), { pode: true, motivo: "liberado" }, "prazo vencido e setor esgotado: abre");
  assert.deepEqual(sem(antes(1), 0), { pode: true, motivo: "liberado" });
});

test("cinema: a reserva vai até meia hora antes; grande porte: até 72 horas antes", () => {
  const cinema = (agora: Date, outrosLivres = 0) => podeComprarLugarReservado({ agora, inicio, espaco: { capacidade: 150, cinema: true }, outrosLivres, declarou: false });
  assert.equal(cinema(antes(2)).pode, false);
  assert.equal(cinema(antes(0.6)).pode, false);
  assert.equal(cinema(antes(0.5)).pode, true);
  const grande = (agora: Date) => podeComprarLugarReservado({ agora, inicio, espaco: { capacidade: 20000 }, outrosLivres: 0, declarou: false });
  assert.equal(grande(antes(100)).pode, false, "faltando 100 horas, em um local grande, ainda é reservado");
  assert.equal(grande(antes(72.01)).pode, false);
  assert.equal(grande(antes(72)).pode, true, "no instante das 72 horas a reserva acabou (e o setor esgotou)");
  assert.equal(grande(antes(48)).pode, true, "e daí em diante também");
  const normal = podeComprarLugarReservado({ agora: antes(48), inicio, espaco: { capacidade: 600 }, outrosLivres: 0, declarou: false });
  assert.equal(normal.pode, false, "num local normal, faltando 48 horas, ainda é reservado");
});

test("as frases dizem por que não pôde, sem prometer o que a lei não diz", () => {
  assert.match(fraseDoLugarReservado("reservado_ate_o_prazo"), /reservado para pessoas com deficiência ou mobilidade reduzida/);
  assert.match(fraseDoLugarReservado("ainda_ha_outros_lugares"), /demais lugares do setor se esgotam/);
});
