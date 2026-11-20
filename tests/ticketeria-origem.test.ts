import assert from "node:assert/strict";
import test from "node:test";
import { lerOrigem, origemDaPagina } from "../lib/ticketeria/origem";

test("a origem do corpo: rótulos aparados, só as cinco utm, nada de dado pessoal", () => {
  assert.equal(lerOrigem(null), null);
  assert.equal(lerOrigem("instagram"), null);
  assert.equal(lerOrigem([]), null);
  assert.equal(lerOrigem({}), null);
  assert.equal(lerOrigem({ canal: "   ", acao: "!!!", referencia: "...", utm: {} }), null, "tudo vazio depois de limpo: sem origem");
  assert.deepEqual(lerOrigem({ canal: "  WhatsApp ", acao: "Promoção da Semana/Última chance" }), { canal: "whatsapp", acao: "promocao-da-semana-ultima-chance", referencia: null, utm: null });
  assert.deepEqual(lerOrigem({ canal: "e-mail", utm: { utm_source: "news", utm_medium: "email", utm_campaign: "lote 1", utm_term: "", utm_content: "topo", email: "a@b.c", gclid: "x" } }),
    { canal: "e-mail", acao: null, referencia: null, utm: { utm_source: "news", utm_medium: "email", utm_campaign: "lote 1", utm_content: "topo" } });
  assert.equal(lerOrigem({ referencia: "L.Instagram.com/abc?x=1" })?.referencia, "l.instagram.comabcx1", "o domínio só tem letras, números, ponto e hífen");
});

test("os limites: canal 30, ação 60, referência 100, utm 100", () => {
  const o = lerOrigem({ canal: "a".repeat(50), acao: "b".repeat(80), referencia: "c".repeat(150), utm: { utm_source: "d".repeat(150) } });
  assert.equal(o?.canal?.length, 30);
  assert.equal(o?.acao?.length, 60);
  assert.equal(o?.referencia?.length, 100);
  assert.equal(o?.utm?.utm_source?.length, 100);
  assert.equal(lerOrigem({ canal: `${"a".repeat(29)}-zz` })?.canal, "a".repeat(29), "não termina em hífen depois de cortar");
});

test("a página de compra: ?canal, ?acao, utm_* e o site de onde chegou (o do próprio site não conta)", () => {
  assert.equal(origemDaPagina("", "", "jards.com.br"), null, "sem nada: sem origem");
  assert.deepEqual(origemDaPagina("?canal=instagram&acao=stories-do-lote-2&utm_source=ig&utm_medium=social&fbclid=zzz", "https://l.instagram.com/?u=abc", "jards.com.br"),
    { canal: "instagram", acao: "stories-do-lote-2", referencia: "l.instagram.com", utm: { utm_source: "ig", utm_medium: "social" } });
  assert.equal(origemDaPagina("", "https://jards.com.br/site", "jards.com.br"), null, "veio do próprio site: sem referência");
  assert.deepEqual(origemDaPagina("", "https://www.google.com/", "jards.com.br"), { canal: null, acao: null, referencia: "www.google.com", utm: null });
  assert.equal(origemDaPagina("?canal=instagram", "isto não é um endereço", "jards.com.br")?.referencia, null, "referência torta é ignorada");
});
