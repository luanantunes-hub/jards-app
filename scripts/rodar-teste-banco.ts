// Roda um teste de banco (pgTAP, supabase/tests/*.test.sql) no banco ligado pelo Supabase CLI, dentro de uma transação que é DESFEITA no fim, e diz
// quantas verificações passaram e quais falharam. Com --migration, a migration roda antes, na mesma transação (o teste a prova sem aplicá-la).
//
// Uso:
//   npx tsx scripts/rodar-teste-banco.ts supabase/tests/producao_marcas.test.sql
//   npx tsx scripts/rodar-teste-banco.ts supabase/tests/producao_marcas.test.sql --migration supabase/migrations/20261117800000_producao_marcas.sql
//   npx tsx scripts/rodar-teste-banco.ts <teste> --so-gerar   (só escreve a cópia e mostra o caminho)
// Pede o Supabase CLI entrado na conta (`supabase login`) e o projeto ligado (`supabase link`). Testes que usam DELETE rodam pelo CLI, não pelo conector.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A cópia "gravadora" do teste: cada is()/ok()/isnt() vira um insert numa tabela do esquema do teste, e no fim uma consulta devolve o total e as falhas
 * (o pgTAP em si só escreve a saída TAP, que o CLI não devolve). A transação do teste continua terminando em rollback.
 */
export function montarCopiaGravadora(teste: string, migrations: readonly string[] = []): { sql: string; verificacoes: number; esquema: string } {
  const esquema = /^create schema (\w+);/m.exec(teste)?.[1];
  if (!esquema) throw new Error("O teste precisa de uma linha `create schema xx;` (o esquema do teste).");
  const fim = "select * from finish();\nrollback;";
  if (!teste.includes(fim)) throw new Error("O teste precisa terminar com `select * from finish();` e `rollback;`.");
  const verificacoes = (teste.match(/^select (is|ok|isnt)\(/gm) ?? []).length;
  let sql = teste.replace(`create schema ${esquema};\n`, `create schema ${esquema};\ncreate table ${esquema}.saida (n serial, t text);\ngrant all on ${esquema}.saida to authenticated, anon;\ngrant usage on sequence ${esquema}.saida_n_seq to authenticated, anon;\n`);
  sql = sql.replace(/^select (is|ok|isnt)\(/gm, `insert into ${esquema}.saida (t) select $1(`);
  sql = sql.replace(fim, `select (select count(*) from ${esquema}.saida) as total, (select string_agg(t, E'\\n' order by n) from ${esquema}.saida where t like 'not ok%') as falhas;\nrollback;`);
  if (migrations.length > 0) {
    if (!/^begin;/m.test(sql)) throw new Error("O teste precisa abrir com `begin;` para a migration rodar na mesma transação.");
    // Com função, porque o `$$` do texto da migration, numa substituição por texto, viraria um `$` só.
    sql = sql.replace(/^begin;\n/m, () => `begin;\n${migrations.join("\n")}\n`);
  }
  return { sql, verificacoes, esquema };
}

function principal() {
  const lista = process.argv.slice(2);
  const arquivoDoTeste = lista.find(item => item.endsWith(".sql") && !lista[lista.indexOf(item) - 1]?.startsWith("--migration"));
  if (!arquivoDoTeste) { console.error("Informe o arquivo do teste (.sql)."); process.exit(1); }
  const migrations: string[] = [];
  lista.forEach((item, i) => { if (item === "--migration" && lista[i + 1]) migrations.push(readFileSync(lista[i + 1], "utf8")); });
  const { sql, verificacoes } = montarCopiaGravadora(readFileSync(arquivoDoTeste, "utf8"), migrations);
  const pasta = mkdtempSync(join(tmpdir(), "teste-banco-"));
  const arquivo = join(pasta, "teste.sql");
  writeFileSync(arquivo, sql);
  if (lista.includes("--so-gerar")) { console.log(arquivo); return; }
  const r = spawnSync("supabase", ["db", "query", "--linked", "-f", arquivo], { encoding: "utf8" });
  if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
  const json = /\{[\s\S]*\}/.exec(r.stdout)?.[0];
  if (!json) { console.error(`Resposta inesperada do CLI:\n${r.stdout}`); process.exit(1); }
  const linha = (JSON.parse(json) as { rows?: { total?: number | string; falhas?: string | null }[] }).rows?.[0];
  if (!linha) { console.error(`Sem resultado:\n${json}`); process.exit(1); }
  const total = Number(linha.total);
  console.log(`${arquivoDoTeste}: ${total} de ${verificacoes} verificações rodaram; ${linha.falhas ? "FALHAS:\n" + linha.falhas : "nenhuma falha"}`);
  if (linha.falhas || total !== verificacoes) process.exit(1);
}

if (process.argv[1]?.endsWith("rodar-teste-banco.ts")) principal();
