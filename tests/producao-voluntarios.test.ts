import assert from "node:assert/strict";
import test from "node:test";
import { CODIGO_DO_LINK_DE_VOLUNTARIOS, lerInscricao, resumoDosVoluntarios, TEXTO_DA_CONCORDANCIA } from "../lib/producao/voluntarios";

const base = { nome: "Eva Souza", email: "EVA@Exemplo.com ", telefone: "", disponibilidade: "", concordou: true, site: "" };

test("inscrição: nome, um contato e a concordância; e-mail em minúsculas; vazio vira nulo", () => {
  const leitura = lerInscricao(base);
  assert.deepEqual(leitura.ok === true && leitura.valor, { nome: "Eva Souza", email: "eva@exemplo.com", telefone: null, disponibilidade: null });
  const soTelefone = lerInscricao({ ...base, email: "", telefone: "(11) 99999-0001", disponibilidade: " Noites e fins de semana " });
  assert.deepEqual(soTelefone.ok === true && soTelefone.valor, { nome: "Eva Souza", email: null, telefone: "(11) 99999-0001", disponibilidade: "Noites e fins de semana" });
});

test("inscrição: recusa o que o banco recusaria, dizendo o campo", () => {
  const erro = (campos: Record<string, unknown>) => { const l = lerInscricao({ ...base, ...campos }); return l.ok === false ? l : null; };
  assert.equal(erro({ nome: " " })?.campo, "nome");
  assert.equal(erro({ nome: "x".repeat(121) })?.campo, "nome");
  assert.equal(erro({ email: "", telefone: "" })?.campo, "email");
  assert.equal(erro({ email: "sem-arroba" })?.campo, "email");
  assert.equal(erro({ email: "", telefone: "123" })?.campo, "telefone");
  assert.equal(erro({ disponibilidade: "x".repeat(501) })?.campo, "disponibilidade");
  assert.equal(erro({ concordou: false })?.campo, "concordou");
  assert.equal(erro({ concordou: "true" })?.campo, "concordou", "só o booleano verdadeiro vale");
});

test("o campo escondido preenchido é robô: armadilha, sem gravar", () => {
  assert.deepEqual(lerInscricao({ ...base, site: "http://spam.example" }), { ok: "armadilha" });
});

test("resumo, código do link e texto da concordância", () => {
  assert.deepEqual(resumoDosVoluntarios([{ situacao: "inscrito" }, { situacao: "aprovado" }, { situacao: "aprovado" }, { situacao: "recusado" }]), { inscritos: 1, aprovados: 2, recusados: 1, total: 4 });
  assert.ok(CODIGO_DO_LINK_DE_VOLUNTARIOS.test("A".repeat(43)) && !CODIGO_DO_LINK_DE_VOLUNTARIOS.test("A".repeat(42)));
  assert.match(TEXTO_DA_CONCORDANCIA, /só para organizar o voluntariado/);
});
