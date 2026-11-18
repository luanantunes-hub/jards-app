import assert from "node:assert/strict";
import test from "node:test";
import { decidirPeloEstado, mensagemDaFalha } from "../lib/reunioes/conferir";
import { lerReuniaoDoVexa } from "../lib/reunioes/vexa";

test("conferência: o estado do Vexa decide o que fazer com a reunião parada", () => {
  assert.equal(decidirPeloEstado("failed", "bot_entrando"), "falhar");
  assert.equal(decidirPeloEstado("completed", "gravando"), "concluir");
  assert.equal(decidirPeloEstado("active", "bot_entrando"), "iniciar");
  assert.equal(decidirPeloEstado("active", "gravando"), "ignorar");
  assert.equal(decidirPeloEstado("awaiting_admission", "bot_entrando"), "ignorar");
  assert.equal(decidirPeloEstado(null, "bot_entrando"), "ignorar");
});

test("conferência: reunião já fechada nunca é mexida", () => {
  assert.equal(decidirPeloEstado("failed", "concluida"), "ignorar");
  assert.equal(decidirPeloEstado("completed", "falhou"), "ignorar");
});

test("mensagem da falha: espera de admissão vira orientação; outros motivos aparecem", () => {
  assert.match(mensagemDaFalha("awaiting_admission"), /admita/i);
  assert.match(mensagemDaFalha("awaiting_admission_timeout"), /ninguém o admitiu/);
  assert.match(mensagemDaFalha("removed_by_admin"), /removido/);
  assert.match(mensagemDaFalha("falha estranha"), /falha estranha/);
  assert.equal(mensagemDaFalha(null), "O assistente não conseguiu participar da reunião");
});

test("Vexa: o motivo da falha vem do objeto ou de data", () => {
  assert.equal(lerReuniaoDoVexa({ id: 7, status: "failed", failure_stage: "awaiting_admission" }).motivo, "awaiting_admission");
  assert.equal(lerReuniaoDoVexa({ id: 7, status: "failed", data: { completion_reason: "awaiting_admission_timeout" } }).motivo, "awaiting_admission_timeout");
  assert.equal(lerReuniaoDoVexa({ id: 7, status: "active" }).motivo, null);
});
