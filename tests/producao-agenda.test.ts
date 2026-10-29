import assert from "node:assert/strict";
import test from "node:test";
import { agruparPorMes, diaDaSemana, diaEMes, diasDoLote, MAXIMO_DE_DATAS_NO_LOTE, opcaoVencida, rotuloDoMes, type DataDaAgenda } from "../lib/producao/agenda";

const data = (id: string, dia: string, extra: Partial<DataDaAgenda> = {}): DataDaAgenda => ({
  id, data: dia, data_fim: null, tipo: "apresentacao", situacao: "confirmada", opcao_ordem: null, opcao_ate: null,
  temporada_id: "t1", temporada_titulo: "Turnê", obra_titulo: null, municipio: null, uf: null, ...extra,
});

test("as datas se agrupam por mês e saem em ordem de dia", () => {
  const meses = agruparPorMes([data("c", "2026-12-02"), data("a", "2026-11-30"), data("b", "2026-11-05")]);
  assert.deepEqual(meses.map(mes => [mes.rotulo, mes.datas.map(item => item.id)]), [
    ["novembro de 2026", ["b", "a"]],
    ["dezembro de 2026", ["c"]],
  ]);
});

test("no mesmo dia, a confirmada vem antes da opção, e a cancelada por último", () => {
  const [mes] = agruparPorMes([
    data("cancelada", "2026-11-05", { situacao: "cancelada" }),
    data("opcao2", "2026-11-05", { situacao: "opcao", opcao_ordem: 2 }),
    data("opcao1", "2026-11-05", { situacao: "opcao", opcao_ordem: 1 }),
    data("confirmada", "2026-11-05"),
  ]);
  assert.deepEqual(mes.datas.map(item => item.id), ["confirmada", "opcao1", "opcao2", "cancelada"]);
});

test("rótulos de dia e de mês não dependem do fuso", () => {
  assert.equal(rotuloDoMes("2026-03"), "março de 2026");
  assert.equal(diaEMes("2026-11-05"), "05 nov");
  assert.equal(diaDaSemana("2026-11-05"), "qui");
  assert.equal(diaDaSemana("2026-10-29"), "qui");
});

test("só a opção com o prazo passado está vencida", () => {
  assert.equal(opcaoVencida({ situacao: "opcao", opcao_ate: "2026-10-01" }, "2026-10-29"), true);
  assert.equal(opcaoVencida({ situacao: "opcao", opcao_ate: "2026-10-29" }, "2026-10-29"), false);
  assert.equal(opcaoVencida({ situacao: "opcao", opcao_ate: null }, "2026-10-29"), false);
  assert.equal(opcaoVencida({ situacao: "confirmada", opcao_ate: "2026-10-01" }, "2026-10-29"), false);
});

test("o lote cobre o intervalo inteiro, pula dias da semana e vira o mês e o ano", () => {
  assert.deepEqual(diasDoLote("2026-12-30", "2027-01-02"), { ok: true, dias: ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"] });
  // 2026-11-02 é segunda: pulando domingo (0) e segunda (1) sobram terça a sábado.
  const resultado = diasDoLote("2026-11-01", "2026-11-07", [0, 1]);
  assert.deepEqual(resultado, { ok: true, dias: ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"] });
  assert.deepEqual(diasDoLote("2026-11-05", "2026-11-05"), { ok: true, dias: ["2026-11-05"] });
});

test("o lote recusa intervalo ao contrário, vazio, sem data ou grande demais", () => {
  assert.equal(diasDoLote("2026-11-05", "2026-11-01").ok, false);
  assert.equal(diasDoLote("", "2026-11-01").ok, false);
  assert.equal(diasDoLote("2026-11-01", "2026-11-02", [0, 1, 2, 3, 4, 5, 6]).ok, false);
  const grande = diasDoLote("2026-01-01", "2027-12-31");
  assert.equal(grande.ok, false);
  const noLimite = diasDoLote("2026-01-01", "2026-04-30"); // 120 dias
  assert.equal(noLimite.ok && noLimite.dias.length, MAXIMO_DE_DATAS_NO_LOTE);
});

test("somar dias e meses vira mês e ano", async () => {
  const { somarDias, somarMes, inicioDaSemana } = await import("../lib/producao/agenda");
  assert.equal(somarDias("2026-12-31", 1), "2027-01-01");
  assert.equal(somarDias("2026-03-01", -1), "2026-02-28");
  assert.equal(somarMes("2026-12", 1), "2027-01");
  assert.equal(somarMes("2026-01", -1), "2025-12");
  assert.equal(inicioDaSemana("2026-11-05"), "2026-11-01"); // quinta → domingo
  assert.equal(inicioDaSemana("2026-11-01"), "2026-11-01");
});

test("a grade do mês tem semanas inteiras e põe a data no dia certo (inclusive vários dias)", async () => {
  const { gradeDoMes, gradeDaSemana } = await import("../lib/producao/agenda");
  const unica = data("a", "2026-11-05");
  const longa = data("b", "2026-11-09", { data_fim: "2026-11-11" });
  const semanas = gradeDoMes("2026-11", [unica, longa]);
  assert.ok(semanas.every(semana => semana.length === 7));
  assert.equal(semanas[0][0].data, "2026-11-01");
  assert.equal(semanas.at(-1)?.at(-1)?.data, "2026-12-05");
  const dias = semanas.flat();
  assert.deepEqual(dias.find(dia => dia.data === "2026-11-05")?.datas.map(item => item.id), ["a"]);
  assert.deepEqual(dias.filter(dia => dia.datas.some(item => item.id === "b")).map(dia => dia.data), ["2026-11-09", "2026-11-10", "2026-11-11"]);
  assert.equal(dias.find(dia => dia.data === "2026-12-02")?.doMes, false);
  assert.deepEqual(gradeDaSemana("2026-11-05", [unica]).map(dia => dia.datas.length), [0, 0, 0, 0, 1, 0, 0]);
});

test("filtros por temporada e situação", async () => {
  const { filtrarDatas } = await import("../lib/producao/agenda");
  const lista = [data("a", "2026-11-05"), data("b", "2026-11-06", { temporada_id: "t2" }), data("c", "2026-11-07", { situacao: "opcao" })];
  assert.deepEqual(filtrarDatas(lista, { temporada: "todas", situacao: "todas" }).length, 3);
  assert.deepEqual(filtrarDatas(lista, { temporada: "t2", situacao: "todas" }).map(item => item.id), ["b"]);
  assert.deepEqual(filtrarDatas(lista, { temporada: "todas", situacao: "opcao" }).map(item => item.id), ["c"]);
});

test("Hoje: opção vencida ou vencendo, e as próximas datas", async () => {
  const { pendenciasDeHoje, proximasDatas } = await import("../lib/producao/agenda");
  const lista = [
    data("vencida", "2026-11-20", { situacao: "opcao", opcao_ate: "2026-10-25" }),
    data("vencendo", "2026-11-21", { situacao: "opcao", opcao_ate: "2026-11-01" }),
    data("longe", "2026-11-22", { situacao: "opcao", opcao_ate: "2026-12-01" }),
    data("semprazo", "2026-11-23", { situacao: "opcao" }),
    data("confirmada", "2026-10-30"),
    data("passada", "2026-10-01"),
    data("cancelada", "2026-10-31", { situacao: "cancelada" }),
  ];
  assert.deepEqual(pendenciasDeHoje(lista, "2026-10-29").map(p => [p.tipo, p.data.id]), [["opcao_vencida", "vencida"], ["opcao_vencendo", "vencendo"]]);
  assert.deepEqual(proximasDatas(lista, "2026-10-29", 3).map(item => item.id), ["confirmada", "vencida", "vencendo"]);
});

test("mudar a situação: só a opção guarda ordem; as outras limpam", async () => {
  const { mudancaDeSituacao } = await import("../lib/producao/agenda");
  assert.deepEqual(mudancaDeSituacao("confirmada"), { situacao: "confirmada", opcao_ordem: null, opcao_ate: null });
  assert.deepEqual(mudancaDeSituacao("opcao"), { situacao: "opcao", opcao_ordem: 1, opcao_ate: null });
  assert.equal(mudancaDeSituacao("cancelada").opcao_ordem, null);
});

test("copiar a temporada anda todas as datas o mesmo tanto, inclusive as de vários dias", async () => {
  const { copiarDatas, diasEntre } = await import("../lib/producao/agenda");
  assert.equal(diasEntre("2026-11-05", "2027-11-05"), 365);
  const copia = copiarDatas([
    { data: "2026-11-07", data_fim: null, tipo: "apresentacao", uf: "RS" },
    { data: "2026-11-05", data_fim: "2026-11-06", tipo: "montagem", uf: null },
  ], "2027-03-01");
  // A primeira data (05/11) vai para 01/03; a outra, o mesmo tanto depois.
  assert.deepEqual(copia.map(item => [item.data, item.data_fim]), [["2027-03-03", null], ["2027-03-01", "2027-03-02"]]);
  assert.deepEqual(copiarDatas([], "2027-03-01"), []);
});
