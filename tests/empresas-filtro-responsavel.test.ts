import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FiltroResponsavel } from "../components/list/FiltroResponsavel";

const pagina = readFileSync(new URL("../app/(dashboard)/empresas-crm/page.tsx", import.meta.url), "utf8");

const eu = { id: "eu", nome: "Luan" };
const ana = { id: "ana", nome: "Ana" };
const html = (props: Partial<Parameters<typeof FiltroResponsavel>[0]>) =>
  renderToStaticMarkup(createElement(FiltroResponsavel, { membros: [eu], meuId: "eu", value: "todos", onChange: () => {}, ...props }));

test("o filtro de responsável some em organização de uma pessoa só, a não ser que a lista peça `sempre`", () => {
  assert.equal(html({}), "", "uma pessoa só: sem filtro (padrão das outras listas)");
  assert.ok(html({ sempre: true }).includes("<select"), "com `sempre`, aparece mesmo com uma pessoa só");
  assert.ok(html({ membros: [eu, ana] }).includes("<select"), "com equipe, aparece como sempre");
});

test("com `sempre`, espera a equipe carregar para não mostrar o filtro pela metade", () => {
  assert.equal(html({ membros: [], sempre: true }), "");
});

test("o texto de \"sem filtro\" pode ser trocado, e \"Só os meus\" e \"Sem responsável\" continuam", () => {
  const marcado = html({ sempre: true, rotuloDeTodos: "Todos os responsáveis" });
  assert.ok(marcado.includes("Todos os responsáveis"));
  assert.ok(marcado.includes("Só os meus"));
  assert.ok(marcado.includes("Sem responsável"));
  assert.ok(html({ sempre: true }).includes("Toda a equipe"), "o padrão não muda para as outras listas");
});

test("a lista de Empresas sempre mostra o filtro de responsável e abre em lista quando chega filtrada", () => {
  assert.match(pagina, /<FiltroResponsavel[^>]*\bsempre\b[^>]*rotuloDeTodos="Todos os responsáveis"/);
  assert.match(pagina, /endereco\.has\("tag"\) \|\| endereco\.has\("responsavel"\)/, "?tag= e ?responsavel= abrem a lista");
  assert.match(pagina, /const modo: ViewMode = chegouComFiltro \? "lista" : viewMode/, "sem apagar a preferência guardada");
  assert.match(pagina, /setSearch\(""\); setTipoFilter\("todos"\); setTagFilter\("todas"\); responsavel\.setFiltro\("todos"\)/, "limpar filtros limpa a tag também");
});
