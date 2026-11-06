import assert from "node:assert/strict";
import test from "node:test";
import { conviteDaFolhaEmail } from "../lib/email/templates";

test("o convite diz quem convida, leva o link e trata a pessoa pelo primeiro nome", () => {
  const e = conviteDaFolhaEmail({ recipientName: "Ana Souza", organizacao: "Cia Atores de Mar", convidadoPor: "Luan Barros", url: "https://app.jards.com.br/minha-folha" });
  assert.equal(e.subject, "Cia Atores de Mar convidou você para ver a sua folha do dia");
  assert.match(e.text, /^Olá, Ana\. Luan Barros, de Cia Atores de Mar, convidou você/);
  assert.ok(e.text.includes("https://app.jards.com.br/minha-folha"));
  assert.ok(e.html.includes('href="https://app.jards.com.br/minha-folha"'));
  assert.ok(e.html.includes("Olá, Ana."));
});

test("sem nome e sem quem convidou, o texto continua certo", () => {
  const e = conviteDaFolhaEmail({ recipientName: null, organizacao: "Teatro X", url: "https://app.jards.com.br/minha-folha" });
  assert.match(e.text, /^Olá\. Teatro X convidou você/);
});

test("nome, organização e link com HTML não viram HTML no corpo; o texto simples não leva escape", () => {
  const e = conviteDaFolhaEmail({ recipientName: "<b>Zé</b>", organizacao: "A & B <i>", convidadoPor: "Fulano \"F\"", url: "https://x.com/?a=1&b=2" });
  assert.ok(!e.html.includes("<b>Zé"), "o nome não pode entrar como tag");
  assert.ok(!e.html.includes("A & B <i>"));
  assert.ok(e.html.includes("&lt;b&gt;"));
  assert.ok(e.html.includes("https://x.com/?a=1&amp;b=2"));
  assert.ok(e.text.includes("A & B <i>"), "o texto simples guarda o nome como é");
});
