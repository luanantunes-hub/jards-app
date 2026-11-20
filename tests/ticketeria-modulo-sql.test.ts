import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { MODULOS_COM_CONTRATO, PAPEIS_EXTERNOS } from "../lib/equipe-modulos";
import { INICIO_DO_MODULO, MODULOS, MODULOS_EM_CONSTRUCAO, moduloDaRota, moduloVisivel } from "../lib/modulos";
import { NOME_NO_TEXTO, mensagemErroAcesso } from "../lib/modulos-contrato";
import { dividirComandos } from "../lib/supabase/sql-em-bloco";
import { ITENS_DO_MENU } from "../e2e/perfis";

// T0 da ticketeria: o teste de acesso roda no banco (supabase/tests/README.md). Estes
// conferem, sem banco, que as listas de módulos do SQL são as de MODULOS em
// lib/modulos.ts, a forma das duas migrations da entrega e que o módulo fica escondido.
// O id do módulo é "ticketeria"; a rota no app é /ingressos, porque
// jards.com.br/ticketeria é a página pública do produto.

const TESTE = "supabase/tests/ticketeria_modulo.test.sql";
const PRECEDENTE = "20261005130100_convites_papeis.sql";
const POLITICA = "organization_members: modulo pago so pelo suporte";
const ROTINA = "fn_prestacao_cortesias_diaria";

/** As quatro regras de módulo, com os nomes conferidos em pg_constraint (18/11/2026). */
const REGRAS = [
  { tabela: "organization_invitations", nome: "organization_invitations_modulos_acesso_check", coluna: "modulos_acesso" },
  { tabela: "organization_members", nome: "organization_members_modulos_acesso_check", coluna: "modulos_acesso" },
  { tabela: "organization_modulos", nome: "organization_modulos_modulo_check", coluna: "modulo" },
  { tabela: "organization_seat_purchases", nome: "organization_seat_purchases_modulo_check", coluna: "modulo" },
];

async function migration(assunto: "regras" | "funcoes"): Promise<{ nome: string; sql: string }> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith(`_ticketeria_modulo_${assunto}.sql`));
  assert.ok(nome, `migration ticketeria_modulo_${assunto}.sql não encontrada`);
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

// ─── O módulo no app ────────────────────────────────────────────────────────

test("a ticketeria é o último módulo, escondida dos clientes, com página e rótulos próprios", () => {
  assert.deepEqual([...MODULOS], ["captacao", "prestacao", "producao", "ticketeria"]);
  assert.ok(MODULOS_EM_CONSTRUCAO.includes("ticketeria"), "escondida enquanto o plano não manda abrir");
  assert.equal(INICIO_DO_MODULO.ticketeria, "/ingressos", "jards.com.br/ticketeria é a página pública do produto");
  assert.equal(moduloDaRota("/ingressos"), "ticketeria");
  assert.equal(moduloDaRota("/ingressos/eventos/1"), "ticketeria");
  assert.equal(moduloDaRota("/ingressos-antigos"), "captacao", "prefixo parecido não é da ticketeria");
  assert.equal(moduloDaRota("/ticketeria"), "captacao", "a página pública não é rota do módulo");
  assert.ok(MODULOS_COM_CONTRATO.includes("ticketeria"), "as vagas vêm do contrato do módulo");
  assert.deepEqual(NOME_NO_TEXTO.ticketeria, { completo: "ticketeria", curto: "ticketeria" });
  assert.equal(mensagemErroAcesso("sem_vaga_ticketeria"), "Todas as vagas da ticketeria estão em uso.");
});

test("cliente sem a ticketeria não a vê; o super admin e quem já tem, sim", () => {
  for (const modulos of [[], ["captacao"], ["captacao", "prestacao"], ["captacao", "producao"], ["captacao", "prestacao", "producao"]] as const) {
    assert.equal(moduloVisivel("ticketeria", modulos), false, modulos.join("+"));
    assert.equal(moduloVisivel("ticketeria", modulos, true), true, `${modulos.join("+")} (super admin)`);
  }
  assert.equal(moduloVisivel("ticketeria", ["captacao", "ticketeria"]), true);
  // O que o cliente vê hoje não muda: captação e prestação seguem visíveis, a produção segue escondida.
  assert.equal(moduloVisivel("captacao", ["captacao"]), true);
  assert.equal(moduloVisivel("prestacao", ["captacao"]), true);
  assert.equal(moduloVisivel("producao", ["captacao"]), false);
});

test("o seletor do layout tem a ticketeria, com rótulo, descrição e menu próprios", async () => {
  const layout = await readFile("app/(dashboard)/layout.tsx", "utf8");
  assert.match(layout, /\{ id: "ticketeria", label: "Ticketeria", +descricao: "[^"]+", +icone: \w+ *\}/);
  assert.match(layout, /ticketeria: \[\s*\{\s*section: "[^"]+",\s*items: \[\s*\{ label: "Página inicial", href: "\/ingressos", icon: Home \},\s*\{ label: "Eventos", href: "\/ingressos\/eventos"/);
  // O e2e por perfil acha o item do menu pelo nome: nenhum nome se repete entre módulos.
  const nomes = Object.values(ITENS_DO_MENU).flat();
  assert.equal(new Set(nomes).size, nomes.length, "nome de item de menu repetido entre módulos");
});

test("a página /ingressos é protegida no servidor e tem estado vazio (desde a T2, a lista de eventos)", async () => {
  const layout = await readFile("app/(dashboard)/ingressos/layout.tsx", "utf8");
  assert.ok(!/^["']use client["']/m.test(layout), "o layout é de servidor");
  assert.ok(layout.includes('await exigirModulo("ticketeria")'));
  const pagina = await readFile("app/(dashboard)/ingressos/eventos/page.tsx", "utf8");
  assert.match(pagina, /ListEmptyState/);
  // A T2 lê os eventos da Ticketeria; dinheiro (Stripe, provedor de pagamento) segue fora.
  assert.doesNotMatch(pagina, /stripe/i);
  for (const tabela of pagina.matchAll(/from\("(\w+)"\)/g)) assert.match(tabela[1], /^ticketeria_/, `a lista de eventos só lê tabelas da Ticketeria (${tabela[1]})`);
});

test("a compra de vaga da ticketeria fica indisponível (409), sem tocar no Stripe", async () => {
  const rota = await readFile("app/api/members/seats/route.ts", "utf8");
  assert.match(rota, /default: return NextResponse\.json\(\{ error: mensagemCompraIndisponivel\(modulo\) \}, \{ status: 409 \}\);/);
  const casos = [...rota.matchAll(/case "(\w+)":/g)].map(m => m[1]);
  assert.ok(!casos.includes("ticketeria"), "a ticketeria cai no ramo da compra indisponível");
});

// ─── As migrations ──────────────────────────────────────────────────────────

test("as duas migrations são da entrega, nesta ordem, depois das da produção", async () => {
  const regras = await migration("regras");
  const funcoes = await migration("funcoes");
  assert.ok(regras.nome < funcoes.nome, "a migration das regras vem primeiro");
  assert.ok(regras.nome > "20261015062658", "depois das migrations da PD0.1");
  assert.ok(funcoes.sql.includes(regras.nome), "a das funções cita a das regras pela versão");
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
  assert.ok(comandos.includes("set local lock_timeout = '10s'"), "lock_timeout curto");
  assert.match(regras.sql, /ESTA É A ÚNICA MIGRATION COM DROP DA ENTREGA/);
  assert.ok(regras.sql.includes(`supabase/migrations/${PRECEDENTE}`), "cita o precedente");
  assert.ok((await readdir("supabase/migrations")).includes(PRECEDENTE), "o precedente existe");
});

test("a migration das funções não tem DROP e não mexe na cobrança nem no Stripe", async () => {
  const codigo = semComentarios((await migration("funcoes")).sql);
  assert.doesNotMatch(codigo, /\bdrop\b/i);
  assert.doesNotMatch(codigo, /fn_processar_cobranca_modulo|stripe/i);
  assert.doesNotMatch(codigo, /\bcreate (table|policy|trigger)\b/i, "nenhuma tabela de ingresso, loja ou evento (T1 em diante)");
});

test("a porta do navegador da PD0.1 já vale para a ticketeria: nada a recriar", async () => {
  const comandos = comandosDe((await migration("regras")).sql);
  assert.ok(!comandos.some(c => c.includes("create policy")), "a regra restritiva não é recriada");
  const pd01 = await readFile("supabase/migrations/20261015062440_producao_modulo_regras.sql", "utf8");
  assert.match(pd01.replace(/\s+/g, " "),
    /with check \(coalesce\(modulos_acesso, '\{\}'\) <@ array\['captacao'\]::text\[\] or public\.is_jards_super_admin\(\)\)/,
    "a regra restritiva só libera a captação, qualquer que seja o módulo pago");
});

test("as três funções de módulo repetem a lista de MODULOS", async () => {
  const comandos = comandosDe((await migration("funcoes")).sql);
  assert.deepEqual(idsDe(/unnest\(array\[([^\]]*)\]\)/.exec(funcao(comandos, "modulos_canonicos"))?.[1]), [...MODULOS],
    "modulos_canonicos na ordem de MODULOS");
  assert.deepEqual(idsDe(/p_modulos <@ array\[([^\]]*)\]::text\[\]/.exec(funcao(comandos, "fn_conferir_modulos"))?.[1]), [...MODULOS],
    "fn_conferir_modulos");
  const ramos = [...funcao(comandos, "modulo_vagas_limite").matchAll(/when '(\w+)' then/g)].map(m => m[1]);
  assert.deepEqual(ramos, [...MODULOS], "modulo_vagas_limite tem um ramo por módulo");
});

test("o ramo da ticketeria em modulo_vagas_limite é igual ao da prestação e ao da produção", async () => {
  const comandos = comandosDe((await migration("funcoes")).sql);
  const ramos = new Map(
    [...funcao(comandos, "modulo_vagas_limite").matchAll(/when '(\w+)' then (.*?)(?= when '\w+' then | else 0 end)/g)]
      .map(m => [m[1], m[2]] as const));
  assert.ok(ramos.get("prestacao") && ramos.get("producao") && ramos.get("ticketeria"), "os ramos foram lidos");
  assert.equal(ramos.get("ticketeria"), ramos.get("prestacao")!.replaceAll("'prestacao'", "'ticketeria'"));
  assert.equal(ramos.get("producao"), ramos.get("prestacao")!.replaceAll("'prestacao'", "'producao'"));
  assert.match(ramos.get("captacao")!, /organization_seats/);
});

test("captador e proponente só podem ter a captação", async () => {
  const conferir = funcao(comandosDe((await migration("funcoes")).sql), "fn_conferir_modulos");
  const listas = [...conferir.matchAll(/p_papel (?:not )?in \(([^)]*)\)/g)].map(m => idsDe(m[1]).sort());
  assert.equal(listas.length, 2, "a recusa do módulo pago e a isenção de vaga");
  for (const papeis of listas) assert.deepEqual(papeis, [...PAPEIS_EXTERNOS].sort());
  assert.match(conferir,
    /p_papel in \('captador', 'proponente'\) and exists \(select 1 from unnest\(p_modulos\) as pedido where pedido <> 'captacao'\) then raise exception 'captador_sem_modulo'/);
  // O código de falta de vaga é por módulo: sem_vaga_ticketeria.
  assert.match(conferir, /raise exception 'sem_vaga_%', modulo/);
});

test("a rotina diária avisa os módulos com contrato, com os nomes e as páginas do app", async () => {
  const rotina = funcao(comandosDe((await migration("funcoes")).sql), ROTINA);
  assert.deepEqual(idsDe(/where om\.modulo in \(([^)]*)\)/.exec(rotina)?.[1]), [...MODULOS_COM_CONTRATO]);
  for (const [variavel, campo] of [["v_nome", (m: string) => NOME_NO_TEXTO[m as keyof typeof NOME_NO_TEXTO].completo], ["v_link", (m: string) => INICIO_DO_MODULO[m as keyof typeof INICIO_DO_MODULO]]] as const) {
    const ramos = [...(new RegExp(`${variavel} := case contrato\\.modulo (.*?) end;`).exec(rotina)?.[1] ?? "").matchAll(/when '(\w+)' then '([^']+)'/g)];
    assert.deepEqual(ramos.map(r => r[1]), [...MODULOS_COM_CONTRATO], variavel);
    for (const [, modulo, texto] of ramos) assert.equal(texto, campo(modulo), `${variavel}: ${modulo}`);
  }
  assert.match(rotina, /elsif contrato\.modulo = 'ticketeria' then .*'A cortesia da ticketeria terminou'.*'\/ingressos'/);
});

test("a rotina diária é a de antes mais a ticketeria, palavra por palavra", async () => {
  const anterior = funcao(comandosDe(await readFile("supabase/migrations/20261015083221_cortesia_prestacao_aviso_fim.sql", "utf8")), ROTINA);
  const nova = funcao(comandosDe((await migration("funcoes")).sql), ROTINA);
  const ramo = /elsif contrato\.modulo = 'ticketeria' then .*? end loop; (?=end if; end loop; perform)/.exec(nova)?.[0];
  assert.ok(ramo, "o ramo do fim da cortesia da ticketeria");
  const semTicketeria = nova
    .replace(ramo, "")
    .replace("in ('prestacao', 'producao', 'ticketeria')", "in ('prestacao', 'producao')")
    .replace(" when 'ticketeria' then 'ticketeria' end;", " end;")
    .replace(" when 'ticketeria' then '/ingressos' end;", " end;");
  assert.equal(semTicketeria, anterior);
});

test("toda função da migration tem search_path fixo e revoga de public e anon; os acessos de hoje ficam", async () => {
  const comandos = comandosDe((await migration("funcoes")).sql);
  const criadas = comandos.filter(c => c.startsWith("create or replace function "));
  const nomes = criadas.map(c => /^create or replace function public\.(\w+)\(/.exec(c)?.[1]);
  assert.deepEqual([...nomes].sort(), [ROTINA, "fn_conferir_modulos", "modulo_vagas_limite", "modulos_canonicos"].sort());
  for (const comando of criadas) {
    const [, nome, argumentos] = /^create or replace function public\.(\w+)\(([^)]*)\)/.exec(comando)!;
    const tipos = argumentos.split(",").map(a => a.trim().split(" ").slice(1).join(" ")).filter(Boolean).join(", ");
    assert.match(comando, /set search_path = public, pg_temp/, `${nome}: search_path fixo`);
    assert.ok(comandos.some(c => c.startsWith(`revoke execute on function public.${nome}(${tipos}) from public, anon`)),
      `${nome}(${tipos}): falta o revoke de public e anon`);
  }
  for (const nome of [ROTINA, "fn_conferir_modulos", "modulo_vagas_limite"]) {
    assert.match(funcao(comandos, nome), /security definer/, nome);
  }
  assert.ok(comandos.includes(`revoke execute on function public.${ROTINA}() from public, anon, authenticated`));
  assert.ok(comandos.includes("grant execute on function public.modulo_vagas_limite(uuid, text) to service_role"));
});

test("o teste de acesso confere as quatro regras, a regra restritiva e os casos do plano", async () => {
  const teste = await readFile(TESTE, "utf8");
  for (const { nome } of REGRAS) assert.ok(teste.includes(`'${nome}'`), `${nome} fora do teste de acesso`);
  assert.ok(teste.includes(`'${POLITICA}'`), "a regra restritiva fora do teste de acesso");
  for (const caso of [
    "reservar_convite_com_modulos", "sem_vaga_ticketeria", "sem_vaga_captacao", "sem_vaga_prestacao", "captador_sem_modulo",
    "admin_definir_acesso_modulo", "accept_my_organization_invitations", "modulo_inativo", "ultimo_modulo",
    "insert into public.organization_modulos", "'cortesia'", "modulos_ativos", "jards_super_admin", ROTINA, "/ingressos",
  ]) {
    assert.ok(teste.includes(caso), `o teste de acesso não cobre ${caso}`);
  }
});

test("o plano do teste de acesso bate com as verificações, tudo é desfeito e não há DELETE", async () => {
  const teste = await readFile(TESTE, "utf8");
  const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
  const verificacoes = teste.match(/^select (is|isnt|ok|throws_ok|lives_ok)\(/gm)?.length ?? 0;
  assert.equal(verificacoes, plano);
  const comandos = dividirComandos(teste);
  assert.equal(comandos[0], "begin");
  assert.equal(comandos.at(-1), "rollback");
  assert.doesNotMatch(semComentarios(teste), /\bdelete\b/i, "o conector recusa blocos de ensaio com delete");
});
