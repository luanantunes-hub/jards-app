import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EnviosDaLoja } from "../components/ticketeria/EnviosView";
import { lerEventoDoEmail, porcentagem } from "../lib/ticketeria/eventos-de-email";

test("os eventos do Resend: só os cinco valem, com o id do e-mail; a devolução é permanente só quando o Resend diz", () => {
  const base = { created_at: "2026-11-21T15:00:00.000Z", data: { email_id: "re_123", created_at: "2026-11-21T14:59:00.000Z" } };
  assert.deepEqual(lerEventoDoEmail({ ...base, type: "email.delivered" }), { tipo: "entregue", provedorId: "re_123", quando: "2026-11-21T15:00:00.000Z", permanente: false });
  assert.equal(lerEventoDoEmail({ ...base, type: "email.opened" })?.tipo, "aberto");
  assert.equal(lerEventoDoEmail({ ...base, type: "email.clicked" })?.tipo, "clicou");
  assert.equal(lerEventoDoEmail({ ...base, type: "email.complained" })?.tipo, "reclamou");
  assert.deepEqual(lerEventoDoEmail({ ...base, type: "email.bounced", data: { ...base.data, bounce: { type: "Permanent", subType: "General" } } }), { tipo: "devolvido", provedorId: "re_123", quando: "2026-11-21T15:00:00.000Z", permanente: true });
  assert.equal(lerEventoDoEmail({ ...base, type: "email.bounced", data: { ...base.data, bounce: { type: "Transient" } } })?.permanente, false, "devolução passageira não corta a pessoa da lista");
  assert.equal(lerEventoDoEmail({ ...base, type: "email.bounced" })?.permanente, false, "sem o tipo, não é permanente");
  assert.equal(lerEventoDoEmail({ type: "email.opened", data: { email_id: "re_9", created_at: "2026-11-21T10:00:00Z" } })?.quando, "2026-11-21T10:00:00.000Z", "sem a hora do aviso, vale a do e-mail");
  assert.equal(lerEventoDoEmail({ type: "email.opened", data: { email_id: "re_9" } })?.quando, null);
  for (const torto of [null, "x", {}, { type: "email.sent", data: { email_id: "re_1" } }, { type: "email.received", data: { email_id: "re_1" } }, { type: "email.opened", data: {} }, { type: "email.opened", data: { email_id: "" } }, { type: "email.opened", data: { email_id: "x".repeat(101) } }, { type: 7, data: { email_id: "re_1" } }]) assert.equal(lerEventoDoEmail(torto), null, JSON.stringify(torto));
});

test("a porcentagem: arredondada, sem total vira traço", () => {
  assert.equal(porcentagem(127, 310), 41);
  assert.equal(porcentagem(28, 310), 9);
  assert.equal(porcentagem(0, 10), 0);
  assert.equal(porcentagem(1, 0), null);
});

test("a aba Envios: abriram e clicaram em porcentagem e em pessoas; WhatsApp sem esses números; devolvidos aparecem", () => {
  const h = renderToStaticMarkup(createElement(EnviosDaLoja, { envios: [
    { id: "e1", assunto: "Últimas vagas", canal: "email", quando: "2026-11-14T13:00:00Z", destinatarios: 312, enviados: 310, falhas: 0, abertos: 127, cliques: 28, devolvidos: 2, situacao: "enviado", ingressos: 38, vendido_centavos: 205200 },
    { id: "w1", assunto: "Lembrete", canal: "whatsapp", quando: "2026-11-13T13:00:00Z", destinatarios: 4, enviados: 4, falhas: 0, situacao: "enviado", ingressos: 1, vendido_centavos: 6000 },
    { id: "e0", assunto: "Sem acompanhamento", canal: "email", quando: "2026-11-12T13:00:00Z", destinatarios: 0, enviados: 0, falhas: 0, situacao: "falhou", ingressos: 0, vendido_centavos: 0 }] }));
  for (const t of ["Abriram", "Clicaram", "41%", "9%", "127", "28", "2 voltaram"]) assert.ok(h.includes(t), t);
  assert.ok(h.includes("—"), "WhatsApp e envio sem enviados mostram traço");
  assert.equal((h.match(/41%/g) ?? []).length, 1);
});

test("a rota do webhook: falha fechada sem o segredo, assinatura obrigatória, sempre 200 para o que é válido, e a função do banco é só do servidor; a migration não apaga nada", async () => {
  const rota = await readFile("app/api/ticketeria/resend-eventos/route.ts", "utf8");
  assert.match(rota, /TICKETERIA_RESEND_WEBHOOK_SECRET/);
  assert.doesNotMatch(rota, /process\.env\.RESEND_WEBHOOK_SECRET/, "não usa o segredo do webhook de e-mails recebidos");
  assert.match(rota, /nao_configurado"\s*\}, 503/);
  assert.match(rota, /assinatura_invalida"\s*\}, 401/);
  assert.match(rota, /webhookDoResendValido/);
  assert.match(rota, /fn_ticketeria_registrar_evento_envio/);
  const proxy = await readFile("proxy.ts", "utf8");
  assert.match(proxy, /\["\/api\/ticketeria\/resend-eventos", \d+\]/, "limite por IP");
  const sql = (await readFile("supabase/migrations/20261121051531_ticketeria_envios_eventos.sql", "utf8")).replace(/--.*$/gm, "");
  assert.match(sql, /revoke execute on function public\.fn_ticketeria_registrar_evento_envio\(text, text, timestamptz, boolean\) from public, anon, authenticated/);
  assert.match(sql, /p_tipo = 'reclamou' or \(p_tipo = 'devolvido' and coalesce\(p_permanente, false\)\)/, "reclamação e devolução permanente cortam a pessoa");
  assert.doesNotMatch(sql, /\bdrop\b/i);
});
