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
