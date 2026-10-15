import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

// A lista de módulos mora em lib/modulos.ts (MODULOS). Lista escrita à mão em
// outro arquivo fica para trás quando entra um módulo novo, como a produção.
// As que já existiam estão abaixo, com a entrega do plano da produção que as troca.
const JA_EXISTENTES: Record<string, number> = {
  "app/(dashboard)/configuracoes/page.tsx": 1, // PD0.5
  "components/modals/NovoMembroModal.tsx": 2, // PD0.5
};

const PASTAS = ["app", "components", "lib", "hooks", "contexts", "supabase/functions"];
const LISTA_LITERAL = /\[\s*["']captacao["']\s*,\s*["']prestacao["']/g;

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

test("nenhuma lista nova de módulos escrita à mão fora de lib/modulos.ts", async () => {
  const encontradas: Record<string, number> = {};
  for (const pasta of PASTAS) {
    for (const arquivo of await arquivos(pasta)) {
      if (arquivo === join("lib", "modulos.ts")) continue;
      const quantas = (await readFile(arquivo, "utf8")).match(LISTA_LITERAL)?.length ?? 0;
      if (quantas > 0) encontradas[arquivo] = quantas;
    }
  }
  assert.deepEqual(encontradas, JA_EXISTENTES);
});

test("os testes ficam na raiz de tests/, onde o npm test os encontra", async () => {
  const entradas = await readdir("tests", { withFileTypes: true });
  const pastas = entradas.filter(e => e.isDirectory()).map(e => e.name);
  for (const pasta of pastas) {
    const dentro = await arquivos(join("tests", pasta));
    assert.deepEqual(dentro.filter(a => a.endsWith(".test.ts")), [], `teste em subpasta: ${pasta}`);
  }
});
