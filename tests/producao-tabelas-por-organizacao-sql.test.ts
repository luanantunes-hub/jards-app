import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";
import { PAPEIS_EXTERNOS } from "../lib/equipe-modulos";

// PD0.4b: o teste de acesso roda no banco (supabase/tests/README.md). Estes
// conferem, sem banco, a forma da migration das tabelas por organização e que o
// teste de acesso cobre as mesmas tabelas.

const TESTE = "supabase/tests/tabelas_por_organizacao.test.sql";
const TABELAS = ["captacoes", "contatos", "editais_user", "projetos_crm", "atividades"];

async function migration(): Promise<string> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith("_producao_tabelas_por_organizacao.sql"));
  assert.ok(nome, "migration producao_tabelas_por_organizacao.sql não encontrada");
  return readFile(`supabase/migrations/${nome}`, "utf8");
}

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");

test("a migration é de expansão: sem DROP, com guarda restritiva só de escrita", async () => {
  const codigo = semComentarios(await migration());
  assert.doesNotMatch(codigo, /\bdrop\b/i);
  assert.match(codigo, /as restrictive for insert to authenticated with check/);
  assert.match(codigo, /as restrictive for update to authenticated using \(true\) with check/);
  assert.doesNotMatch(codigo, /as restrictive for (all|select|delete)/i, "a guarda não pode esconder o que quem criou já lê");
  for (const comando of ["select", "update", "delete"]) {
    assert.match(codigo, new RegExp(`create policy %I on public\\.%I for ${comando} to authenticated`));
  }
});

test("a função auxiliar não dá passe livre ao super admin e exclui os papéis externos", async () => {
  const codigo = semComentarios(await migration());
  const funcao = /create or replace function public\.auth_org_ids_equipe[\s\S]*?\$\$;/.exec(codigo)?.[0] ?? "";
  assert.ok(funcao, "função auth_org_ids_equipe não encontrada");
  assert.match(funcao, /security definer[\s\S]*set search_path = public, pg_temp/);
  assert.doesNotMatch(funcao, /is_jards_super_admin/, "o super admin só lê a organização em que é membro");
  const lista = /m\.papel not in \(([^)]*)\)/.exec(funcao)?.[1] ?? "";
  const papeis = [...lista.matchAll(/'([^']+)'/g)].map(m => m[1]).sort();
  assert.deepEqual(papeis, [...PAPEIS_EXTERNOS].sort());
  assert.match(codigo, /revoke execute on function public\.auth_org_ids_equipe\(text, text\) from public, anon/);
  assert.match(codigo, /grant execute on function public\.auth_org_ids_equipe\(text, text\) to authenticated/);
});

test("as cinco tabelas da migration são as do teste de acesso", async () => {
  const codigo = semComentarios(await migration());
  const lista = /foreach v_tabela in array array\[([^\]]*)\] loop\s+-- ?Comerciais|foreach v_tabela in array array\[([^\]]*)\] loop\s+v_modulo/.exec(codigo);
  const nomes = [...(lista?.[1] ?? lista?.[2] ?? "").matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(nomes, TABELAS);
  const teste = await readFile(TESTE, "utf8");
  const sonda = /function rls_teste\.todas\(\)[\s\S]*?array\[([\s\S]*?)\]/.exec(teste)?.[1] ?? "";
  assert.deepEqual([...sonda.matchAll(/'([^']+)'/g)].map(m => m[1]).sort(), [...TABELAS].sort());
});

test("o plano do teste de acesso bate com as verificações e tudo é desfeito", async () => {
  const teste = await readFile(TESTE, "utf8");
  const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
  const verificacoes = teste.match(/^select (is|isnt|ok|throws_ok|lives_ok)\(/gm)?.length ?? 0;
  assert.equal(verificacoes, plano);
  const comandos = dividirComandos(teste);
  assert.equal(comandos[0], "begin");
  assert.equal(comandos.at(-1), "rollback");
});

test("a tela da negociação cria a atividade pela folha, que grava a organização", async () => {
  const pagina = await readFile("app/(dashboard)/captacoes/[id]/page.tsx", "utf8");
  assert.doesNotMatch(pagina, /from\("atividades"\)\.insert/, "a tela não grava atividade por conta própria: quem grava é a folha");
  assert.match(pagina, /<NovaAtividadeModal[\s\S]*?captacao_id: captacao\.id/, "a folha abre ligada à negociação");
  const folha = await readFile("components/modals/NovaAtividadeModal.tsx", "utf8");
  const payload = /const payload = \{([\s\S]*?)\n {4}\};/.exec(folha)?.[1] ?? "";
  assert.match(payload, /organization_id:/, "atividade sem organização some da equipe");
});

test("a tela da inscrição também cria a atividade pela folha, ligada à inscrição", async () => {
  const pagina = await readFile("app/(dashboard)/editais-inscritos/[id]/page.tsx", "utf8");
  assert.doesNotMatch(pagina, /from\("atividades"\)\.insert/, "a tela não grava atividade por conta própria: quem grava é a folha");
  assert.match(pagina, /<NovaAtividadeModal[\s\S]*?edital_user_id: inscricao\.id/, "a folha abre ligada à inscrição");
});
