import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";

// O teste de banco (supabase/tests/cortesia_por_modulo.test.sql) roda a rotina antiga e a
// nova sobre os mesmos dados (supabase/tests/README.md). Estes conferem, sem banco, que a
// versão que avisa o fim da cortesia comum da prestação é a da PD0.6 mais um ramo, e nada
// além disso, e fixam o texto, o link e a chave do aviso novo.

const FUNCAO = "fn_prestacao_cortesias_diaria";

async function migracao(sufixo: string): Promise<string> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith(sufixo));
  assert.ok(nome, `migration ${sufixo} não encontrada`);
  return readFile(`supabase/migrations/${nome}`, "utf8");
}

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");
const compacto = (texto: string) => texto.replace(/\s+/g, " ").trim();

/** O corpo (entre os $$) da rotina diária, espaços reduzidos a um. */
function corpoDaRotina(sql: string): string {
  const comando = dividirComandos(semComentarios(sql)).find(c => c.startsWith(`create or replace function public.${FUNCAO}()`));
  assert.ok(comando, "função não encontrada");
  return compacto(comando.slice(comando.indexOf("$$") + 2, comando.lastIndexOf("$$")));
}

const RAMO = /elsif contrato\.modulo = 'prestacao' then (.*?) elsif contrato\.modulo = 'producao' then/;

test("a rotina é a da PD0.6 mais um ramo: tirado o ramo, o corpo é igual palavra por palavra", async () => {
  const anterior = corpoDaRotina(await migracao("_producao_cortesia_por_modulo.sql"));
  const nova = corpoDaRotina(await migracao("_cortesia_prestacao_aviso_fim.sql"));
  const ramo = RAMO.exec(nova);
  assert.ok(ramo, "falta o ramo da cortesia comum da prestação");
  assert.equal(nova.replace(`elsif contrato.modulo = 'prestacao' then ${ramo[1]} `, ""), anterior);
  assert.doesNotMatch(anterior, RAMO, "a PD0.6 não tinha esse ramo");
});

test("o ramo novo avisa os administradores, com o texto da prestação, o link de Meu plano e a chave de sempre", async () => {
  const nova = corpoDaRotina(await migracao("_cortesia_prestacao_aviso_fim.sql"));
  const ramo = RAMO.exec(nova)![1];
  assert.match(ramo, /^for destinatario in select membro\.user_id from public\.organization_members membro where membro\.organization_id = contrato\.organization_id and membro\.papel = 'admin' loop /);
  assert.match(ramo, /perform public\.fn_emit_notification\( 'modulo_cortesia_encerrada', contrato\.organization_id, destinatario\.user_id,/);
  assert.match(ramo, /'A cortesia da prestação de contas terminou',/);
  assert.match(ramo, /'O acesso de cortesia ao módulo de prestação de contas terminou em ' \|\| to_char\(contrato\.cortesia_ate, 'DD\/MM\/YYYY'\) \|\| '\. Os dados continuam guardados para consulta e exportação\. Para voltar a editar, assine em Meu plano\.',/);
  assert.match(ramo, /'\/meu-plano\?assinar=prestacao', 'sistema', 'alta', 'organization_modulo', contrato\.id, null,/);
  assert.match(ramo, /'modulo_cortesia_encerrada:' \|\| contrato\.id \|\| ':' \|\| contrato\.cortesia_ate \|\| ':' \|\| destinatario\.user_id,/);
});

test("o teste grátis encerrado segue com o aviso dele: o ramo novo vem depois e só vale para a cortesia comum", async () => {
  const nova = corpoDaRotina(await migracao("_cortesia_prestacao_aviso_fim.sql"));
  const teste = nova.indexOf("if contrato.teste_gratis and contrato.modulo = 'prestacao' then for destinatario in");
  const comum = nova.indexOf("elsif contrato.modulo = 'prestacao' then");
  const producao = nova.indexOf("elsif contrato.modulo = 'producao' then");
  assert.ok(teste >= 0 && teste < comum && comum < producao, "teste grátis, depois cortesia comum da prestação, depois produção");
});

test("só troca o corpo da rotina: sem DROP, com lock_timeout curto, e as permissões e o job ficam como estão", async () => {
  const sql = await migracao("_cortesia_prestacao_aviso_fim.sql");
  const comandos = dividirComandos(semComentarios(sql)).map(compacto);
  assert.doesNotMatch(semComentarios(sql), /\bdrop\b/i);
  assert.ok(comandos.includes("set local lock_timeout = '10s'"));
  const criacoes = comandos.filter(c => /^create (or replace )?(function|table|trigger|policy)/i.test(c));
  assert.equal(criacoes.length, 1, "uma função, nada mais");
  assert.match(criacoes[0], /^create or replace function public\.fn_prestacao_cortesias_diaria\(\) returns integer language plpgsql security definer set search_path = public, pg_temp as \$\$/);
  assert.ok(comandos.includes(`revoke execute on function public.${FUNCAO}() from public, anon, authenticated`));
  assert.doesNotMatch(semComentarios(sql), /cron\.(schedule|unschedule)/, "o job jards-prestacao-cortesias não é recriado");
  assert.doesNotMatch(semComentarios(sql), /fn_processar_cobranca_modulo/, "a cobrança fica para a PDL.1");
});
