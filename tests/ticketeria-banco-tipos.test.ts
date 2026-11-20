import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { CATEGORIAS_DO_INGRESSO, CLASSIFICACOES_INDICATIVAS, CONTAS_DO_RAZAO, MEIOS_DE_PAGAMENTO, QUEM_PAGA_A_TAXA, SITUACOES_DO_PEDIDO, TIPOS_DE_TRANSACAO, TIPOS_DO_CUPOM, SITUACOES_DO_DOMINIO, SITUACOES_DO_EVENTO, SITUACOES_DO_SITE } from "../lib/ticketeria/estados";

// lib/ticketeria/banco.ts é o tipo do banco só da Ticketeria, escrito à mão (como lib/producao/banco.ts). Este teste o compara,
// sem banco, com as migrations da Ticketeria: as mesmas tabelas, as mesmas colunas, a mesma anulabilidade, as listas fechadas
// iguais às de lib/ticketeria/estados.ts, e o que a migration da T1 promete (sem DROP; toda função revoga de public e anon).

type Coluna = { nome: string; anulavel: boolean };

async function migrationsDaTicketeria(): Promise<{ nome: string; sql: string }[]> {
  const pasta = "supabase/migrations";
  const nomes = (await readdir(pasta)).filter(nome => /_ticketeria_(lojas_site|eventos|catalogo|pagamentos|custo_do_meio|custo_real_do_pagamento|validacao_de_saque|chave_da_subconta|saque_por_conta_bancaria|troca_de_conta_de_saque|ingressos_emitidos|reembolsos|reembolso_reabrir|porta|aceite_dos_termos|cupons|lista_de_espera|assentos_mapa|assentos_compra|assentos_porta|porta_melhor|origem_das_vendas|porta_equipe)\.sql$/.test(nome)).sort();
  return Promise.all(nomes.map(async nome => ({ nome, sql: await readFile(`${pasta}/${nome}`, "utf8") })));
}

function tabelasDoSql(sql: string): Map<string, Coluna[]> {
  const tabelas = new Map<string, Coluna[]>();
  for (const achado of sql.matchAll(/create table if not exists public\.(ticketeria_\w+) \(\n([\s\S]*?)\n\);/g)) {
    const colunas = achado[2].split("\n").map(linha => linha.trim()).filter(linha => linha !== "" && !linha.startsWith("constraint "))
      .map(linha => ({ nome: linha.split(" ")[0], anulavel: !/\bnot null\b/.test(linha) && !/\bprimary key\b/.test(linha) }));
    tabelas.set(achado[1], colunas);
  }
  // As colunas que migrations posteriores acrescentam (`alter table ... add column if not exists`), na ordem das migrations.
  for (const achado of sql.matchAll(/^alter table public\.(ticketeria_\w+) add column if not exists (\w+) ([^;\n]*);/gm)) {
    const colunas = tabelas.get(achado[1]);
    assert.ok(colunas, `alter table de ${achado[1]}, que nenhuma migration criou`);
    if (!colunas.some(coluna => coluna.nome === achado[2])) colunas.push({ nome: achado[2], anulavel: !/\bnot null\b/.test(achado[3]) });
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
  const migrations = await migrationsDaTicketeria();
  assert.equal(migrations.length, 23, "achou as migrations da T1 a T5, a do custo real, a do cadeado, a da chave da subconta, a da conta de saques, a da troca dela a dos ingressos emitidos a dos reembolsos, a de reabrir um reembolso, a da porta, a do aceite dos termos, a dos cupons, a da lista de espera a do mapa dos assentos a da compra com lugares, a do lugar na porta a da porta melhor, a da origem das vendas e a do link da equipe");
  const doSql = tabelasDoSql(migrations.map(m => m.sql).join("\n"));
  const doTipo = tabelasDoTipo(await readFile("lib/ticketeria/banco.ts", "utf8"));
  assert.deepEqual([...doTipo.keys()].sort(), [...doSql.keys()].sort(), "as mesmas tabelas");
  assert.deepEqual([...doSql.keys()].sort(), ["ticketeria_assentos", "ticketeria_contas_asaas", "ticketeria_cupons", "ticketeria_custos_meio", "ticketeria_espera", "ticketeria_eventos", "ticketeria_ingressos", "ticketeria_ingressos_emitidos", "ticketeria_locais", "ticketeria_lojas", "ticketeria_lotes", "ticketeria_notificacoes_provedor", "ticketeria_partidas", "ticketeria_pedido_assentos", "ticketeria_pedido_itens", "ticketeria_pedidos", "ticketeria_porta_desfeitas", "ticketeria_porta_links", "ticketeria_reembolsos", "ticketeria_sessoes", "ticketeria_setores", "ticketeria_site_dominios", "ticketeria_site_paginas", "ticketeria_sites", "ticketeria_taxas", "ticketeria_transacoes", "ticketeria_transferencias_autorizadas", "ticketeria_trocas_de_conta", "ticketeria_validacoes_saque"]);
  const porNome = (colunas: Coluna[] | undefined) => [...(colunas ?? [])].sort((x, y) => x.nome.localeCompare(y.nome));
  for (const [tabela, colunas] of doSql) assert.deepEqual(porNome(doTipo.get(tabela)), porNome(colunas), `colunas de ${tabela}`);
});

test("as listas fechadas do banco são as de lib/ticketeria/estados.ts", async () => {
  const sql = (await migrationsDaTicketeria()).map(m => m.sql).join("\n");
  const lista = (restricao: string, coluna = "situacao") => {
    const m = new RegExp(`constraint ${restricao} check \\((?:${coluna} is null or )?${coluna} in \\(([^)]*)\\)\\)`).exec(sql);
    assert.ok(m, restricao);
    return [...m[1].matchAll(/'([^']*)'/g)].map(x => x[1]);
  };
  assert.deepEqual(lista("ticketeria_sites_situacao_check"), [...SITUACOES_DO_SITE]);
  assert.deepEqual(lista("ticketeria_site_dominios_situacao_check"), [...SITUACOES_DO_DOMINIO]);
  assert.deepEqual(lista("ticketeria_eventos_situacao_check"), [...SITUACOES_DO_EVENTO]);
  assert.deepEqual(lista("ticketeria_eventos_classificacao_check", "classificacao"), [...CLASSIFICACOES_INDICATIVAS]);
  assert.deepEqual(lista("ticketeria_ingressos_categoria_check", "categoria"), [...CATEGORIAS_DO_INGRESSO]);
  assert.deepEqual(lista("ticketeria_pedidos_situacao_check"), [...SITUACOES_DO_PEDIDO]);
  assert.deepEqual(lista("ticketeria_taxas_quem_paga_check", "quem_paga"), [...QUEM_PAGA_A_TAXA]);
  assert.deepEqual(lista("ticketeria_pedidos_quem_paga_check", "quem_paga_taxa"), [...QUEM_PAGA_A_TAXA]);
  assert.deepEqual(lista("ticketeria_transacoes_tipo_check", "tipo"), [...TIPOS_DE_TRANSACAO]);
  assert.deepEqual(lista("ticketeria_partidas_conta_check", "conta"), [...CONTAS_DO_RAZAO]);
  assert.deepEqual(lista("ticketeria_cupons_tipo_check", "tipo"), [...TIPOS_DO_CUPOM]);
  assert.deepEqual(lista("ticketeria_custos_meio_meio_check", "meio"), [...MEIOS_DE_PAGAMENTO]);
  assert.deepEqual(lista("ticketeria_pedidos_meio_check", "meio"), [...MEIOS_DE_PAGAMENTO]);
});

test("as migrations da loja, do site e dos eventos não apagam nada e toda função revoga de public e anon", async () => {
  for (const migration of await migrationsDaTicketeria()) {
  const semComentarios = migration.sql.replace(/--.*$/gm, "");
  assert.doesNotMatch(semComentarios, /\bdrop\s+(table|function|policy|trigger|column|constraint)\b/i, "sem DROP");
  const funcoes = [...semComentarios.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(funcoes.length >= 1, `${migration.nome}: leu as funções`);
  for (const funcao of funcoes) assert.match(semComentarios, new RegExp(`revoke execute on function public\\.${funcao}\\([^)]*\\) from public, anon`), `${funcao} revoga de public e anon`);
  assert.doesNotMatch(semComentarios, /grant [^;]*delete[^;]* on public\.ticketeria_lojas\b/, "a loja não se apaga pelo navegador");
  if (migration.nome.endsWith("_ticketeria_lojas_site.sql")) assert.match(semComentarios, /grant select on public\.ticketeria_site_dominios to authenticated;/, "o navegador só lê os domínios");
  }
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
