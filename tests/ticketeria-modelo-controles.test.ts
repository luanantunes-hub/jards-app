import assert from "node:assert/strict";
import test from "node:test";
import { controlesDaTela, controlesDasSemanas, controlesQueEntram, datasNacionaisDoAno, lerDataDePico, pascoa, SEMANAS_DOS_CONTROLES_EXTRAS, variaNaTabela, type ControleDaTela, type EntradaDosControles } from "../lib/ticketeria/modelo-controles";
import { inicioDaSemana } from "../lib/ticketeria/modelo";

const dia = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const segunda = (i: number) => new Date(Date.UTC(2026, 2, 2 + i * 7)).toISOString().slice(0, 10); // 02/03/2026 é segunda
const vazio = (semanas: string[]): EntradaDosControles => ({ semanas, sessoes: [], datasProprias: [], viradasDeLote: [], itens: [] });

test("a Páscoa e o calendário nacional dos anos que importam", () => {
  assert.equal(dia(pascoa(2024)), "2024-03-31");
  assert.equal(dia(pascoa(2025)), "2025-04-20");
  assert.equal(dia(pascoa(2026)), "2026-04-05");
  const d = Object.fromEntries(datasNacionaisDoAno(2026).map(x => [x.nome, x.dia]));
  assert.equal(d["Carnaval"], "2026-02-17");
  assert.equal(d["Sexta-feira Santa"], "2026-04-03");
  assert.equal(d["Dia das Mães"], "2026-05-10");
  assert.equal(d["Corpus Christi"], "2026-06-04");
  assert.equal(d["Dia dos Pais"], "2026-08-09");
  assert.equal(d["Black Friday"], "2026-11-27");
  assert.equal(d["Natal"], "2026-12-25");
  assert.equal(d["Dia dos Namorados"], "2026-06-12");
  assert.deepEqual(datasNacionaisDoAno(2026).map(x => x.dia), datasNacionaisDoAno(2026).map(x => x.dia).sort(), "em ordem");
});

test("a proximidade da sessão: 1 na semana, cai até 0 oito semanas antes e é 0 depois da última sessão", () => {
  const semanas = Array.from({ length: 14 }, (_, i) => segunda(i));
  const c = controlesDasSemanas({ ...vazio(semanas), sessoes: ["2026-05-02"] }); // sábado da semana de 27/04 (semana 8)
  assert.equal(inicioDaSemana("2026-05-02"), segunda(8));
  assert.equal(c[segunda(8)].proximidade, 1);
  assert.equal(c[segunda(7)].proximidade, 0.8889);
  assert.equal(c[segunda(0)].proximidade, 0.1111, "a oito semanas ainda está no horizonte, com o menor valor");
  assert.ok(c[segunda(1)].proximidade > 0 && c[segunda(1)].proximidade < c[segunda(2)].proximidade, "sobe até a sessão");
  assert.equal(c[segunda(9)].proximidade, 0, "depois da última sessão");
  assert.equal(c[segunda(13)].proximidade, 0);
});

test("a proximidade usa a PRÓXIMA sessão quando há várias", () => {
  const semanas = Array.from({ length: 12 }, (_, i) => segunda(i));
  const c = controlesDasSemanas({ ...vazio(semanas), sessoes: [semanas[3], semanas[10]] });
  assert.equal(c[semanas[3]].proximidade, 1);
  assert.equal(c[semanas[4]].proximidade, 0.3333, "depois da primeira vale a próxima, a seis semanas");
  assert.equal(c[semanas[10]].proximidade, 1);
});

test("a nove semanas ou mais da sessão a proximidade é zero", () => {
  const semanas = Array.from({ length: 12 }, (_, i) => segunda(i));
  const c = controlesDasSemanas({ ...vazio(semanas), sessoes: [semanas[11]] });
  assert.equal(c[semanas[0]].proximidade, 0, "11 semanas antes");
  assert.equal(c[semanas[2]].proximidade, 0, "9 semanas antes");
  assert.equal(c[semanas[3]].proximidade, 0.1111, "8 semanas antes");
});

test("o feriado: o calendário nacional e as datas da própria loja", () => {
  const semanas = Array.from({ length: 12 }, (_, i) => segunda(i)); // março a maio de 2026
  const c = controlesDasSemanas({ ...vazio(semanas), datasProprias: [{ dia: "2026-03-20", nome: "Festa da cidade" }] });
  assert.equal(c[inicioDaSemana("2026-03-20")].feriado, 1, "data da loja");
  assert.equal(c[inicioDaSemana("2026-04-03")].feriado, 1, "Sexta-feira Santa");
  assert.equal(c[inicioDaSemana("2026-05-10")].feriado, 1, "Dia das Mães");
  assert.equal(c[segunda(0)].feriado, 0, "semana sem data");
});

test("a virada de lote marca a semana em que o lote começa", () => {
  const semanas = Array.from({ length: 6 }, (_, i) => segunda(i));
  const c = controlesDasSemanas({ ...vazio(semanas), viradasDeLote: [semanas[2], dia(Date.parse(`${semanas[4]}T00:00:00Z`) + 3 * 86400000)] });
  assert.deepEqual(semanas.map(s => c[s].lote), [0, 0, 1, 0, 1, 0]);
});

test("o preço é relativo ao preço mediano e a semana sem venda repete a anterior; cortesia não conta", () => {
  const semanas = Array.from({ length: 5 }, (_, i) => segunda(i));
  const itens = [
    { dia: semanas[0], quantidade: 2, precoCentavos: 10000, comCupom: false },
    { dia: semanas[1], quantidade: 1, precoCentavos: 12000, comCupom: false },
    { dia: semanas[2], quantidade: 1, precoCentavos: 10000, comCupom: false },
    { dia: semanas[2], quantidade: 5, precoCentavos: 0, comCupom: false }, // cortesia
    { dia: semanas[4], quantidade: 1, precoCentavos: 10000, comCupom: false },
  ];
  const c = controlesDasSemanas({ ...vazio(semanas), itens });
  assert.deepEqual(semanas.map(s => c[s].preco), [0, 0.2, 0, 0, 0]);
  const caro = controlesDasSemanas({ ...vazio(semanas), itens: [...itens.slice(0, 2), { dia: semanas[3], quantidade: 1, precoCentavos: 15000, comCupom: false }] });
  assert.equal(caro[semanas[4]].preco, caro[semanas[3]].preco, "sem venda na semana 4, repete a 3");
});

test("o cupom é a parte dos ingressos pagos da semana comprados com cupom", () => {
  const semanas = Array.from({ length: 3 }, (_, i) => segunda(i));
  const c = controlesDasSemanas({ ...vazio(semanas), itens: [
    { dia: semanas[0], quantidade: 3, precoCentavos: 5000, comCupom: true }, { dia: semanas[0], quantidade: 1, precoCentavos: 5000, comCupom: false },
    { dia: semanas[1], quantidade: 2, precoCentavos: 5000, comCupom: false },
  ] });
  assert.deepEqual(semanas.map(s => c[s].cupom), [0.75, 0, 0]);
});

const tabela = (n: number, controles: (i: number) => Record<string, number>) => Array.from({ length: n }, (_, i) => ({ controles: controles(i) }));
const resumo = { eventos: 3, sessoes: 12, lotes: 4, cupons: 6, datasProprias: 0 };
const grupo = (l: ControleDaTela[], g: string) => l.find(c => c.grupo === g) as ControleDaTela;

test("com 41 semanas: proximidade e feriados em uso; preço, lotes e cupons entram com 52 (faltam 11); visitas opcional", () => {
  const t = tabela(41, i => ({ proximidade: (i % 9) / 9, feriado: i % 7 === 0 ? 1 : 0, lote: i % 10 === 0 ? 1 : 0, preco: (i % 3) / 10, cupom: (i % 4) / 10, visitas: 0 }));
  const l = controlesDaTela(t, resumo, { conectado: false, semanas: 0 });
  assert.deepEqual(l.map(c => c.grupo), ["proximidade", "feriados", "preco_e_lotes", "cupons", "visitas"]);
  assert.equal(grupo(l, "proximidade").estado, "em_uso");
  assert.match(grupo(l, "proximidade").detalhe, /3 eventos, 12 sessões/);
  assert.equal(grupo(l, "feriados").estado, "em_uso");
  assert.equal(grupo(l, "feriados").acao, "datas");
  for (const g of ["preco_e_lotes", "cupons"]) { assert.equal(grupo(l, g).estado, "entra_depois"); assert.equal(grupo(l, g).faltam, SEMANAS_DOS_CONTROLES_EXTRAS - 41); }
  assert.match(grupo(l, "preco_e_lotes").detalhe, /4 lotes/);
  assert.match(grupo(l, "cupons").detalhe, /6 cupons/);
  assert.equal(grupo(l, "visitas").estado, "opcional");
  assert.equal(grupo(l, "visitas").acao, "conexoes");
});

test("com 60 semanas os extras entram, mas só os que variam; sem sessão a proximidade fica sem dado", () => {
  const t = tabela(60, i => ({ proximidade: 0, feriado: i % 7 === 0 ? 1 : 0, lote: i % 10 === 0 ? 1 : 0, preco: 0, cupom: 0, visitas: 0 }));
  const l = controlesDaTela(t, { ...resumo, sessoes: 0, eventos: 0, cupons: 0 }, { conectado: false, semanas: 0 });
  assert.equal(grupo(l, "proximidade").estado, "sem_dados");
  assert.equal(grupo(l, "preco_e_lotes").estado, "em_uso", "o lote varia, mesmo com o preço parado");
  assert.equal(grupo(l, "cupons").estado, "sem_dados");
  assert.match(grupo(l, "cupons").detalhe, /não entra/);
  assert.deepEqual(controlesQueEntram(t), ["feriado", "lote"]);
  assert.deepEqual(controlesQueEntram(t.slice(0, 40)), ["feriado"], "com menos de 52 semanas só os dois primeiros");
  assert.equal(variaNaTabela(t, "cupom"), false);
});

test("a data de pico da loja: dia que existe e nome de 2 a 60 letras", () => {
  assert.deepEqual(lerDataDePico({ dia: "2026-09-14", nome: "  Festa   da cidade " }), { ok: true, valor: { dia: "2026-09-14", nome: "Festa da cidade" } });
  assert.equal(lerDataDePico({ dia: "", nome: "Festa" }).ok, false);
  assert.equal(lerDataDePico({ dia: "2026-02-30", nome: "Festa" }).ok, false, "30 de fevereiro não existe");
  assert.equal(lerDataDePico({ dia: "2026-09-14", nome: "F" }).ok, false);
  assert.equal(lerDataDePico({ dia: "2026-09-14", nome: "x".repeat(61) }).ok, false);
});
