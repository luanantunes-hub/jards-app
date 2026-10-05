import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mensagemErroPrestacao, proximosBloqueados, proximosStatus, SEM_PERMISSAO, TRANSICOES } from "../lib/prestacao/status";

const MIGRATION = "supabase/migrations/20261005140000_prestacao_status_e_papeis.sql";
const TODAS = { editar: true, avaliar: true, decidir: true };
const COLABORADOR = { editar: true, avaliar: false, decidir: false };

test("a tela oferece só as transições que o papel permite", () => {
  assert.deepEqual(proximosStatus("revisao_interna", TODAS), ["enviado", "rascunho"]);
  assert.deepEqual(proximosStatus("revisao_interna", COLABORADOR), ["rascunho"]);
  assert.deepEqual(proximosBloqueados("revisao_interna", COLABORADOR), ["enviado"]);
  assert.deepEqual(proximosStatus("enviado", COLABORADOR), []);
  assert.deepEqual(proximosStatus("ajuste_solicitado", COLABORADOR), ["revisao_interna"]);
  assert.deepEqual(proximosStatus("rascunho", SEM_PERMISSAO), [], "leitor não muda nada");
  assert.deepEqual(proximosStatus("arquivado", TODAS), []);
});

test("o mapa de transições é o mesmo do banco", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  const doBanco = new Map([...sql.matchAll(/when '([a-z_]+)>([a-z_]+)' then '([a-z]+)'/g)].map(r => [`${r[1]}>${r[2]}`, r[3]]));
  const doApp = new Map(Object.entries(TRANSICOES).flatMap(([de, paras]) =>
    Object.entries(paras).map(([para, acao]) => [`${de}>${para}`, acao] as const)));
  assert.equal(doBanco.size, 7);
  assert.deepEqual([...doApp.entries()].sort(), [...doBanco.entries()].sort());
});

test("papéis no banco: leitor só lê; revisor avalia; responsável decide", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /when 'editar' then p_papel in \('admin', 'colaborador', 'visualizador'\)/);
  assert.match(sql, /when 'avaliar' then p_papel = 'admin'\s+or \(p_papel in \('colaborador', 'visualizador'\) and p_funcao in \('revisor', 'responsavel'\)\)/);
  assert.match(sql, /when 'decidir' then p_papel = 'admin'\s+or \(p_papel in \('colaborador', 'visualizador'\) and p_funcao = 'responsavel'\)/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /'leitor'/, "leitor não aparece em nenhuma permissão");
});

test("status e histórico mudam juntos, e só pela função", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  const funcao = /create or replace function public\.fn_prestacao_mudar_status[\s\S]*?\$\$;/.exec(sql)?.[0] ?? "";
  assert.match(funcao, /for update/);
  assert.match(funcao, /update public\.prestacoes_contas set status = p_novo_status/);
  assert.match(funcao, /insert into public\.prestacao_status_log/);
  assert.match(sql, /before insert or update of status on public\.prestacoes_contas/);
  assert.match(sql, /after insert on public\.prestacoes_contas/);
  assert.match(sql, /revoke all on public\.prestacao_status_log from anon, authenticated;\s*grant select on public\.prestacao_status_log to authenticated;/);
  assert.match(sql, /before insert or update on public\.prestacao_comprovantes/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /\bdrop\b/i);
});

test("escrita exige papel nas tabelas da prestação", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  for (const tabela of ["prestacao_itens", "prestacao_comprovantes", "prestacao_atividades",
    "prestacao_relatorio", "prestacao_distribuicao", "prestacao_divulgacao"]) {
    assert.ok(sql.includes(`'${tabela}'`), tabela);
  }
  for (const regra of ["prestacao_atividade_evidencias: papel insere", "prestacoes_contas: papel cria",
    "prestacoes_contas: papel edita", "prestacoes_contas: papel apaga"]) {
    assert.ok(sql.includes(`"${regra}"`), regra);
  }
  assert.equal((sql.match(/as restrictive/g) ?? []).length >= 9, true);
});

test("as telas usam as funções do banco", async () => {
  const detalhe = await readFile("app/(dashboard)/prestacoes/[id]/page.tsx", "utf8");
  assert.match(detalhe, /rpc\("fn_prestacao_mudar_status"/);
  assert.doesNotMatch(detalhe, /from\("prestacao_status_log"\)\.insert/);
  assert.doesNotMatch(detalhe, /update\(\{ status: novoStatus \}\)/);
  const comprovantes = await readFile("app/(dashboard)/prestacoes/[id]/comprovantes/page.tsx", "utf8");
  assert.match(comprovantes, /rpc\("fn_prestacao_avaliar_comprovante"/);
  assert.doesNotMatch(comprovantes, /\.update\(\{ status \}\)/);
});

test("toda recusa do banco tem texto na tela", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  const codigos = [...sql.matchAll(/raise exception '([a-z_]+)'/g)].map(r => r[1]);
  assert.ok(codigos.length >= 4);
  for (const codigo of codigos) {
    assert.doesNotMatch(mensagemErroPrestacao({ message: codigo }, "PADRAO"), /PADRAO/, codigo);
  }
});
