import assert from "node:assert/strict";
import test from "node:test";
import { casaResponsavel, membrosDaEquipe } from "../lib/equipe/responsavel";

test("filtro por responsável: todos, só os meus, de uma pessoa e sem responsável", () => {
  assert.equal(casaResponsavel([null, null], "todos", "eu"), true);
  assert.equal(casaResponsavel(["eu", null], "meus", "eu"), true);
  assert.equal(casaResponsavel(["outro", "eu"], "meus", "eu"), true, "supervisor também conta");
  assert.equal(casaResponsavel(["outro"], "meus", "eu"), false);
  assert.equal(casaResponsavel(["eu"], "meus", null), false, "sem saber quem está logado, nada é dele");
  assert.equal(casaResponsavel(["fulano"], "fulano", "eu"), true);
  assert.equal(casaResponsavel(["eu"], "fulano", "eu"), false);
  assert.equal(casaResponsavel([null, undefined], "sem", "eu"), true);
  assert.equal(casaResponsavel(["fulano", null], "sem", "eu"), false);
});

test("a equipe deixa de fora captador e proponente externos e sai em ordem de nome", () => {
  const membro = (user_id: string, papel: string, full_name: string | null, email: string | null = null) =>
    ({ user_id, papel, full_name, email, created_at: "" });
  assert.deepEqual(membrosDaEquipe([
    membro("3", "colaborador", "Zélia"),
    membro("1", "admin", "Ana"),
    membro("4", "captador", "Externo"),
    membro("5", "proponente", "Proponente"),
    membro("2", "leitor", null, "bruno@empresa.com"),
  ]), [
    { id: "1", nome: "Ana" },
    { id: "2", nome: "bruno" },
    { id: "3", nome: "Zélia" },
  ]);
});

test("resumo da pessoa: abertas, ganhas e atrasadas", async () => {
  const { estaAtrasada, inicioDoPeriodo, resumoDasNegociacoes } = await import("../lib/equipe/perfil");
  assert.deepEqual(resumoDasNegociacoes([
    { status: "prospeccao", valor_solicitado: 100 },
    { status: "negociacao", valor_solicitado: null },
    { status: "aprovado", valor_solicitado: 500 },
    { status: "recusado", valor_solicitado: 900 },
  ]), { abertas: 2, valorAberto: 100, ganhas: 1, valorGanho: 500 });
  assert.equal(estaAtrasada({ feita: false, data_prevista: "2026-10-01" }, "2026-10-29"), true);
  assert.equal(estaAtrasada({ feita: false, data_prevista: "2026-10-29" }, "2026-10-29"), false, "hoje não é atraso");
  assert.equal(estaAtrasada({ feita: true, data_prevista: "2026-10-01" }, "2026-10-29"), false);
  assert.equal(estaAtrasada({ feita: false, data_prevista: null }, "2026-10-29"), false);
  assert.equal(inicioDoPeriodo(7, new Date("2026-10-29T12:00:00Z")), "2026-10-22T12:00:00.000Z");
});
