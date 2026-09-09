import test from "node:test";
import assert from "node:assert/strict";
import { getInscricaoTiming } from "../lib/inscricoes/timing";

const TODAY = new Date("2026-09-06T12:00:00Z");

test("inscrições abertas respeitam o prazo de fechamento", () => {
  assert.equal(getInscricaoTiming({ status: "interesse", dataFechamento: "2026-09-10", updatedAt: "2026-09-01", createdAt: "2026-08-01" }, TODAY).label, "No prazo");
  assert.equal(getInscricaoTiming({ status: "inscrito", dataFechamento: "2026-09-01", updatedAt: "2026-09-01", createdAt: "2026-08-01" }, TODAY).label, "Prazo perdido");
  assert.equal(getInscricaoTiming({ status: "inscrito", dataFechamento: "2026-08-01", updatedAt: "2026-09-01", createdAt: "2026-08-01" }, TODAY).label, "Prazo perdido há muito tempo");
});

test("análise distingue fechamento, espera e atraso", () => {
  assert.equal(getInscricaoTiming({ status: "em_analise", dataFechamento: "2026-09-10", updatedAt: "2026-09-01", createdAt: "2026-08-01" }, TODAY).label, "Aguardando fechamento");
  assert.equal(getInscricaoTiming({ status: "em_analise", dataFechamento: "2026-08-25", updatedAt: "2026-09-01", createdAt: "2026-08-01" }, TODAY).label, "Aguardando resultado");
  assert.equal(getInscricaoTiming({ status: "em_analise", dataFechamento: "2026-08-01", updatedAt: "2026-09-01", createdAt: "2026-08-01" }, TODAY).label, "Resultado atrasado");
});

test("desfecho vence as demais datas e ausência de fechamento usa recência", () => {
  assert.equal(getInscricaoTiming({ status: "reprovado", dataFechamento: "2026-01-01", updatedAt: "2026-09-05", createdAt: "2026-08-01" }, TODAY).label, "Concluído em 05/09/2026");
  assert.equal(getInscricaoTiming({ status: "interesse", dataFechamento: null, updatedAt: "2026-09-02", createdAt: "2026-08-01" }, TODAY).label, "Recente");
  assert.equal(getInscricaoTiming({ status: "interesse", dataFechamento: null, updatedAt: "2026-08-20", createdAt: "2026-08-01" }, TODAY).label, "Esfriando");
  assert.equal(getInscricaoTiming({ status: "interesse", dataFechamento: null, updatedAt: "2026-08-01", createdAt: "2026-08-01" }, TODAY).label, "Sem retorno");
});
