import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// A Ticketeria usa a Plus Jakarta Sans leve (decisão do dono, 20/11/2026); o resto do Jards fica na Google Sans.
const LAYOUTS = [
  "app/(dashboard)/ingressos/layout.tsx",
  "app/comprar/layout.tsx",
  "app/pedido/layout.tsx",
  "app/termos-de-compra/layout.tsx",
];

test("o painel e as páginas públicas da Ticketeria usam a classe da fonte própria", async () => {
  for (const arquivo of LAYOUTS) {
    const texto = await readFile(arquivo, "utf8");
    assert.match(texto, /CLASSE_FONTE_TICKETERIA/, arquivo);
  }
});

test("a fonte é a Plus Jakarta Sans só com pesos leves, e o CSS mapeia os pesos um degrau abaixo", async () => {
  const fonte = await readFile("lib/ticketeria/fonte.ts", "utf8");
  assert.match(fonte, /Plus_Jakarta_Sans/);
  assert.match(fonte, /weight: \["300", "400", "500"\]/);
  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /\.fonte-ticketeria \.font-normal \{ font-weight: 300; \}/);
  assert.match(css, /\.fonte-ticketeria \.font-medium \{ font-weight: 400; \}/);
  assert.match(css, /\.fonte-ticketeria \.font-semibold \{ font-weight: 500; \}/);
});

test("o menu e o layout geral do app não usam a fonte da Ticketeria", async () => {
  const layout = await readFile("app/layout.tsx", "utf8");
  assert.doesNotMatch(layout, /fonte-ticketeria|Plus_Jakarta/);
});
