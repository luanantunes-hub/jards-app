import assert from "node:assert/strict";
import test from "node:test";
import { equipamentosDaFicha, lerEquipamento, lerManutencao, pendenciasDaCasa, proximaPreventiva } from "../lib/producao/equipamentos";

const base = { nome: " Refletor LED ", categoria: "luz", quantidade: "24", estado: "em_uso", salaId: "", observacoes: "" };

test("o equipamento lido tem o formato do banco", () => {
  assert.deepEqual(lerEquipamento(base), { ok: true, equipamento: { nome: "Refletor LED", categoria: "luz", quantidade: 24, estado: "em_uso", sala_id: null, observacoes: null } });
  assert.deepEqual(lerEquipamento({ ...base, quantidade: "", salaId: "s1", observacoes: " Revisado " }), { ok: true, equipamento: { nome: "Refletor LED", categoria: "luz", quantidade: 1, estado: "em_uso", sala_id: "s1", observacoes: "Revisado" } });
  for (const mudanca of [{ nome: " " }, { nome: "a".repeat(201) }, { categoria: "drone" }, { estado: "quebrado" }, { quantidade: "0" }, { quantidade: "2,5" }, { quantidade: "100000" }, { observacoes: "a".repeat(2001) }]) {
    assert.equal(lerEquipamento({ ...base, ...mudanca }).ok, false, JSON.stringify(mudanca));
  }
});

test("a manutenção lida: recorrência só na preventiva e de 1 a 3.650 dias", () => {
  const campos = { tipo: "preventiva", descricao: " Limpeza ", prevista: "2026-12-01", recorrencia: "90" };
  assert.deepEqual(lerManutencao(campos), { ok: true, manutencao: { tipo: "preventiva", descricao: "Limpeza", prevista_para: "2026-12-01", recorrencia_dias: 90 } });
  assert.deepEqual(lerManutencao({ ...campos, tipo: "corretiva", recorrencia: "" }), { ok: true, manutencao: { tipo: "corretiva", descricao: "Limpeza", prevista_para: "2026-12-01", recorrencia_dias: null } });
  for (const mudanca of [{ tipo: "geral" }, { descricao: " " }, { prevista: "" }, { recorrencia: "0" }, { recorrencia: "3651" }, { recorrencia: "abc" }, { tipo: "corretiva" }]) {
    assert.equal(lerManutencao({ ...campos, ...mudanca }).ok, false, JSON.stringify(mudanca));
  }
});

test("a próxima preventiva é a feita mais a recorrência; sem recorrência não há próxima", () => {
  assert.equal(proximaPreventiva("2026-11-20", 90), "2027-02-18");
  assert.equal(proximaPreventiva("2026-12-31", 1), "2027-01-01");
  assert.equal(proximaPreventiva("2026-11-20", null), null);
});

test("as pendências: avariado, manutenção vencida e a dos próximos 30 dias; baixado e feita não contam", () => {
  const equipamentos = [
    { id: "e1", nome: "Refletor", estado: "em_uso" as const }, { id: "e2", nome: "Mesa de som", estado: "avariado" as const },
    { id: "e3", nome: "Projetor velho", estado: "baixado" as const }, { id: "e4", nome: "Cabos", estado: "manutencao" as const },
  ];
  const m = (id: string, equipamento_id: string, prevista_para: string, feita_em: string | null = null) => ({ id, equipamento_id, descricao: id, prevista_para, feita_em });
  const pendencias = pendenciasDaCasa(equipamentos, [
    m("vencida", "e1", "2026-11-01"), m("hoje", "e1", "2026-11-10"), m("em-20-dias", "e4", "2026-11-30"), m("em-40-dias", "e1", "2026-12-20"),
    m("feita", "e1", "2026-10-01", "2026-10-02"), m("do-baixado", "e3", "2026-11-05"), m("de-fora", "e9", "2026-11-05"),
  ], "2026-11-10");
  assert.deepEqual(pendencias.avariados.map(item => item.nome), ["Mesa de som"]);
  assert.deepEqual(pendencias.vencidas.map(item => [item.id, item.equipamento]), [["vencida", "Refletor"]]);
  assert.deepEqual(pendencias.proximas.map(item => item.id), ["hoje", "em-20-dias"]);
});

test("a ficha só leva o que está em uso", () => {
  const lista = [{ nome: "a", estado: "em_uso" as const }, { nome: "b", estado: "avariado" as const }, { nome: "c", estado: "manutencao" as const }, { nome: "d", estado: "baixado" as const }];
  assert.deepEqual(equipamentosDaFicha(lista).map(item => item.nome), ["a"]);
});
