import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const css = readFileSync(join(RAIZ, "app/globals.css"), "utf8");

/** A parte logada do app: painel, admin e componentes. */
const INTERNO = /^(app\/\(dashboard\)\/|app\/admin\/|components\/)/;
/** Páginas públicas, por link: ficam fora, como no teste do roxo noite. */
const FORA_DO_APP = /^(app\/(acerto|convite|enviar|nova-senha|redefinir-senha|alterar-senha|p\/|palco|presenca|embed|publicacoes|blog|login|cadastro|dominio|voluntario|credencial|convidar|visita|programacao|hospedagem|ficha|tabela|r\/)|components\/site\/|components\/producao\/(ProgramacaoPublicaView|PalcoAoVivo)\.tsx|components\/ticketeria\/SiteView\.tsx)/;

function arquivos(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) return item.name === "node_modules" ? [] : arquivos(caminho);
    return /\.tsx$/.test(item.name) ? [caminho] : [];
  });
}

/** O conteúdo `{ ... }` das regras com exatamente esse seletor (sem chaves aninhadas). */
function regra(seletor: string): string {
  const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blocos = [...css.matchAll(new RegExp(`(^|\\n)${escapado}\\s*\\{([^}]*)\\}`, "g"))].map((achado) => achado[2]);
  assert.ok(blocos.length > 0, `app/globals.css precisa ter a regra ${seletor}`);
  return blocos.join("\n");
}

test("a classe de salvar tem volume discreto: degradê em torno do verde, luz no topo e sombra curta verde", () => {
  const base = regra(".acao-salvar");
  assert.match(base, /background-color:\s*#2E8932/i);
  assert.match(base, /linear-gradient\(180deg,\s*#399C3E 0%,\s*#2E8932 55%,\s*#26752A 100%\)/i);
  assert.match(base, /inset 0 1px 0 rgba\(255, 255, 255, \.22\)/, "luz no topo");
  assert.match(base, /0 4px 12px -4px rgba\(24, 80, 28, \.42\)/, "sombra de elevação em verde");
  assert.doesNotMatch(base, /animation|transition|translate/, "sem animação nem movimento");
});

test("sem efeito no hover; pressionar afunda e desativado fica chapado", () => {
  assert.doesNotMatch(css, /\.acao-salvar:hover/, "o botão fica igual com ou sem o mouse em cima");
  assert.match(regra(".acao-salvar:active"), /inset 0 1px 3px rgba\(0, 0, 0, \.3\)/);
  assert.match(regra(".acao-salvar:disabled"), /box-shadow:\s*none/);
});

test("na parte logada, o botão verde de salvar usa .acao-salvar e não o par bg-[#2E8932] + hover:bg-[#26752A] à mão", () => {
  const achados: string[] = [];
  for (const caminho of [...arquivos(join(RAIZ, "app")), ...arquivos(join(RAIZ, "components"))]) {
    const rel = relative(RAIZ, caminho).split("\\").join("/");
    if (!INTERNO.test(rel) || FORA_DO_APP.test(rel)) continue;
    readFileSync(caminho, "utf8").split("\n").forEach((linha, indice) => {
      if (linha.includes("hover:bg-[#26752A]")) achados.push(`${rel}:${indice + 1}`);
    });
  }
  assert.deepEqual(achados, [], "use a classe acao-salvar (ver DESIGN.md)");
});
