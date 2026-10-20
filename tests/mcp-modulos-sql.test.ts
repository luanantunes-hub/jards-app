import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { MODULO_PADRAO, MODULOS_MCP } from "../lib/mcp/modulos";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";

// O conector por módulo: o teste de banco real é a conferência da migration contra o banco vivo (em transação desfeita);
// estes conferem, sem banco, a forma dela: aditiva, reaplicável, e com as mesmas listas de módulos do código. A migration
// é achada pelo sufixo: quem a aplica a renomeia para a versão gravada no banco, e nada aqui depende da data do arquivo.

const TABELAS = ["mcp_api_keys", "oauth_authorization_codes", "oauth_refresh_tokens"];

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");
const normalizar = (sql: string) => sql.replace(/\s+/g, " ").trim().toLowerCase();

async function migracao(): Promise<string> {
  const nome = (await readdir("supabase/migrations")).find((n) => n.endsWith("_mcp_modulos.sql"));
  assert.ok(nome, "migration _mcp_modulos.sql não encontrada");
  return readFile(`supabase/migrations/${nome}`, "utf8");
}

test("é aditiva: nenhuma exclusão, nenhuma troca de tipo, nenhuma regra apagada", async () => {
  const sql = normalizar(semComentarios(await migracao()));
  assert.ok(!/\bdrop\b/.test(sql), "a migration não pode ter DROP");
  assert.ok(!/\bdelete\b|\btruncate\b|\bupdate\b/.test(sql), "a migration não mexe em linhas");
  assert.ok(!/alter column/.test(sql), "a migration não altera coluna existente");
  assert.ok(!/create policy|alter policy|disable row level security/.test(sql), "as regras de acesso dessas tabelas não mudam");
});

test("cada tabela ganha a coluna com o padrão da captação, sem aceitar nulo, e é reaplicável", async () => {
  const sql = normalizar(semComentarios(await migracao()));
  for (const tabela of TABELAS) {
    const esperado = `alter table public.${tabela} add column if not exists modulos text[] not null default '{${MODULO_PADRAO}}'`;
    assert.ok(sql.includes(esperado), `falta a coluna em ${tabela}`);
  }
  assert.ok(sql.includes("if not exists ( select 1 from pg_constraint"), "a conferência dos valores precisa ser reaplicável");
});

test("a conferência aceita só módulos conhecidos e exige ao menos um, com a lista do código", async () => {
  const sql = normalizar(semComentarios(await migracao()));
  const lista = MODULOS_MCP.map((modulo) => `''${modulo}''`).join(", ");
  assert.ok(sql.includes(`check (cardinality(modulos) > 0 and modulos <@ array[${lista}]::text[])`), "a lista de módulos do SQL difere de MODULOS_MCP");
  for (const tabela of TABELAS) assert.ok(sql.includes(`'${tabela}'`), `a conferência precisa cobrir ${tabela}`);
});

test("cada coluna nova tem comentário", async () => {
  const sql = normalizar(semComentarios(await migracao()));
  for (const tabela of TABELAS) assert.ok(sql.includes(`comment on column public.${tabela}.modulos is`), `sem comentário em ${tabela}`);
});

test("o plano do teste de banco bate com as verificações, tudo é desfeito e o README o descreve", async () => {
  const teste = await readFile("supabase/tests/mcp_modulos.test.sql", "utf8");
  const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
  const verificacoes = teste.match(/^select (is|isnt|ok|throws_ok|lives_ok)\(/gm)?.length ?? 0;
  assert.equal(verificacoes, plano);
  const comandos = dividirComandos(teste);
  assert.equal(comandos[0], "begin");
  assert.equal(comandos.at(-1), "rollback");
  assert.doesNotMatch(teste, /\d{14}_mcp_modulos/, "o teste não depende da data do arquivo da migration");

  const leia = await readFile("supabase/tests/README.md", "utf8");
  assert.ok(leia.includes("`mcp_modulos.test.sql`"), "o README dos testes de banco precisa descrever mcp_modulos.test.sql");
});
