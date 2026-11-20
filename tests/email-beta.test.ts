import assert from "node:assert/strict";
import test from "node:test";
import { emailLiberadoPara } from "../lib/email/beta";

const PESSOA = { id: "11111111-aaaa-4aaa-8aaa-111111111111", email: "Ana@Exemplo.com.br" };
const ORGANIZACAO = "22222222-bbbb-4bbb-8bbb-222222222222";

test("sem a variável ninguém conecta, nem com lista vazia ou só vírgulas", () => {
  assert.equal(emailLiberadoPara(PESSOA, ORGANIZACAO, undefined), false);
  assert.equal(emailLiberadoPara(PESSOA, ORGANIZACAO, ""), false);
  assert.equal(emailLiberadoPara(PESSOA, ORGANIZACAO, " , ,"), false);
});

test("`todos` libera qualquer pessoa, em qualquer caixa de letras", () => {
  assert.equal(emailLiberadoPara(PESSOA, ORGANIZACAO, "todos"), true);
  assert.equal(emailLiberadoPara(PESSOA, null, "TODOS"), true);
});

test("a lista libera por e-mail, por id da pessoa ou por id da organização", () => {
  assert.equal(emailLiberadoPara(PESSOA, ORGANIZACAO, "ana@exemplo.com.br"), true);
  assert.equal(emailLiberadoPara(PESSOA, ORGANIZACAO, "outra@exemplo.com.br, " + PESSOA.id), true);
  assert.equal(emailLiberadoPara(PESSOA, ORGANIZACAO, ORGANIZACAO.toUpperCase()), true);
});

test("quem não está na lista fica de fora", () => {
  assert.equal(emailLiberadoPara(PESSOA, ORGANIZACAO, "outra@exemplo.com.br, 33333333-cccc-4ccc-8ccc-333333333333"), false);
  assert.equal(emailLiberadoPara({ id: PESSOA.id }, null, "ana@exemplo.com.br"), false);
});

test("super admin do Jards sempre pode, mesmo sem a variável", () => {
  assert.equal(emailLiberadoPara({ ...PESSOA, superAdmin: true }, ORGANIZACAO, undefined), true);
  assert.equal(emailLiberadoPara({ ...PESSOA, superAdmin: false }, ORGANIZACAO, undefined), false);
});
