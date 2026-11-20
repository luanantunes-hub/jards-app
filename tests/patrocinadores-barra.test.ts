import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const barra = readFileSync(new URL("../components/patrocinadores/BarraDeSelecao.tsx", import.meta.url), "utf8");

/** O botão da barra (de `<button` até `</button>`) cujo texto de acessibilidade é o dado. */
function botao(rotulo: string): string {
  const marca = barra.indexOf(`aria-label="${rotulo}" title="${rotulo}"`);
  assert.ok(marca >= 0, `a barra precisa ter o botão "${rotulo}"`);
  return barra.slice(barra.lastIndexOf("<button", marca), barra.indexOf("</button>", marca));
}

test("a barra de seleção tem só o tamanho do que cabe nela, não a largura da tabela", () => {
  const caixa = barra.slice(barra.indexOf('role="toolbar"'), barra.indexOf("{marcando ? ("));
  assert.ok(caixa.includes("w-fit"), "a barra se ajusta ao conteúdo (w-fit)");
  assert.ok(!caixa.includes("inset-x-0") && !caixa.includes("right-0"), "sem esticar de ponta a ponta do cabeçalho");
});

test("a barra de seleção é toda no roxo noite e os dois botões são iguais e vazados", () => {
  const caixa = barra.slice(barra.indexOf('role="toolbar"'), barra.indexOf("{marcando ? ("));
  assert.ok(caixa.includes("bg-[#1C0E33]"), "a barra de seleção é o roxo noite do app");
  assert.match(barra, /const BOTAO = "[^"]*\bborder-white\/30\b[^"]*\btext-white\b/, "botão vazado: borda clara e texto branco");
  assert.ok(!/const BOTAO = "([^"]*\s)?bg-/.test(barra), "o botão não tem preenchimento próprio (só o véu claro do hover)");
  // As duas ações têm o mesmo peso: um branco e um roxo lado a lado sugeriam uma ação principal que não existe.
  assert.ok(botao("Criar tag").includes("className={BOTAO}"));
  assert.ok(botao("Atribuir responsável").includes("className={BOTAO}"), "os dois botões têm o mesmo estilo");
  assert.ok(!barra.includes("acao-principal"), "nenhum botão cheio em roxo dentro da barra");
});
