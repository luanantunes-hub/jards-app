import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const primitivas = readFileSync(new URL("../components/list/ListPagePrimitives.tsx", import.meta.url), "utf8");

/** O código de uma das duas ações, do `export function` até o próximo. */
function acao(nome: "PrimaryListAction" | "SecondaryListAction"): string {
  const inicio = primitivas.indexOf(`export function ${nome}`);
  assert.ok(inicio >= 0, `${nome} precisa existir em ListPagePrimitives.tsx`);
  const proximo = primitivas.indexOf("\nexport function", inicio + 1);
  return primitivas.slice(inicio, proximo < 0 ? undefined : proximo);
}

/**
 * As declarações de todas as regras cuja linha de seletor termina exatamente em `seletor`
 * (a regra própria e a parte comum de uma lista como `::before,\n::after`), sem chaves aninhadas.
 */
function regra(seletor: string): string {
  const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blocos = [...css.matchAll(new RegExp(`(^|\\n)${escapado}\\s*\\{([^}]*)\\}`, "g"))].map((achado) => achado[2]);
  assert.ok(blocos.length > 0, `app/globals.css precisa ter a regra ${seletor}`);
  return blocos.join("\n");
}

/** Os quadros de um @keyframes. */
function quadros(nome: string): string {
  const achado = css.match(new RegExp(`@keyframes ${nome}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(achado, `app/globals.css precisa ter @keyframes ${nome}`);
  return achado[1];
}

test("a ação principal é o roxo noite do hero (#1C0E33), com texto branco, definido no CSS global e não em cada botão", () => {
  assert.match(regra(".acao-principal"), /background-color:\s*#1C0E33/i);
  const botao = acao("PrimaryListAction");
  assert.ok(botao.includes("acao-principal"), "PrimaryListAction usa a classe .acao-principal");
  assert.ok(botao.includes("text-white"));
  assert.ok(!/bg-white|border-black/.test(botao), "o botão principal não é o branco com borda");
});

test("em repouso tem volume discreto: degradê em torno do roxo noite, luz de 1px no topo e sombra curta tingida de roxo noite", () => {
  const base = regra(".acao-principal");
  assert.match(base, /background-image:\s*linear-gradient\(180deg,\s*#28164B 0%,\s*#1C0E33 55%,\s*#160A2A 100%\)/i);
  assert.match(base, /box-shadow:[^;]*inset 0 1px 0 rgba\(255, 255, 255, \.14\)/, "luz no topo");
  assert.match(base, /box-shadow:[^;]*inset 0 -1px 0 rgba\(0, 0, 0, \.3\)/, "sombra na base");
  assert.match(base, /box-shadow:[^;]*0 4px 12px -4px rgba\(28, 14, 51, \.45\)/, "sombra de elevação em roxo noite");
  assert.match(base, /text-shadow:/);
  assert.doesNotMatch(base, /border(-color)?:/, "sem borda");
});

test("o botão fica parado: sem brilho próprio, sem animação e sem subir no hover; só clareia um tom, na hora", () => {
  assert.doesNotMatch(css, /\.acao-principal::(before|after)/, "o brilho não fica mais no botão");
  assert.doesNotMatch(css, /@keyframes acao-brilho/);
  const hover = regra(".acao-principal:hover");
  assert.doesNotMatch(hover, /translate|transform/, "não sobe");
  assert.match(hover, /inset 0 0 0 999px rgba\(142, 99, 245, \.1\)/, "clareia um tom");
  const botao = acao("PrimaryListAction");
  assert.match(botao, /transition-transform/, "só o pressionar tem transição");
  assert.doesNotMatch(botao.replace(/transition-transform/g, ""), /\btransition\b/, "o hover não anima");
});

test("pressionar afunda; desativado fica chapado", () => {
  assert.match(regra(".acao-principal:active"), /inset 0 1px 3px rgba\(0, 0, 0, \.4\)/, "sombra por dentro");
  assert.match(regra(".acao-principal:disabled"), /box-shadow:\s*none/);
});

test("sem contorno em volta: o foco clareia, abre um brilho embaixo e o contorno só aparece no alto contraste", () => {
  const foco = regra(".acao-principal:focus-visible");
  assert.match(foco, /outline:\s*2px solid transparent/);
  assert.match(foco, /inset 0 0 0 999px rgba\(142, 99, 245, \.12\)/);
  assert.match(foco, /0 6px 20px -4px rgba\(142, 99, 245, \.65\)/);
  assert.match(css, /@media \(forced-colors: active\)\s*\{\s*\.acao-principal:focus-visible\s*\{\s*outline-color:\s*Highlight/);
  assert.ok(!/focus-visible:outline/.test(acao("PrimaryListAction")), "o botão principal não leva anel de foco por classe");
});

test("o brilho vai para a folha: faixa fixa no topo, por cima dela, sem pegar clique, uma passada só", () => {
  const faixa = regra(".brilho-da-folha");
  assert.match(faixa, /position:\s*fixed/);
  assert.match(faixa, /top:\s*0/);
  assert.match(faixa, /z-index:\s*60/, "acima das folhas (z-50)");
  assert.match(faixa, /pointer-events:\s*none/);
  assert.match(regra(".brilho-da-folha::after"), /animation:\s*brilho-da-folha-passa 900ms cubic-bezier\(\.32, \.72, 0, 1\) 160ms both/, "mesma curva da folha, depois da descida");
  const corpo = quadros("brilho-da-folha-passa");
  assert.match(corpo, /(^|\n)\s*0%\s*\{[^}]*opacity:\s*0;/, "começa apagada");
  assert.match(corpo, /(^|\n)\s*100%\s*\{[^}]*opacity:\s*0;/, "termina apagada");
  assert.match(corpo, /translateX/, "passa de um lado ao outro");
  assert.doesNotMatch(corpo, /\b(top|left|right|bottom|width|height|margin|padding)\s*:/, "não anima propriedade de layout");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.brilho-da-folha\s*\{\s*display:\s*none;?\s*\}\s*\}/);
});

test("o clique do botão principal acha a folha que abriu e acende a faixa na largura dela", () => {
  const botao = acao("PrimaryListAction");
  for (const trecho of ["createPortal", "brilho-da-folha", "folhaQueDesceuDoTopo", '[role="dialog"]', "getBoundingClientRect", "DURACAO_DO_BRILHO_MS"]) {
    assert.ok(botao.includes(trecho), `PrimaryListAction precisa de ${trecho}`);
  }
});

test("a ação de apoio continua branca, com borda leve e hover animado", () => {
  const apoio = acao("SecondaryListAction");
  assert.ok(apoio.includes("bg-white") && apoio.includes("border-black/12"));
  assert.match(apoio, /\btransition\b/);
});
