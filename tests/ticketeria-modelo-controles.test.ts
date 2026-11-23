import assert from "node:assert/strict";
import test from "node:test";
import { abrirSessoesLongas, atracaoOAnoTodo, curvaDaCasa, rampaPadrao, semanaDeFerias, controleDeVisitas, controlesDaTela, controlesDasSemanas, controlesQueEntram, datasNacionaisDoAno, lerDataDePico, pascoa, SEMANAS_DOS_CONTROLES_EXTRAS, variaNaTabela, visitaDeAnuncioPago, type ControleDaTela, type EntradaDosControles, type VisitaDoDia } from "../lib/ticketeria/modelo-controles";
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
  assert.deepEqual(l.map(c => c.grupo), ["proximidade", "feriados", "lugares", "ferias", "preco_e_lotes", "cupons", "visitas"]);
  assert.equal(grupo(l, "ferias").estado, "entra_depois");
  assert.match(grupo(l, "proximidade").detalhe, /rampa padrão/);
  assert.equal(grupo(l, "proximidade").estado, "em_uso");
  assert.equal(grupo(l, "lugares").estado, "sem_dados", "lugares iguais em todas as semanas não entram");
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

// ─── As visitas sem anúncio (GA4) ───────────────────────────────────────────

test("visita de anúncio pago: o meio do GA4 (cpc, cpm, ppc, paid…) ou o link da loja marcado como anúncio pago", () => {
  for (const pago of ["google / cpc", "facebook / paid_social", "bing / ppc", "tiktok / cpm", "x / retargeting", "anuncio-pago / divulgacao", "Google / CPC"]) assert.equal(visitaDeAnuncioPago(pago), true, pago);
  for (const livre of ["google / organic", "instagram / social", "(direct) / (none)", "l.instagram.com / referral", "email / divulgacao", "(not set)", ""]) assert.equal(visitaDeAnuncioPago(livre), false, livre);
});

const semanasDeVisita = (n: number) => Array.from({ length: n }, (_, i) => segunda(i));
const domingo = (i: number) => new Date(Date.parse(`${segunda(i)}T00:00:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
const doOrganico = (n: number): VisitaDoDia[] => semanasDeVisita(n).flatMap((s, i) => [{ dia: s, origem: "google / organic", sessoes: 10 + (i % 5) }, { dia: s, origem: "google / cpc", sessoes: 1000 }]);

test("o controle de visitas: só as sem anúncio, em log relativo à mediana, só semanas inteiras", () => {
  const semanas = semanasDeVisita(30);
  const r = controleDeVisitas(doOrganico(30), segunda(0), domingo(29), semanas);
  assert.equal(r.semanasLidas, 30);
  assert.equal(r.valores[segunda(4)], 0.1431, "14 sessões contra a mediana de 12 (o anúncio de 1.000 não entra)");
  assert.equal(r.valores[segunda(0)], -0.1671, "10 sessões");
  assert.equal(r.valores[segunda(2)], 0, "a mediana");
});

test("a semana que a conexão leu pela metade e as semanas de fora ficam em zero", () => {
  const semanas = semanasDeVisita(32);
  const quarta = new Date(Date.parse(`${segunda(0)}T00:00:00Z`) + 2 * 86400000).toISOString().slice(0, 10);
  const r = controleDeVisitas(doOrganico(30), quarta, domingo(29), semanas);
  assert.equal(r.semanasLidas, 29, "a primeira semana foi lida pela metade");
  assert.equal(r.valores[segunda(0)], 0);
  assert.equal(r.valores[segunda(30)], 0, "depois do último dia lido");
  assert.ok(r.valores[segunda(4)] !== 0);
});

test("com menos de 26 semanas lidas, o GA4 não vira controle (tudo zero) e sem leitura também não", () => {
  const poucas = controleDeVisitas(doOrganico(20), segunda(0), domingo(19), semanasDeVisita(20));
  assert.equal(poucas.semanasLidas, 20);
  assert.ok(Object.values(poucas.valores).every(v => v === 0));
  assert.deepEqual(controleDeVisitas([], null, null, semanasDeVisita(3)), { valores: { [segunda(0)]: 0, [segunda(1)]: 0, [segunda(2)]: 0 }, semanasLidas: 0 });
});

test("a tela das visitas: poucas semanas lidas, entra com 52 e em uso", () => {
  const t = (n: number, varia: boolean) => tabela(n, i => ({ proximidade: 0, feriado: 0, lote: 0, preco: 0, cupom: 0, visitas: varia ? (i % 5) / 10 : 0 }));
  const dos = (l: ControleDaTela[]) => grupo(l, "visitas");
  assert.equal(dos(controlesDaTela(t(60, true), resumo, { conectado: true, semanas: 10 })).estado, "sem_dados");
  assert.match(dos(controlesDaTela(t(60, true), resumo, { conectado: true, semanas: 10 })).detalhe, /só 10 semanas de visitas foram lidas.*26 semanas/);
  assert.equal(dos(controlesDaTela(t(41, true), resumo, { conectado: true, semanas: 40 })).estado, "entra_depois");
  assert.equal(dos(controlesDaTela(t(60, true), resumo, { conectado: true, semanas: 40 })).estado, "em_uso");
  assert.equal(dos(controlesDaTela(t(60, false), resumo, { conectado: true, semanas: 40 })).estado, "sem_dados");
  assert.equal(dos(controlesDaTela(t(60, true), resumo, { conectado: false, semanas: 0 })).estado, "opcional");
});

test("o tamanho do que está à venda: lugares das sessões das próximas 8 semanas, em relação à mediana; antes da primeira sessão vale 1", () => {
  const semanas = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 0, 5) + i * 7 * 86400000).toISOString().slice(0, 10));
  const base = { semanas, datasProprias: [], viradasDeLote: [], itens: [] };
  // Uma sessão pequena (200 lugares) na semana 15 e uma grande (800) na semana 25.
  const sessoes = [{ dia: semanas[15], lugares: 200 }, { dia: semanas[25], lugares: 800 }];
  const c = controlesDasSemanas({ ...base, sessoes: sessoes.map(x => x.dia), lugaresDasSessoes: sessoes });
  const v = (i: number) => c[semanas[i]].lugares;
  assert.equal(v(0), 1, "antes da janela da primeira sessão: o de sempre");
  assert.ok(v(10) > 0 && v(10) < v(20), `a sessão grande pesa mais: ${v(10)} x ${v(20)}`);
  assert.equal(v(16), 0, "a grande ainda está a mais de 8 semanas");
  assert.equal(v(17), v(18), "entre as duas sessões, só a grande está à frente");
  assert.ok(v(17) > 0);
  assert.equal(v(26), 0, "depois da última sessão, nada à venda");
  const sem = controlesDasSemanas({ ...base, sessoes: sessoes.map(x => x.dia) });
  assert.ok(semanas.every(s => sem[s].lugares === 0), "sem a lotação, o controle fica em zero (e não entra)");
});

test("a exposição (uma sessão que fica aberta vários dias) vale todas as semanas em cartaz, e os lugares se dividem entre elas", () => {
  const { dias, lugares } = abrirSessoesLongas([{ inicio: "2026-04-20", fim: "2026-05-05", lugares: 900 }, { inicio: "2026-03-12", fim: null, lugares: 200 }, { inicio: "2026-03-13", fim: "2026-03-13", lugares: 200 }]);
  assert.deepEqual(dias, ["2026-04-20", "2026-04-27", "2026-05-04", "2026-03-12", "2026-03-13"]);
  assert.deepEqual(lugares.map(l => l.lugares), [300, 300, 300, 200, 200]);
  // Com a exposição aberta, a proximidade fica no máximo nas três semanas, e não só na da abertura.
  const semanas = ["2026-04-13", "2026-04-20", "2026-04-27", "2026-05-04", "2026-05-11"];
  const c = controlesDasSemanas({ semanas, sessoes: dias.slice(0, 3), lugaresDasSessoes: lugares.slice(0, 3), datasProprias: [], viradasDeLote: [], itens: [] });
  assert.deepEqual(semanas.map(s => c[s].proximidade), [c["2026-04-13"].proximidade, 1, 1, 1, 0]);
  assert.ok(c["2026-04-13"].proximidade < 1 && c["2026-04-13"].proximidade > 0);
});

test("a curva da casa: só com 3 eventos de 20+ ingressos; parte das vendas por semana antes da sessão, na média dos eventos", () => {
  const v = (evento: string, porSemana: number[]) => porSemana.map((quantidade, semanasAntes) => ({ evento, semanasAntes, quantidade }));
  assert.equal(curvaDaCasa([...v("a", [30, 10]), ...v("b", [30, 10])]), null, "2 eventos: vale a rampa");
  assert.equal(curvaDaCasa([...v("a", [30, 10]), ...v("b", [30, 10]), ...v("c", [5, 5])]), null, "o terceiro vendeu pouco");
  const c = curvaDaCasa([...v("a", [30, 10]), ...v("b", [20, 20]), ...v("c", [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10])])!;
  assert.equal(c.eventos, 3);
  assert.equal(c.curva.length, 9);
  assert.equal(c.curva[0], 0.5833, "(0,75 + 0,5 + 0,5) ÷ 3");
  assert.equal(c.curva[8], 0.1667, "o que veio antes de 8 semanas conta na última");
  assert.ok(Math.abs(c.curva.reduce((s, x) => s + x, 0) - 1) < 0.001);
  const r = rampaPadrao();
  assert.ok(Math.abs(r.reduce((s, x) => s + x, 0) - 1) < 0.001 && r[0] > r[8]);
});

test("com a curva da casa, a proximidade segue a curva (a semana de mais venda vale 1); sem ela, a rampa", () => {
  const semanas = ["2026-04-06", "2026-04-13", "2026-04-20"];
  const base = { semanas, sessoes: ["2026-04-22"], datasProprias: [], viradasDeLote: [], itens: [] };
  const rampa = controlesDasSemanas(base);
  assert.deepEqual(semanas.map(s => rampa[s].proximidade), [0.7778, 0.8889, 1]);
  const curva = [0.5, 0.3, 0.1, 0.05, 0.05, 0, 0, 0, 0];
  const casa = controlesDasSemanas({ ...base, curvaDaCasa: curva });
  assert.deepEqual(semanas.map(s => casa[s].proximidade), [0.2, 0.6, 1]);
});

test("férias escolares: julho e de 20 de dezembro a 31 de janeiro, pela maior parte da semana", () => {
  assert.equal(semanaDeFerias("2026-07-06"), true);
  assert.equal(semanaDeFerias("2026-06-29"), true, "2 dias de junho e 5 de julho");
  assert.equal(semanaDeFerias("2026-06-22"), false);
  assert.equal(semanaDeFerias("2026-12-21"), true);
  assert.equal(semanaDeFerias("2026-12-14"), false);
  assert.equal(semanaDeFerias("2027-01-25"), true);
  assert.equal(semanaDeFerias("2026-04-13"), false);
});

test("atração aberta o ano todo: um evento com sessão em 70% das semanas de 26 ou mais", () => {
  const zoologico = Array.from({ length: 40 }, (_, i) => ({ evento: "zoo", inicio: new Date(Date.UTC(2026, 0, 6) + i * 7 * 86400000).toISOString().slice(0, 10), fim: null }));
  assert.equal(atracaoOAnoTodo(zoologico), true);
  assert.equal(atracaoOAnoTodo([{ evento: "expo", inicio: "2026-01-05", fim: "2026-09-30" }]), true, "uma exposição longa também");
  const teatro = Array.from({ length: 6 }, (_, i) => ({ evento: `e${i}`, inicio: new Date(Date.UTC(2026, 0, 6) + i * 60 * 86400000).toISOString().slice(0, 10), fim: null }));
  assert.equal(atracaoOAnoTodo(teatro), false);
  const l = controlesDaTela([{ controles: { proximidade: 1 } }, { controles: { proximidade: 1 } }], { eventos: 1, sessoes: 200, lotes: 0, cupons: 0, datasProprias: 0, permanente: true }, { conectado: false, semanas: 0 });
  assert.equal(l.find(c => c.grupo === "proximidade")?.estado, "nao_se_aplica");
  assert.equal(l.find(c => c.grupo === "lugares")?.estado, "nao_se_aplica");
  const comCurva = controlesDaTela([{ controles: { proximidade: 1 } }, { controles: { proximidade: 0.2 } }], { eventos: 7, sessoes: 30, lotes: 0, cupons: 0, datasProprias: 0, curva: { curva: [1], eventos: 7 } }, { conectado: false, semanas: 0 });
  assert.equal(comCurva[0].rotulo, "Ritmo de venda da sua casa");
  assert.equal(comCurva[0].acao, "curva");
});
