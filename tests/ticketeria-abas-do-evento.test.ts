import { test } from "node:test";
import assert from "node:assert/strict";
import { abaDoEndereco, abasDoEvento } from "@/lib/ticketeria/abas-do-evento";

// As subabas da página do evento: Sessões, Ingressos e Precificação.

test("quem edita vê as três abas, na ordem; quem só lê não vê a Precificação", () => {
  assert.deepEqual(abasDoEvento(true).map(a => a.rotulo), ["Sessões", "Ingressos", "Precificação"]);
  assert.deepEqual(abasDoEvento(false).map(a => a.rotulo), ["Sessões", "Ingressos"]);
});

test("a aba vem do endereço, com ou sem o #", () => {
  assert.equal(abaDoEndereco("#ingressos", true), "ingressos");
  assert.equal(abaDoEndereco("precificacao", true), "precificacao");
  assert.equal(abaDoEndereco("#sessoes", false), "sessoes");
});

test("sem endereço, com aba desconhecida ou que a pessoa não pode ver, abre em Sessões", () => {
  assert.equal(abaDoEndereco("", true), "sessoes");
  assert.equal(abaDoEndereco("#qualquer", true), "sessoes");
  assert.equal(abaDoEndereco("#precificacao", false), "sessoes", "quem só lê não cai na Precificação");
});
