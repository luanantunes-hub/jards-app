import assert from "node:assert/strict";
import test from "node:test";
import { correspondeRota, hrefAtivoDoMenu, itemAtivoDoMenu, tituloDaPagina } from "../lib/navigation/rotas";

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
  assert.equal(tituloDaPagina("/producoes"), "Produção — Jards");
  assert.equal(tituloDaPagina("/producoes/datas/1"), "Produção — Jards");
  assert.equal(tituloDaPagina("/inexistente"), "Jards");
});

test("prefixo não casa com rota de nome parecido", () => {
  assert.equal(correspondeRota("/projetos-antigos", "/projetos"), false);
  assert.equal(correspondeRota("/projetos/1", "/projetos"), true);
});

test("contratos, entregas e ativações destacam Clientes no menu", () => {
  assert.equal(itemAtivoDoMenu("/contratos/abc"), "/contas-patrocinio");
  assert.equal(itemAtivoDoMenu("/entregas/abc"), "/contas-patrocinio");
  assert.equal(itemAtivoDoMenu("/producoes/pedidos/abc"), "/producoes/temporadas", "o pedido nasce de uma temporada: o menu acende Temporadas");
  assert.equal(itemAtivoDoMenu("/producoes/faturas/abc"), "/producoes/temporadas", "a fatura nasce de uma temporada: o menu acende Temporadas");
  assert.equal(itemAtivoDoMenu("/producoes/acordos/abc"), "/producoes/temporadas", "o acordo nasce de uma temporada: o menu acende Temporadas");
  assert.equal(itemAtivoDoMenu("/producoes/adiantamentos/abc"), "/producoes/temporadas", "o adiantamento nasce de uma temporada: o menu acende Temporadas");
  for (const tela of ["convidados", "acessibilidade", "porta", "bordero"]) assert.equal(itemAtivoDoMenu(`/producoes/${tela}`), "/producoes/plateia", `${tela} é aba da sessão: o menu acende Sessão`);
  assert.equal(itemAtivoDoMenu("/ativacoes/abc"), "/contas-patrocinio");
  assert.equal(itemAtivoDoMenu("/captacoes/abc"), "/captacoes/abc");
});

test("rotas da prestação usam o título do módulo", () => {
  assert.equal(tituloDaPagina("/prestacoes"), "Prestações — Jards");
  assert.equal(tituloDaPagina("/prestacoes/abc/comprovantes"), "Prestações — Jards");
});

test("fornecedores: título próprio e só o item mais específico fica ativo", () => {
  assert.equal(tituloDaPagina("/prestacoes/fornecedores"), "Fornecedores — Jards");
  const hrefs = ["/prestacoes", "/prestacoes/fornecedores"];
  assert.equal(hrefAtivoDoMenu("/prestacoes/fornecedores", hrefs), "/prestacoes/fornecedores");
  assert.equal(hrefAtivoDoMenu("/prestacoes/abc/extrato", hrefs), "/prestacoes");
  assert.equal(hrefAtivoDoMenu("/dashboard", hrefs), null);
});
