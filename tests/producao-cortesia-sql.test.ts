import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { MODULOS_COM_CONTRATO } from "../lib/equipe-modulos";
import { INICIO_DO_MODULO } from "../lib/modulos";
import { NOME_NO_TEXTO } from "../lib/modulos-contrato";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";

// PD0.6: o teste de banco (supabase/tests/cortesia_por_modulo.test.sql) roda a rotina
// antiga e a nova sobre os mesmos dados (supabase/tests/README.md). Estes conferem, sem
// banco, a forma da migration, que as listas, os nomes e os links do SQL são os do app e
// que a prestação ficou com os textos de antes, palavra por palavra.

const ANTIGA = "supabase/migrations/20261011110000_prestacao_teste_gratis_45_dias.sql";
const TESTE = "supabase/tests/cortesia_por_modulo.test.sql";
const FUNCAO = "fn_prestacao_cortesias_diaria";

async function migracao(): Promise<{ nome: string; sql: string }> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith("_producao_cortesia_por_modulo.sql"));
  assert.ok(nome, "migration producao_cortesia_por_modulo.sql não encontrada");
  return { nome, sql: await readFile(`supabase/migrations/${nome}`, "utf8") };
}

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");
const compacto = (texto: string) => texto.replace(/\s+/g, " ").trim();

/** Comandos do arquivo, sem comentários e com os espaços reduzidos a um. */
const comandosDe = (sql: string) => dividirComandos(semComentarios(sql)).map(compacto);

/** O corpo (entre os $$) da rotina diária, espaços reduzidos a um. */
function corpoDaRotina(sql: string): string {
  const comando = dividirComandos(semComentarios(sql)).find(c => c.startsWith(`create or replace function public.${FUNCAO}()`));
  assert.ok(comando, "função não encontrada");
  return compacto(comando.slice(comando.indexOf("$$") + 2, comando.lastIndexOf("$$")));
}

/** As chamadas a fn_emit_notification do corpo, por evento (o primeiro argumento). */
function avisosDe(corpo: string): Map<string, string> {
  const avisos = new Map<string, string>();
  for (const [chamada, evento] of corpo.matchAll(/perform public\.fn_emit_notification\( '([a-z_]+)',[\s\S]*?\);/g)) {
    assert.ok(!avisos.has(evento), `evento ${evento} repetido`);
    avisos.set(evento, chamada);
  }
  return avisos;
}

/** Os ids de módulo (textos entre aspas simples) de um trecho. */
const idsDe = (trecho: string | undefined) => [...(trecho ?? "").matchAll(/'([a-z_]+)'/g)].map(m => m[1]);

test("a migration vem depois da última versão da rotina e das migrations da PD0.1", async () => {
  const { nome } = await migracao();
  assert.ok(nome > "20261011110000", "depois da versão anterior da rotina");
  assert.ok(nome >= "20261015062658", "as migrations da fase 0 usam as versões gravadas no banco, a partir da PD0.1");
});

test("só troca o corpo da rotina: sem DROP, com o caminho de busca fixo, e as permissões e o job ficam como estão", async () => {
  const { sql } = await migracao();
  const comandos = comandosDe(sql);
  assert.doesNotMatch(semComentarios(sql), /\bdrop\b/i, "sem DROP: o conector trava em comandos destrutivos");
  assert.ok(comandos.includes("set local lock_timeout = '10s'"), "lock_timeout curto");
  const criacoes = comandos.filter(c => /^create (or replace )?(function|table|trigger|policy)/i.test(c));
  assert.equal(criacoes.length, 1, "uma função, nada mais");
  assert.match(criacoes[0], /^create or replace function public\.fn_prestacao_cortesias_diaria\(\) returns integer language plpgsql security definer set search_path = public, pg_temp as \$\$/);
  assert.ok(comandos.includes(`revoke execute on function public.${FUNCAO}() from public, anon, authenticated`),
    "o revoke da migration original se repete");
  assert.doesNotMatch(semComentarios(sql), /cron\.(schedule|unschedule)/, "o job jards-prestacao-cortesias não é recriado");
  assert.doesNotMatch(semComentarios(sql), /fn_processar_cobranca_modulo/, "a cobrança fica para a PDL.1");
});

test("os módulos avisados, os nomes e os links do SQL são os do app", async () => {
  const corpo = corpoDaRotina((await migracao()).sql);
  assert.deepEqual(idsDe(/where om\.modulo in \(([^)]*)\)/.exec(corpo)?.[1]), [...MODULOS_COM_CONTRATO], "o aviso olha os módulos com contrato");
  for (const [variavel, campo] of [["v_nome", (m: keyof typeof NOME_NO_TEXTO) => NOME_NO_TEXTO[m].completo], ["v_link", (m: keyof typeof INICIO_DO_MODULO) => INICIO_DO_MODULO[m]]] as const) {
    const ramos = [...(new RegExp(`${variavel} := case contrato\\.modulo (.*?) end;`).exec(corpo)?.[1] ?? "").matchAll(/when '(\w+)' then '([^']+)'/g)];
    assert.deepEqual(ramos.map(r => r[1]), [...MODULOS_COM_CONTRATO], `${variavel}: um ramo por módulo com contrato, na mesma ordem`);
    for (const [, modulo, texto] of ramos) assert.equal(texto, (campo as (m: string) => string)(modulo), `${variavel}: ${modulo}`);
  }
});

test("a prestação tem os textos, os links, os eventos e as chaves de antes, palavra por palavra", async () => {
  const antiga = corpoDaRotina(await readFile(ANTIGA, "utf8"));
  const nova = corpoDaRotina((await migracao()).sql);

  // As chamadas de antes: três eventos. Os dois do teste grátis são idênticos; o da cortesia vem do nome e do link do módulo.
  const antigas = avisosDe(antiga);
  const novas = avisosDe(nova);
  assert.deepEqual([...antigas.keys()].sort(), ["modulo_cortesia_fim", "modulo_teste_encerrado", "modulo_teste_fim"]);
  for (const evento of ["modulo_teste_fim", "modulo_teste_encerrado"]) {
    assert.equal(novas.get(evento), antigas.get(evento), `${evento}: igual ao de antes`);
  }
  const daPrestacao = novas.get("modulo_cortesia_fim")!
    .replace("'Cortesia da ' || v_nome || ' termina em breve'", "'Cortesia da prestação de contas termina em breve'")
    .replace("'O acesso de cortesia ao módulo de ' || v_nome || ' vai até '", "'O acesso de cortesia ao módulo de prestação de contas vai até '")
    .replace("v_link,", "'/prestacoes',");
  assert.equal(daPrestacao, antigas.get("modulo_cortesia_fim"), "modulo_cortesia_fim: com o nome e o link da prestação, igual ao de antes");
  assert.doesNotMatch(daPrestacao, /v_nome|v_link/, "nenhuma variável sobrou");

  // O que não é aviso não mudou: a janela de 7 dias, o encerramento, o log de auditoria e o final.
  const semAvisos = (corpo: string) => corpo.replace(/perform public\.fn_emit_notification\( [\s\S]*?\);/g, "perform aviso;");
  const trechos = (corpo: string) => ({
    janela: /and om\.status = 'cortesia'[\s\S]*?hoje \+ 7/.exec(corpo)?.[0],
    encerramento: /update public\.organization_modulos set status = 'cancelado'[\s\S]*?returning [^;]*?loop/.exec(corpo)?.[0],
    auditoria: /insert into public\.admin_audit_logs[\s\S]*?'teste_gratis', contrato\.teste_gratis\)\);/.exec(corpo)?.[0],
    destinatarios: [...corpo.matchAll(/select membro\.user_id from public\.organization_members membro where membro\.organization_id = contrato\.organization_id and membro\.papel = 'admin'/g)].length,
    final: /perform public\.fn_aplicar_modulo_ativo[\s\S]*$/.exec(corpo)?.[0],
    marca: /update public\.organization_modulos set cortesia_aviso_em = now\(\) where id = contrato\.id;/.exec(corpo)?.[0],
  });
  const antes = trechos(semAvisos(antiga));
  const depois = trechos(semAvisos(nova));
  for (const parte of ["janela", "encerramento", "auditoria", "final", "marca"] as const) {
    assert.ok(antes[parte], `${parte}: não achei o trecho antigo`);
    assert.equal(depois[parte], antes[parte], `${parte}: igual ao de antes`);
  }
  assert.equal(antes.destinatarios, 2, "antes: os administradores recebiam o aviso de 7 dias e o de teste encerrado");
  assert.equal(depois.destinatarios, 3, "depois: e o aviso novo de encerramento da produção, sempre os administradores");
});

test("o teste grátis e o aviso de teste encerrado continuam só da prestação, e só a produção ganha o aviso de encerramento", async () => {
  const corpo = corpoDaRotina((await migracao()).sql);
  assert.match(corpo, /if contrato\.teste_gratis and contrato\.modulo = 'prestacao' then perform public\.fn_emit_notification\( 'modulo_teste_fim'/);
  assert.match(corpo, /if contrato\.teste_gratis and contrato\.modulo = 'prestacao' then for destinatario in .*? 'modulo_teste_encerrado'/);
  assert.match(corpo, /elsif contrato\.modulo = 'producao' then for destinatario in .*? 'modulo_cortesia_encerrada'/);
  // O aviso novo leva o nome e o link da produção, com a data final na chave (um prazo novo avisa de novo).
  const encerrada = avisosDe(corpo).get("modulo_cortesia_encerrada")!;
  assert.match(encerrada, /'A cortesia da produção terminou'/);
  assert.match(encerrada, /'O acesso de cortesia ao módulo de produção terminou em '/);
  assert.match(encerrada, /'\/producoes', 'sistema', 'alta', 'organization_modulo', contrato\.id, null/);
  assert.match(encerrada, /'modulo_cortesia_encerrada:' \|\| contrato\.id \|\| ':' \|\| contrato\.cortesia_ate \|\| ':' \|\| destinatario\.user_id/);
  assert.equal(avisosDe(corpo).size, 4, "quatro avisos: cortesia, teste, teste encerrado e a cortesia da produção encerrada");
});

test("o teste de banco compara com a rotina antiga de verdade, fecha o plano e desfaz tudo", async () => {
  const teste = await readFile(TESTE, "utf8");
  // A cópia da rotina antiga é a de 20261011110000, sem tirar nem pôr.
  const colada = /create function pg_temp\.cortesias_antiga\(\)([\s\S]*?)as \$\$([\s\S]*?)\$\$;/.exec(teste);
  assert.ok(colada, "falta a cópia da rotina antiga");
  assert.equal(compacto(colada[2]), corpoDaRotina(await readFile(ANTIGA, "utf8")));
  assert.match(colada[1], /security definer\s+set search_path = public, pg_temp/);
  // Cada cenário da prestação e da produção que o plano pede.
  for (const caso of [
    "pg_temp.cortesias_antiga", "public.fn_prestacao_cortesias_diaria", "modulo_cortesia_encerrada", "modulo_teste_fim",
    "modulo_teste_encerrado", "modulo_cortesia_fim", "/producoes", "/prestacoes", "produção marcada como teste grátis",
    "cron.job", "jards-prestacao-cortesias", "admin_audit_logs", "prazo novo, aviso novo",
  ]) {
    assert.ok(teste.includes(caso), `o teste de banco não cobre ${caso}`);
  }
  assert.ok(teste.includes("0d060000-"), "prefixo de ids da PD0.6");
  const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
  const verificacoes = teste.match(/^select (is|isnt|ok|throws_ok|lives_ok)\(/gm)?.length ?? 0;
  assert.equal(verificacoes, plano);
  const comandos = dividirComandos(teste);
  assert.equal(comandos[0], "begin");
  assert.equal(comandos.at(-1), "rollback");
});
