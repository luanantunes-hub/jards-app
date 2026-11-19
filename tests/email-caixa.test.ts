import assert from "node:assert/strict";
import test from "node:test";
import { agruparConversas, type EmailDeConversa } from "../lib/email/conversas";
import { contagemPorFiltro, conversaNoFiltro, quemDaConversa } from "../lib/email/caixa";

const AGORA = Date.parse("2026-11-19T12:00:00Z");

function email(id: string, campos: Partial<EmailDeConversa>): EmailDeConversa {
  return {
    id, message_id: id, thread_id: `fio-${id}`, subject: "Assunto", snippet: "trecho", from_email: "novo@cliente.com.br", from_name: "Novo Cliente",
    to_emails: ["luan@platibanda.com"], sent_at: "2026-11-18T10:00:00Z", direction: "inbound", visibility: "private", user_id: "u1",
    contato_id: null, empresa_crm_id: null, captacao_id: null, ...campos,
  };
}

const conversas = agruparConversas([
  email("a", {}), // desconhecido, privado, quem escreveu por último foi o outro
  email("b", { direction: "outbound", to_emails: ["marina@aurora.com.br"], contato_id: "c1", visibility: "organization", sent_at: "2026-11-15T10:00:00Z" }), // contato, aguardando
  email("c", { contato_id: "c2", visibility: "organization", from_name: null, from_email: "ana@x.com" }), // contato que respondeu
], AGORA);

test("cada filtro separa o que promete", () => {
  const porAssunto = (id: string) => conversas.find((conversa) => conversa.mensagens[0].id === id)!;
  assert.equal(conversaNoFiltro(porAssunto("a"), "sem-contato"), true);
  assert.equal(conversaNoFiltro(porAssunto("b"), "sem-contato"), false);
  assert.equal(conversaNoFiltro(porAssunto("b"), "aguardando"), true);
  assert.equal(conversaNoFiltro(porAssunto("a"), "aguardando"), false);
  assert.equal(conversaNoFiltro(porAssunto("a"), "so-eu"), true);
  assert.equal(conversaNoFiltro(porAssunto("c"), "so-eu"), false);
  assert.equal(conversaNoFiltro(porAssunto("c"), "todas"), true);
});

test("a contagem de cada filtro", () => {
  assert.deepEqual(contagemPorFiltro(conversas), { todas: 3, aguardando: 1, "sem-contato": 1, "so-eu": 1 });
});

test("com quem é a conversa: contatos, ou o outro lado da última mensagem", () => {
  const porAssunto = (id: string) => conversas.find((conversa) => conversa.mensagens[0].id === id)!;
  assert.deepEqual(quemDaConversa(porAssunto("a"), []), ["Novo Cliente"]);
  assert.deepEqual(quemDaConversa(porAssunto("b"), ["Marina"]), ["Marina"]);
  assert.deepEqual(quemDaConversa(porAssunto("b"), []), ["marina@aurora.com.br"]);
  assert.deepEqual(quemDaConversa(porAssunto("c"), []), ["ana@x.com"]);
});
