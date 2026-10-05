import assert from "node:assert/strict";
import test from "node:test";
import { CAMPOS_NOTA, atualizarNota, autorDaNota, criarNota, normalizarNota, notaEditavel, resumoNota } from "../lib/notas";

function clienteFalso({ user = { id: "u1" } as { id: string } | null, erro = null as { message: string } | null, linha = { id: "n1" } as { id: string } | null } = {}) {
  const chamadas: { tabela?: string; insert?: Record<string, unknown>; update?: Record<string, unknown> } = {};
  const query = {
    insert: async (dados: Record<string, unknown>) => { chamadas.insert = dados; return { error: erro }; },
    update: (dados: Record<string, unknown>) => { chamadas.update = dados; return query; },
    eq: () => query,
    select: () => query,
    maybeSingle: async () => ({ data: erro ? null : linha, error: erro }),
  };
  const cliente = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (tabela: string) => { chamadas.tabela = tabela; return query; },
  };
  return { cliente: cliente as never, chamadas };
}

test("a nota é gravada com account_id (a tabela não tem user_id) e no escopo certo", async () => {
  const { cliente, chamadas } = clienteFalso();
  await criarNota(cliente, { coluna: "captacao_id", id: "c1" }, "org1", { titulo: "  Reunião ", conteudo: " Combinado o envio da proposta. " });
  assert.equal(chamadas.tabela, "notas");
  assert.deepEqual(chamadas.insert, { titulo: "Reunião", conteudo: "Combinado o envio da proposta.", account_id: "u1", organization_id: "org1", captacao_id: "c1" });
  assert.ok(!("user_id" in (chamadas.insert ?? {})));
});

test("as colunas lidas existem na tabela notas", () => {
  assert.equal(CAMPOS_NOTA, "id, titulo, conteudo, created_at, account_id");
  assert.ok(!CAMPOS_NOTA.includes("user"));
});

test("nota vazia não é salva; título em branco vira nulo", async () => {
  assert.equal(normalizarNota({ titulo: "x", conteudo: "   " }), null);
  assert.deepEqual(normalizarNota({ titulo: "  ", conteudo: "texto" }), { titulo: null, conteudo: "texto" });
  const { cliente, chamadas } = clienteFalso();
  await assert.rejects(criarNota(cliente, { coluna: "edital_user_id", id: "e1" }, null, { titulo: "", conteudo: " " }), /Escreva a nota/);
  assert.equal(chamadas.insert, undefined);
});

test("falhas viram mensagens para a pessoa", async () => {
  await assert.rejects(criarNota(clienteFalso({ user: null }).cliente, { coluna: "captacao_id", id: "c1" }, null, { titulo: "", conteudo: "a" }), /sessão expirou/);
  await assert.rejects(criarNota(clienteFalso({ erro: { message: "rls" } }).cliente, { coluna: "captacao_id", id: "c1" }, null, { titulo: "", conteudo: "a" }), /Não foi possível salvar/);
  // Edição bloqueada pelo RLS não volta linha: não pode parecer sucesso.
  await assert.rejects(atualizarNota(clienteFalso({ linha: null }).cliente, "n1", { titulo: "", conteudo: "a" }), /Não foi possível salvar/);
});

test("o histórico mostra um trecho de uma linha", () => {
  assert.equal(resumoNota("linha um\n\nlinha   dois"), "linha um linha dois");
  const longa = "palavra ".repeat(40);
  const resumo = resumoNota(longa, 30);
  assert.ok(resumo.length <= 30 && resumo.endsWith("…"));
});

test("nota da equipe aparece com o nome de quem escreveu e não é editável", () => {
  const nomes = { u2: "Ana Souza" };
  assert.equal(notaEditavel({ account_id: "u1" }, "u1"), true);
  assert.equal(autorDaNota({ account_id: "u1" }, "u1", nomes), null);
  assert.equal(notaEditavel({ account_id: "u2" }, "u1"), false);
  assert.equal(autorDaNota({ account_id: "u2" }, "u1", nomes), "Ana Souza");
  assert.equal(autorDaNota({ account_id: "u3" }, "u1", nomes), "Outra pessoa da equipe");
  // Antes de saber quem está logado, nada fica travado (o banco decide).
  assert.equal(notaEditavel({ account_id: "u2" }, null), true);
});
