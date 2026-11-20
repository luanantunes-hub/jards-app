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

test("\"Criar tag\" é branco e \"Atribuir responsável\" é o roxo noite do app (.acao-principal)", () => {
  assert.match(barra, /const BOTAO = "[^"]*\bbg-white\b/, "o botão comum da barra é branco");
  assert.match(barra, /const BOTAO_PRINCIPAL = "[^"]*\bacao-principal\b[^"]*"/, "a ação principal usa a classe do roxo noite");
  assert.match(barra, /const BOTAO_PRINCIPAL = "[^"]*\btext-white\b/);
  assert.ok(botao("Criar tag").includes("className={BOTAO}"), "Criar tag fica branco");
  assert.ok(botao("Atribuir responsável").includes("className={BOTAO_PRINCIPAL}"), "Atribuir responsável fica no roxo noite");
});
