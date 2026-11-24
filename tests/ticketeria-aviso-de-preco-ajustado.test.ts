import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrecoDoIngresso } from "@/components/ticketeria/CompraView";

// O ⓘ do preço ajustado pela demanda (P2c): aparece só quando o preço está ajustado, sem etapa nova para quem compra.

const html = (props: { centavos: number; ajustado?: boolean }) => renderToStaticMarkup(createElement(PrecoDoIngresso, props));

test("no preço-base não aparece nada além do preço", () => {
  const h = html({ centavos: 6000 });
  assert.match(h, /R\$\s?60,00/);
  assert.doesNotMatch(h, /ⓘ|varia conforme a procura|<details/);
});

test("com o preço ajustado, o ⓘ fica ao lado do preço e a explicação abre ao toque", () => {
  const h = html({ centavos: 6600, ajustado: true });
  assert.match(h, /<details/);
  assert.match(h, /R\$\s?66,00/);
  assert.match(h, /ⓘ/);
  assert.match(h, /O preço deste ingresso varia conforme a procura/);
  assert.match(h, /fica garantido durante a sua compra/);
  assert.doesNotMatch(h, /<input|<button/, "sem caixa para marcar nem botão: nenhuma ação obrigatória");
});

test("o gratuito nunca leva o ⓘ", () => {
  assert.doesNotMatch(html({ centavos: 0, ajustado: true }), /ⓘ/);
});
