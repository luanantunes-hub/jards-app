import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ler = (caminho: string) => readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");
const css = ler("app/globals.css");
const sucesso = ler("components/patrocinadores/SucessoDoLote.tsx");
const barra = ler("components/patrocinadores/BarraDeSelecao.tsx");

/** As declarações da regra cujo seletor é exatamente `seletor` (fora de @media). */
function regra(seletor: string): string {
  const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const achado = css.match(new RegExp(`(^|\\n)${escapado}\\s*\\{([^}]*)\\}`));
  assert.ok(achado, `app/globals.css precisa ter a regra ${seletor}`);
  return achado[2];
}

test("o círculo verde sobe do fundo da tela e o check branco se desenha", () => {
  const sobe = css.match(/@keyframes sucesso-sobe\s*\{([\s\S]*?)\n\}/);
  assert.ok(sobe, "app/globals.css precisa ter @keyframes sucesso-sobe");
  assert.match(sobe[1], /0%\s*\{[^}]*translateY\(\d+vh\)/, "começa abaixo da tela");
  assert.match(sobe[1], /100%\s*\{[^}]*translateY\(0\)/, "termina no lugar");
  assert.match(css, /@keyframes sucesso-risca\s*\{\s*to\s*\{\s*stroke-dashoffset:\s*0/, "o traço do check é desenhado");
  assert.match(regra(".sucesso-check"), /stroke-dasharray:\s*1/, "o traço usa pathLength 1");
  assert.ok(sucesso.includes('pathLength={1}'));
  assert.match(sucesso, /bg-\[#2E8932\]/, "círculo no verde do Jards (salvar e confirmar)");
  assert.match(sucesso, /stroke="#FFFFFF"/, "check branco");
});

test("com movimento reduzido nada sobe nem é desenhado", () => {
  const reduzido = css.slice(css.indexOf("/* Sucesso da seleção em lote"));
  const bloco = reduzido.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(bloco, "a animação de sucesso precisa tratar prefers-reduced-motion");
  assert.match(bloco[1], /\.sucesso-circulo\s*\{\s*animation:\s*none/);
  assert.match(bloco[1], /\.sucesso-check\s*\{[^}]*animation:\s*none[^}]*stroke-dashoffset:\s*0/);
  assert.ok(sucesso.includes("prefers-reduced-motion"), "a espera também encurta");
});

test("a tela de sucesso leva para a lista e pode ser pulada", () => {
  assert.ok(sucesso.includes("createPortal"), "fica acima de tudo (barra lateral, menus), fora do cabeçalho da tabela");
  assert.match(sucesso, /Enter/);
  assert.match(sucesso, /Escape/);
  assert.match(sucesso, /onClick=\{concluir\}/, "clicar pula a espera");
  assert.match(sucesso, /role="status"/, "o leitor de tela ouve o que aconteceu");
  assert.ok(barra.includes("router.push(sucesso.href)"), "no fim, a tela troca para a lista filtrada");
});

test("no lugar da tarja verde, o check; a tarja só sobra para quando nada mudou, em âmbar", () => {
  assert.ok(!barra.includes("Ver no CRM"), "a tarja verde com o link saiu");
  assert.ok(!/text-\[#2E8932\]/.test(barra), "nenhum aviso verde na barra");
  assert.match(barra, /aplicouAlgo\(resumo\)/, "só há tela de sucesso quando alguma empresa foi aplicada");
  assert.match(barra, /#B07A14/, "o aviso de nada mudou é âmbar (alerta moderado)");
});
