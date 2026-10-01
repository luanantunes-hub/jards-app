import assert from "node:assert/strict";
import test from "node:test";
import { correspondeRota, itemAtivoDoMenu, tituloDaPagina } from "../lib/navigation/rotas";

test("título da aba usa o nome da seção do menu", () => {
  assert.equal(tituloDaPagina("/captacoes"), "Negociações — Jards");
  assert.equal(tituloDaPagina("/captacoes/123"), "Negociações — Jards");
  assert.equal(tituloDaPagina("/contas-patrocinio"), "Clientes — Jards");
  assert.equal(tituloDaPagina("/dashboard"), "Visão geral — Jards");
});

test("o prefixo mais específico vence", () => {
  assert.equal(tituloDaPagina("/configuracoes/mcp"), "Claude e ChatGPT (MCP) — Jards");
  assert.equal(tituloDaPagina("/configuracoes"), "Configurações — Jards");
});

test("rota desconhecida cai no nome do produto", () => {
  assert.equal(tituloDaPagina("/inexistente"), "Jards");
});

test("prefixo não casa com rota de nome parecido", () => {
  assert.equal(correspondeRota("/projetos-antigos", "/projetos"), false);
  assert.equal(correspondeRota("/projetos/1", "/projetos"), true);
});

test("contratos, entregas e ativações destacam Clientes no menu", () => {
  assert.equal(itemAtivoDoMenu("/contratos/abc"), "/contas-patrocinio");
  assert.equal(itemAtivoDoMenu("/entregas/abc"), "/contas-patrocinio");
  assert.equal(itemAtivoDoMenu("/ativacoes/abc"), "/contas-patrocinio");
  assert.equal(itemAtivoDoMenu("/captacoes/abc"), "/captacoes/abc");
});
