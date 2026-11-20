import assert from "node:assert/strict";
import test from "node:test";
import { horaDe, intervaloDoItem, isoLocal, metricasDoMes, minutosDe, posicionarNoDia, type ItemDoMes } from "../lib/activities/agenda-grade";

test("horas: texto do banco vira minutos e volta", () => {
  assert.equal(minutosDe("09:30:00"), 570);
  assert.equal(minutosDe("9:05"), 545);
  assert.equal(minutosDe(null), null);
  assert.equal(minutosDe("25:00"), null);
  assert.equal(horaDe(570), "09:30");
  assert.equal(isoLocal(new Date(2026, 10, 18, 23, 30)), "2026-11-18", "à noite continua no mesmo dia");
});

test("intervalo: sem fim dura uma hora; sem início fica fora da grade; passa da meia-noite para no fim do dia", () => {
  assert.deepEqual(intervaloDoItem("14:00", null), { inicio: 840, fim: 900 });
  assert.deepEqual(intervaloDoItem("14:00", "15:30"), { inicio: 840, fim: 930 });
  assert.deepEqual(intervaloDoItem("14:00", "13:00"), { inicio: 840, fim: 900 }, "fim antes do início é ignorado");
  assert.deepEqual(intervaloDoItem("23:30", null), { inicio: 1410, fim: 1440 });
  assert.equal(intervaloDoItem(null, "10:00"), null);
});

test("sobreposição: quem se cruza divide a largura; quem não se cruza usa a largura toda", () => {
  const r = posicionarNoDia([
    { item: "a", inicio: 540, fim: 600 },
    { item: "b", inicio: 570, fim: 630 },
    { item: "c", inicio: 600, fim: 660 },
    { item: "d", inicio: 720, fim: 780 },
  ]);
  const por = Object.fromEntries(r.map(p => [p.item, p]));
  assert.deepEqual([por.a.coluna, por.b.coluna, por.c.coluna], [0, 1, 0], "c reaproveita a coluna de a");
  assert.deepEqual([por.a.colunas, por.b.colunas, por.c.colunas], [2, 2, 2]);
  assert.deepEqual([por.d.coluna, por.d.colunas], [0, 1]);
});

test("sobreposição: atividades curtas e seguidas não se cobrem na tela", () => {
  const r = posicionarNoDia([{ item: "a", inicio: 540, fim: 550 }, { item: "b", inicio: 550, fim: 560 }]);
  assert.deepEqual(r.map(p => p.colunas), [2, 2]);
});

test("painel do mês: totais, atrasadas, semanas começando na segunda e agrupamentos", () => {
  const itens: ItemDoMes[] = [
    { data: "2026-11-02", feita: true, tipo: "reuniao", responsavel: "ana", minutos: 60 },
    { data: "2026-11-02", feita: false, tipo: "reuniao", responsavel: "ana", minutos: 30 },
    { data: "2026-11-20", feita: false, tipo: "email", responsavel: null, minutos: null },
    { data: "2026-10-30", feita: false, tipo: "email", responsavel: "ana", minutos: null },
    { data: null, feita: false, tipo: "email", responsavel: null, minutos: null },
  ];
  const m = metricasDoMes(itens, 2026, 10, "2026-11-18");
  assert.equal(m.total, 3);
  assert.equal(m.concluidas, 1);
  assert.equal(m.atrasadas, 1, "a de 02/11 não feita; a de 20/11 ainda não venceu");
  assert.equal(m.minutosAgendados, 90);
  assert.equal(m.comHorario, 2);
  assert.deepEqual(m.porDia.get("2026-11-02"), { total: 2, concluidas: 1, atrasadas: 1 });
  assert.deepEqual(m.porSemana[0], { inicio: "2026-11-01", fim: "2026-11-01", total: 0, concluidas: 0 }, "1º/11/2026 é domingo");
  assert.deepEqual(m.porSemana[1], { inicio: "2026-11-02", fim: "2026-11-08", total: 2, concluidas: 1 });
  assert.equal(m.porSemana.at(-1)?.fim, "2026-11-30");
  assert.deepEqual(m.porTipo.map(t => [t.chave, t.total]), [["reuniao", 2], ["email", 1]]);
  assert.deepEqual(m.porResponsavel.map(t => [t.chave, t.total]), [["ana", 2], [null, 1]]);
});

test("arrastar: mover mantém a duração, encaixa em 15 min e não sai do dia", async () => {
  const { novoIntervalo } = await import("../lib/activities/agenda-grade");
  const reuniao = { inicio: 540, fim: 600 }; // 09:00–10:00
  assert.deepEqual(novoIntervalo("mover", reuniao, 620, 10), { inicio: 615, fim: 675 }, "pegou 10 min abaixo do topo");
  assert.deepEqual(novoIntervalo("mover", reuniao, 1435, 0), { inicio: 1380, fim: 1440 }, "não passa da meia-noite");
  assert.deepEqual(novoIntervalo("mover", reuniao, -50, 0), { inicio: 0, fim: 60 });
});

test("redimensionar: cada borda anda sozinha e o compromisso dura pelo menos 15 min", async () => {
  const { novoIntervalo } = await import("../lib/activities/agenda-grade");
  const reuniao = { inicio: 540, fim: 600 };
  assert.deepEqual(novoIntervalo("fim", reuniao, 668), { inicio: 540, fim: 675 });
  assert.deepEqual(novoIntervalo("fim", reuniao, 500), { inicio: 540, fim: 555 });
  assert.deepEqual(novoIntervalo("inicio", reuniao, 508), { inicio: 510, fim: 600 });
  assert.deepEqual(novoIntervalo("inicio", reuniao, 640), { inicio: 585, fim: 600 });
});

test("datas: somar e contar dias atravessa o mês", async () => {
  const { somarDiasIso, diasEntreIso } = await import("../lib/activities/agenda-grade");
  assert.equal(somarDiasIso("2026-11-30", 1), "2026-12-01");
  assert.equal(somarDiasIso("2026-11-01", -1), "2026-10-31");
  assert.equal(diasEntreIso("2026-11-18", "2026-11-21"), 3);
  assert.equal(diasEntreIso("2026-11-18", "2026-11-16"), -2);
});

test("faixa da grade: 7h às 22h, cresce em horas cheias para caber os compromissos", async () => {
  const { faixaDeHoras, prenderNaFaixa } = await import("../lib/activities/agenda-grade");
  assert.deepEqual(faixaDeHoras([]), { inicio: 420, fim: 1320 });
  assert.deepEqual(faixaDeHoras([{ inicio: 390, fim: 450 }, { inicio: 1350, fim: 1410 }]), { inicio: 360, fim: 1440 });
  const faixa = { inicio: 420, fim: 1320 };
  assert.deepEqual(prenderNaFaixa("mover", { inicio: 380, fim: 440 }, faixa), { inicio: 420, fim: 480 });
  assert.deepEqual(prenderNaFaixa("mover", { inicio: 1300, fim: 1360 }, faixa), { inicio: 1260, fim: 1320 });
  assert.deepEqual(prenderNaFaixa("fim", { inicio: 1200, fim: 1380 }, faixa), { inicio: 1200, fim: 1320 });
});
