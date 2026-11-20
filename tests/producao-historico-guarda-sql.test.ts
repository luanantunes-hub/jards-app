import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";

// PD0.10b: o gatilho do histórico (fn_producao_historico) não grava ao alterar uma linha quando a organização
// dela já foi apagada, como já não gravava ao apagar. A migration é o texto da função da PD0.10 com a guarda no
// ramo de alterar. Este teste confere, sem banco, que é só isso, e que atributos e privilégios seguem iguais.

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");
const normalizar = (sql: string) => sql.replace(/\s+/g, " ").trim();

async function achar(sufixo: string): Promise<{ nome: string; sql: string }> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith(sufixo));
  assert.ok(nome, `migration ${sufixo} não encontrada`);
  return { nome, sql: await readFile(`supabase/migrations/${nome}`, "utf8") };
}

/** O corpo da função do gatilho (entre `as $$` e `$$;`), sem comentários e com os espaços reduzidos a um. */
function corpoDaFuncao(sql: string): string {
  const m = /create or replace function public\.fn_producao_historico\(\)[\s\S]*?\bas \$\$([\s\S]*?)\$\$;/.exec(sql);
  assert.ok(m, "a função fn_producao_historico não foi encontrada");
  return normalizar(semComentarios(m[1]));
}

const GUARDA_DE_ALTERAR =
  "if not exists (select 1 from public.organizations org where org.id = new.organization_id) then return null; end if;";

test("a função nova é a da PD0.10 com a guarda no ramo de alterar, e só isso", async () => {
  const antiga = corpoDaFuncao((await achar("_producao_historico.sql")).sql);
  const nova = corpoDaFuncao((await achar("_producao_historico_guarda_alterar.sql")).sql);
  const esperada = antiga.replace("if tg_op = 'UPDATE' then insert into", `if tg_op = 'UPDATE' then ${GUARDA_DE_ALTERAR} insert into`);
  assert.notEqual(esperada, antiga, "o ponto da guarda não foi achado na função da PD0.10");
  assert.equal(nova, esperada);
});

test("os dois ramos que mexem em linha existente guardam a organização: alterar (new) e apagar (old)", async () => {
  const nova = corpoDaFuncao((await achar("_producao_historico_guarda_alterar.sql")).sql);
  const guardas = [...nova.matchAll(/if not exists \(select 1 from public\.organizations org where org\.id = ([\w.]+)\) then return null; end if;/g)].map(m => m[1]);
  assert.deepEqual(guardas, ["new.organization_id", "v_org"]);
  // A de criar não existe: a linha acaba de nascer com a organização por chave.
  assert.ok(nova.indexOf(guardas[0]) < nova.indexOf("insert into public.producao_historico"));
});

test("só a função muda: mesmos atributos, mesmo privilégio, nenhum gatilho, nenhum drop", async () => {
  const { nome, sql } = await achar("_producao_historico_guarda_alterar.sql");
  const comandos = dividirComandos(sql).map(normalizar);
  assert.equal(comandos.length, 4, comandos.map(c => c.slice(0, 60)).join(" | "));
  assert.equal(comandos[0], "set local lock_timeout = '10s'");
  assert.match(comandos[1], /^create or replace function public\.fn_producao_historico\(\) returns trigger language plpgsql security definer set search_path = public, pg_temp set timezone = 'UTC' as \$\$/);
  assert.equal(comandos[2], "revoke execute on function public.fn_producao_historico() from public, anon, authenticated");
  assert.match(comandos[3], /^comment on function public\.fn_producao_historico\(\) is '/);
  // Nenhum comando (o texto da função tem DELETE e UPDATE como valores de tg_op, que não contam).
  assert.deepEqual(comandos.filter(c => /^(drop|grant|alter|delete|insert|update|create (or replace )?trigger)\b/i.test(c)), []);
  // A versão vem depois da migration do histórico, para o create or replace valer por último.
  const { nome: nomeDoHistorico } = await achar("_producao_historico.sql");
  assert.ok(nome > nomeDoHistorico, `${nome} deve vir depois de ${nomeDoHistorico}`);
});
