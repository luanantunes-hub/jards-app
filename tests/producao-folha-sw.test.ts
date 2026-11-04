import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// O service worker da folha sem internet (PD1.13) guarda só a casca: nunca resposta do banco, de /api nem escrita.

test("o service worker só guarda a página Minha folha e os arquivos estáticos, só por GET e só da própria origem", async () => {
  const sw = await readFile("public/folha-sw.js", "utf8");
  assert.match(sw, /if \(pedido\.method !== "GET"\) return;/, "escrita nunca passa por ele");
  assert.match(sw, /if \(url\.origin !== self\.location\.origin\) return;/, "o banco é de outra origem e não é guardado");
  assert.match(sw, /const PAGINA = "\/minha-folha";/);
  assert.match(sw, /url\.pathname === PAGINA/);
  assert.match(sw, /url\.pathname\.startsWith\("\/_next\/static\/"\)/);
  // Nada além dessas duas rotas é respondido por ele.
  assert.equal([...sw.matchAll(/respondWith\(/g)].length, 2);
  assert.doesNotMatch(sw.replace(/\/\/.*$/gm, ""), /\/api|rest\/v1|supabase/i, "no código (fora dos comentários) nada de banco nem de API");
});

test("a página registra o service worker só no escopo dela, e o proxy o deixa passar sem login", async () => {
  const pagina = await readFile("app/minha-folha/page.tsx", "utf8");
  assert.match(pagina, /register\("\/folha-sw\.js", \{ scope: "\/minha-folha" \}\)/);
  const proxy = await readFile("proxy.ts", "utf8");
  assert.match(proxy, /folha-sw\\\\\.js\$/);
});
