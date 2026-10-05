import assert from "node:assert/strict";
import test from "node:test";
import { DESFECHOS_INSCRICAO, DESFECHOS_NEGOCIACAO, ehDesfecho, etapaInicial, etapasDoFormulario } from "../lib/etapas";

const etapas = ["prospeccao", "primeiro_contato", "proposta_enviada", "em_negociacao", "aprovado", "recusado", "renovacao"].map(status => ({ status }));

test("o cadastro de negociação não oferece aprovar nem recusar", () => {
  assert.deepEqual(etapasDoFormulario(etapas, DESFECHOS_NEGOCIACAO).map(e => e.status), ["prospeccao", "primeiro_contato", "proposta_enviada", "em_negociacao", "renovacao"]);
});

test("ao editar uma negociação encerrada, o desfecho atual continua na lista", () => {
  const lista = etapasDoFormulario(etapas, DESFECHOS_NEGOCIACAO, "recusado").map(e => e.status);
  assert.ok(lista.includes("recusado"));
  assert.ok(!lista.includes("aprovado"));
});

test("a coluna de desfecho do kanban não abre o cadastro já encerrado", () => {
  assert.equal(etapaInicial(etapas, DESFECHOS_NEGOCIACAO, "aprovado"), "prospeccao");
  assert.equal(etapaInicial(etapas, DESFECHOS_NEGOCIACAO, "em_negociacao"), "em_negociacao");
  assert.equal(etapaInicial(etapas, DESFECHOS_NEGOCIACAO, null), "prospeccao");
});

test("desfechos de inscrição", () => {
  assert.ok(ehDesfecho("cancelado", DESFECHOS_INSCRICAO));
  assert.ok(!ehDesfecho("inscrito", DESFECHOS_INSCRICAO));
  assert.ok(!ehDesfecho(null, DESFECHOS_NEGOCIACAO));
});
