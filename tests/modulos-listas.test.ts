import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import test from "node:test";

// A lista de módulos mora em lib/modulos.ts (MODULOS). Lista escrita à mão em
// outro arquivo fica para trás quando entra um módulo novo, como a produção.
// As que existiam (convite e equipe) saíram na PD0.5: hoje não há exceção, e
// uma nova só entra aqui com a entrega do plano que a troca.
const JA_EXISTENTES: Record<string, number> = {};

const PASTAS = ["app", "components", "lib", "hooks", "contexts", "supabase/functions", "mcp-server/src"];
const ARQUIVOS_DA_RAIZ = ["proxy.ts"];
const MODULO = `["'\`](?:captacao|prestacao|producao)["'\`]`;
/** Um array numa linha só com dois ou mais ids de módulo, em qualquer ordem. */
const LISTA_LITERAL = new RegExp(`\\[[^\\]\\n]*${MODULO}[^\\]\\n]*${MODULO}[^\\]\\n]*\\]`, "g");
/** As fases do projeto (planejamento, captação, execução, prestação) não são módulos. */
const FASES_DO_PROJETO = /planejamento|execucao|concluido/;

async function arquivos(pasta: string): Promise<string[]> {
  const entradas = await readdir(pasta, { withFileTypes: true }).catch(() => []);
  const lista: string[] = [];
  for (const entrada of entradas) {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) lista.push(...await arquivos(caminho));
    else if (/\.(ts|tsx)$/.test(entrada.name)) lista.push(caminho);
  }
  return lista;
}

/** Caminho com "/" em qualquer sistema. */
function relativo(caminho: string): string {
  return caminho.split(sep).join("/");
}

test("nenhuma lista nova de módulos escrita à mão fora de lib/modulos.ts", async () => {
  const todos = [...ARQUIVOS_DA_RAIZ];
  for (const pasta of PASTAS) todos.push(...await arquivos(pasta));
  const encontradas: Record<string, number> = {};
  for (const arquivo of todos) {
    const caminho = relativo(arquivo);
    if (caminho === "lib/modulos.ts") continue;
    const texto = await readFile(arquivo, "utf8").catch(() => "");
    const quantas = (texto.match(LISTA_LITERAL) ?? []).filter(lista => !FASES_DO_PROJETO.test(lista)).length;
    if (quantas > 0) encontradas[caminho] = quantas;
  }
  assert.deepEqual(encontradas, JA_EXISTENTES);
});

test("a busca pega listas em qualquer ordem e ignora as fases do projeto", () => {
  const pega = (texto: string) => (texto.match(LISTA_LITERAL) ?? []).filter(lista => !FASES_DO_PROJETO.test(lista)).length;
  assert.equal(pega(`(["captacao", "producao"] as ModuloId[])`), 1);
  assert.equal(pega(`["prestacao", "captacao"]`), 1);
  assert.equal(pega("[`producao`, 'prestacao']"), 1);
  assert.equal(pega(`["planejamento", "captacao", "execucao", "prestacao", "concluido"]`), 0);
  assert.equal(pega(`["captacao"]`), 0);
});

test("os testes ficam na raiz de tests/, onde o npm test os encontra", async () => {
  const entradas = await readdir("tests", { withFileTypes: true });
  const pastas = entradas.filter(e => e.isDirectory()).map(e => e.name);
  for (const pasta of pastas) {
    const dentro = await arquivos(join("tests", pasta));
    assert.deepEqual(dentro.filter(a => a.endsWith(".test.ts")), [], `teste em subpasta: ${pasta}`);
  }
});
