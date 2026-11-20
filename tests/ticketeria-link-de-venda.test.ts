import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LinkDeVenda, enderecoDeVenda } from "../components/ticketeria/LinkDeVenda";

const SESSAO = "0d760000-0000-4000-8000-000000000081";

test("o endereço de venda: a origem sem barra no fim, /comprar/ e o id da sessão", () => {
  assert.equal(enderecoDeVenda("https://jards.com.br", SESSAO), `https://jards.com.br/comprar/${SESSAO}`);
  assert.equal(enderecoDeVenda("https://jards.com.br/", SESSAO), `https://jards.com.br/comprar/${SESSAO}`);
  assert.equal(enderecoDeVenda("http://localhost:3000", SESSAO), `http://localhost:3000/comprar/${SESSAO}`);
});

test("o link: botão de copiar e o ícone que abre a página em outra aba, com o endereço certo", () => {
  const h = renderToStaticMarkup(createElement(LinkDeVenda, { sessaoId: SESSAO, origem: "https://jards.com.br" }));
  assert.match(h, /Copiar link de venda/);
  assert.ok(h.includes(`href="https://jards.com.br/comprar/${SESSAO}"`));
  assert.match(h, /target="_blank" rel="noopener noreferrer"/);
  assert.match(h, /aria-label="Abrir a página de venda em outra aba"/);
  assert.doesNotMatch(h, /Link copiado/);
});

test("depois de copiar, o botão avisa", () => {
  const h = renderToStaticMarkup(createElement(LinkDeVenda, { sessaoId: SESSAO, origem: "https://jards.com.br", copiadoDeInicio: true }));
  assert.match(h, /Link copiado/);
  assert.doesNotMatch(h, /Copiar link de venda/);
});

test("sem a origem (no servidor), o link de abrir é relativo ao próprio endereço do Jards", () => {
  assert.ok(renderToStaticMarkup(createElement(LinkDeVenda, { sessaoId: SESSAO })).includes(`href="/comprar/${SESSAO}"`));
});
