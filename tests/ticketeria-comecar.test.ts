import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import {
  PERFIL, PERFIS, RESPOSTAS_VAZIAS, UFS_DO_COMECAR, argumentosDoComecar, centavosDe, conferirPasso, divisaoDosLugares, mapaDoAuditorio, mensagemDoErroDoComecar, nomeDoLocal, ondeDoEvento, passosDoComecar, precoDaMeia, sugestaoPorFileira,
  type RespostasDoComecar,
} from "../lib/ticketeria/comecar";
import { cidadeExata, cidadesDoBrasil, cidadesDoEstado, normalizar } from "../lib/ticketeria/local-do-evento";
import { ESTADOS_DO_MAPA } from "../lib/ticketeria/mapa-estados";
import { NOMES_DOS_MESES, dataPorExtenso, mesDaData, semanasDoMes, somarMeses } from "../lib/ticketeria/calendario";

// O onboarding da Ticketeria ("Começar"). O teste de banco é supabase/tests/ticketeria_comecar.test.sql; estes conferem, sem
// banco, a conferência dos passos, a conta da meia (igual à do banco) e a forma da migration.

const HOJE = "2026-11-21";
const CHEIO: RespostasDoComecar = {
  ...RESPOSTAS_VAZIAS, perfil: "unico", evento: "Show de lançamento", lugar: "Casa de Cultura", uf: "RJ", cidade: "Rio de Janeiro",
  lugares: "100", data: "2026-12-20", hora: "20:00", numerada: false, preco: "60",
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

test("são cinco passos, uma coisa por tela, e cada passo diz o que falta", () => {
  assert.deepEqual(passosDoComecar("unico", false), ["perfil", "nome", "onde", "data", "horario", "numerada", "lugares", "ingresso"]);
  assert.deepEqual(passosDoComecar("espaco", false), ["perfil", "nome", "onde", "evento", "data", "horario", "numerada", "lugares", "ingresso"], "quem tem espaço dá o nome do primeiro evento num passo só dele");
  assert.deepEqual(passosDoComecar("festival", null), ["perfil", "nome", "onde", "data", "dias", "horario", "numerada", "lugares", "ingresso"], "os dias só no festival");
  assert.deepEqual(passosDoComecar("turne", true), ["perfil", "nome", "onde", "data", "horario", "numerada", "lugares", "auditorio", "ingresso"], "o auditório só com lugares numerados");
  assert.equal(conferirPasso("perfil", RESPOSTAS_VAZIAS, HOJE), "Escolha uma opção para continuar");
  assert.equal(conferirPasso("perfil", CHEIO, HOJE), null);
  // O nome: só o nome. Quem tem espaço dá o nome do espaço; os outros, o nome do evento.
  assert.equal(conferirPasso("nome", { ...CHEIO, evento: "  " }, HOJE), "Dê um nome ao evento");
  assert.equal(conferirPasso("nome", { ...CHEIO, perfil: "espaco", lugar: "", evento: "Hamlet" }, HOJE), "Diga o nome do espaço");
  assert.equal(conferirPasso("nome", { ...CHEIO, perfil: "espaco", lugar: "Teatro Municipal", evento: "" }, HOJE), null, "o primeiro evento do espaço só é pedido no passo do quando");
  assert.equal(conferirPasso("nome", { ...CHEIO, evento: "x".repeat(201) }, HOJE), "O nome pode ter até 200 caracteres");
  assert.equal(conferirPasso("nome", CHEIO, HOJE), null);
  // O lugar: o estado no mapa e a cidade; o nome do lugar é opcional.
  assert.equal(conferirPasso("onde", { ...CHEIO, uf: "" }, HOJE), "Escolha o estado no mapa");
  assert.equal(conferirPasso("onde", { ...CHEIO, uf: "XX" }, HOJE), "Escolha o estado no mapa");
  assert.equal(conferirPasso("onde", { ...CHEIO, cidade: " " }, HOJE), "Escolha ou digite a cidade");
  assert.equal(conferirPasso("onde", { ...CHEIO, lugar: "" }, HOJE), null, "sem o nome do lugar vale a cidade");
  assert.equal(conferirPasso("onde", { ...CHEIO, cidade: "Cidade que não está na lista" }, HOJE), null, "cidade digitada vale");
  // O primeiro evento (só quem tem espaço), o dia, os dias do festival, o horário, os lugares numerados, quantos lugares e o auditório.
  assert.equal(conferirPasso("evento", { ...CHEIO, perfil: "espaco", evento: "" }, HOJE), "Dê um nome ao primeiro evento");
  assert.equal(conferirPasso("evento", { ...CHEIO, perfil: "espaco" }, HOJE), null);
  assert.equal(conferirPasso("data", { ...CHEIO, data: "" }, HOJE), "Escolha o dia");
  assert.equal(conferirPasso("data", { ...CHEIO, data: "2026-11-20" }, HOJE), "Esse dia já passou");
  assert.equal(conferirPasso("data", { ...CHEIO, data: HOJE }, HOJE), null, "hoje ainda vale");
  assert.equal(conferirPasso("dias", { ...CHEIO, perfil: "festival", dias: "40" }, HOJE), "O festival pode ter de 1 a 31 dias");
  assert.equal(conferirPasso("dias", { ...CHEIO, perfil: "festival", dias: "3" }, HOJE), null);
  assert.equal(conferirPasso("horario", { ...CHEIO, hora: "" }, HOJE), "Escolha o horário");
  assert.equal(conferirPasso("horario", CHEIO, HOJE), null);
  assert.equal(conferirPasso("numerada", { ...CHEIO, numerada: null }, HOJE), "Escolha sim ou não");
  assert.equal(conferirPasso("numerada", { ...CHEIO, numerada: true }, HOJE), null);
  assert.equal(conferirPasso("lugares", { ...CHEIO, lugares: "0" }, HOJE), "Diga quantos lugares há");
  assert.equal(conferirPasso("lugares", { ...CHEIO, lugares: "200001" }, HOJE), "São no máximo 200.000 lugares");
  assert.equal(conferirPasso("lugares", { ...CHEIO, numerada: true, lugares: "4801" }, HOJE), "Com lugares numerados, o máximo são 4.800 lugares");
  assert.equal(conferirPasso("lugares", { ...CHEIO, numerada: true, lugares: "4800" }, HOJE), null);
  assert.equal(conferirPasso("lugares", { ...CHEIO, numerada: false, lugares: "5001" }, HOJE), null, "sem numeração o teto é maior");
  assert.equal(conferirPasso("auditorio", { ...CHEIO, numerada: true, porFileira: "" }, HOJE), "Diga quantos lugares por fileira");
  assert.equal(conferirPasso("auditorio", { ...CHEIO, numerada: true, porFileira: "81" }, HOJE), "São no máximo 80 lugares por fileira");
  assert.equal(conferirPasso("auditorio", { ...CHEIO, numerada: true, lugares: "1000", porFileira: "10" }, HOJE), "Ficariam mais de 60 fileiras: aumente os lugares por fileira");
  assert.equal(conferirPasso("auditorio", { ...CHEIO, numerada: true, porFileira: "16" }, HOJE), null);
  // O preço.
  assert.equal(conferirPasso("ingresso", { ...CHEIO, preco: "" }, HOJE), "Diga o preço da inteira, ou marque gratuito");
  assert.equal(conferirPasso("ingresso", { ...CHEIO, preco: "", gratuito: true }, HOJE), null);
  assert.equal(conferirPasso("ingresso", CHEIO, HOJE), null);
  for (const passo of passosDoComecar("unico", true).slice(1)) assert.equal(conferirPasso(passo, RESPOSTAS_VAZIAS, HOJE), "Escolha como você trabalha", passo);
});

test("o nome do local e o texto do 'onde' seguem o que a pessoa disse", () => {
  assert.equal(nomeDoLocal(CHEIO), "Casa de Cultura");
  assert.equal(nomeDoLocal({ ...CHEIO, lugar: " " }), "Rio de Janeiro", "sem o nome do lugar, a cidade dá nome ao local");
  assert.equal(ondeDoEvento(CHEIO), "Casa de Cultura, Rio de Janeiro, RJ");
  assert.equal(ondeDoEvento({ ...CHEIO, lugar: "" }), "Rio de Janeiro, RJ");
});

test("o mapa tem os 27 estados, os mesmos da lista do onboarding, cada um com desenho e nome", () => {
  assert.deepEqual(ESTADOS_DO_MAPA.map(e => e.uf).sort(), [...UFS_DO_COMECAR].sort());
  for (const e of ESTADOS_DO_MAPA) {
    assert.match(e.d, /^M[\d. L-]+Z/, e.uf);
    assert.ok(e.nome.length > 3, e.uf);
  }
  assert.equal(new Set(ESTADOS_DO_MAPA.map(e => e.uf)).size, 27);
});

const CIDADES = { municipios: [
  ["3552205", "Sorocaba", "SP", -23.5, -47.4], ["3550308", "São Paulo", "SP", -23.5, -46.6], ["3304557", "Rio de Janeiro", "RJ", -22.9, -43.2],
  ["3305109", "São João de Meriti", "RJ", -22.8, -43.3], ["3106200", "Belo Horizonte", "MG", -19.9, -43.9], ["3550704", "São José do Rio Pardo", "SP", -21.6, -46.9],
] as const };

test("a busca de cidades ignora acento e caixa, filtra pelo estado e, sem estado, acha em todo o Brasil", () => {
  assert.equal(normalizar("São José"), "sao jose");
  assert.deepEqual(cidadesDoEstado(CIDADES, "SP", "").map(m => m[1]), ["Sorocaba", "São Paulo", "São José do Rio Pardo"], "sem texto, as do estado");
  assert.deepEqual(cidadesDoEstado(CIDADES, "SP", "sao").map(m => m[1]), ["São Paulo", "São José do Rio Pardo"], "acento e caixa não atrapalham");
  assert.deepEqual(cidadesDoEstado(CIDADES, "SP", "rio").map(m => m[1]), ["São José do Rio Pardo"], "o que contém vem depois dos que começam");
  assert.deepEqual(cidadesDoEstado(CIDADES, "RJ", "sao").map(m => m[1]), ["São João de Meriti"]);
  assert.deepEqual(cidadesDoBrasil(CIDADES, "s"), [], "só a partir de 2 letras");
  assert.deepEqual(cidadesDoBrasil(CIDADES, "soro").map(m => `${m[1]}, ${m[2]}`), ["Sorocaba, SP"]);
  assert.deepEqual(cidadesDoBrasil(CIDADES, "sao").map(m => m[2]), ["SP", "RJ", "SP"]);
  assert.equal(cidadeExata(CIDADES, "SP", "SOROCABA")?.[0], "3552205");
  assert.equal(cidadeExata(CIDADES, "RJ", "Sorocaba"), null, "outra cidade de outro estado não vale");
  assert.equal(cidadeExata(CIDADES, "SP", " "), null);
});

test("o perfil tem uma pergunta por tela: nome, onde e quando", () => {
  for (const id of PERFIS) {
    const perfil = PERFIL[id];
    for (const texto of [perfil.nome.pergunta, perfil.onde.pergunta, perfil.data.pergunta]) assert.match(texto, /\?$/, `${id}: ${texto}`);
    assert.ok(perfil.nome.rotulo && perfil.nome.exemplo, id);
  }
  assert.equal(PERFIL.espaco.onde.rotuloDoLugar, "", "quem tem espaço já disse o nome do lugar no passo do nome");
  for (const id of ["turne", "unico", "festival"] as const) assert.ok(PERFIL[id].onde.rotuloDoLugar, id);
});

test("o auditório divide os lugares em fileiras, a última leva o que sobra, e o total é sempre o digitado", () => {
  const mapa = mapaDoAuditorio(100, 16, true);
  assert.deepEqual(mapa.map(f => f.nome), ["A", "B", "C", "D", "E", "F", "G"]);
  assert.deepEqual(mapa.map(f => f.assentos.length), [16, 16, 16, 16, 16, 16, 4]);
  assert.equal(mapa.reduce((t, f) => t + f.assentos.length, 0), 100);
  assert.deepEqual(mapa[0].vaos, [8], "corredor depois da metade da fileira");
  assert.equal(mapa[6].vaos, undefined, "fileira de 4 lugares é curta para ter corredor");
  assert.equal(mapaDoAuditorio(100, 16, false)[0].vaos, undefined);
  for (const [lugares, por] of [[1, 1], [7, 3], [350, 30], [4800, 80]] as const) assert.equal(mapaDoAuditorio(lugares, por, true).reduce((t, f) => t + f.assentos.length, 0), lugares);
  assert.equal(mapaDoAuditorio(60, 10, true)[5].nome, "F");
});

test("a sugestão de lugares por fileira é mais larga que funda e cabe nos limites", () => {
  assert.equal(sugestaoPorFileira(100), 16);
  assert.equal(sugestaoPorFileira(350), 30);
  assert.equal(sugestaoPorFileira(5), 5, "salas pequenas: uma fileira só");
  assert.equal(sugestaoPorFileira(40), 10);
  for (const n of [1, 6, 20, 200, 1000, 4800]) {
    const por = sugestaoPorFileira(n);
    assert.ok(por >= 1 && por <= 80, `${n}: ${por}`);
    assert.ok(Math.ceil(n / por) <= 60, `${n} lugares: fileiras demais`);
  }
});

test("o calendário do mês começa no domingo, completa as semanas e apaga o que já passou", () => {
  const semanas = semanasDoMes(2026, 11, "2026-12-10"); // dezembro de 2026 começa numa terça-feira
  assert.equal(semanas.length, 5);
  assert.ok(semanas.every(sem => sem.length === 7));
  assert.deepEqual(semanas[0].map(d => d?.dia ?? null), [null, null, 1, 2, 3, 4, 5]);
  assert.deepEqual(semanas[4].map(d => d?.dia ?? null), [27, 28, 29, 30, 31, null, null]);
  const dias = semanas.flat().filter((d): d is NonNullable<typeof d> => d !== null);
  assert.equal(dias.length, 31);
  assert.equal(dias.find(d => d.dia === 9)?.passou, true);
  assert.equal(dias.find(d => d.dia === 10)?.passou, false, "hoje não passou");
  assert.equal(dias.find(d => d.dia === 10)?.hoje, true);
  assert.equal(dias.find(d => d.dia === 20)?.data, "2026-12-20");
  assert.equal(semanasDoMes(2028, 1, "2026-01-01").flat().filter(Boolean).length, 29, "fevereiro bissexto");
  assert.deepEqual(somarMeses(2026, 11, 1), { ano: 2027, mes: 0 });
  assert.deepEqual(somarMeses(2026, 0, -1), { ano: 2025, mes: 11 });
  assert.deepEqual(mesDaData("2026-12-20"), { ano: 2026, mes: 11 });
  assert.equal(NOMES_DOS_MESES[11], "dezembro");
  assert.equal(dataPorExtenso("2026-12-20"), "domingo, 20 de dezembro de 2026");
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
