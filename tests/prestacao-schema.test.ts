import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

// A estrutura da prestação existia só em produção. Estes testes garantem que
// ela continua versionada e protegida nas migrations.

const TABELAS = [
  "prestacoes_contas",
  "prestacao_status_log",
  "prestacao_itens",
  "prestacao_comprovantes",
  "prestacao_atividades",
  "prestacao_atividade_evidencias",
  "prestacao_relatorio",
  "prestacao_distribuicao",
  "prestacao_divulgacao",
];

async function todasAsMigrations(): Promise<{ nome: string; sql: string }[]> {
  const nomes = (await readdir("supabase/migrations")).filter(n => n.endsWith(".sql")).sort();
  return Promise.all(nomes.map(async nome => ({ nome, sql: await readFile(`supabase/migrations/${nome}`, "utf8") })));
}

test("toda tabela da prestação tem create table e RLS ligado", async () => {
  const sql = (await todasAsMigrations()).map(m => m.sql).join("\n");
  for (const tabela of TABELAS) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${tabela} \\(`), `${tabela} sem create table`);
    assert.match(sql, new RegExp(`alter table public\\.${tabela} enable row level security`), `${tabela} sem RLS`);
  }
});

test("a estrutura vem antes da primeira migration que usa as tabelas", async () => {
  const migrations = await todasAsMigrations();
  const base = migrations.findIndex(m => m.nome.endsWith("_prestacao_base.sql"));
  const primeiroUso = migrations.findIndex(m => !m.nome.endsWith("_prestacao_base.sql") && /prestacoes_contas|prestacao_/.test(m.sql));
  assert.ok(base >= 0, "falta a migration de base");
  assert.ok(base < primeiroUso, `base (${migrations[base].nome}) deve vir antes de ${migrations[primeiroUso].nome}`);
});

test("nenhuma migration abre a prestação para qualquer conta logada", async () => {
  for (const { nome, sql } of await todasAsMigrations()) {
    const aberta = /create policy[^;]*on public\.prestac[a-z_]+[^;]*using \(true\)/i.test(sql);
    assert.equal(aberta, false, `${nome} cria regra using (true) na prestação`);
  }
});

test("o app só usa tipos de comprovante que o banco aceita", async () => {
  const base = await readFile("supabase/migrations/20260827074320_prestacao_base.sql", "utf8");
  const extras = (await todasAsMigrations())
    .flatMap(m => [...m.sql.matchAll(/alter type public\.tipo_comprovante add value if not exists '([a-z_]+)'/g)].map(r => r[1]));
  const enumBase = /create type public\.tipo_comprovante as enum \(([^)]*)\)/.exec(base)?.[1] ?? "";
  const aceitos = new Set([...enumBase.matchAll(/'([a-z_]+)'/g)].map(r => r[1]).concat(extras));

  const tipos = await readFile("lib/supabase/types.ts", "utf8");
  const declarados = /export type TipoComprovante =([^;]*);/.exec(tipos)?.[1] ?? "";
  for (const [, tipo] of declarados.matchAll(/"([a-z_]+)"/g)) {
    assert.ok(aceitos.has(tipo), `tipo "${tipo}" está no app mas não no enum tipo_comprovante`);
  }
});
