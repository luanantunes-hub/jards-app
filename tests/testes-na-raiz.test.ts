import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import test from "node:test";

// O `npm test` é `tsx --test tests/**/*.test.ts`, sem aspas, e quem expande o padrão é o shell. O `sh` do CI trata
// `**` como `*`: com um teste numa subpasta de tests/, o padrão vira só o caminho dele (tests/pasta/arquivo.test.ts),
// e todos os testes da raiz de tests/ deixam de rodar, sem aviso e com o CI verde. Sem nenhum teste em subpasta, o
// padrão chega intacto ao `tsx --test`, que o percorre inteiro. Por isso os testes ficam na raiz de tests/, e o que
// os testes compartilham (tests/_helpers/, tests/fixtures/) não termina em `.test.ts`.

const TESTE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

async function arquivosDeTests(): Promise<string[]> {
  return (await readdir("tests", { recursive: true })).map(caminho => caminho.split("\\").join("/"));
}

test("nenhum *.test.ts fica em subpasta de tests/: o npm test deixaria de rodar os da raiz", async () => {
  const emSubpasta = (await arquivosDeTests()).filter(caminho => caminho.includes("/") && TESTE.test(caminho));
  assert.deepEqual(emSubpasta, [], "mova para a raiz de tests/ (o que for de apoio fica em tests/_helpers/, sem terminar em .test.ts)");
});

test("todo arquivo de teste da raiz de tests/ termina em .test.ts, o que o npm test acha", async () => {
  const noRaiz = (await arquivosDeTests()).filter(caminho => !caminho.includes("/") && TESTE.test(caminho));
  assert.ok(noRaiz.length > 100, "o leitor não achou os testes");
  assert.deepEqual(noRaiz.filter(caminho => !caminho.endsWith(".test.ts")), [], "o glob do npm test só acha *.test.ts");
});
