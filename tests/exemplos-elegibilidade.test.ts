import assert from "node:assert/strict";
import test from "node:test";
import { JANELA_DE_CONTA_NOVA_MS, motivoDeNaoSemear, progressoDaConfiguracao, type SituacaoDaConta } from "../lib/exemplos/elegibilidade";

const AGORA = Date.parse("2026-11-20T15:00:00Z");
const nova: SituacaoDaConta = {
  papelNaOrganizacao: "admin",
  membrosDaOrganizacao: 1,
  convitesRecebidos: 0,
  registrosDaOrganizacao: 0,
  contaCriadaEm: "2026-11-20T14:55:00Z",
  agora: AGORA,
};

test("conta recém-criada, sozinha na organização vazia, recebe os exemplos", () => {
  assert.equal(motivoDeNaoSemear(nova), null);
});

test("convidado, equipe, quem não é admin e organização com dados não recebem", () => {
  assert.equal(motivoDeNaoSemear({ ...nova, convitesRecebidos: 1 }), "convidado");
  assert.equal(motivoDeNaoSemear({ ...nova, membrosDaOrganizacao: 2 }), "equipe");
  assert.equal(motivoDeNaoSemear({ ...nova, papelNaOrganizacao: "captador" }), "nao_e_admin");
  assert.equal(motivoDeNaoSemear({ ...nova, papelNaOrganizacao: null }), "nao_e_admin");
  assert.equal(motivoDeNaoSemear({ ...nova, registrosDaOrganizacao: 3 }), "organizacao_com_dados");
});

test("conta antiga ou sem data de criação não recebe", () => {
  const velha = new Date(AGORA - JANELA_DE_CONTA_NOVA_MS - 1000).toISOString();
  assert.equal(motivoDeNaoSemear({ ...nova, contaCriadaEm: velha }), "conta_antiga");
  assert.equal(motivoDeNaoSemear({ ...nova, contaCriadaEm: null }), "conta_antiga");
});

test("a barra de carregamento sobe sem passar de 92% e nunca anda para trás", () => {
  assert.equal(progressoDaConfiguracao(0), 0);
  let anterior = 0;
  for (const ms of [200, 600, 1200, 2500, 5000, 20000, 120000]) {
    const atual = progressoDaConfiguracao(ms);
    assert.ok(atual > anterior && atual <= 92, `${ms} ms -> ${atual}`);
    anterior = atual;
  }
  assert.equal(progressoDaConfiguracao(-50), 0);
});
