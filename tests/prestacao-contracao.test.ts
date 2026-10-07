import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

// P2.11: o orçamento antigo e as colunas da leitura v1 saem do banco, e nada
// no app nem nas funções pode voltar a usá-los.

const MIGRATION = "supabase/migrations/20261007090000_prestacao_contracao_orcamento_antigo.sql";

async function arquivos(pasta: string): Promise<string[]> {
  const itens = await readdir(pasta, { withFileTypes: true });
  const filhos = await Promise.all(itens.map(i => {
    const caminho = `${pasta}/${i.name}`;
    if (i.isDirectory()) return i.name === "node_modules" ? [] : arquivos(caminho);
    return /\.(ts|tsx)$/.test(i.name) ? [caminho] : [];
  }));
  return filhos.flat();
}

test("contração: gatilhos sem a tabela antiga, colunas e tabela apagadas", async () => {
  const sql = (await readFile(MIGRATION, "utf8")).replace(/--.*$/gm, "");
  assert.match(sql, /before insert or update of no_id on public\.prestacao_comprovantes/);
  assert.doesNotMatch(sql.slice(0, sql.indexOf("alter table public.prestacao_comprovantes drop column")), /prestacao_itens|item_id/, "os gatilhos novos não citam a tabela antiga");
  for (const coluna of ["item_id", "rubrica_sugerida_id", "risco_glosa", "motivos_glosa"]) {
    assert.match(sql, new RegExp(`alter table public\\.prestacao_comprovantes drop column if exists ${coluna};`), coluna);
  }
  assert.match(sql, /drop table if exists public\.prestacao_itens;/);
  assert.ok(sql.indexOf("drop column if exists item_id") < sql.indexOf("drop table if exists public.prestacao_itens"), "a coluna com a chave estrangeira sai antes da tabela");
});

test("nada no app nem nas funções usa as estruturas apagadas", async () => {
  const caminhos = (await Promise.all(["app", "components", "lib", "hooks", "supabase/functions"].map(arquivos))).flat();
  for (const caminho of caminhos) {
    const texto = await readFile(caminho, "utf8");
    assert.doesNotMatch(texto, /prestacao_itens|risco_glosa|motivos_glosa|rubrica_sugerida_id/, caminho);
  }
});
