import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { PAPEIS_EXTERNOS } from "../lib/equipe-modulos";
import { MODULOS } from "../lib/modulos";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";

// PD0.1: o teste de acesso roda no banco (supabase/tests/README.md). Estes
// conferem, sem banco, que as listas de módulos do SQL são as de MODULOS em
// lib/modulos.ts e a forma das duas migrations da entrega.

const TESTE = "supabase/tests/producao_modulo.test.sql";
const PRECEDENTE = "20261005130100_convites_papeis.sql";
const POLITICA = "organization_members: modulo pago so pelo suporte";

/** As quatro regras de módulo, com os nomes conferidos em pg_constraint (15/10/2026). */
const REGRAS = [
  { tabela: "organization_invitations", nome: "organization_invitations_modulos_acesso_check", coluna: "modulos_acesso" },
  { tabela: "organization_members", nome: "organization_members_modulos_acesso_check", coluna: "modulos_acesso" },
  { tabela: "organization_modulos", nome: "organization_modulos_modulo_check", coluna: "modulo" },
  { tabela: "organization_seat_purchases", nome: "organization_seat_purchases_modulo_check", coluna: "modulo" },
];

async function migration(assunto: "regras" | "funcoes"): Promise<{ nome: string; sql: string }> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith(`_producao_modulo_${assunto}.sql`));
  assert.ok(nome, `migration producao_modulo_${assunto}.sql não encontrada`);
  return { nome, sql: await readFile(`supabase/migrations/${nome}`, "utf8") };
}

const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");

/** Comandos da migration, sem comentários e com os espaços reduzidos a um. */
function comandosDe(sql: string): string[] {
  return dividirComandos(semComentarios(sql)).map(comando => comando.replace(/\s+/g, " ").trim());
}

/** Os ids de módulo (textos entre aspas simples) de um trecho de array SQL. */
const idsDe = (trecho: string | undefined) => [...(trecho ?? "").matchAll(/'([a-z_]+)'/g)].map(m => m[1]);

function funcao(comandos: string[], nome: string): string {
  const comando = comandos.find(c => c.startsWith(`create or replace function public.${nome}(`));
  assert.ok(comando, `função ${nome} não encontrada na migration`);
  return comando;
}

test("as duas migrations são da entrega, nesta ordem: regras antes das funções", async () => {
  const regras = await migration("regras");
  const funcoes = await migration("funcoes");
  assert.ok(regras.nome < funcoes.nome, "a migration das regras vem primeiro");
  assert.ok(regras.nome >= "20261015062440", "as migrations da fase 0 usam as versões gravadas no banco, a partir de 20261015062440");
});

test("as quatro regras de módulo do banco listam os mesmos módulos que MODULOS, na mesma ordem", async () => {
  const comandos = comandosDe((await migration("regras")).sql);
  for (const { tabela, nome, coluna } of REGRAS) {
    const soltar = comandos.indexOf(`alter table public.${tabela} drop constraint if exists ${nome}`);
    assert.ok(soltar >= 0, `${nome}: falta o drop constraint if exists`);
    const criar = comandos[soltar + 1] ?? "";
    assert.ok(criar.startsWith(`alter table public.${tabela} add constraint ${nome} check (`),
      `${nome}: o add constraint vem logo depois do drop`);
    assert.deepEqual(idsDe(/array\[([^\]]*)\]/.exec(criar)?.[1]), [...MODULOS], `${nome}: a lista é a de MODULOS`);
    const forma = coluna === "modulos_acesso"
      ? /check \(cardinality\(modulos_acesso\) > 0 and modulos_acesso <@ array\[/
      : /check \(modulo = any \(array\[/;
    assert.match(criar, forma, `${nome}: a forma da regra não mudou`);
  }
});

test("a migration das regras é a única com DROP, e só derruba as quatro regras", async () => {
  const regras = await migration("regras");
  const comandos = comandosDe(regras.sql);
  const drops = comandos.filter(c => /\bdrop\b/i.test(c));
  assert.equal(drops.length, REGRAS.length);
  for (const { tabela, nome } of REGRAS) {
    assert.ok(drops.includes(`alter table public.${tabela} drop constraint if exists ${nome}`), nome);
  }
  // O comentário do topo diz isso e cita o precedente aplicado à mão.
  assert.match(regras.sql, /ESTA É A ÚNICA MIGRATION COM DROP DA ENTREGA/);
  assert.match(regras.sql, /editor SQL/);
  assert.ok(regras.sql.includes(`supabase/migrations/${PRECEDENTE}`), "cita o precedente");
  const precedente = await readdir("supabase/migrations");
  assert.ok(precedente.includes(PRECEDENTE), "o precedente existe");
});

test("a migration das funções não tem DROP", async () => {
  const codigo = semComentarios((await migration("funcoes")).sql);
  assert.doesNotMatch(codigo, /\bdrop\b/i);
});

test("a regra restritiva fecha a porta do navegador antes de as regras abrirem, e a captação é livre", async () => {
  const comandos = comandosDe((await migration("regras")).sql);
  const politica = comandos.findIndex(c => c.includes(`create policy "${POLITICA}"`));
  const primeiroDrop = comandos.findIndex(c => /\bdrop\b/i.test(c));
  assert.ok(politica >= 0, "falta a regra restritiva");
  assert.ok(politica < primeiroDrop, "a regra restritiva vem antes do primeiro DROP");
  assert.match(comandos[politica],
    /on public\.organization_members as restrictive for insert to authenticated with check \(coalesce\(modulos_acesso, '\{\}'\) <@ array\['captacao'\]::text\[\] or public\.is_jards_super_admin\(\)\)/);
  assert.equal(MODULOS[0], "captacao", "o módulo livre, o único que o navegador insere, é o primeiro de MODULOS");
});

test("as três funções repetem a lista de MODULOS", async () => {
  const comandos = comandosDe((await migration("funcoes")).sql);
  assert.deepEqual(idsDe(/unnest\(array\[([^\]]*)\]\)/.exec(funcao(comandos, "modulos_canonicos"))?.[1]), [...MODULOS],
    "modulos_canonicos na ordem de MODULOS");
  assert.deepEqual(idsDe(/p_modulos <@ array\[([^\]]*)\]::text\[\]/.exec(funcao(comandos, "fn_conferir_modulos"))?.[1]), [...MODULOS],
    "fn_conferir_modulos");
  const ramos = [...funcao(comandos, "modulo_vagas_limite").matchAll(/when '(\w+)' then/g)].map(m => m[1]);
  assert.deepEqual(ramos, [...MODULOS], "modulo_vagas_limite tem um ramo por módulo");
});

test("o ramo da produção em modulo_vagas_limite é igual ao da prestação", async () => {
  const comandos = comandosDe((await migration("funcoes")).sql);
  const ramos = new Map(
    [...funcao(comandos, "modulo_vagas_limite").matchAll(/when '(\w+)' then (.*?)(?= when '\w+' then | else 0 end)/g)]
      .map(m => [m[1], m[2]] as const));
  assert.ok(ramos.get("prestacao") && ramos.get("producao"), "os dois ramos foram lidos");
  assert.equal(ramos.get("producao"), ramos.get("prestacao")!.replaceAll("'prestacao'", "'producao'"));
  // A captação segue contando as vagas compradas, e o que não é módulo não tem vaga.
  assert.match(ramos.get("captacao")!, /organization_seats/);
  assert.match(funcao(comandos, "modulo_vagas_limite"), / else 0 end/);
});

test("captador e proponente só podem ter a captação, e isso vale para qualquer módulo que entre depois", async () => {
  const conferir = funcao(comandosDe((await migration("funcoes")).sql), "fn_conferir_modulos");
  const listas = [...conferir.matchAll(/p_papel (?:not )?in \(([^)]*)\)/g)].map(m => idsDe(m[1]).sort());
  assert.equal(listas.length, 2, "a recusa da produção e a isenção de vaga");
  for (const papeis of listas) assert.deepEqual(papeis, [...PAPEIS_EXTERNOS].sort());
  assert.match(conferir,
    /p_papel in \('captador', 'proponente'\) and exists \(select 1 from unnest\(p_modulos\) as pedido where pedido <> 'captacao'\) then raise exception 'captador_sem_modulo'/);
});

test("toda função da migration tem search_path fixo e revoga de public e anon", async () => {
  const comandos = comandosDe((await migration("funcoes")).sql);
  const criadas = comandos.filter(c => c.startsWith("create or replace function "));
  const nomes = criadas.map(c => /^create or replace function public\.(\w+)\(/.exec(c)?.[1]);
  assert.deepEqual([...nomes].sort(), ["fn_conferir_modulos", "modulo_vagas_limite", "modulos_canonicos"]);
  for (const comando of criadas) {
    const [, nome, argumentos] = /^create or replace function public\.(\w+)\(([^)]*)\)/.exec(comando)!;
    const tipos = argumentos.split(",").map(a => a.trim().split(" ").slice(1).join(" ")).join(", ");
    assert.match(comando, /set search_path = public, pg_temp/, `${nome}: search_path fixo`);
    assert.ok(comandos.some(c => c.startsWith(`revoke execute on function public.${nome}(${tipos}) from public, anon`)),
      `${nome}(${tipos}): falta o revoke de public e anon`);
  }
  // As duas que leem tabelas rodam com a permissão do dono e ficam fora do alcance de quem está logado.
  for (const nome of ["fn_conferir_modulos", "modulo_vagas_limite"]) {
    assert.match(funcao(comandos, nome), /security definer/, nome);
  }
  assert.ok(comandos.includes("revoke execute on function public.fn_conferir_modulos(uuid, text, text[], text, text[]) from public, anon, authenticated"));
  assert.ok(comandos.includes("revoke execute on function public.modulo_vagas_limite(uuid, text) from public, anon, authenticated"));
  assert.ok(comandos.includes("grant execute on function public.modulo_vagas_limite(uuid, text) to service_role"));
});

test("o teste de acesso confere as quatro regras, a regra restritiva e os casos do plano", async () => {
  const teste = await readFile(TESTE, "utf8");
  for (const { nome } of REGRAS) assert.ok(teste.includes(`'${nome}'`), `${nome} fora do teste de acesso`);
  assert.ok(teste.includes(`'${POLITICA}'`), "a regra restritiva fora do teste de acesso");
  // Convite só com a produção sem gastar a captação; sem contrato, sem vaga; externos recusados;
  // acesso dado pelo suporte; navegador barrado; contrato de cortesia liga o módulo.
  for (const caso of [
    "reservar_convite_com_modulos", "sem_vaga_producao", "sem_vaga_captacao", "captador_sem_modulo",
    "admin_definir_acesso_modulo", "accept_my_organization_invitations", "modulo_inativo", "ultimo_modulo",
    "insert into public.organization_modulos", "'cortesia'", "modulos_ativos", "jards_super_admin",
  ]) {
    assert.ok(teste.includes(caso), `o teste de acesso não cobre ${caso}`);
  }
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
