import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { dividirComandos, emBlocoDesfeito } from "../lib/supabase/sql-em-bloco";

// Os testes de acesso rodam no banco (supabase/tests/README.md). Estes
// conferem, sem banco, que eles continuam cobrindo a prestação inteira.

const TESTE_RLS = "supabase/tests/prestacao_rls.test.sql";

async function migrations(): Promise<string> {
  const nomes = (await readdir("supabase/migrations")).filter(n => n.endsWith(".sql")).sort();
  return (await Promise.all(nomes.map(n => readFile(`supabase/migrations/${n}`, "utf8")))).join("\n");
}

test("toda tabela da prestação tem sonda no teste de acesso", async () => {
  const tabelas = new Set([...(await migrations()).matchAll(/create table if not exists public\.(prestac[a-z_]+)/g)].map(m => m[1]));
  // O catálogo de regimes não pertence a uma prestação: o teste confere à parte quem lê.
  tabelas.delete("prestacao_regimes");
  const teste = await readFile(TESTE_RLS, "utf8");
  const lista = /function rls_teste\.todas\(\)[\s\S]*?array\[([\s\S]*?)\]/.exec(teste)?.[1] ?? "";
  const cobertas = new Set([...lista.matchAll(/'(prestac[a-z_]+)'/g)].map(m => m[1]));
  for (const tabela of tabelas) assert.ok(cobertas.has(tabela), `${tabela} sem sonda em ${TESTE_RLS}`);
  assert.match(teste, /prestacao_regimes/, "o catálogo de regimes também precisa de caso");
});

test("o plano do teste de acesso bate com as verificações e tudo é desfeito", async () => {
  const teste = await readFile(TESTE_RLS, "utf8");
  const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
  const verificacoes = teste.match(/^select (is|isnt|ok|throws_ok|lives_ok)\(/gm)?.length ?? 0;
  assert.equal(verificacoes, plano);
  const comandos = dividirComandos(teste);
  assert.equal(comandos[0], "begin");
  assert.equal(comandos.at(-1), "rollback");
});

test("arquivo da prestação: escrever no bucket pede o papel de quem edita", async () => {
  const sql = [
    await readFile("supabase/migrations/20261006130000_prestacao_arquivos_por_papel.sql", "utf8"),
    await readFile("supabase/migrations/20261006130100_prestacao_arquivos_por_papel_exclusao.sql", "utf8"),
  ].join("\n");
  const codigo = sql.replace(/--.*$/gm, "");
  assert.match(codigo, /security definer/);
  assert.match(codigo, /public\.auth_prestacao_pode\(p_prestacao::uuid, 'editar'\)/);
  assert.match(codigo, /p\.organization_id = p_org::uuid/, "a prestação tem de ser da organização da pasta");
  assert.match(codigo, /revoke execute on function public\.auth_prestacao_arquivo_editavel\(text, text\) from public, anon/);
  for (const regra of ["upload", "update", "delete"]) {
    assert.match(codigo, new RegExp(`'documentos: ${regra} org', escrita`), `regra "${regra}" sem o papel`);
  }
  assert.doesNotMatch(codigo, /'documentos: read org'/, "ler continua como estava");
  assert.doesNotMatch(codigo, /\bdrop\b/i, "sem DROP: o conector trava em comandos destrutivos");
});

test("dividirComandos separa no ; de fora de textos, blocos e comentários", () => {
  const sql = [
    "begin;",
    "-- comentário; com ponto e vírgula",
    "do $x$ begin perform 1; end $x$;",
    "select 'a;b', \"c;d\" /* e; */ from t;",
    "create function f() returns int language sql as $$ select 1; $$;",
    "rollback",
  ].join("\n");
  assert.deepEqual(dividirComandos(sql), [
    "begin",
    "do $x$ begin perform 1; end $x$",
    "select 'a;b', \"c;d\"   from t",
    "create function f() returns int language sql as $$ select 1; $$",
    "rollback",
  ]);
  assert.throws(() => dividirComandos("select 'aberto;"), /sem fechamento/);
});

test("emBlocoDesfeito junta os arquivos, tira a transação e termina em erro", () => {
  const bloco = emBlocoDesfeito(["create table x (id int);", "begin;\nselect plan(1);\nselect $cmd$ok$cmd$;\nrollback;"]);
  assert.doesNotMatch(bloco, /\$cmd\$begin\$cmd\$|\$cmd1\$begin\$cmd1\$/);
  assert.match(bloco, /'f', \$cmd1\$create table x \(id int\)\$cmd1\$/, "a tag muda quando o texto já usa $cmd$");
  assert.match(bloco, /'t', \$cmd1\$select plan\(1\)\$cmd1\$/);
  assert.match(bloco, /raise exception using message = E'BLOCO DESFEITO\\n' \|\| saida;/);
});
