import assert from "node:assert/strict";
import test from "node:test";
import { interacaoDoEmail, resumoDoEmail, type EmailParaInteracao } from "../lib/email/interacoes";
import { decisorDeVisibilidade } from "../lib/email/visibilidade";

test("sem nada gravado, a mensagem nova é da equipe, como sempre foi", () => {
  const decidir = decisorDeVisibilidade([]);
  assert.equal(decidir({ id: "m1", threadId: "f1" }), "organization");
  assert.equal(decidir({ id: "m2", threadId: null }), "organization");
});

test("mensagem nova de uma conversa Só eu vejo nasce privada", () => {
  const decidir = decisorDeVisibilidade([{ message_id: "m1", thread_id: "f1", visibility: "private" }]);
  assert.equal(decidir({ id: "m2", threadId: "f1" }), "private");
});

test("a mensagem que já é privada continua privada ao ser lida de novo, mesmo sem fio", () => {
  const decidir = decisorDeVisibilidade([{ message_id: "m1", thread_id: null, visibility: "private" }]);
  assert.equal(decidir({ id: "m1", threadId: null }), "private");
});

test("outra conversa, ou uma conversa da equipe, não é afetada", () => {
  const decidir = decisorDeVisibilidade([
    { message_id: "m1", thread_id: "f1", visibility: "private" },
    { message_id: "m3", thread_id: "f2", visibility: "organization" },
  ]);
  assert.equal(decidir({ id: "m4", threadId: "f2" }), "organization");
  assert.equal(decidir({ id: "m5", threadId: "f9" }), "organization");
  assert.equal(decidir({ id: "m3", threadId: "f2" }), "organization");
});

test("na dúvida esconde: um fio com uma mensagem privada deixa as outras privadas", () => {
  const decidir = decisorDeVisibilidade([
    { message_id: "m1", thread_id: "f1", visibility: "organization" },
    { message_id: "m2", thread_id: "f1", visibility: "private" },
  ]);
  assert.equal(decidir({ id: "m1", threadId: "f1" }), "private");
});

test("o resumo do e-mail tira quebras e espaços sobrando e corta em 1200 caracteres", () => {
  assert.equal(resumoDoEmail("Oi,\r\n\n\n\nsegue    a proposta.  ", null), "Oi,\n\nsegue a proposta.");
  assert.equal(resumoDoEmail("a".repeat(2000), null)?.length, 1200);
});

test("sem corpo o resumo usa o trecho, e sem os dois não há resumo", () => {
  assert.equal(resumoDoEmail(null, "trecho curto"), "trecho curto");
  assert.equal(resumoDoEmail("", "trecho curto"), "trecho curto");
  assert.equal(resumoDoEmail(null, null), null);
  assert.equal(resumoDoEmail("   \n  ", null), null);
});

const EMAIL: EmailParaInteracao = {
  id: "e1",
  contato_id: "c1",
  empresa_crm_id: "emp1",
  captacao_id: "cap1",
  direction: "inbound",
  subject: "  Re: Proposta  ",
  snippet: "trecho",
  body_text: "Corpo do e-mail",
  sent_at: "2026-11-14T12:11:50.000Z",
};

test("a interação do e-mail recebido: entrada, no nome de quem sincronizou", () => {
  const interacao = interacaoDoEmail(EMAIL, "org1", "usuario-1");
  assert.equal(interacao.direcao, "entrada");
  assert.equal(interacao.assunto, "Re: Proposta");
  assert.equal(interacao.resumo, "Corpo do e-mail");
  assert.equal(interacao.ocorreu_em, "2026-11-14T12:11:50.000Z");
  assert.equal(interacao.email_id, "e1");
  assert.equal(interacao.organization_id, "org1");
  assert.equal(interacao.account_id, "usuario-1");
  assert.equal(interacao.created_by, "usuario-1");
  assert.equal(interacao.empresa_crm_id, "emp1");
  assert.equal(interacao.captacao_id, "cap1");
  assert.equal(interacao.contato_id, "c1");
  assert.equal(interacao.tipo, "email");
  assert.equal(interacao.canal, "email");
});

test("e-mail enviado vira saída; sem assunto e sem data o Jards preenche", () => {
  const agora = new Date("2026-11-18T10:00:00.000Z");
  const interacao = interacaoDoEmail({ ...EMAIL, direction: "outbound", subject: "  ", sent_at: null }, "org1", "usuario-1", agora);
  assert.equal(interacao.direcao, "saida");
  assert.equal(interacao.assunto, "E-mail sem assunto");
  assert.equal(interacao.ocorreu_em, "2026-11-18T10:00:00.000Z");
});
