import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

// Dentro de um EXISTS sobre organization_members, "organization_id" sem
// prefixo é lido como a coluna da própria organization_members, e a regra
// vira "sempre verdadeiro". Foi o que abriu crm_interacoes, crm_followups e
// crm_duvidas para todas as organizações (corrigido em 20261004140000).

const CORRECOES: Record<string, string> = {
  "20260828000010_relacionamento_followups.sql": "20261004140000_crm_politicas_por_organizacao.sql",
};

test("regras não comparam a organização do membro com ela mesma", async () => {
  const nomes = (await readdir("supabase/migrations")).filter(n => n.endsWith(".sql")).sort();
  for (const nome of nomes) {
    // Comentários podem citar o padrão antigo ao explicar a correção.
    const sql = (await readFile(`supabase/migrations/${nome}`, "utf8")).replace(/--.*$/gm, "");
    const semPrefixo = /\b(om|m|membro|me)\.organization_id\s*=\s*organization_id\b/i.test(sql);
    if (!semPrefixo) continue;
    const correcao = CORRECOES[nome];
    assert.ok(correcao, `${nome} compara organization_id sem prefixo da tabela`);
    assert.ok(nomes.indexOf(correcao) > nomes.indexOf(nome), `${correcao} precisa vir depois de ${nome}`);
  }
});

test("a correção do CRM qualifica a coluna pela tabela", async () => {
  const sql = await readFile("supabase/migrations/20261004140000_crm_politicas_por_organizacao.sql", "utf8");
  assert.match(sql, /om\.organization_id = %I\.organization_id/);
  for (const tabela of ["crm_interacoes", "crm_duvidas", "crm_followups"]) assert.ok(sql.includes(`'${tabela}'`), tabela);
});
