import assert from "node:assert/strict";
import test from "node:test";
import { gerarLinhaDeHistorico, gerarMigration, gerarTesteDeBanco, gerarTipos, lerColunas, lerExemplo, lerRegras, tipoTsDoSql, type OpcoesDoMolde } from "../scripts/molde-de-tabela";
import { montarCopiaGravadora } from "../scripts/rodar-teste-banco";

const base: OpcoesDoMolde = {
  molde: "org", tabela: "producao_exemplo", cabecalho: "Exemplo", colunas: lerColunas("nome text not null; site_url text; arquivada boolean not null default false; capacidade integer"),
  regras: lerRegras("nome_check: char_length(btrim(nome)) between 1 and 120; capacidade_check: capacidade is null or capacidade > 0"),
  unico: "organization_id, lower(btrim(nome))", pai: null, colunaDoPai: null, exemplo: lerExemplo("nome|'Exemplo {n}'"), prefixoDoTeste: "exe", motivoSemHistorico: "é só um exemplo",
};

test("as colunas: o tipo TypeScript, se é obrigatória na gravação e o que não se conhece", () => {
  const colunas = lerColunas("nome text not null; site_url text; arquivada boolean not null default false; capacidade integer; preco numeric(10,2) not null");
  assert.deepEqual(colunas.map(c => [c.nome, c.tipoTs, c.obrigatoria]), [["nome", "string", true], ["site_url", "string", false], ["arquivada", "boolean", false], ["capacidade", "number", false], ["preco", "number", true]]);
  assert.equal(tipoTsDoSql("varchar(80)"), "string");
  assert.equal(tipoTsDoSql("double precision"), "number");
  assert.throws(() => tipoTsDoSql("jsonb"), /desconhecido/);
  assert.throws(() => lerColunas("sozinho"), /mal escrita/);
});

test("as regras e o exemplo: o nome vem antes dos dois pontos, a expressão pode ter ponto e vírgula dentro de texto não, e {n} vira rótulo", () => {
  assert.deepEqual(lerRegras("a_check: x > 0; b_check: y ~ '^https://'"), [{ nome: "a_check", expressao: "x > 0" }, { nome: "b_check", expressao: "y ~ '^https://'" }]);
  assert.throws(() => lerRegras("sem dois pontos"), /mal escrita/);
  assert.deepEqual(lerExemplo("nome, site_url|'Marca {n}', null"), { colunas: ["nome", "site_url"], valores: ["'Marca {n}'", "null"] });
  assert.throws(() => lerExemplo("sem barra"), /--exemplo/);
});

test("a migration da forma org: tabela, regras, gatilhos, as cinco regras de acesso, permissões e nada de DROP", () => {
  const sql = gerarMigration(base);
  assert.match(sql, /create table if not exists public\.producao_exemplo \(/);
  assert.match(sql, /constraint producao_exemplo_nome_check check \(char_length\(btrim\(nome\)\) between 1 and 120\)/);
  assert.match(sql, /create unique index if not exists producao_exemplo_unico_key on public\.producao_exemplo \(organization_id, lower\(btrim\(nome\)\)\)/);
  for (const regra of ["le", "leitura sem assinatura", "insere", "edita", "apaga"]) assert.match(sql, new RegExp(`create policy "producao_exemplo: ${regra}"`));
  assert.match(sql, /auth_producao_ve_temporada\(organization_id, null\)/);
  assert.match(sql, /revoke all on public\.producao_exemplo from anon, authenticated;/);
  assert.match(sql, /grant select, insert, update, delete on public\.producao_exemplo to authenticated;/);
  assert.doesNotMatch(sql, /^\s*drop\s/im, "nenhum comando DROP (só o comentário diz que não há)");
});

test("a migration da forma filha: a coluna da mãe com cascata, a mãe visível nas regras e a coerência da organização", () => {
  const sql = gerarMigration({ ...base, tabela: "producao_filha", molde: "filha", pai: "producao_hospedagens", colunaDoPai: "hospedagem_id" });
  assert.match(sql, /hospedagem_id uuid not null references public\.producao_hospedagens \(id\) on delete cascade/);
  assert.match(sql, /exists \(select 1 from public\.producao_hospedagens p where p\.id = producao_filha\.hospedagem_id\)/);
  assert.match(sql, /pai_de_outra_organizacao/);
  assert.doesNotMatch(sql, /auth_producao_ve_temporada/);
  assert.throws(() => gerarMigration({ ...base, molde: "filha" }), /--pai/);
});

test("o nome da tabela tem de começar com producao_", () => {
  assert.throws(() => gerarMigration({ ...base, tabela: "marcas" }), /producao_/);
});

test("os tipos: Row, Insert e Update no jeito do banco.ts, com a chave da organização", () => {
  const tipos = gerarTipos(base);
  assert.match(tipos, /producao_exemplo: \{\n {8}Row: \{/);
  assert.match(tipos, /nome: string;\n {10}site_url: string \| null;\n {10}arquivada: boolean;\n {10}capacidade: number \| null;/);
  assert.match(tipos, /Insert: \{[\s\S]*nome: string;[\s\S]*site_url\?: string \| null;[\s\S]*arquivada\?: boolean;/);
  assert.match(tipos, /foreignKeyName: "producao_exemplo_organization_id_fkey"/);
  assert.equal(gerarLinhaDeHistorico(base), '  producao_exemplo: "é só um exemplo",\n');
});

test("o teste de banco gerado: plano certo, os papéis, e as aspas do exemplo dobradas dentro do texto", () => {
  const sql = gerarTesteDeBanco(base);
  const verificacoes = (sql.match(/^select (is|ok|isnt)\(/gm) ?? []).length;
  assert.match(sql, new RegExp(`select plan\\(${verificacoes}\\);`));
  assert.match(sql, /create schema exe;/);
  assert.match(sql, /values \(%L, ''Exemplo N1''\)/, "o exemplo entra dentro de um texto: aspas dobradas");
  assert.match(sql, /colaborador cria/);
  assert.match(sql, /o recorte "vinculado" sem vínculo não lê/);
  assert.match(sql, /select \* from finish\(\);\nrollback;/);
  assert.throws(() => gerarTesteDeBanco({ ...base, exemplo: null }), /--exemplo/);
  assert.throws(() => gerarTesteDeBanco({ ...base, molde: "filha", pai: "p", colunaDoPai: "p_id" }), /filha/);
});

test("a cópia gravadora: cada verificação vira um insert, no fim devolve total e falhas, a migration entra depois do begin e o $$ dela fica inteiro", () => {
  const teste = gerarTesteDeBanco(base);
  const migration = "create function f() returns int language sql as $$ select 1 $$;";
  const { sql, verificacoes, esquema } = montarCopiaGravadora(teste, [migration]);
  assert.equal(esquema, "exe");
  assert.equal((sql.match(/^insert into exe\.saida \(t\) select (is|ok|isnt)\(/gm) ?? []).length, verificacoes);
  assert.match(sql, /select \(select count\(\*\) from exe\.saida\) as total/);
  assert.match(sql, /^begin;\ncreate function f\(\) returns int language sql as \$\$ select 1 \$\$;/m);
  assert.doesNotMatch(sql, /select \* from finish\(\);/);
  assert.throws(() => montarCopiaGravadora("select 1;"), /create schema/);
});
