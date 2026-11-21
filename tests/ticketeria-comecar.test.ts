import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import {
  PERFIS, RESPOSTAS_VAZIAS, argumentosDoComecar, centavosDe, conferirPasso, divisaoDosLugares, mensagemDoErroDoComecar, precoDaMeia,
  type RespostasDoComecar,
} from "../lib/ticketeria/comecar";

// O onboarding da Ticketeria ("Começar"). O teste de banco é supabase/tests/ticketeria_comecar.test.sql; estes conferem, sem
// banco, a conferência dos passos, a conta da meia (igual à do banco) e a forma da migration.

const HOJE = "2026-11-21";
const CHEIO: RespostasDoComecar = {
  ...RESPOSTAS_VAZIAS, perfil: "unico", evento: "Show de lançamento", lugar: "Casa de Cultura", cidade: "Rio de Janeiro",
  lugares: "100", data: "2026-12-20", hora: "20:00", preco: "60",
};

async function migration(): Promise<string> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith("_ticketeria_comecar.sql"));
  assert.ok(nome, "migration ticketeria_comecar.sql não encontrada");
  return readFile(`supabase/migrations/${nome}`, "utf8");
}
const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");

test("os quatro perfis são os que o banco aceita, na ordem da tela", async () => {
  assert.deepEqual([...PERFIS], ["espaco", "turne", "unico", "festival"]);
  const sql = semComentarios(await migration()).replace(/\s+/g, " ");
  assert.match(sql, /check \(perfil is null or perfil in \('espaco', 'turne', 'unico', 'festival'\)\)/);
});

test("cada passo diz o que falta, um campo por vez", () => {
  assert.equal(conferirPasso("perfil", RESPOSTAS_VAZIAS, HOJE), "Escolha uma opção para continuar");
  assert.equal(conferirPasso("perfil", CHEIO, HOJE), null);
  assert.equal(conferirPasso("evento", { ...CHEIO, evento: "  " }, HOJE), "Dê um nome ao evento");
  assert.equal(conferirPasso("evento", { ...CHEIO, lugar: "" }, HOJE), "Diga onde vai ser");
  assert.equal(conferirPasso("evento", { ...CHEIO, perfil: "espaco", lugar: "" }, HOJE), "Diga o nome do espaço");
  assert.equal(conferirPasso("evento", { ...CHEIO, lugares: "0" }, HOJE), "Diga quantos lugares há");
  assert.equal(conferirPasso("evento", { ...CHEIO, lugares: "200001" }, HOJE), "São no máximo 200.000 lugares");
  assert.equal(conferirPasso("evento", { ...CHEIO, data: "" }, HOJE), "Escolha a data");
  assert.equal(conferirPasso("evento", { ...CHEIO, data: "2026-11-20" }, HOJE), "A data já passou");
  assert.equal(conferirPasso("evento", { ...CHEIO, data: HOJE }, HOJE), null, "hoje ainda vale");
  assert.equal(conferirPasso("evento", { ...CHEIO, perfil: "festival", dias: "40" }, HOJE), "O festival pode ter de 1 a 31 dias");
  assert.equal(conferirPasso("evento", CHEIO, HOJE), null);
  assert.equal(conferirPasso("ingresso", { ...CHEIO, preco: "" }, HOJE), "Diga o preço da inteira, ou marque gratuito");
  assert.equal(conferirPasso("ingresso", { ...CHEIO, preco: "", gratuito: true }, HOJE), null);
  assert.equal(conferirPasso("ingresso", CHEIO, HOJE), null);
});

test("o preço digitado vira centavos, no jeito brasileiro", () => {
  assert.equal(centavosDe("60"), 6000);
  assert.equal(centavosDe("59,90"), 5990);
  assert.equal(centavosDe("R$ 1.200,50"), 120050);
  assert.equal(centavosDe("12.5"), 1250);
  for (const ruim of ["", "abc", "1,2,3", "-5"]) assert.equal(centavosDe(ruim), null, ruim);
});

test("a meia fica com 40% dos lugares pela metade do preço, como o banco divide", () => {
  assert.deepEqual(divisaoDosLugares(100, true, false), { inteira: 60, meia: 40 });
  assert.deepEqual(divisaoDosLugares(7, true, false), { inteira: 5, meia: 2 });
  assert.deepEqual(divisaoDosLugares(2, true, false), { inteira: 2, meia: 0 }, "menos de 3 lugares: sem meia");
  assert.deepEqual(divisaoDosLugares(100, false, false), { inteira: 100, meia: 0 });
  assert.deepEqual(divisaoDosLugares(500, true, true), { inteira: 500, meia: 0 }, "gratuito: sem meia");
  assert.equal(precoDaMeia(6000), 3000);
  assert.equal(precoDaMeia(5990), 2995);
  assert.equal(precoDaMeia(1), 1);
});

test("a conta da meia no banco é a mesma da tela", async () => {
  const sql = semComentarios(await migration()).replace(/\s+/g, " ");
  assert.match(sql, /if coalesce\(p_meia, false\) and v_lugares >= 3 then v_meia := floor\(v_lugares \* 0\.4\);/);
  assert.match(sql, /greatest\(1, round\(p_preco_centavos \/ 2\.0\)::integer\)/);
});

test("os argumentos da chamada saem limpos", () => {
  assert.deepEqual(argumentosDoComecar("org", { ...CHEIO, cidade: " ", evento: " Show " }), {
    p_org: "org", p_perfil: "unico", p_evento: "Show", p_local: "Casa de Cultura", p_cidade: null, p_lugares: 100,
    p_data: "2026-12-20", p_hora: "20:00", p_dias: null, p_preco_centavos: 6000, p_meia: true,
  });
  const festival = argumentosDoComecar("org", { ...CHEIO, perfil: "festival", dias: "3", gratuito: true });
  assert.equal(festival.p_dias, 3);
  assert.equal(festival.p_preco_centavos, 0);
  assert.equal(festival.p_meia, false, "gratuito não pede meia");
});

test("os erros do banco viram texto da tela", () => {
  assert.match(mensagemDoErroDoComecar({ message: "sem_permissao" }), /Só quem edita/);
  assert.equal(mensagemDoErroDoComecar({ message: "data_no_passado" }), "A data já passou. Escolha outra.");
  assert.equal(mensagemDoErroDoComecar({ message: "outra coisa" }), "Não foi possível criar o evento. Tente de novo.");
  assert.equal(mensagemDoErroDoComecar(null), "Não foi possível criar o evento. Tente de novo.");
});

test("a migration é aditiva, a função roda com a permissão de quem chama e o gatilho do slug é consertado", async () => {
  const sql = await migration();
  const codigo = semComentarios(sql).replace(/\s+/g, " ");
  assert.doesNotMatch(codigo, /\bdrop\b/i, "sem DROP");
  assert.match(codigo, /set local lock_timeout = '10s'/);
  assert.match(codigo, /create or replace function public\.fn_ticketeria_comecar\([^)]*\) returns jsonb language plpgsql security invoker set search_path = public, pg_temp/);
  assert.match(codigo, /if not public\.auth_ticketeria_pode\(p_org, 'editar'\) then raise exception 'sem_permissao'/);
  assert.match(codigo, /revoke execute on function public\.fn_ticketeria_comecar\(uuid, text, text, text, text, integer, date, time, integer, integer, boolean\) from public, anon;/);
  assert.match(codigo, /grant execute on function public\.fn_ticketeria_comecar\(uuid, text, text, text, text, integer, date, time, integer, integer, boolean\) to authenticated;/);
  assert.match(codigo, /alter function public\.fn_ticketeria_evento_slug\(\) security definer;/);
  assert.match(codigo, /insert into public\.ticketeria_eventos \(organization_id, loja_id, titulo, criado_por\)/, "o evento nasce em rascunho (padrão da tabela)");
});

test("a tela vazia da Ticketeria leva ao onboarding, e o onboarding chama a função do banco", async () => {
  const inicio = await readFile("app/(dashboard)/ingressos/page.tsx", "utf8");
  assert.match(inicio, /href="\/ingressos\/comecar"/);
  const tela = await readFile("components/ticketeria/ComecarView.tsx", "utf8");
  assert.match(tela, /\.rpc\("fn_ticketeria_comecar", argumentosDoComecar\(organizationId, r\)\)/);
  assert.match(tela, /href="\/ingressos\/recebimentos"/, "a conta de recebimento fica para o fim, sem travar");
  const teste = await readFile("supabase/tests/ticketeria_comecar.test.sql", "utf8");
  const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
  assert.equal(teste.match(/^select (is|isnt|ok|throws_ok|lives_ok)\(/gm)?.length, plano, "o plano do teste de banco bate");
  assert.doesNotMatch(semComentarios(teste), /\bdelete\b/i);
});
