import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TelaDados } from "../components/ticketeria/CompraView";
import { TEXTO_DAS_NOVIDADES, VERSAO_DAS_NOVIDADES, lerWhatsapp, mascararWhatsapp } from "../lib/ticketeria/novidades";

test("o WhatsApp: só dígitos, com o 55, DDD e número do Brasil", () => {
  assert.equal(lerWhatsapp("(15) 99712-4410"), "5515997124410");
  assert.equal(lerWhatsapp("15997124410"), "5515997124410");
  assert.equal(lerWhatsapp("+55 15 99712-4410"), "5515997124410");
  assert.equal(lerWhatsapp("5515997124410"), "5515997124410");
  assert.equal(lerWhatsapp("(15) 3333-4410"), "551533334410", "fixo, 10 dígitos");
  for (const ruim of ["", "123", "(15) 89712-4410", "(05) 99712-4410", "(15) 99712-44100", null, undefined, 15997124410]) assert.equal(lerWhatsapp(ruim), null, String(ruim));
});

test("a máscara acompanha a digitação", () => {
  assert.equal(mascararWhatsapp(""), "");
  assert.equal(mascararWhatsapp("1"), "(1");
  assert.equal(mascararWhatsapp("15"), "(15");
  assert.equal(mascararWhatsapp("159"), "(15) 9");
  assert.equal(mascararWhatsapp("1599712"), "(15) 99712");
  assert.equal(mascararWhatsapp("15997124410"), "(15) 99712-4410");
  assert.equal(mascararWhatsapp("1533334410"), "(15) 3333-4410");
  assert.equal(mascararWhatsapp("(15) 99712-4410999"), "(15) 99712-4410");
  assert.match(VERSAO_DAS_NOVIDADES, /^\d{4}-\d{2}-\d{2}$/);
});

test("a tela de dados: a caixa de novidades começa desmarcada e o WhatsApp só aparece com ela marcada", () => {
  const props = { site: { titulo: "Cia" }, evento: { titulo: "Hamlet", quando: "sábado", local: "Teatro", classificacao: null, descricao: null }, resumo: { linhas: [{ nome: "Inteira", quantidade: 1, total_centavos: 6000 }], total_centavos: 6000 }, valores: { nome: "", email: "", documento: "" } };
  const fechada = renderToStaticMarkup(createElement(TelaDados, props));
  assert.ok(fechada.includes(TEXTO_DAS_NOVIDADES.slice(0, 40)), "mostra o texto do aceite");
  assert.doesNotMatch(fechada, /id="c-whatsapp"/, "sem a marca, sem o campo");
  assert.doesNotMatch(fechada, /type="checkbox"[^>]*checked/, "nenhuma caixa vem marcada");
  assert.equal((fechada.match(/type="checkbox"/g) ?? []).length, 2, "os Termos e as novidades, duas caixas separadas");
  const aberta = renderToStaticMarkup(createElement(TelaDados, { ...props, novidades: true, whatsapp: "(15) 99712-4410" }));
  assert.match(aberta, /id="c-whatsapp"/);
  assert.match(aberta, /WhatsApp \(opcional\)/);
});
