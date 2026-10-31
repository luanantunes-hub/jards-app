import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { tituloDaPagina } from "../lib/navigation/rotas";

// Os protótipos da produção (/producoes/prototipo) são telas de exemplo: não leem nem gravam nada no
// banco, só o suporte (super admin) os abre, e cada um da lista tem a sua página. Quando a tela de
// verdade chega, o protótipo dela sai da lista e da pasta.

const PASTA = "app/(dashboard)/producoes/prototipo";
const ARQUIVOS_DE_TELA = ["components/producao/prototipo/Prototipo.tsx", "lib/producao/prototipo/dados.ts"];

async function paginas(): Promise<string[]> {
  const itens = await readdir(PASTA, { withFileTypes: true });
  return itens.filter(item => item.isDirectory()).map(item => item.name).sort();
}

test("nenhuma tela do protótipo lê nem grava no banco ou na rede", async () => {
  const arquivos = [`${PASTA}/page.tsx`, ...(await paginas()).map(nome => `${PASTA}/${nome}/page.tsx`), ...ARQUIVOS_DE_TELA];
  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    assert.doesNotMatch(texto, /@\/lib\/supabase|clienteDaProducao|createClient|fetch\(|\/api\//, `${arquivo} fala com o banco ou com a rede`);
  }
});

test("só o super admin entra: o layout do servidor confere e manda os outros para a agenda", async () => {
  const layout = await readFile(`${PASTA}/layout.tsx`, "utf8");
  assert.match(layout, /if \(!user\) redirect\("\/login\?next=\/producoes\/prototipo"\);/);
  assert.match(layout, /if \(!acesso\.superAdmin\) redirect\("\/producoes"\);/);
  // O layout só lê quem está logado e o acesso: não lê nem grava dado da produção.
  assert.doesNotMatch(layout, /\.from\(|\.rpc\(/);
  const menu = await readFile("app/(dashboard)/layout.tsx", "utf8");
  assert.match(menu, /const ROTAS_SO_SUPER_ADMIN = \[[^\]]*"\/producoes\/prototipo"[^\]]*\];/, "o item do menu é só do super admin");
  assert.match(menu, /\{ label: "Protótipos", href: "\/producoes\/prototipo", icon: \w+ \}/);
});

test("cada protótipo da lista tem a sua página, e cada página está na lista", async () => {
  const lista = await readFile("components/producao/prototipo/Prototipo.tsx", "utf8");
  const hrefs = [...lista.matchAll(/href: "\/producoes\/prototipo\/([\w-]+)"/g)].map(m => m[1]).sort();
  assert.deepEqual(hrefs, await paginas());
  for (const nome of hrefs) {
    const pagina = await readFile(`${PASTA}/${nome}/page.tsx`, "utf8");
    assert.match(pagina, new RegExp(`<FaixaDoPrototipo href="/producoes/prototipo/${nome}" />`), `${nome}: sem a faixa de protótipo`);
  }
});

test("o título da aba diz que é protótipo", () => {
  assert.equal(tituloDaPagina("/producoes/prototipo"), tituloDaPagina("/producoes/prototipo/data"));
  assert.notEqual(tituloDaPagina("/producoes/prototipo/data"), tituloDaPagina("/producoes/temporadas"));
  assert.match(tituloDaPagina("/producoes/prototipo/orcamento"), /Protótipos/);
});
