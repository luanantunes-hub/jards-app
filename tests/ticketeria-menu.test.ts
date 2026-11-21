import test from "node:test";
import assert from "node:assert/strict";
import { GRUPOS_DE_ABAS, abasDaRota } from "../lib/ticketeria/menu";
import { hrefAtivoDoMenu, itemAtivoDoMenu, tituloDaPagina } from "../lib/navigation/rotas";

const MENU = ["/ingressos", "/ingressos/eventos", "/ingressos/vendas", "/ingressos/recebimentos", "/ingressos/divulgacao", "/ingressos/integracoes"];
const acende = (path: string) => hrefAtivoDoMenu(itemAtivoDoMenu(path), MENU);

test("cada página da Ticketeria acende um dos seis itens do menu", () => {
  const esperado: Record<string, string> = {
    "/ingressos": "/ingressos",
    "/ingressos/eventos": "/ingressos/eventos", "/ingressos/eventos/abc": "/ingressos/eventos",
    "/ingressos/vendas": "/ingressos/vendas", "/ingressos/site": "/ingressos/vendas", "/ingressos/porta": "/ingressos/vendas", "/ingressos/porta/relatorio": "/ingressos/vendas", "/ingressos/bilheteria": "/ingressos/vendas",
    "/ingressos/recebimentos": "/ingressos/recebimentos",
    "/ingressos/divulgacao": "/ingressos/divulgacao", "/ingressos/cupons": "/ingressos/divulgacao", "/ingressos/espera": "/ingressos/divulgacao", "/ingressos/publico": "/ingressos/divulgacao",
    "/ingressos/integracoes": "/ingressos/integracoes", "/ingressos/locais": "/ingressos/integracoes",
  };
  for (const [rota, item] of Object.entries(esperado)) assert.equal(acende(rota), item, rota);
});

test("as abas aparecem só nas páginas agrupadas e acendem a aba certa", () => {
  assert.equal(abasDaRota("/ingressos"), null);
  assert.equal(abasDaRota("/ingressos/eventos/abc"), null);
  assert.equal(abasDaRota("/ingressos/recebimentos"), null);
  assert.equal(abasDaRota("/ingressos/comecar"), null);
  assert.equal(abasDaRota("/ingressos/porta/relatorio")?.ativa.rotulo, "Controle de entrada");
  assert.equal(abasDaRota("/ingressos/publico")?.grupo.id, "divulgacao");
  assert.equal(abasDaRota("/ingressos/locais")?.ativa.rotulo, "Espaços");
  assert.equal(abasDaRota("/ingressos/vendas")?.grupo.abas.length, 4);
  assert.equal(abasDaRota("/ingressos/site")?.grupo.id, "vendas", "a loja online é uma aba de Vendas");
  assert.equal(abasDaRota("/ingressos/site")?.ativa.rotulo, "Loja online");
});

test("a primeira aba de cada grupo é o href do item do menu", () => {
  const primeiras = GRUPOS_DE_ABAS.map(g => g.abas[0].href);
  for (const href of primeiras) assert.ok(MENU.includes(href), href);
});

test("os títulos das abas usam os nomes novos", () => {
  assert.equal(tituloDaPagina("/ingressos/eventos"), "Programação — Jards");
  assert.equal(tituloDaPagina("/ingressos/recebimentos"), "Financeiro — Jards");
  assert.equal(tituloDaPagina("/ingressos/locais"), "Espaços — Jards");
  assert.equal(tituloDaPagina("/ingressos"), "Início — Jards");
});
