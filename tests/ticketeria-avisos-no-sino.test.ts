import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { notificacaoDoModulo } from "../lib/notificacoes-modulo";

const SQL = "supabase/migrations/20261125200000_ticketeria_avisos_no_sino.sql";

test("a migration dos avisos é aditiva (sem DROP de tabela/função) e toda função revoga de public e anon", async () => {
  const sql = await readFile(SQL, "utf8");
  assert.doesNotMatch(sql, /drop (table|function|column|schema)/i);
  const funcoes = [...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map(m => m[1]);
  assert.deepEqual(funcoes, ["fn_ticketeria_avisar", "fn_ticketeria_moeda", "fn_ticketeria_avisa_venda", "fn_ticketeria_avisa_reembolso"]);
  for (const nome of funcoes) assert.match(sql, new RegExp(`revoke all on function public\\.${nome}\\([^)]*\\) from public, anon`), nome);
  assert.match(sql, /fn_ticketeria_avisar\([^)]*\)[^;]*from public, anon, authenticated/, "o avisar só o banco chama");
});

test("os avisos usam a fila de notificações, a categoria ticketeria e links que o sino do módulo reconhece", async () => {
  const sql = await readFile(SQL, "utf8");
  assert.match(sql, /fn_emit_notification\(/);
  assert.match(sql, /'ticketeria', p_prioridade/);
  for (const chave of ["ticketeria_venda_paga", "ticketeria_reembolso_feito", "ticketeria_reembolso_falhou"]) {
    assert.ok(sql.includes(chave), chave);
    assert.equal(notificacaoDoModulo({ categoria: "ticketeria", event_key: chave }, "ticketeria"), true, chave);
  }
  for (const link of ["/ingressos/vendas?compra=", "/ingressos/vendas"]) assert.ok(sql.includes(`'${link}`), link);
  assert.equal(notificacaoDoModulo({ link: "/ingressos/vendas?compra=abc" }, "ticketeria"), true);
});

test("quem recebe: membros com a ticketeria que não são captador, proponente nem leitor; um aviso por pessoa e fato", async () => {
  const sql = await readFile(SQL, "utf8");
  assert.match(sql, /'ticketeria' = any\(o\.modulos_ativos\)/);
  assert.match(sql, /'ticketeria' = any\(m\.modulos_acesso\)/);
  assert.match(sql, /m\.papel not in \('captador', 'proponente', 'leitor'\)/);
  assert.match(sql, /p_dedupe \|\| ':' \|\| v_membro\.user_id/);
});
