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
  assert.ok(!/bg-white|border-black/.test(botao), "o botão principal não é mais o branco com borda");
});

test("o brilho é uma animação só: roda uma vez, nasce e termina apagado, e o botão fica liso", () => {
  assert.match(regra(".acao-principal::before,\n.acao-principal::after"), /opacity:\s*0;/, "em repouso as luzes estão apagadas");
  const luzA = regra(".acao-principal::before");
  const luzB = regra(".acao-principal::after");
  assert.match(luzA, /animation:\s*acao-brilho-a\s+5s\s+ease-in-out\s+both;/);
  assert.match(luzB, /animation:\s*acao-brilho-b\s+6\.5s\s+ease-in-out\s+\.3s\s+both;/);
  assert.doesNotMatch(luzA + luzB, /infinite/, "não repete");
  for (const nome of ["acao-brilho-a", "acao-brilho-b"]) {
    const corpo = quadros(nome);
    assert.match(corpo, /(^|\n)\s*0%\s*\{[^}]*opacity:\s*0;/, `${nome} começa apagada`);
    assert.match(corpo, /(^|\n)\s*100%\s*\{[^}]*opacity:\s*0;/, `${nome} termina apagada`);
    assert.match(corpo, /transform:/, `${nome} anda com transform`);
    assert.doesNotMatch(corpo, /\b(top|left|right|bottom|width|height|margin|padding)\s*:/, `${nome} não anima propriedade de layout`);
  }
});

test("quem pede menos movimento recebe o botão liso, sem animação", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.acao-principal::before,\s*\.acao-principal::after\s*\{\s*animation:\s*none;?\s*\}\s*\}/);
});

test("sem contorno em volta: hover e foco clareiam o fundo, o foco abre um brilho e o contorno só aparece no alto contraste", () => {
  assert.match(regra(".acao-principal:hover"), /background-color:\s*#2D1A53/i);
  const foco = regra(".acao-principal:focus-visible");
  assert.match(foco, /outline:\s*2px solid transparent/);
  assert.match(foco, /background-color:\s*#2D1A53/i);
  assert.match(foco, /box-shadow:/);
  assert.match(css, /@media \(forced-colors: active\)\s*\{\s*\.acao-principal:focus-visible\s*\{\s*outline-color:\s*Highlight/);
  assert.ok(!/focus-visible:outline/.test(acao("PrimaryListAction")), "o botão principal não leva anel de foco por classe");
  assert.match(regra(".acao-principal:disabled"), /background-color:\s*#1C0E33/i, "desativado não clareia");
});

test("a ação de apoio continua branca, com borda leve", () => {
  const apoio = acao("SecondaryListAction");
  assert.ok(apoio.includes("bg-white") && apoio.includes("border-black/12"));
});
