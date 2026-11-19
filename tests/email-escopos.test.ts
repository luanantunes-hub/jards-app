import assert from "node:assert/strict";
import test from "node:test";
import { GMAIL_SCOPES, MICROSOFT_EMAIL_SCOPES } from "../lib/email/config";

test("o Gmail pede leitura e envio de uma vez, para a pessoa não reconectar depois", () => {
  assert.ok(GMAIL_SCOPES.includes("https://www.googleapis.com/auth/gmail.readonly"));
  assert.ok(GMAIL_SCOPES.includes("https://www.googleapis.com/auth/gmail.send"));
  assert.ok(!GMAIL_SCOPES.some((escopo) => /gmail\.(modify|compose)$|mail\.google\.com/.test(escopo)), "sem permissão de alterar ou apagar a caixa");
});

test("a Microsoft pede leitura e envio, sem poder de alterar a caixa", () => {
  assert.ok(MICROSOFT_EMAIL_SCOPES.includes("Mail.Read"));
  assert.ok(MICROSOFT_EMAIL_SCOPES.includes("Mail.Send"));
  assert.ok(MICROSOFT_EMAIL_SCOPES.includes("offline_access"));
  assert.ok(!MICROSOFT_EMAIL_SCOPES.includes("Mail.ReadWrite"));
});
