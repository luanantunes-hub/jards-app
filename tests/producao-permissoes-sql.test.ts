import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PAPEIS_EXTERNOS } from "../lib/equipe-modulos";
import { mensagemErroAcesso } from "../lib/modulos-contrato";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";

// PD0.7a: o teste de acesso roda no banco (supabase/tests/README.md). Estes
// conferem, sem banco, a forma da migration das permissões da produção e que o
// teste de acesso cobre o que ela promete. A migration é achada pelo sufixo: a
// sessão que a aplica a renomeia para a versão gravada no banco.

const TESTE = "supabase/tests/producao_permissoes.test.sql";
const MOLDE = "20261005140000_prestacao_status_e_papeis.sql";
const ACOES = ["ler", "editar", "dinheiro", "aprovar"];
/** As oito funções da migration. A ficha é só das outras (rodam com a permissão do dono) e não sai para o navegador. */
const FUNCOES = [
  "auth_producao_papel_permite", "auth_producao_ficha", "auth_producao_pode", "auth_producao_le_sem_assinatura",
  "auth_producao_dinheiro_sem_assinatura", "auth_producao_ve_temporada", "auth_producao_ve_espaco",
  "fn_producao_definir_funcao",
];
const INTERNA = "auth_producao_ficha";
const PURA = "auth_producao_papel_permite";
/** Os erros de fn_producao_definir_funcao, na ordem em que a função os confere. */
const ERROS = [
  "nao_autenticado", "sem_permissao", "dados_invalidos", "escopo_invalido", "alcada_invalida", "alcada_sem_dinheiro",
  "membro_inexistente", "captador_sem_modulo", "modulo_inativo", "pessoa_sem_producao",
];
/** Códigos que a tela de acesso já explica, e que a função reaproveita de propósito. */
const ERROS_DA_TELA = ["membro_inexistente", "captador_sem_modulo", "modulo_inativo"];

async function migration(): Promise<{ nome: string; sql: string }> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith("_producao_permissoes.sql"));
  assert.ok(nome, "migration producao_permissoes.sql não encontrada");
  return { nome, sql: await readFile(`supabase/migrations/${nome}`, "utf8") };
}

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");

/** Comandos da migration, sem comentários e com os espaços reduzidos a um. */
function comandosDe(sql: string): string[] {
  return dividirComandos(semComentarios(sql)).map(comando => comando.replace(/\s+/g, " ").trim());
}

function funcao(comandos: string[], nome: string): string {
  const comando = comandos.find(c => c.startsWith(`create or replace function public.${nome}(`));
  assert.ok(comando, `função ${nome} não encontrada na migration`);
  return comando;
}

/** Os tipos dos argumentos de uma função, como o revoke e o grant os escrevem. */
function tiposDe(comando: string): string {
  const argumentos = /^create or replace function public\.\w+\(([^)]*)\)/.exec(comando)?.[1] ?? "";
  return argumentos.split(",").map(a => a.trim().split(" ").slice(1).join(" ")).join(", ");
}

/** Os textos entre aspas simples de um trecho de SQL. */
const textosDe = (trecho: string) => [...trecho.matchAll(/'(\w+)'/g)].map(m => m[1]);

test("a migration é de expansão: sem DROP, reaplicável e só cria o que é da entrega", async () => {
  const { sql } = await migration();
  const comandos = comandosDe(sql);
  assert.doesNotMatch(semComentarios(sql), /\bdrop\b/i);
  assert.equal(comandos[0], "set local lock_timeout = '10s'");
  // Fora das funções, só se declara: nada de insert, update, delete nem truncate.
  assert.deepEqual([...new Set(comandos.map(c => c.split(" ")[0]))].sort(), ["alter", "comment", "create", "do", "grant", "revoke", "set"]);
  for (const comando of comandos.filter(c => /^(alter|comment on table)/.test(c))) {
    assert.match(comando, /public\.producao_funcoes/, "a migration só altera a tabela nova");
  }
  assert.equal(comandos.filter(c => /^create function /.test(c)).length, 0, "create or replace, para poder reaplicar");
  const criadas = comandos.filter(c => c.startsWith("create or replace function ")).map(c => /^create or replace function public\.(\w+)\(/.exec(c)?.[1]);
  assert.deepEqual([...criadas].sort(), [...FUNCOES].sort());
  const criacoes = comandos.filter(c => /^create (table|index|unique|trigger|view|policy)/.test(c));
  assert.equal(criacoes.length, 1, "a única criação fora de função é a tabela");
  assert.match(criacoes[0], /^create table if not exists public\.producao_funcoes \(/);
});

test("só as funções novas leem as tabelas de membros e a da entrega", async () => {
  const { sql } = await migration();
  const comandos = comandosDe(sql);
  const tabelas = new Set<string>();
  for (const nome of FUNCOES) {
    for (const m of funcao(comandos, nome).matchAll(/\b(?:from|join|into|update) public\.(\w+)/g)) {
      if (!m[1].startsWith("auth_")) tabelas.add(m[1]);
    }
  }
  assert.deepEqual([...tabelas].sort(), ["organization_members", "organizations", "producao_funcoes"]);
});

test("producao_funcoes: um registro por pessoa, preso ao vínculo, com as regras de valor", async () => {
  const comandos = comandosDe((await migration()).sql);
  const tabela = comandos.find(c => c.startsWith("create table if not exists public.producao_funcoes"))!;
  assert.match(tabela, /organization_id uuid not null, user_id uuid not null,/);
  assert.match(tabela, /dinheiro boolean not null default false,/);
  assert.match(tabela, /alcada numeric\(14, 2\),/);
  assert.match(tabela, /escopo text not null default 'organizacao',/);
  assert.match(tabela, /definido_por uuid references auth\.users \(id\) on delete set null,/);
  assert.match(tabela, /unique \(organization_id, user_id\)/);
  assert.match(tabela,
    /foreign key \(organization_id, user_id\) references public\.organization_members \(organization_id, user_id\) on delete cascade/);
  assert.deepEqual(textosDe(/check \(escopo in \(([^)]*)\)\)/.exec(tabela)?.[1] ?? ""), ["organizacao", "vinculado"]);
  assert.match(tabela, /check \(alcada is null or \(dinheiro and alcada >= 0\)\)/);
});

test("producao_funcoes: o navegador só lê; sem regra de escrita e sem privilégio de escrita", async () => {
  const comandos = comandosDe((await migration()).sql);
  const todos = comandos.join("\n");
  assert.ok(comandos.includes("alter table public.producao_funcoes enable row level security"));
  const regras = [...todos.matchAll(/create policy "([^"]+)" on public\.producao_funcoes for (\w+) to (\w+) using \((.*?)\); end if;/g)];
  assert.deepEqual(regras.map(r => [r[2], r[3]]), [["select", "authenticated"]], "uma regra só, de leitura");
  assert.equal(regras[0][4], "user_id = auth.uid() or public.auth_admin_da_organizacao(organization_id)");
  assert.doesNotMatch(todos, /create policy[^;]*\bfor (insert|update|delete|all)\b/i);
  const revoke = comandos.indexOf("revoke all on public.producao_funcoes from anon, authenticated");
  const grant = comandos.indexOf("grant select on public.producao_funcoes to authenticated");
  assert.ok(revoke >= 0 && grant > revoke, "revoga tudo e só então devolve a leitura");
  assert.deepEqual(comandos.filter(c => /^grant (?!execute)/.test(c)), ["grant select on public.producao_funcoes to authenticated"]);
});

test("toda função tem search_path fixo e revoga de public e anon; só a ficha fica fora do navegador", async () => {
  const comandos = comandosDe((await migration()).sql);
  for (const nome of FUNCOES) {
    const comando = funcao(comandos, nome);
    const tipos = tiposDe(comando);
    assert.match(comando, /set search_path = public, pg_temp/, `${nome}: search_path fixo`);
    if (nome === INTERNA) {
      assert.ok(comandos.includes(`revoke execute on function public.${nome}(${tipos}) from public, anon, authenticated`), `${nome}: fora do navegador`);
      assert.ok(!comandos.some(c => c.startsWith("grant execute") && c.includes(nome)), `${nome}: ninguém recebe execute`);
    } else {
      assert.ok(comandos.includes(`revoke execute on function public.${nome}(${tipos}) from public, anon`), `${nome}(${tipos}): falta o revoke de public e anon`);
      assert.ok(comandos.includes(`grant execute on function public.${nome}(${tipos}) to authenticated`), `${nome}(${tipos}): falta o grant a authenticated`);
    }
    // Só a regra por papel é pura e roda com a permissão de quem chama; as outras rodam com a do dono.
    assert.equal(/security definer/.test(comando), nome !== PURA, `${nome}: security definer`);
  }
  assert.ok(!comandos.some(c => c.startsWith("grant") && /\banon\b/.test(c)), "o visitante não recebe nada");
  assert.match(funcao(comandos, PURA), /language sql immutable set search_path/);
});

test("a regra por papel: quatro ações, captador e proponente nunca, e o editar é o da prestação", async () => {
  const comandos = comandosDe((await migration()).sql);
  const corpo = funcao(comandos, PURA);
  const ramos = new Map([...corpo.matchAll(/when '(\w+)' then (.*?)(?= when '\w+' then | end, false\))/g)].map(m => [m[1], m[2]] as const));
  assert.deepEqual([...ramos.keys()], ACOES);
  assert.match(corpo, / end, false\)/, "ação desconhecida nega");
  for (const [acao, condicao] of ramos) {
    for (const externo of PAPEIS_EXTERNOS) assert.ok(!textosDe(condicao).includes(externo), `${acao}: ${externo} não usa a produção`);
  }
  // Editar é o mesmo conjunto de papéis da prestação (o molde), com o nome antigo do colaborador.
  const prestacao = await readFile(`supabase/migrations/${MOLDE}`, "utf8");
  const doMolde = textosDe(/when 'editar' then p_papel in \(([^)]*)\)/.exec(prestacao)?.[1] ?? "");
  assert.deepEqual(textosDe(/^p_papel in \(([^)]*)\)/.exec(ramos.get("editar")!)?.[1] ?? ""), doMolde);
  assert.deepEqual(doMolde, ["admin", "colaborador", "visualizador"]);
  // O leitor só entra nas ações de ler: ler e ver o dinheiro. Aprovar muda o pedido, então exige editar.
  const comLeitor = ACOES.filter(acao => textosDe(ramos.get(acao)!).includes("leitor"));
  assert.deepEqual(comLeitor, ["ler", "dinheiro"]);
  assert.match(ramos.get("aprovar")!, /coalesce\(p_dinheiro, false\) and p_alcada is not null/);
  assert.match(ramos.get("dinheiro")!, /coalesce\(p_dinheiro, false\)/);
});

test("o recorte por vínculo falha fechado e a PD1.9 sabe o que trocar", async () => {
  const { sql } = await migration();
  const comandos = comandosDe(sql);
  for (const nome of ["auth_producao_ve_temporada", "auth_producao_ve_espaco"]) {
    const corpo = funcao(comandos, nome);
    assert.match(corpo, /ficha\.papel = 'admin' or ficha\.escopo = 'organizacao'/, `${nome}: só admin e organização inteira passam`);
    assert.doesNotMatch(corpo, /vinculado/, `${nome}: o ramo "vinculado" nega`);
    assert.doesNotMatch(corpo, /producao_(temporadas|espacos|vinculos|obras)/, `${nome}: não consulta tabela que ainda não existe`);
    assert.match(corpo, /public\.is_jards_super_admin\(\) or exists/, `${nome}: o super admin passa`);
  }
  // O cabeçalho diz o que a PD1.9 troca, com as duas funções pelo nome.
  const cabecalho = /O que a PD1\.9 troca[\s\S]*?(?=\nset local)/.exec(sql)?.[0] ?? "";
  assert.ok(cabecalho, "o cabeçalho explica o que a PD1.9 troca");
  for (const nome of ["auth_producao_ve_temporada", "auth_producao_ve_espaco", "producao_vinculos", "create or replace"]) {
    assert.ok(cabecalho.includes(nome), `o cabeçalho não cita ${nome}`);
  }
});

test("fn_producao_definir_funcao: confere quem chama, depois o alvo, e é a única que escreve", async () => {
  const comandos = comandosDe((await migration()).sql);
  const corpo = funcao(comandos, "fn_producao_definir_funcao");
  const codigos = [...corpo.matchAll(/raise exception '(\w+)'/g)].map(m => m[1]);
  assert.deepEqual(codigos, ERROS);
  const posicoes = ERROS.map(codigo => corpo.indexOf(`raise exception '${codigo}'`));
  assert.deepEqual(posicoes, [...posicoes].sort((a, b) => a - b), "os erros saem nesta ordem");
  assert.match(corpo, /if auth\.uid\(\) is null then raise exception 'nao_autenticado'/);
  assert.match(corpo, /if p_org is null or not public\.auth_admin_da_organizacao\(p_org\) then raise exception 'sem_permissao'/);
  // O alvo externo é o de PAPEIS_EXTERNOS, e a escrita só vem depois de todas as conferências.
  const externos = textosDe(/v_alvo\.papel in \(([^)]*)\)/.exec(corpo)?.[1] ?? "");
  assert.deepEqual([...externos].sort(), [...PAPEIS_EXTERNOS].sort());
  assert.ok(corpo.indexOf("insert into public.producao_funcoes") > corpo.indexOf("raise exception 'pessoa_sem_producao'"));
  assert.match(corpo, /on conflict \(organization_id, user_id\) do update/);
  for (const nome of FUNCOES.filter(n => n !== "fn_producao_definir_funcao")) {
    assert.doesNotMatch(funcao(comandos, nome), /\b(insert|update|delete)\b/i, `${nome} só lê`);
  }
  assert.doesNotMatch(comandos.join("\n").replace(corpo, ""), /(insert into|update|delete from) public\.producao_funcoes/);
});

test("os erros novos não caem na mensagem de outro erro da tela de acesso", () => {
  const generica = mensagemErroAcesso("erro_que_nao_existe");
  for (const codigo of ERROS) {
    if (ERROS_DA_TELA.includes(codigo)) {
      assert.notEqual(mensagemErroAcesso(codigo), generica, `${codigo}: a tela já o explica`);
    } else {
      assert.equal(mensagemErroAcesso(codigo), generica, `${codigo}: contém o código de outro erro e mostraria a mensagem errada`);
    }
  }
});

test("o teste de acesso cobre as funções, as ações, os erros e os casos do plano", async () => {
  const teste = await readFile(TESTE, "utf8");
  for (const nome of FUNCOES.filter(n => n !== INTERNA)) assert.ok(teste.includes(nome), `${nome} fora do teste de acesso`);
  for (const acao of ACOES) assert.ok(teste.includes(`'${acao}'`), `a ação ${acao} fora do teste de acesso`);
  for (const codigo of ERROS) assert.ok(teste.includes(`'${codigo}'`), `o erro ${codigo} fora do teste de acesso`);
  // Leitor lê e não escreve; dinheiro só com a função; ninguém escreve na tabela pelo navegador (nem com o privilégio
  // devolvido); só leitura (módulo encerrado); recorte por vínculo; sair da organização apaga a função; super admin,
  // outra organização e visitante.
  for (const caso of [
    "'leitor'", "'visualizador'", "'captador'", "'proponente'", "dinheiro_sem_assinatura", "le_sem_assinatura",
    "status = 'cancelado'", "'vinculado'", "jards_super_admin", "grant insert, update, delete", "revoke insert, update, delete",
    "pp_teste.como(null)", "new row violates row-level security policy", "delete from public.organization_members",
  ]) {
    assert.ok(teste.includes(caso), `o teste de acesso não cobre ${caso}`);
  }
  assert.ok(teste.includes("0d070000-0000-4000-8000-"), "o teste usa o prefixo de ids da entrega");
  assert.doesNotMatch(teste, /\d{14}_producao_permissoes/, "o teste não depende da data do arquivo da migration");
});

test("o plano do teste de acesso bate com as verificações e tudo é desfeito", async () => {
  const teste = await readFile(TESTE, "utf8");
  const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
  const verificacoes = teste.match(/^select (is|isnt|ok|throws_ok|lives_ok)\(/gm)?.length ?? 0;
  assert.equal(verificacoes, plano);
  const comandos = dividirComandos(teste);
  assert.equal(comandos[0], "begin");
  assert.equal(comandos.at(-1), "rollback");
});

test("o README dos testes de banco descreve o teste de acesso", async () => {
  const leia = await readFile("supabase/tests/README.md", "utf8");
  assert.match(leia, /`producao_permissoes\.test\.sql` confere a PD0\.7a/);
});
