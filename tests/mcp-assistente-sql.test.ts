import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { ROTULO_DO_ASSISTENTE, TABELAS_QUE_O_ASSISTENTE_CRIA } from "../lib/mcp/prestacao/acoes-do-assistente";
import { ORIGENS_DA_CAIXA } from "../lib/mcp/prestacao/caixa";
import { ACOES_DO_ASSISTENTE } from "../lib/mcp/prestacao/gravacao";
import { DESTINOS_DE_ENVIO, LIMITE_DO_ARQUIVO_BYTES, MAX_ARQUIVOS_POR_ENVIO } from "../lib/mcp/prestacao/tipos-de-envio";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";

// O assistente na prestação de contas: o teste de banco real é a conferência da migration contra o banco vivo (em
// transação desfeita); estes conferem, sem banco, a forma dela: aditiva, reaplicável, fechada para o navegador, e com as
// mesmas listas do código. A migration é achada pelo sufixo: quem a aplica a renomeia para a versão gravada no banco.

const TABELAS = ["assistente_acoes", "assistente_arquivos", "assistente_sessoes_envio"];

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");
const normalizar = (sql: string) => sql.replace(/\s+/g, " ").trim().toLowerCase();
const lista = (valores: readonly string[]) => `(${valores.map((valor) => `'${valor}'`).join(", ")})`;

async function migracao(): Promise<string> {
  const nome = (await readdir("supabase/migrations")).find((n) => n.endsWith("_assistente_prestacao.sql"));
  assert.ok(nome, "migration _assistente_prestacao.sql não encontrada");
  return readFile(`supabase/migrations/${nome}`, "utf8");
}

test("é aditiva: só troca as duas conferências de canal; nenhuma linha é apagada ou alterada", async () => {
  const sql = normalizar(semComentarios(await migracao()));
  const exclusoes = [...sql.matchAll(/\bdrop\b[^;]*/g)].map(([trecho]) => trecho.trim());
  assert.deepEqual(exclusoes, ["drop constraint if exists prestacao_comprovantes_canal_check", "drop constraint if exists prestacao_evidencias_canal_check"]);
  assert.ok(!/\bdelete\b|\btruncate\b|\bupdate\b/.test(sql.replace(/on delete (set null|cascade)/g, "")), "a migration não mexe em linhas");
});

test("é reaplicável: tabelas, índices e funções se recriam sem erro e cada regra de acesso só nasce uma vez", async () => {
  const sql = normalizar(semComentarios(await migracao()));
  for (const tabela of TABELAS) assert.ok(sql.includes(`create table if not exists public.${tabela} (`), `${tabela} sem if not exists`);
  assert.ok(!/create (unique )?index (?!if not exists)/.test(sql), "índice sem if not exists");
  assert.ok(!/create function/.test(sql), "função sem or replace");
  const criacoes = (sql.match(/create policy/g) ?? []).length;
  const conferencias = (sql.match(/if not exists \(select 1 from pg_policies/g) ?? []).length;
  assert.ok(criacoes > 0 && criacoes === conferencias, `políticas criadas: ${criacoes}; conferências de existência: ${conferencias}`);
});

test("as três tabelas têm RLS ligado, nada aberto ao navegador além da leitura da equipe, e a dos links não tem nem isso", async () => {
  const sql = normalizar(semComentarios(await migracao()));
  for (const tabela of TABELAS) {
    assert.ok(sql.includes(`alter table public.${tabela} enable row level security`), `${tabela} sem RLS`);
    assert.ok(sql.includes(`revoke all on table public.${tabela} from anon, authenticated`), `${tabela} sem revoke`);
  }
  assert.ok(sql.includes("grant select on table public.assistente_acoes to authenticated"));
  assert.ok(sql.includes("grant select on table public.assistente_arquivos to authenticated"));
  assert.ok(!sql.includes("grant select on table public.assistente_sessoes_envio"), "só o servidor lê os links de envio");
  assert.ok(!/grant (insert|update|delete|all)/.test(sql), "o navegador nunca grava nessas tabelas");
  assert.ok(sql.includes("array['assistente_acoes', 'assistente_arquivos']"), "as políticas de leitura são só das duas tabelas da equipe");
});

test("as funções do assistente são do servidor: sem execução para o navegador e com caminho de busca fixo", async () => {
  const sql = normalizar(semComentarios(await migracao()));
  for (const assinatura of ["fn_mcp_prestacao_pode(uuid, uuid, text)", "fn_prestacao_avisar_assistente(uuid, text, text, text)"]) {
    assert.ok(sql.includes(`revoke all on function public.${assinatura} from public, anon, authenticated`), `${assinatura} sem revoke`);
    assert.ok(sql.includes(`grant execute on function public.${assinatura} to service_role`), `${assinatura} sem grant ao servidor`);
  }
  assert.equal((sql.match(/security definer/g) ?? []).length, 2);
  assert.equal((sql.match(/set search_path = public, pg_temp/g) ?? []).length, 2);
});

test("as listas fechadas do SQL são as do código: canais, origens, destinos, ações, plataformas e tabelas", async () => {
  const sql = normalizar(semComentarios(await migracao()));
  const igual = (trecho: string, mensagem: string) => assert.ok(sql.includes(normalizar(trecho)), mensagem);
  igual("check (canal = any (array['equipe', 'proponente', 'email', 'assistente']))", "canal das despesas");
  igual("check (canal = any (array['equipe', 'proponente', 'assistente']))", "canal das evidências");
  igual(`origem text not null check (origem in ${lista(ORIGENS_DA_CAIXA)})`, "origens da caixa");
  igual(`destino text not null check (destino in ${lista(DESTINOS_DE_ENVIO)})`, "destinos da caixa");
  igual(`acao text not null check (acao in ${lista(ACOES_DO_ASSISTENTE)})`, "ações da trilha");
  igual(`plataforma text not null default 'outro' check (plataforma in ${lista(Object.keys(ROTULO_DO_ASSISTENTE))})`, "plataformas");
  igual(`registro_tabela in ${lista(TABELAS_QUE_O_ASSISTENTE_CRIA)}`, "tabelas que o assistente cria");
});

test("os limites do SQL são os do código: 15 MB por arquivo, de 1 a 10 arquivos por link e hash de 64 caracteres", async () => {
  const sql = normalizar(semComentarios(await migracao()));
  assert.ok(sql.includes(`tamanho_bytes <= ${LIMITE_DO_ARQUIVO_BYTES}`));
  assert.ok(sql.includes(`max_arquivos between 1 and ${MAX_ARQUIVOS_POR_ENVIO}`));
  assert.ok(sql.includes("token_hash ~ '^[0-9a-f]{64}$'"));
  assert.ok(sql.includes("token_hash text not null unique"));
});

test("o mesmo conteúdo não entra duas vezes na mesma prestação, e as tabelas não têm organization_id", async () => {
  const sql = normalizar(semComentarios(await migracao()));
  assert.ok(sql.includes("create unique index if not exists assistente_arquivos_conteudo_key on public.assistente_arquivos (prestacao_id, destino, sha256) where sha256 is not null and situacao in ('recebido', 'registrado')"));
  const corpos = [...sql.matchAll(/create table if not exists public\.(\w+) \((.*?)\);/g)];
  assert.deepEqual(corpos.map(([, nome]) => nome), TABELAS);
  for (const [, nome, corpo] of corpos) assert.ok(!corpo.includes("organization_id"), `${nome}: o isolamento é pela prestação, não por organization_id`);
});

test("o plano do teste de banco bate com as verificações, tudo é desfeito e o README o descreve", async () => {
  const teste = await readFile("supabase/tests/assistente_prestacao.test.sql", "utf8");
  const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
  const verificacoes = teste.match(/^select (is|isnt|ok|throws_ok|lives_ok|results_eq|is_empty|isnt_empty)\(/gm)?.length ?? 0;
  assert.equal(verificacoes, plano, `plano ${plano} x verificações ${verificacoes}`);
  const comandos = dividirComandos(teste);
  assert.equal(comandos[0], "begin");
  assert.equal(comandos.at(-1), "rollback");
  assert.doesNotMatch(teste, /\d{14}_assistente_prestacao/, "o teste não depende da data do arquivo da migration");

  const leia = await readFile("supabase/tests/README.md", "utf8");
  assert.ok(leia.includes("`assistente_prestacao.test.sql`"), "o README dos testes de banco precisa descrever assistente_prestacao.test.sql");
});
