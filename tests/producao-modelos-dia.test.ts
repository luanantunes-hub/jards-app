import assert from "node:assert/strict";
import test from "node:test";
import { blocosParaModelo, horaDoPrimeiroBloco, lerBlocosDoModelo, modeloDaOrganizacao } from "../lib/producao/modelos-dia";

test("o dia vira lista do modelo: em ordem de hora, com a duração do bloco e a padrão para o sem fim", () => {
  const lista = blocosParaModelo([
    { inicio: "2026-11-05T23:00:00.000Z", fim: "2026-11-06T00:30:00.000Z", tipo: "show", titulo: "Show", ordem: 1 },
    { inicio: "2026-11-05T20:00:00.000Z", fim: "2026-11-05T22:00:00.000Z", tipo: "montagem", titulo: "Montagem", ordem: 0 },
    { inicio: null, fim: null, tipo: "outro", titulo: "Jantar", ordem: 2 },
    { inicio: "2026-11-05T22:30:00.000Z", fim: null, tipo: "outro", titulo: "  ", ordem: 3 },
  ]);
  assert.deepEqual(lista, [
    { tipo: "montagem", titulo: "Montagem", duracaoMin: 120 },
    { tipo: "show", titulo: "Show", duracaoMin: 90 },
    { tipo: "outro", titulo: "Jantar", duracaoMin: 60 },
  ]);
});

test("a hora do primeiro bloco no relógio do lugar", () => {
  assert.equal(horaDoPrimeiroBloco([{ inicio: "2026-11-05T23:00:00.000Z" }, { inicio: "2026-11-05T20:00:00.000Z" }, { inicio: null }], "America/Sao_Paulo"), "17:00");
  assert.equal(horaDoPrimeiroBloco([{ inicio: null }], "America/Sao_Paulo"), null);
});

test("ler a lista guardada ignora o que não tem a forma de um bloco", () => {
  assert.deepEqual(lerBlocosDoModelo([{ tipo: "show", titulo: "Show", duracaoMin: 60 }, { tipo: 1 }, null, "x"]), [{ tipo: "show", titulo: "Show", duracaoMin: 60 }]);
  assert.deepEqual(lerBlocosDoModelo({ a: 1 }), []);
  assert.equal(modeloDaOrganizacao({ id: "abc", nome: "Meu dia", blocos: [{ tipo: "show", titulo: "S", duracaoMin: 30 }] }, "apresentacao" as never).id, "org-abc");
});
