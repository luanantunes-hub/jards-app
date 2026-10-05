import assert from "node:assert/strict";
import test from "node:test";
import { propostaAtivaDe } from "../lib/propostas";

const p = (id: string, status: string, dia: number) => ({ id, status, created_at: `2026-10-${String(dia).padStart(2, "0")}T12:00:00Z` });

test("vale a mais recente que segue ativa", () => {
  assert.equal(propostaAtivaDe([p("a", "rascunho", 1), p("b", "enviada", 3), p("c", "recusada", 5)])?.id, "b");
});

test("a aceita vence qualquer outra", () => {
  assert.equal(propostaAtivaDe([p("a", "aceita", 1), p("b", "rascunho", 9)])?.id, "a");
});

test("sem proposta ativa, nenhuma vale", () => {
  assert.equal(propostaAtivaDe([p("a", "arquivada", 1), p("b", "expirada", 2)]), null);
  assert.equal(propostaAtivaDe([]), null);
});
