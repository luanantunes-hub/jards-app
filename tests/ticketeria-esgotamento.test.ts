import assert from "node:assert/strict";
import test from "node:test";
import { avisosDeEsgotamento, quandoEsgotou } from "../lib/ticketeria/esgotamento";

test("quandoEsgotou: o dia em que a venda chegou a 98% da lotação", () => {
  const v = [{ dia: "2027-03-01", quantidade: 50 }, { dia: "2027-03-05", quantidade: 40 }, { dia: "2027-03-03", quantidade: 8 }];
  assert.equal(quandoEsgotou(v, 100), "2027-03-05");
  assert.equal(quandoEsgotou(v, 200), null);
  assert.equal(quandoEsgotou(v, 0), null);
});

test("avisos: evento esgotado com gasto depois de esgotar, e quase esgotado a até 14 dias", () => {
  const eventos = [
    { eventoId: "h", evento: "Hamlet", sessoes: [{ dia: "2027-03-20", lugares: 100, vendidos: 100, esgotouEm: "2027-03-10" }, { dia: "2027-03-21", lugares: 100, vendidos: 99, esgotouEm: "2027-03-12" }] },
    { eventoId: "r", evento: "Ricardo III", sessoes: [{ dia: "2027-03-19", lugares: 100, vendidos: 92, esgotouEm: null }] },
    { eventoId: "x", evento: "Longe", sessoes: [{ dia: "2027-06-01", lugares: 100, vendidos: 95, esgotouEm: null }] },
    { eventoId: "s", evento: "Sem gasto", sessoes: [{ dia: "2027-03-20", lugares: 50, vendidos: 50, esgotouEm: "2027-03-01" }] },
  ];
  const gastos = [
    { eventoId: "h", canal: "meta-ads", dia: "2027-03-11", centavos: 9999 }, // antes de esgotar tudo: não conta
    { eventoId: "h", canal: "meta-ads", dia: "2027-03-13", centavos: 28000 },
    { eventoId: "h", canal: "google-ads", dia: "2027-03-14", centavos: 13200 },
  ];
  const { esgotados, quase } = avisosDeEsgotamento(eventos, gastos, "2027-03-14");
  assert.equal(esgotados.length, 1, "sem gasto depois de esgotar, não há aviso");
  assert.deepEqual(esgotados[0], { eventoId: "h", evento: "Hamlet", sessoes: 2, esgotouEm: "2027-03-12", gastoDepois: { "meta-ads": 28000, "google-ads": 13200 }, totalDepois: 41200, porDia: Math.round(41200 / 7) });
  assert.deepEqual(quase, [{ eventoId: "r", evento: "Ricardo III", parteVendida: 0.92, diasAteASessao: 5 }]);
});
