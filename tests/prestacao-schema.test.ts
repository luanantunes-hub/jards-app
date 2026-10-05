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
    // Regra RESTRICTIVE com using (true) só soma restrição; o perigo é a permissiva.
    const aberta = sql.split(";").some(comando =>
      /create policy[\s\S]*on public\.prestac[a-z_]+[\s\S]*using \(true\)/i.test(comando) && !/as restrictive/i.test(comando));
    assert.equal(aberta, false, `${nome} cria regra permissiva using (true) na prestação`);
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

test("P0.2: prestação ganha organização, preenchida e protegida", async () => {
  const sql = await readFile("supabase/migrations/20261005100000_prestacao_organizacao.sql", "utf8");
  assert.match(sql, /add column if not exists organization_id uuid references public\.organizations\(id\)/);
  assert.match(sql, /update public\.prestacoes_contas p\s+set organization_id = coalesce\(/);
  assert.match(sql, /p\.organization_id = any\(array\(select public\.auth_org_ids\(\)\)\)/);
  assert.match(sql, /as restrictive for insert to authenticated/);
  assert.match(sql, /as restrictive for update to authenticated/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /\bdrop\b/i, "sem DROP: o conector trava em comandos destrutivos");
});

test("P0.2: o modal grava a organização atual", async () => {
  const modal = await readFile("components/modals/NovaPrestacaoModal.tsx", "utf8");
  assert.match(modal, /organization_id: organizationId/);
  const lista = await readFile("app/(dashboard)/prestacoes/page.tsx", "utf8");
  assert.match(lista, /\.eq\("organization_id", organizationId\)/);
  assert.doesNotMatch(lista, /organization_id\.is\.null/, "depois da contração não há prestação sem organização");
});

test("P0.2 contração: organização obrigatória e acesso só por ela", async () => {
  const sql = await readFile("supabase/migrations/20261006120000_prestacao_organizacao_contracao.sql", "utf8");
  const codigo = sql.replace(/--.*$/gm, "");
  // A trava vem antes do not null: com linha sem organização, nada é aplicado.
  assert.ok(codigo.indexOf("where organization_id is null") < codigo.indexOf("set not null"));
  assert.match(codigo, /alter column organization_id set not null/);
  assert.doesNotMatch(codigo, /criado_por/, "quem criou deixa de ter acesso próprio");
  assert.doesNotMatch(codigo, /organization_id is null or|or organization_id is null/i);
  // A regra permissiva olha a linha: no insert, can_access_prestacao(id) ainda não a encontra.
  assert.match(codigo, /alter policy "auth users can manage prestacoes"[\s\S]*?with check \(\s*organization_id = any\(array\(select public\.auth_org_ids\(\)\)\)\s*and public\.auth_tem_modulo\(organization_id, 'prestacao'\)/);
  for (const regra of ["organizacao do usuario ao criar", "organizacao do usuario ao alterar", "papel cria"]) {
    assert.match(codigo, new RegExp(`alter policy "prestacoes_contas: ${regra}"`), `regra "${regra}" não foi contraída`);
  }
  assert.doesNotMatch(codigo, /\bdrop\b/i, "sem DROP: o conector trava em comandos destrutivos");
});

test("P0.5: dados e arquivos da prestação exigem o módulo", async () => {
  const sql = await readFile("supabase/migrations/20261005110000_modulos_acesso.sql", "utf8");
  // Mesma regra de lib/modulos.ts: organização com o módulo e vínculo com acesso; super admin usa todos.
  assert.match(sql, /public\.is_jards_super_admin\(\)\s+or exists/);
  assert.match(sql, /modulo = any\(organizacao\.modulos_ativos\)\s+and modulo = any\(membro\.modulos_acesso\)/);
  assert.match(sql, /and public\.auth_tem_modulo\(p\.organization_id, 'prestacao'\)/);
  for (const regra of ["read", "delete", "update", "upload"]) {
    assert.match(sql, new RegExp(`'documentos: ${regra} org'`), `regra do storage "${regra}" sem o módulo`);
  }
  assert.match(sql, /revoke execute on function public\.auth_tem_modulo\(uuid, text\) from public, anon/);
  assert.match(sql, /before update of modulos_ativos on public\.organizations/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /\bdrop\b/i, "sem DROP: o conector trava em comandos destrutivos");
});
