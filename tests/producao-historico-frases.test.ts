import assert from "node:assert/strict";
import test from "node:test";
import { fraseDoHistorico, rotuloDaEntidade, valorLegivel } from "../lib/producao/historico";

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

test("o histórico escreve dia, momento e sim/não como a pessoa lê", () => {
  assert.equal(valorLegivel("2026-11-17"), "17/11/2026");
  assert.equal(valorLegivel("2026-11-13T22:30:59.738+00:00"), "13/11/2026 19:30", "horário de Brasília");
  assert.equal(valorLegivel("true"), "sim");
  assert.equal(valorLegivel("false"), "não");
  assert.equal(valorLegivel("10:00"), "10:00", "o resto fica como veio");
  assert.equal(valorLegivel("TESTE 2026-11-17"), "TESTE 2026-11-17", "texto com data no meio não é mexido");
  assert.equal(fraseDoHistorico({ entidade: "producao_sessoes", acao: "criou", campo: null, antes: null, depois: "2026-11-17" }), "Criou uma sessão da programação: 17/11/2026");
  assert.equal(fraseDoHistorico({ entidade: "producao_blocos", acao: "alterou", campo: "confirmado", antes: "false", depois: "true" }), "Mudou a confirmação em um bloco do dia de não para sim");
  assert.equal(fraseDoHistorico({ entidade: "producao_blocos", acao: "alterou", campo: "iniciado_em", antes: "2026-11-13T22:30:59.738+00:00", depois: null }), "Mudou quando começou em um bloco do dia de 13/11/2026 19:30 para vazio");
});
