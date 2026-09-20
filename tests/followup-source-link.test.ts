import assert from "node:assert/strict";
import test from "node:test";
import { followupSourceLink } from "../lib/activities/followupSourceLink";

test("follow-up sem empresa acessível não aponta para uma página inexistente", () => {
  assert.equal(followupSourceLink({ empresa_crm_id: "empresa-antiga", empresa_crm: null }), undefined);
  assert.equal(followupSourceLink({ empresa_crm_id: null, empresa_crm: null }), undefined);
});

test("follow-up mantém o link quando o contexto vinculado existe", () => {
  assert.equal(
    followupSourceLink({ empresa_crm_id: "empresa-ativa", empresa_crm: { nome: "Empresa" } }),
    "/empresas-crm/empresa-ativa?tab=relationship",
  );
  assert.equal(
    followupSourceLink({ captacao_id: "negociacao-ativa", captacao: { titulo: "Negociação" } }),
    "/captacoes/negociacao-ativa?tab=relacionamento",
  );
});
