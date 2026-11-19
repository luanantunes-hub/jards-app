import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { SITUACOES_DO_DOMINIO, SITUACOES_DO_SITE } from "../lib/ticketeria/estados";

// lib/ticketeria/banco.ts é o tipo do banco só da Ticketeria, escrito à mão (como lib/producao/banco.ts). Este teste o compara,
// sem banco, com as migrations da Ticketeria: as mesmas tabelas, as mesmas colunas, a mesma anulabilidade, as listas fechadas
// iguais às de lib/ticketeria/estados.ts, e o que a migration da T1 promete (sem DROP; toda função revoga de public e anon).

type Coluna = { nome: string; anulavel: boolean };

async function migrationsDaTicketeria(): Promise<{ nome: string; sql: string }[]> {
  const pasta = "supabase/migrations";
  const nomes = (await readdir(pasta)).filter(nome => /_ticketeria_lojas_site\.sql$/.test(nome)).sort();
  return Promise.all(nomes.map(async nome => ({ nome, sql: await readFile(`${pasta}/${nome}`, "utf8") })));
}

function tabelasDoSql(sql: string): Map<string, Coluna[]> {
  const tabelas = new Map<string, Coluna[]>();
  for (const achado of sql.matchAll(/create table if not exists public\.(ticketeria_\w+) \(\n([\s\S]*?)\n\);/g)) {
    const colunas = achado[2].split("\n").map(linha => linha.trim()).filter(linha => linha !== "" && !linha.startsWith("constraint "))
      .map(linha => ({ nome: linha.split(" ")[0], anulavel: !/\bnot null\b/.test(linha) && !/\bprimary key\b/.test(linha) }));
    tabelas.set(achado[1], colunas);
  }
  return tabelas;
}

function tabelasDoTipo(ts: string): Map<string, Coluna[]> {
  const tabelas = new Map<string, Coluna[]>();
  for (const achado of ts.matchAll(/^ {6}(ticketeria_\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\};/gm)) {
    tabelas.set(achado[1], achado[2].split("\n").map(linha => {
      const m = /^\s+(\w+): (.+);$/.exec(linha);
      assert.ok(m, `linha que o teste não entende em ${achado[1]}: ${linha}`);
      return { nome: m[1], anulavel: / \| null$/.test(m[2]) };
    }));
  }
  return tabelas;
}

test("lib/ticketeria/banco.ts tem as tabelas e as colunas da migration, com a mesma anulabilidade", async () => {
  const [migration] = await migrationsDaTicketeria();
  assert.ok(migration, "achou a migration da T1");
  const doSql = tabelasDoSql(migration.sql);
  const doTipo = tabelasDoTipo(await readFile("lib/ticketeria/banco.ts", "utf8"));
  assert.deepEqual([...doTipo.keys()].sort(), [...doSql.keys()].sort(), "as mesmas tabelas");
  assert.deepEqual([...doSql.keys()].sort(), ["ticketeria_lojas", "ticketeria_site_dominios", "ticketeria_site_paginas", "ticketeria_sites"]);
  for (const [tabela, colunas] of doSql) assert.deepEqual(doTipo.get(tabela), colunas, `colunas de ${tabela}`);
});

test("as listas fechadas do banco são as de lib/ticketeria/estados.ts", async () => {
  const [migration] = await migrationsDaTicketeria();
  const lista = (restricao: string) => {
    const m = new RegExp(`constraint ${restricao} check \\(situacao in \\(([^)]*)\\)\\)`).exec(migration.sql);
    assert.ok(m, restricao);
    return [...m[1].matchAll(/'([^']*)'/g)].map(x => x[1]);
  };
  assert.deepEqual(lista("ticketeria_sites_situacao_check"), [...SITUACOES_DO_SITE]);
  assert.deepEqual(lista("ticketeria_site_dominios_situacao_check"), [...SITUACOES_DO_DOMINIO]);
});

test("a migration da loja e do site não apaga nada e toda função revoga de public e anon", async () => {
  const [migration] = await migrationsDaTicketeria();
  const semComentarios = migration.sql.replace(/--.*$/gm, "");
  assert.doesNotMatch(semComentarios, /\bdrop\s+(table|function|policy|trigger|column|constraint)\b/i, "sem DROP");
  const funcoes = [...semComentarios.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(funcoes.length >= 6, "leu as funções");
  for (const funcao of funcoes) assert.match(semComentarios, new RegExp(`revoke execute on function public\\.${funcao}\\([^)]*\\) from public, anon`), `${funcao} revoga de public e anon`);
  assert.match(semComentarios, /grant select on public\.ticketeria_site_dominios to authenticated;/, "o navegador só lê os domínios");
  assert.doesNotMatch(semComentarios, /grant [^;]*delete[^;]* on public\.ticketeria_lojas\b/, "a loja não se apaga pelo navegador");
});

test("a migration que tira os ingressos da Produção apaga só o que é de site, plateia, convidados, porta e borderô", async () => {
  const pasta = "supabase/migrations";
  const nome = (await readdir(pasta)).find(arquivo => /_producao_sem_ingressos\.sql$/.test(arquivo));
  assert.ok(nome, "achou a migration");
  const sql = (await readFile(`${pasta}/${nome}`, "utf8")).replace(/--.*$/gm, "");
  const apagadas = [...sql.matchAll(/drop (table|function) if exists public\.(\w+)/g)].map(m => m[2]);
  assert.equal(apagadas.length, 34, "14 tabelas e 20 funções");
  for (const objeto of apagadas) assert.match(objeto, /^(producao|fn_producao)_(site|credencia|convidad|porta|setor|bordero)/, `${objeto} é de ingresso ou do site`);
  assert.doesNotMatch(sql, /\bcascade\b/i, "sem cascade: o que dependesse delas faria o drop falhar em voz alta");
});
