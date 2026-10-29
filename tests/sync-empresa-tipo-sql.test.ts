import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";

// O teste de acesso roda no banco (supabase/tests/README.md). Estes conferem, sem
// banco, a forma da migration que deixa o gatilho do tipo da empresa valer para a
// equipe inteira e o plano do teste de acesso.

const TESTE = "supabase/tests/sync_empresa_tipo.test.sql";

async function migration(): Promise<string> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith("_sync_empresa_tipo_definer.sql"));
  assert.ok(nome, "migration sync_empresa_tipo_definer.sql não encontrada");
  return readFile(`supabase/migrations/${nome}`, "utf8");
}

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");

test("a função roda como dono, com o caminho de busca fixo, e a migration não tem DROP", async () => {
  const codigo = semComentarios(await migration());
  assert.doesNotMatch(codigo, /\bdrop\b/i);
  assert.match(codigo, /create or replace function public\.fn_sync_empresa_tipo\(\)\s+returns trigger\s+language plpgsql\s+security definer\s+set search_path = public, pg_temp/);
});

test("toda leitura e as duas atualizações ficam na organização da linha que disparou o gatilho", async () => {
  const codigo = semComentarios(await migration());
  // Contas, a raiz e o passo recursivo das negociações, a raiz e o passo recursivo das inscrições, e as duas atualizações.
  assert.equal(codigo.match(/organization_id = v_org/g)?.length, 7);
  assert.match(codigo, /select 1 from contas_patrocinio where empresa_crm_id = v_empresa_id and organization_id = v_org and status = 'ativa'/);
  assert.match(codigo, /update empresas_crm set tipo = 'cliente_ativo' where id = v_empresa_id and organization_id = v_org and tipo != 'cliente_ativo'/);
  assert.match(codigo, /update empresas_crm set tipo = 'ex_cliente' where id = v_empresa_id and organization_id = v_org and tipo = 'cliente_ativo'/);
  // A organização vem da própria linha: da antiga na exclusão, da nova nas demais.
  assert.match(codigo, /v_org := OLD\.organization_id;/);
  assert.match(codigo, /v_org := NEW\.organization_id;/);
});

test("o navegador não executa a função de gatilho", async () => {
  const codigo = semComentarios(await migration());
  assert.match(codigo, /revoke execute on function public\.fn_sync_empresa_tipo\(\) from public, anon, authenticated/);
  assert.doesNotMatch(codigo, /grant execute/i);
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
