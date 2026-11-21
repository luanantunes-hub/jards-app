import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import {
  MAX_DATAS_POR_PRACA, MAX_PRACAS, MAX_SESSOES, PERFIL, PERFIS, RESPOSTAS_VAZIAS, UFS_DO_COMECAR, argumentosDoComecar, auditorioInicial, lugaresParaVender, centavosDe, conferirPasso, divisaoDosLugares, mapaDoAuditorio, mensagemDoErroDoComecar, nomeDoLocal, ondeDaPraca, passosDoComecar, praca, pracasEfetivas, precoDaMeia, sugestaoPorFileira, totalDeSessoes,
  type Passo, type PassoId, type Praca, type RespostasDoComecar,
} from "../lib/ticketeria/comecar";
import { alternarBloqueio, maisLugares, menosLugares, adicionarFileira, resumoDoMapa } from "../lib/ticketeria/mapa";
import { cidadeExata, cidadesDoBrasil, cidadesDoEstado, normalizar } from "../lib/ticketeria/local-do-evento";
import { ESTADOS_DO_MAPA } from "../lib/ticketeria/mapa-estados";
import { NOMES_DOS_MESES, alternarDia, dataPorExtenso, diasEntre, mesDaData, resumoDasDatas, semanasDoMes, somarMeses } from "../lib/ticketeria/calendario";

// O onboarding da Ticketeria ("Começar"). O teste de banco é supabase/tests/ticketeria_comecar.test.sql; estes conferem, sem
// banco, a conferência dos passos, a conta da meia (igual à do banco) e a forma da migration.

const HOJE = "2026-11-21";
const praca1 = (parte: Partial<Praca> = {}): Praca => ({ ...praca(), uf: "RJ", cidade: "Rio de Janeiro", lugar: "Casa de Cultura", datas: ["2026-12-20"], outra: null, ...parte });
const CHEIO: RespostasDoComecar = {
  ...RESPOSTAS_VAZIAS, perfil: "unico", evento: "Show de lançamento", pracas: [praca1()],
  lugares: "100", hora: "20:00", numerada: false, gratuito: false, venda: "online", preco: "60", meia: true,
};
/** Um passo sem praça (as perguntas que valem para o evento todo) ou da praça `i`. */
const p = (id: PassoId, i = 0): Passo => ({ id, praca: i });
const ids = (passos: Passo[]) => passos.map(x => x.id + (x.id === "onde" || x.id === "data" || x.id === "outra" ? `#${x.praca}` : ""));

async function migration(sufixo = "_ticketeria_comecar.sql"): Promise<string> {
  const nome = (await readdir("supabase/migrations")).find(n => n.endsWith(sufixo));
  assert.ok(nome, `migration ${sufixo} não encontrada`);
  return readFile(`supabase/migrations/${nome}`, "utf8");
}
const semComentarios = (sql: string) => sql.replace(/--.*$/gm, "");

test("os quatro perfis são os que o banco aceita, na ordem da tela", async () => {
  assert.deepEqual([...PERFIS], ["espaco", "turne", "unico", "festival"]);
  const sql = semComentarios(await migration()).replace(/\s+/g, " ");
  assert.match(sql, /check \(perfil is null or perfil in \('espaco', 'turne', 'unico', 'festival'\)\)/);
});

test("a sequência de passos: uma pergunta por tela, as cidades e os dias em laço só na turnê", () => {
  const um = [praca1()];
  assert.deepEqual(ids(passosDoComecar("unico", um, false, false)), ["perfil", "nome", "onde#0", "data#0", "horario", "numerada", "lugares", "gratuito", "preco", "meia", "venda"]);
  assert.deepEqual(ids(passosDoComecar("espaco", um, false, false)), ["perfil", "nome", "onde#0", "evento", "data#0", "horario", "numerada", "lugares", "gratuito", "preco", "meia", "venda"], "quem tem espaço dá o nome do primeiro evento num passo só dele");
  assert.deepEqual(ids(passosDoComecar("festival", um, null, null)), ["perfil", "nome", "onde#0", "data#0", "horario", "numerada", "lugares", "gratuito", "preco", "meia", "venda"], "sem passo de dias: as datas marcadas dizem quantos são");
  assert.deepEqual(ids(passosDoComecar("unico", um, true, false)), ["perfil", "nome", "onde#0", "data#0", "horario", "numerada", "lugares", "auditorio", "gratuito", "preco", "meia", "venda"], "o auditório só com lugares numerados");
  assert.deepEqual(ids(passosDoComecar("unico", um, false, true)), ["perfil", "nome", "onde#0", "data#0", "horario", "numerada", "lugares", "gratuito", "venda"], "gratuito: acaba na pergunta do gratuito, sem preço nem meia-entrada");
  // Turnê: cada cidade pergunta "tem outra?"; com sim, vem a próxima cidade; com não, segue.
  assert.deepEqual(ids(passosDoComecar("turne", [praca1()], false, false)), ["perfil", "nome", "onde#0", "data#0", "outra#0", "horario", "numerada", "lugares", "gratuito", "preco", "meia", "venda"]);
  assert.deepEqual(ids(passosDoComecar("turne", [praca1({ outra: false })], false, false)).slice(2, 6), ["onde#0", "data#0", "outra#0", "horario"]);
  assert.deepEqual(ids(passosDoComecar("turne", [praca1({ outra: true }), praca1({ cidade: "Curitiba", uf: "PR" })], false, false)).slice(2, 9), ["onde#0", "data#0", "outra#0", "onde#1", "data#1", "outra#1", "horario"]);
  assert.deepEqual(ids(passosDoComecar("turne", [praca1({ outra: true }), praca1({ outra: true }), praca1({ outra: false })], false, false)).filter(x => x.startsWith("onde")), ["onde#0", "onde#1", "onde#2"]);
  assert.deepEqual(ids(passosDoComecar("unico", [praca1({ outra: true }), praca1()], false, false)).filter(x => x.startsWith("onde")), ["onde#0"], "só a turnê tem mais de uma cidade");
  assert.deepEqual(passosDoComecar(null, [], null, null)[2], { id: "onde", praca: 0 }, "sem perfil nem praças, o caminho comum");
});

test("pracasEfetivas e totalDeSessoes contam só as cidades que a pessoa deixou valer", () => {
  const tres = [praca1({ outra: true, datas: ["2026-12-20", "2026-12-21"] }), praca1({ cidade: "Curitiba", uf: "PR", outra: false, datas: ["2026-12-30"] }), praca1({ cidade: "Sobrou", datas: ["2027-01-01"] })];
  assert.deepEqual(pracasEfetivas("turne", tres).map(x => x.cidade), ["Rio de Janeiro", "Curitiba"], "a terceira ficou para trás quando a segunda disse que não há outra");
  assert.deepEqual(pracasEfetivas("unico", tres).map(x => x.cidade), ["Rio de Janeiro"]);
  assert.equal(totalDeSessoes({ ...CHEIO, perfil: "turne", pracas: tres }), 3);
  assert.equal(totalDeSessoes({ ...CHEIO, perfil: "festival", pracas: [praca1({ datas: ["2026-12-20", "2026-12-21", "2026-12-23"] })] }), 3);
});

test("cada passo diz o que falta, um campo por vez", () => {
  assert.equal(conferirPasso(p("perfil"), RESPOSTAS_VAZIAS, HOJE), "Escolha uma opção para continuar");
  assert.equal(conferirPasso(p("perfil"), CHEIO, HOJE), null);
  // O nome: só o nome. Quem tem espaço dá o nome do espaço; os outros, o nome do evento.
  assert.equal(conferirPasso(p("nome"), { ...CHEIO, evento: "  " }, HOJE), "Dê um nome ao evento");
  assert.equal(conferirPasso(p("nome"), { ...CHEIO, perfil: "espaco", pracas: [praca1({ lugar: "" })], evento: "Hamlet" }, HOJE), "Diga o nome do espaço");
  assert.equal(conferirPasso(p("nome"), { ...CHEIO, perfil: "espaco", pracas: [praca1({ lugar: "Teatro Municipal" })], evento: "" }, HOJE), null, "o primeiro evento do espaço só é pedido no passo próprio");
  assert.equal(conferirPasso(p("nome"), { ...CHEIO, evento: "x".repeat(201) }, HOJE), "O nome pode ter até 200 caracteres");
  assert.equal(conferirPasso(p("nome"), CHEIO, HOJE), null);
  // O lugar: o estado no mapa e a cidade; o nome do lugar é opcional. Cada cidade da turnê é conferida pela própria praça.
  assert.equal(conferirPasso(p("onde"), { ...CHEIO, pracas: [praca1({ uf: "" })] }, HOJE), "Escolha o estado no mapa");
  assert.equal(conferirPasso(p("onde"), { ...CHEIO, pracas: [praca1({ uf: "XX" })] }, HOJE), "Escolha o estado no mapa");
  assert.equal(conferirPasso(p("onde"), { ...CHEIO, pracas: [praca1({ cidade: " " })] }, HOJE), "Escolha ou digite a cidade");
  assert.equal(conferirPasso(p("onde"), { ...CHEIO, pracas: [praca1({ lugar: "" })] }, HOJE), null, "sem o nome do lugar vale a cidade");
  assert.equal(conferirPasso(p("onde"), { ...CHEIO, pracas: [praca1({ cidade: "Cidade que não está na lista" })] }, HOJE), null, "cidade digitada vale");
  assert.equal(conferirPasso(p("onde", 1), { ...CHEIO, perfil: "turne", pracas: [praca1(), praca1({ uf: "" })] }, HOJE), "Escolha o estado no mapa", "a segunda cidade é conferida na própria praça");
  // O primeiro evento (só quem tem espaço) e os dias.
  assert.equal(conferirPasso(p("evento"), { ...CHEIO, perfil: "espaco", evento: "" }, HOJE), "Dê um nome ao primeiro evento");
  assert.equal(conferirPasso(p("evento"), { ...CHEIO, perfil: "espaco" }, HOJE), null);
  assert.equal(conferirPasso(p("data"), { ...CHEIO, pracas: [praca1({ datas: [] })] }, HOJE), "Escolha pelo menos um dia");
  assert.equal(conferirPasso(p("data"), { ...CHEIO, perfil: "turne", pracas: [praca1({ datas: [] })] }, HOJE), "Escolha pelo menos um dia nessa cidade");
  assert.equal(conferirPasso(p("data"), { ...CHEIO, pracas: [praca1({ datas: ["2026-11-20"] })] }, HOJE), "Esse dia já passou");
  assert.equal(conferirPasso(p("data"), { ...CHEIO, pracas: [praca1({ datas: ["2026-12-20", "2026-11-20"] })] }, HOJE), "Esse dia já passou", "um dia passado no meio dos outros também");
  assert.equal(conferirPasso(p("data"), { ...CHEIO, pracas: [praca1({ datas: [HOJE] })] }, HOJE), null, "hoje ainda vale");
  assert.equal(conferirPasso(p("data"), { ...CHEIO, pracas: [praca1({ datas: ["2026-12-20", "2026-12-27", "2027-01-03"] })] }, HOJE), null, "datas alternadas, até em meses diferentes");
  assert.equal(conferirPasso(p("data"), { ...CHEIO, pracas: [praca1({ datas: diasEntre("2026-12-01", "2027-02-10") })] }, HOJE), "São no máximo 60 dias por cidade");
  assert.equal(conferirPasso(p("data"), { ...CHEIO, perfil: "turne", pracas: Array.from({ length: 4 }, () => praca1({ outra: true, datas: diasEntre("2026-12-01", "2027-01-29") })) }, HOJE), "São no máximo 200 datas no total");
  assert.equal(conferirPasso(p("outra"), { ...CHEIO, perfil: "turne", pracas: [praca1()] }, HOJE), "Escolha sim ou não");
  assert.equal(conferirPasso(p("outra"), { ...CHEIO, perfil: "turne", pracas: [praca1({ outra: true })] }, HOJE), null);
  assert.equal(conferirPasso(p("outra", 19), { ...CHEIO, perfil: "turne", pracas: Array.from({ length: 20 }, () => praca1({ outra: true })) }, HOJE), "São no máximo 20 cidades");
  // O horário, os lugares numerados, quantos lugares e o auditório.
  assert.equal(conferirPasso(p("horario"), { ...CHEIO, hora: "" }, HOJE), "Escolha o horário");
  assert.equal(conferirPasso(p("horario"), CHEIO, HOJE), null);
  assert.equal(conferirPasso(p("numerada"), { ...CHEIO, numerada: null }, HOJE), "Escolha sim ou não");
  assert.equal(conferirPasso(p("numerada"), { ...CHEIO, numerada: true }, HOJE), null);
  assert.equal(conferirPasso(p("lugares"), { ...CHEIO, lugares: "0" }, HOJE), "Diga quantos lugares há");
  assert.equal(conferirPasso(p("lugares"), { ...CHEIO, lugares: "200001" }, HOJE), "São no máximo 200.000 lugares");
  assert.equal(conferirPasso(p("lugares"), { ...CHEIO, numerada: true, lugares: "4801" }, HOJE), "Com lugares numerados, o máximo são 4.800 lugares");
  assert.equal(conferirPasso(p("lugares"), { ...CHEIO, numerada: true, lugares: "4800" }, HOJE), null);
  assert.equal(conferirPasso(p("lugares"), { ...CHEIO, numerada: false, lugares: "5001" }, HOJE), null, "sem numeração o teto é maior");
  // O auditório: o mapa desenhado (o mesmo do editor do setor).
  const desenhado = { ...CHEIO, numerada: true, mapa: mapaDoAuditorio(100, 16, true) };
  assert.equal(conferirPasso(p("auditorio"), { ...CHEIO, numerada: true, mapa: null }, HOJE), "Monte pelo menos uma fileira");
  assert.equal(conferirPasso(p("auditorio"), { ...CHEIO, numerada: true, mapa: [] }, HOJE), "Monte pelo menos uma fileira");
  assert.equal(conferirPasso(p("auditorio"), desenhado, HOJE), null);
  assert.equal(conferirPasso(p("auditorio"), { ...desenhado, mapa: mapaDoAuditorio(5, 5, false).map(f => ({ ...f, assentos: f.assentos.map(a => ({ ...a, estado: "bloqueado" as const })) })) }, HOJE), "Deixe pelo menos um lugar à venda", "tudo bloqueado não vende");
  assert.equal(conferirPasso(p("auditorio"), { ...desenhado, mapa: mapaDoAuditorio(5000 + 1, 80, false) }, HOJE), "São no máximo 60 fileiras", "81 fileiras: acima do formato");
  // Gratuito, preço e meia-entrada: três perguntas.
  assert.equal(conferirPasso(p("gratuito"), { ...CHEIO, gratuito: null }, HOJE), "Escolha sim ou não");
  assert.equal(conferirPasso(p("gratuito"), CHEIO, HOJE), null);
  assert.equal(conferirPasso(p("venda"), { ...CHEIO, venda: null }, HOJE), "Escolha uma opção");
  assert.equal(conferirPasso(p("venda"), CHEIO, HOJE), null);
  assert.equal(conferirPasso(p("preco"), { ...CHEIO, preco: "" }, HOJE), "Diga o preço da inteira");
  assert.equal(conferirPasso(p("preco"), { ...CHEIO, preco: "0" }, HOJE), "Diga o preço da inteira");
  assert.equal(conferirPasso(p("preco"), { ...CHEIO, preco: "100001" }, HOJE), "O preço pode ir até R$ 100.000");
  assert.equal(conferirPasso(p("preco"), CHEIO, HOJE), null);
  assert.equal(conferirPasso(p("meia"), { ...CHEIO, meia: null }, HOJE), "Escolha sim ou não");
  assert.equal(conferirPasso(p("meia"), CHEIO, HOJE), null);
  for (const passo of passosDoComecar("unico", [praca1()], true, false).slice(1)) assert.equal(conferirPasso(passo, RESPOSTAS_VAZIAS, HOJE), "Escolha como você trabalha", passo.id);
});

test("o nome do local e o texto do 'onde' seguem o que a pessoa disse", () => {
  assert.equal(nomeDoLocal(praca1()), "Casa de Cultura");
  assert.equal(nomeDoLocal(praca1({ lugar: " " })), "Rio de Janeiro", "sem o nome do lugar, a cidade dá nome ao local");
  assert.equal(ondeDaPraca(praca1()), "Casa de Cultura, Rio de Janeiro, RJ");
  assert.equal(ondeDaPraca(praca1({ lugar: "" })), "Rio de Janeiro, RJ");
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

test("o mapa desenhado no onboarding é o do editor: editar muda os lugares à venda, e é isso que o evento vende", () => {
  const inicial = auditorioInicial(100);
  assert.equal(inicial.reduce((n, f) => n + f.assentos.length, 0), 100, "a grade de partida tem os lugares digitados");
  assert.equal(inicial[0].assentos.length, 16);
  const comNumeracao = { ...CHEIO, numerada: true, lugares: "100", mapa: inicial };
  assert.equal(lugaresParaVender(comNumeracao), 100);
  // Bloqueia três cadeiras e tira um lugar da última fileira: 96 à venda (as mesmas contas do editor do setor).
  let mapa = alternarBloqueio(inicial, "A", 1);
  mapa = alternarBloqueio(mapa, "A", 2);
  mapa = alternarBloqueio(mapa, "B", 16);
  mapa = menosLugares(mapa, "G");
  assert.deepEqual({ ...resumoDoMapa(mapa) }, { fileiras: 7, lugares: 99, bloqueados: 3, aVenda: 96, vendidos: 0 });
  assert.equal(lugaresParaVender({ ...comNumeracao, mapa }), 96, "o evento vende os lugares do mapa, sem as cadeiras bloqueadas");
  assert.equal(argumentosDoComecar("org", { ...comNumeracao, mapa }).p_lugares, 96);
  assert.equal(argumentosDoComecar("org", { ...comNumeracao, mapa: maisLugares(adicionarFileira(mapa), "A") }).p_lugares, 96 + 3 + 1, "a fileira nova copia os 3 lugares da última, e mais um lugar na A: tudo conta");
  assert.equal(alternarBloqueio(mapa, "A", 1)[0].assentos[0].estado, "livre", "tocar de novo libera");
  // Sem lugares numerados, vale o número digitado.
  assert.equal(lugaresParaVender({ ...CHEIO, numerada: false, lugares: "250", mapa }), 250);
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

test("os argumentos da chamada saem limpos: uma praça por cidade, datas em ordem e sem repetir", () => {
  assert.deepEqual(argumentosDoComecar("org", { ...CHEIO, evento: " Show ", pracas: [praca1({ cidade: " Rio de Janeiro ", datas: ["2026-12-27", "2026-12-20", "2026-12-20"] })] }), {
    p_org: "org", p_perfil: "unico", p_evento: "Show",
    p_pracas: [{ local: "Casa de Cultura", cidade: "Rio de Janeiro", uf: "RJ", datas: ["2026-12-20", "2026-12-27"] }],
    p_lugares: 100, p_hora: "20:00", p_preco_centavos: 6000, p_meia: true,
  });
  const turne = argumentosDoComecar("org", { ...CHEIO, perfil: "turne", pracas: [praca1({ outra: true, lugar: "" }), praca1({ cidade: "Curitiba", uf: "PR", lugar: "Teatro Guaíra", outra: false, datas: ["2026-12-30", "2026-12-31"] }), praca1({ cidade: "Fora" })] });
  assert.deepEqual(turne.p_pracas.map(x => `${x.local}|${x.cidade}|${x.uf}|${x.datas.length}`), ["Rio de Janeiro|Rio de Janeiro|RJ|1", "Teatro Guaíra|Curitiba|PR|2"], "só as cidades que valem, e sem o nome do lugar o local leva o da cidade");
  const festival = argumentosDoComecar("org", { ...CHEIO, perfil: "festival", gratuito: true });
  assert.equal(festival.p_preco_centavos, 0);
  assert.equal(festival.p_meia, false, "gratuito não pede meia");
});

test("os erros do banco viram texto da tela", () => {
  assert.match(mensagemDoErroDoComecar({ message: "sem_permissao" }), /Só quem edita/);
  assert.equal(mensagemDoErroDoComecar({ message: "data_no_passado" }), "A data já passou. Escolha outra.");
  assert.equal(mensagemDoErroDoComecar({ message: "outra coisa" }), "Não foi possível criar o evento. Tente de novo.");
  assert.equal(mensagemDoErroDoComecar(null), "Não foi possível criar o evento. Tente de novo.");
});

test("a migration da primeira versão é aditiva, a função roda com a permissão de quem chama e o gatilho do slug é consertado", async () => {
  const sql = await migration();
  const codigo = semComentarios(sql).replace(/\s+/g, " ");
  assert.doesNotMatch(codigo, /\bdrop\b/i, "sem DROP");
  assert.match(codigo, /set local lock_timeout = '10s'/);
  assert.match(codigo, /create or replace function public\.fn_ticketeria_comecar\([^)]*\) returns jsonb language plpgsql security invoker set search_path = public, pg_temp/);
  assert.match(codigo, /if not public\.auth_ticketeria_pode\(p_org, 'editar'\) then raise exception 'sem_permissao'/);
  assert.match(codigo, /alter function public\.fn_ticketeria_evento_slug\(\) security definer;/);
  assert.match(codigo, /insert into public\.ticketeria_eventos \(organization_id, loja_id, titulo, criado_por\)/, "o evento nasce em rascunho (padrão da tabela)");
});

test("a função de várias cidades tem outro nome (sem sobrecarga), roda com a permissão de quem chama e confere antes de gravar", async () => {
  const codigo = semComentarios(await migration("_ticketeria_comecar_pracas.sql")).replace(/\s+/g, " ");
  assert.doesNotMatch(codigo, /\bdrop\b/i, "sem DROP");
  assert.match(codigo, /create or replace function public\.fn_ticketeria_comecar_pracas\( p_org uuid, p_perfil text, p_evento text, p_pracas jsonb, p_lugares integer, p_hora time, p_preco_centavos integer, p_meia boolean\) returns jsonb language plpgsql security invoker set search_path = public, pg_temp/);
  assert.match(codigo, /revoke execute on function public\.fn_ticketeria_comecar_pracas\(uuid, text, text, jsonb, integer, time, integer, boolean\) from public, anon;/);
  assert.match(codigo, /grant execute on function public\.fn_ticketeria_comecar_pracas\(uuid, text, text, jsonb, integer, time, integer, boolean\) to authenticated;/);
  // Os mesmos limites da tela (MAX_PRACAS, MAX_DATAS_POR_PRACA, MAX_SESSOES).
  assert.match(codigo, new RegExp(`jsonb_array_length\\(p_pracas\\) > ${MAX_PRACAS}`));
  assert.match(codigo, new RegExp(`jsonb_array_length\\(v_praca -> 'datas'\\) > ${MAX_DATAS_POR_PRACA}`));
  assert.match(codigo, new RegExp(`v_total > ${MAX_SESSOES}`));
  // Tudo é conferido (o primeiro "for") antes de a loja e o evento serem gravados.
  assert.ok(codigo.indexOf("raise exception 'data_no_passado'") < codigo.indexOf("insert into public.ticketeria_eventos"), "confere antes de gravar");
  assert.ok(codigo.indexOf("raise exception 'sessoes_demais'") < codigo.indexOf("insert into public.ticketeria_lojas"), "confere antes de gravar");
  const antiga = await migration();
  assert.match(antiga, /create or replace function public\.fn_ticketeria_comecar\(/, "a antiga continua, sem uso pelo app");
});

test("a tela vazia da Ticketeria leva ao onboarding, e o onboarding chama a função do banco", async () => {
  const inicio = await readFile("app/(dashboard)/ingressos/page.tsx", "utf8");
  assert.match(inicio, /href="\/ingressos\/comecar"/);
  const tela = await readFile("components/ticketeria/ComecarView.tsx", "utf8");
  assert.match(tela, /\.rpc\("fn_ticketeria_comecar_pracas", argumentosDoComecar\(organizationId, r\)\)/);
  assert.match(tela, /href="\/ingressos\/recebimentos"/, "a conta de recebimento fica para o fim, sem travar");
  assert.doesNotMatch(tela, /Desenhar o mapa/, "o mapa desenhado no passo do auditório é o final: a tela de fim não oferece desenhar de novo");
  assert.match(tela, /<EditorDoMapa /, "o auditório usa o editor de mapa de verdade");
  assert.doesNotMatch(tela, /MapaDeAssentos|SetorSheet/, "sem desenho paralelo nem folha do setor no onboarding");
  for (const arquivo of ["ticketeria_comecar", "ticketeria_comecar_pracas"]) {
    const teste = await readFile(`supabase/tests/${arquivo}.test.sql`, "utf8");
    const plano = Number(/select plan\((\d+)\);/.exec(teste)?.[1]);
    assert.equal(teste.match(/^select (is|isnt|ok|throws_ok|lives_ok)\(/gm)?.length, plano, `o plano do teste de banco ${arquivo} bate`);
    assert.doesNotMatch(semComentarios(teste), /\bdelete\b/i);
  }
});

test("o calendário aceita vários dias, seguidos ou alternados, e o resumo os conta", () => {
  assert.deepEqual(diasEntre("2026-12-30", "2027-01-02"), ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"], "vira o ano");
  assert.deepEqual(diasEntre("2026-12-05", "2026-12-01"), []);
  const hoje = "2026-12-10";
  assert.deepEqual(alternarDia([], "2026-12-20", { hoje }), ["2026-12-20"]);
  assert.deepEqual(alternarDia(["2026-12-20"], "2026-12-27", { hoje }), ["2026-12-20", "2026-12-27"], "alternados");
  assert.deepEqual(alternarDia(["2026-12-20", "2026-12-27"], "2026-12-20", { hoje }), ["2026-12-27"], "tocar de novo desmarca");
  assert.deepEqual(alternarDia(["2026-12-20"], "2026-12-23", { hoje, ate: "2026-12-20" }), ["2026-12-20", "2026-12-21", "2026-12-22", "2026-12-23"], "Shift: dias seguidos");
  assert.deepEqual(alternarDia([], "2026-12-08", { hoje, ate: "2026-12-12" }), ["2026-12-10", "2026-12-11", "2026-12-12"], "os dias que já passaram ficam de fora do intervalo");
  assert.equal(resumoDasDatas([]), "");
  assert.equal(resumoDasDatas(["2026-12-20"]), "domingo, 20 de dezembro de 2026");
  assert.equal(resumoDasDatas(["2026-12-27", "2026-12-20", "2026-12-21"]), "3 dias: 20, 21 e 27 de dezembro");
  assert.equal(resumoDasDatas(["2026-12-20", "2027-01-03"]), "2 dias: 20 de dezembro · 3 de janeiro");
});
