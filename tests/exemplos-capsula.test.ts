import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { LOGOS_HISTORICOS } from "../lib/logos-historicos";

const MIGRATION = readFileSync("supabase/migrations/20261120040034_exemplos_capsula_do_tempo.sql", "utf8");

test("todo logo histórico e toda imagem citada pelos exemplos existe em public/", () => {
  const caminhos = new Set([...Object.values(LOGOS_HISTORICOS), ...MIGRATION.match(/\/exemplos\/[a-z]+\.(png|jpg)/g) ?? []]);
  assert.ok(caminhos.size >= 19);
  for (const caminho of caminhos) assert.ok(existsSync(`public${caminho}`), `falta public${caminho}`);
});

test("toda empresa dos exemplos tem logo histórico pelo domínio", () => {
  const dominios = [...MIGRATION.matchAll(/'(Aviação|Varejo|Financeiro)', '([a-z.]+)'/g)].map(m => m[2]);
  assert.equal(dominios.length, 10);
  for (const dominio of dominios) assert.ok(LOGOS_HISTORICOS[dominio], `sem logo para ${dominio}`);
});

test("os exemplos não ocupam vaga do plano gratuito nem avisam atribuição", () => {
  assert.match(MIGRATION, /Exemplos não ocupam vaga[\s\S]*?if coalesce\(\(to_jsonb\(new\)->>'exemplo'\)::boolean, false\) then\s+return new;/);
  assert.equal((MIGRATION.match(/and not exemplo/g) ?? []).length, 3);
  assert.match(MIGRATION, /and not coalesce\(new\.exemplo, false\)/);
  assert.match(MIGRATION, /revoke all on function public\.fn_semear_exemplos\(uuid, uuid\) from public, anon, authenticated/);
});
