import assert from "node:assert/strict";
import test from "node:test";
import { avisosDeEquipamentosParaHoje, avisosDeLicencasParaHoje } from "../lib/producao/hoje";

const datas = [
  { id: "d1", data: "2026-12-05", situacao: "confirmada", temporada_titulo: "Turnê Sul" },
  { id: "d2", data: "2026-11-20", situacao: "confirmada", temporada_titulo: null },
  { id: "d3", data: "2026-12-06", situacao: "cancelada", temporada_titulo: null },
  { id: "d4", data: "2026-11-01", situacao: "realizada", temporada_titulo: null },
];
const licenca = (id: string, dataId: string, tipo: "alvara" | "ecad" | "avcb", situacao: "a_pedir" | "pedida" | "concedida" | "negada" | "dispensada", prazoDias: number | null, validade: string | null = null) =>
  ({ id, data_id: dataId, tipo, situacao, prazo_dias: prazoDias, validade });

test("licenças em Hoje: prazo vencido, negada e validade curta; só das datas que ainda vão acontecer, da mais próxima à mais distante", () => {
  const avisos = avisosDeLicencasParaHoje([
    licenca("l1", "d1", "alvara", "a_pedir", -30),
    licenca("l2", "d2", "ecad", "negada", null),
    licenca("l3", "d3", "avcb", "negada", null),
    licenca("l4", "d4", "alvara", "a_pedir", -30),
    licenca("l5", "d1", "avcb", "concedida", null, "2026-12-01"),
    licenca("l6", "d1", "ecad", "pedida", -5),
    licenca("l7", "d1", "ecad", "dispensada", -30),
  ], datas, "2026-11-10");
  assert.deepEqual(avisos.map(aviso => aviso.texto), [
    "ECAD de 20 nov: Negada: resolva antes da data ou mude o plano.",
    "Alvará de 05 dez · Turnê Sul: O prazo para pedir já passou.",
    "AVCB (bombeiros) de 05 dez · Turnê Sul: A validade acaba antes do dia da data.",
  ]);
  assert.equal(avisos[0].href, "/producoes/datas/d2");
  assert.equal(new Set(avisos.map(aviso => aviso.chave)).size, avisos.length, "cada aviso tem chave própria");
});

test("equipamentos em Hoje: o avariado e a manutenção vencida; a que vence depois e o baixado não", () => {
  const avisos = avisosDeEquipamentosParaHoje(
    [{ id: "e1", nome: "Mesa de som", estado: "avariado", espaco_id: "x1" }, { id: "e2", nome: "Refletor", estado: "em_uso", espaco_id: "x1" }, { id: "e3", nome: "Fumaça", estado: "baixado", espaco_id: "x2" }],
    [
      { id: "m1", equipamento_id: "e2", descricao: "Limpeza", prevista_para: "2026-11-05", feita_em: null },
      { id: "m2", equipamento_id: "e2", descricao: "Troca de lâmpada", prevista_para: "2026-11-20", feita_em: null },
      { id: "m3", equipamento_id: "e3", descricao: "Revisão", prevista_para: "2026-10-01", feita_em: null },
      { id: "m4", equipamento_id: "e2", descricao: "Já feita", prevista_para: "2026-10-01", feita_em: "2026-10-02" },
    ],
    "2026-11-10",
  );
  assert.deepEqual(avisos.map(aviso => aviso.texto), ["Mesa de som está avariado.", "Refletor, Limpeza: venceu em 05 nov."]);
  assert.equal(avisos[1].href, "/producoes/espacos/x1");
});
