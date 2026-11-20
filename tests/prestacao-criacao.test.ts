import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PASSOS, previaDoPrazo, tituloSugerido, validarPasso, valorInicial, type DadosCriacao } from "../lib/prestacao/criacao";
import { GENERICO } from "../lib/prestacao/regimes";
import { ROUANET_IN29_2026 } from "../lib/prestacao/regimes/rouanet-in29-2026";

const VAZIO: DadosCriacao = { titulo: "", regimeId: "", valorAprovado: "", inicioExecucao: "", fimExecucao: "", prazoInformado: "", justificativa: "" };
const captacao = { id: "c", titulo: "Festival de Inverno", lei: "rouanet", valor_aprovado: 250000, valor_solicitado: 300000, projeto_id: "p" };

test("os passos seguem o plano: origem, regime, dados, importação, marcos", () => {
  assert.deepEqual(PASSOS.map(p => p.id), ["origem", "regime", "dados", "importacao", "marcos"]);
});

test("sugestões a partir da captação e do projeto", () => {
  assert.equal(tituloSugerido(captacao, null), "Prestação de contas — Festival de Inverno");
  assert.equal(tituloSugerido(null, { id: "p", nome: "Circo na Praça", proponente_id: null }), "Prestação de contas — Circo na Praça");
  assert.equal(tituloSugerido(null, null), "");
  assert.equal(valorInicial(captacao), "250.000,00", "aprovado antes do solicitado, como o campo mostra");
  assert.equal(valorInicial({ ...captacao, valor_aprovado: null }), "300.000,00");
  assert.equal(valorInicial(null), "");
});

test("validação por passo", () => {
  assert.match(validarPasso("origem", VAZIO, null) ?? "", /título/);
  assert.equal(validarPasso("origem", { ...VAZIO, titulo: "Festival" }, null), null);
  assert.match(validarPasso("regime", VAZIO, null) ?? "", /regime/);
  assert.match(validarPasso("dados", { ...VAZIO, valorAprovado: "-5" }, null) ?? "", /Valor/);
  assert.equal(validarPasso("dados", { ...VAZIO, valorAprovado: "1000.50" }, null), null);
  assert.equal(validarPasso("dados", { ...VAZIO, valorAprovado: "1.000,50" }, null), null, "o texto da máscara");
  assert.equal(validarPasso("dados", VAZIO, null), null, "sem valor segue");
  assert.equal(validarPasso("importacao", VAZIO, null), null);
  assert.match(validarPasso("marcos", { ...VAZIO, inicioExecucao: "2026-05-01", fimExecucao: "2026-04-01" }, null) ?? "", /antes do início/);
});

test("prévia do prazo e justificativa quando o prazo informado difere", () => {
  assert.equal(previaDoPrazo(ROUANET_IN29_2026, "2026-08-06"), "2026-10-05");
  assert.equal(previaDoPrazo(ROUANET_IN29_2026, ""), null);
  assert.equal(previaDoPrazo(GENERICO, "2026-08-06"), null);
  const diferente = { ...VAZIO, fimExecucao: "2026-08-06", prazoInformado: "2026-11-30" };
  assert.match(validarPasso("marcos", diferente, ROUANET_IN29_2026) ?? "", /calculado/);
  assert.equal(validarPasso("marcos", { ...diferente, justificativa: "Prorrogação deferida" }, ROUANET_IN29_2026), null);
  assert.equal(validarPasso("marcos", { ...diferente, prazoInformado: "2026-10-05" }, ROUANET_IN29_2026), null, "igual ao calculado não pede justificativa");
  assert.equal(validarPasso("marcos", { ...VAZIO, prazoInformado: "2026-11-30" }, GENERICO), null, "genérico não tem prazo calculado");
});

test("o modal cria o rascunho na organização atual e grava cada passo", async () => {
  const modal = await readFile("components/modals/NovaPrestacaoModal.tsx", "utf8");
  assert.match(modal, /organization_id: organizationId/);
  assert.match(modal, /\.insert\(/);
  assert.match(modal, /\.update\(/);
  assert.doesNotMatch(modal, /<select|<Select/, "sem select nativo (DESIGN.md)");
});
