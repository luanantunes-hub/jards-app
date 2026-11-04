import assert from "node:assert/strict";
import test from "node:test";
import { fraseDoHistorico, rotuloDaEntidade } from "../lib/producao/historico";

test("criar e apagar levam o título; alterar mostra de onde para onde", () => {
  assert.equal(fraseDoHistorico({ entidade: "producao_tarefas", acao: "criou", campo: null, antes: null, depois: "Assinar o contrato" }), "Criou uma tarefa: Assinar o contrato");
  assert.equal(fraseDoHistorico({ entidade: "producao_blocos", acao: "apagou", campo: null, antes: "Abertura", depois: null }), "Apagou um bloco do dia: Abertura");
  assert.equal(fraseDoHistorico({ entidade: "producao_datas", acao: "alterou", campo: "situacao", antes: "opcao", depois: "confirmada" }), "Mudou a situação de opcao para confirmada");
  assert.equal(fraseDoHistorico({ entidade: "producao_escalas", acao: "alterou", campo: "chamada", antes: null, depois: "10:00" }), "Mudou a chamada em uma escala de vazio para 10:00");
});

test("campo e tabela desconhecidos não quebram", () => {
  assert.equal(fraseDoHistorico({ entidade: "producao_x", acao: "alterou", campo: "novo_campo", antes: "a", depois: "b" }), "Mudou o campo novo campo em um registro de a para b");
  assert.equal(fraseDoHistorico({ entidade: "producao_x", acao: "criou", campo: null, antes: null, depois: null }), "Criou um registro");
  assert.equal(rotuloDaEntidade("producao_datas"), "a data");
});
