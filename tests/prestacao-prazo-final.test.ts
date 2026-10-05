import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { feriadosNacionais } from "../lib/prestacao/calendario";
import { COLUNA_DO_MARCO, descreverRegra, prazoFinalCalculado, prazoVigente } from "../lib/prestacao/prazo-final";
import { GENERICO } from "../lib/prestacao/regimes";
import { ROUANET_IN29_2026 } from "../lib/prestacao/regimes/rouanet-in29-2026";
import { mensagemErroPrestacao } from "../lib/prestacao/status";

const MIGRATION = "supabase/migrations/20261005160000_prestacao_regime.sql";

test("Rouanet: 60 dias corridos após o fim da execução, com prorrogação", () => {
  assert.equal(prazoFinalCalculado(ROUANET_IN29_2026, { data_fim_execucao: "2026-08-06" })?.data, "2026-10-05");
  const sabado = prazoFinalCalculado(ROUANET_IN29_2026, { data_fim_execucao: "2026-09-01" });
  assert.equal(sabado?.dataOriginal, "2026-10-31");
  assert.equal(sabado?.data, "2026-11-03", "sábado, domingo e Finados");
  assert.equal(sabado?.prorrogadoPor, "Sábado");
  assert.equal(prazoFinalCalculado(ROUANET_IN29_2026, { data_fim_execucao: null }), null);
  assert.equal(prazoFinalCalculado(GENERICO, { data_fim_execucao: "2026-08-06" }), null);
  assert.equal(prazoFinalCalculado(null, { data_fim_execucao: "2026-08-06" }), null);
});

test("texto da regra e prazo vigente", () => {
  assert.equal(descreverRegra(ROUANET_IN29_2026.prazos.prestacaoFinal), "60 dias corridos após o fim da execução");
  assert.equal(prazoVigente({ prazo_final_override: "2026-11-30", prazo_final: "2026-10-05", prazo: "2026-11-30" }), "2026-11-30");
  assert.equal(prazoVigente({ prazo_final_override: null, prazo_final: "2026-10-05", prazo: "2026-10-05" }), "2026-10-05");
  assert.equal(prazoVigente({ prazo: "2026-08-21" }), "2026-08-21");
});

test("o banco usa os mesmos feriados fixos do código", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  const doBanco = new Map([...sql.matchAll(/when dia = '(\d{2}-\d{2})' then '([^']+)'/g)].map(r => [r[1], r[2]]));
  const fixosDoCodigo = new Map(feriadosNacionais(2026)
    .filter(f => !/Carnaval|Paixão|Corpus/.test(f.nome))
    .map(f => [f.data.slice(5), f.nome]));
  assert.deepEqual([...doBanco.entries()].sort(), [...fixosDoCodigo.entries()].sort());
  // Móveis: mesmos deslocamentos da Páscoa que calendario.ts.
  for (const [deslocamento, nome] of [["- 48", "Carnaval (segunda-feira)"], ["- 47", "Carnaval (terça-feira)"], ["- 2", "Sexta-feira da Paixão"], ["+ 60", "Corpus Christi"]]) {
    assert.ok(sql.includes(`when p_data = pascoa ${deslocamento} then '${nome}'`), nome);
  }
});

test("o banco liga os marcos às mesmas colunas", async () => {
  // P1.11: conclusão do objeto (ANCINE) e fim do exercício (saúde) entraram.
  const sql = await readFile("supabase/migrations/20261006100000_prestacao_regimes_dimensoes.sql", "utf8");
  const coluna = { fim_execucao: "data_fim_execucao", conclusao_objeto: "data_conclusao_objeto", envio: "data_envio" } as const;
  const doBanco = Object.fromEntries([...sql.matchAll(/when '([a-z_]+)' then (?:make_date\(extract\(year from )?p_(fim_execucao|conclusao_objeto|envio)/g)]
    .map(r => [r[1], coluna[r[2] as keyof typeof coluna]]));
  assert.deepEqual(doBanco, COLUNA_DO_MARCO);
  assert.match(sql, /make_date\(extract\(year from p_fim_execucao\)::integer, 12, 31\)/, "fim do exercício é 31/12 do ano em que a execução terminou");
  assert.match(sql, /where regra \? 'marco'/, "prazo em lacuna não calcula");
  assert.match(sql, /prestacao_prazo_final\(new\.regime_id, new\.data_fim_execucao, new\.data_conclusao_objeto, new\.data_envio\)/);
});

test("prazo final pelos marcos novos", () => {
  const ancine = { ...ROUANET_IN29_2026, prazos: { ...ROUANET_IN29_2026.prazos, prestacaoFinal: { ...ROUANET_IN29_2026.prazos.prestacaoFinal, marco: "conclusao_objeto" as const, quantidade: 180 } } };
  assert.equal(prazoFinalCalculado(ancine, { data_fim_execucao: "2026-03-01" }), null, "sem a conclusão do objeto, sem prazo");
  assert.equal(prazoFinalCalculado(ancine, { data_conclusao_objeto: "2026-03-02" })?.data, "2026-08-31", "180 dias de 02/03 caem em 29/08, um sábado");
  const saude = { ...ROUANET_IN29_2026, prazos: { ...ROUANET_IN29_2026.prazos, prestacaoFinal: { ...ROUANET_IN29_2026.prazos.prestacaoFinal, marco: "fim_exercicio" as const, quantidade: 4, unidade: "meses" as const } } };
  const anual = prazoFinalCalculado(saude, { data_fim_execucao: "2026-08-15" });
  assert.equal(anual?.marco, "2026-12-31");
  assert.equal(anual?.data, "2027-04-30", "30/04 do ano seguinte");
});

test("prazo vigente, justificativa e histórico no banco", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /new\.prazo := coalesce\(new\.prazo_final_override, new\.prazo_final\)/);
  assert.match(sql, /raise exception 'prazo_sem_justificativa'/);
  assert.match(sql, /after update of regime_id on public\.prestacoes_contas/);
  assert.match(sql, /prazo_final_override = coalesce\(p\.prazo_final_override, p\.prazo\)/, "backfill preserva o prazo informado");
  assert.match(sql, /O proponente é de outra organização/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /\bdrop\b/i);
  assert.match(mensagemErroPrestacao({ message: "prazo_sem_justificativa" }, "x"), /justificativa|calculado/);
});
