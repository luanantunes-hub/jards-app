import assert from "node:assert/strict";
import test from "node:test";
import { copiarBlocosParaOutroDia } from "../lib/producao/copiar-dia";

const base = { exibicao: "exata" as const, tipo: "show", titulo: "x", visivel_para: null, capacidade: null, ordem: 0, notas: null };

test("copiar o dia leva a mesma hora do lugar para o dia novo, inclusive o que passa da meia-noite", () => {
  const [a, b, c] = copiarBlocosParaOutroDia([
    { ...base, inicio: "2026-11-05T22:00:00.000Z", fim: "2026-11-05T23:30:00.000Z" }, // 19:00–20:30 em São Paulo
    { ...base, inicio: "2026-11-06T01:00:00.000Z", fim: "2026-11-06T03:00:00.000Z" }, // 22:00–00:00, passa da meia-noite
    { ...base, inicio: null, fim: null },
  ], "2026-11-05", "America/Sao_Paulo", "2026-11-12", "America/Sao_Paulo");
  assert.equal(a.inicio, "2026-11-12T22:00:00.000Z");
  assert.equal(a.fim, "2026-11-12T23:30:00.000Z");
  assert.equal(b.inicio, "2026-11-13T01:00:00.000Z");
  assert.equal(b.fim, "2026-11-13T03:00:00.000Z");
  assert.equal(c.inicio, null);
  assert.equal(a.dia, "2026-11-12");
  assert.equal(a.confirmado, false);
});

test("copiar para um lugar de outro fuso mantém a hora do relógio do lugar novo", () => {
  const [a] = copiarBlocosParaOutroDia([{ ...base, inicio: "2026-11-05T22:00:00.000Z", fim: null }], "2026-11-05", "America/Sao_Paulo", "2026-11-05", "America/Manaus");
  assert.equal(a.inicio, "2026-11-05T23:00:00.000Z"); // 19:00 em Manaus (UTC-4)
});
