import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";
import { PAPEIS_EXTERNOS } from "../lib/equipe-modulos";

// PD0.4: o teste de acesso roda no banco (supabase/tests/README.md). Estes
// conferem, sem banco, a forma da migration que isola a captação e que o teste
// de acesso continua cobrindo a mesma lista de tabelas.

const TESTE = "supabase/tests/captacao_isolada.test.sql";
const INVENTARIO = "docs/acoes-futuras/estudos/producao-pd0-4-inventario.md";

async function migration(): Promise<string> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith("_producao_captacao_isolada.sql"));
  assert.ok(nome, "migration producao_captacao_isolada.sql não encontrada");
  return readFile(`supabase/migrations/${nome}`, "utf8");
}

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");

/** Os textos entre aspas simples de um array SQL `array[...]`. */
function nomesDoArray(sql: string, variavel: string): string[] {
  const corpo = new RegExp(`${variavel} text\\[\\] := array\\[([\\s\\S]*?)\\]`).exec(sql)?.[1] ?? "";
  return [...corpo.matchAll(/'([^']+)'/g)].map(m => m[1]);
}

test("a migration só acrescenta regras restritivas e funções auxiliares", async () => {
  const codigo = semComentarios(await migration());
  assert.doesNotMatch(codigo, /\bdrop\b/i, "a migration é de expansão: sem DROP");
  assert.match(codigo, /create policy %I on public\.%I as restrictive for all to authenticated/);
  for (const funcao of ["auth_org_ids_com_modulo", "auth_org_ids_internos_com_modulo"]) {
    assert.match(codigo, new RegExp(`function public\\.${funcao}\\(p_modulo text\\)[\\s\\S]*?security definer[\\s\\S]*?set search_path = public, pg_temp`));
    assert.match(codigo, new RegExp(`revoke execute on function public\\.${funcao}\\(text\\) from public, anon`));
    assert.match(codigo, new RegExp(`grant execute on function public\\.${funcao}\\(text\\) to authenticated`));
  }
});

test("as listas de tabelas somam 42, sem repetição", async () => {
  const codigo = semComentarios(await migration());
  const dinheiro = nomesDoArray(codigo, "v_dinheiro");
  const comerciais = nomesDoArray(codigo, "v_comerciais");
  const porPessoa = nomesDoArray(codigo, "v_por_pessoa");
  assert.equal(dinheiro.length, 11);
  assert.equal(comerciais.length, 28);
  assert.deepEqual(porPessoa, ["captacoes", "contatos", "editais_user"]);
  const todas = [...dinheiro, ...comerciais, ...porPessoa];
  assert.equal(new Set(todas).size, todas.length, "tabela repetida nas listas");
  assert.equal(todas.length, 42);
});

test("os papéis excluídos do dinheiro são os externos de lib/equipe-modulos.ts", async () => {
  const codigo = semComentarios(await migration());
  const lista = /m\.papel not in \(([^)]*)\)/.exec(codigo)?.[1] ?? "";
  const papeis = [...lista.matchAll(/'([^']+)'/g)].map(m => m[1]).sort();
  assert.deepEqual(papeis, [...PAPEIS_EXTERNOS].sort());
});

test("toda tabela fechada está no inventário e na lista de classificadas do teste de acesso", async () => {
  const codigo = semComentarios(await migration());
  const tabelas = [
    ...nomesDoArray(codigo, "v_dinheiro"), ...nomesDoArray(codigo, "v_comerciais"), ...nomesDoArray(codigo, "v_por_pessoa"),
  ];
  const inventario = await readFile(INVENTARIO, "utf8");
  const teste = await readFile(TESTE, "utf8");
  const classificadas = new Set(
    [...(/function rls_teste\.classificadas\(\)[\s\S]*?array\[([\s\S]*?)\];/.exec(teste)?.[1] ?? "").matchAll(/'([^']+)'/g)].map(m => m[1]));
  for (const tabela of tabelas) {
    // As seis tabelas filhas da ativação aparecem no inventário com o nome curto.
    const curto = tabela.startsWith("ativacao_") ? tabela.replace("ativacao_", "") : tabela;
    assert.ok(inventario.includes(`\`${tabela}\``) || inventario.includes(`\`${curto}\``), `${tabela} fora do inventário`);
    assert.ok(classificadas.has(tabela), `${tabela} fora de rls_teste.classificadas() em ${TESTE}`);
  }
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
