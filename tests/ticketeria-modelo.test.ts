import assert from "node:assert/strict";
import test from "node:test";
import { avaliarProntidao, canalDoGasto, confiancaPelasSemanas, consolidarGasto, inicioDaSemana, montarTabelaSemanal, resumirCanais, semanasEntre, type SemanaDaTabela } from "../lib/ticketeria/modelo";

test("a semana começa na segunda e as semanas entre dois dias contam as duas pontas", () => {
  assert.equal(inicioDaSemana("2026-11-20"), "2026-11-16", "sexta → segunda");
  assert.equal(inicioDaSemana("2026-11-16"), "2026-11-16");
  assert.equal(inicioDaSemana("2026-11-22"), "2026-11-16", "domingo fica na semana de segunda");
  assert.equal(inicioDaSemana("2026-11-23"), "2026-11-23");
  assert.equal(semanasEntre("2026-11-16", "2026-11-22"), 1);
  assert.equal(semanasEntre("2026-11-16", "2026-11-23"), 2);
  assert.equal(semanasEntre("2025-03-03", "2025-12-14"), 41);
  assert.equal(semanasEntre("2026-11-20", "2026-11-10"), 0);
});

test("o canal de gasto: nomes da planilha e da conexão viram o mesmo canal", () => {
  assert.equal(canalDoGasto("google"), "google-ads");
  assert.equal(canalDoGasto("Google-Ads"), "google-ads");
  assert.equal(canalDoGasto("meta"), "meta-ads");
  assert.equal(canalDoGasto("meta-ads"), "meta-ads");
  assert.equal(canalDoGasto("instagram"), "instagram");
});

test("o gasto das três fontes: a de maior confiança vale no mesmo canal e dia; ação se reparte pelos dias; anúncio pago de ação some se há conexão", () => {
  const r = consolidarGasto({
    conexoes: [{ dia: "2026-11-02", canal: "meta-ads", centavos: 10000 }],
    planilhas: [{ dia: "2026-11-02", canal: "meta", centavos: 9999 }, { dia: "2026-11-02", canal: "meta", centavos: 1 }, { dia: "2026-11-01", canal: "meta", centavos: 5000 }, { dia: "2026-11-01", canal: "google", centavos: 3000 }],
    acoes: [
      { nome: "Stories", canal: "instagram", inicio: "2026-11-02", fim: "2026-11-04", gasto_centavos: 10000 },
      { nome: "Anúncios no Meta", canal: "anuncio-pago", inicio: "2026-11-02", fim: "2026-11-03", gasto_centavos: 99999 },
      { nome: "E-mail", canal: "email", inicio: "2026-11-02", fim: "2026-11-02", gasto_centavos: 0 },
    ],
  });
  assert.deepEqual(r.ignoradas, ["Anúncios no Meta"]);
  const v = (dia: string, canal: string) => r.gasto.find(g => g.dia === dia && g.canal === canal);
  assert.deepEqual([v("2026-11-02", "meta-ads")?.centavos, v("2026-11-02", "meta-ads")?.fonte], [10000, "conexao"], "a conexão vence a planilha no mesmo dia");
  assert.deepEqual([v("2026-11-01", "meta-ads")?.centavos, v("2026-11-01", "meta-ads")?.fonte], [5000, "planilha"], "sem conexão naquele dia, vale a planilha");
  assert.equal(v("2026-11-01", "google-ads")?.centavos, 3000);
  assert.deepEqual(["2026-11-02", "2026-11-03", "2026-11-04"].map(d => v(d, "instagram")?.centavos), [3334, 3333, 3333], "10000 em 3 dias, sem perder centavo");
  assert.equal(r.gasto.some(g => g.canal === "email"), false, "ação sem gasto não entra");
  assert.equal(r.gasto.filter(g => g.canal === "anuncio-pago").length, 0);
  const semConexao = consolidarGasto({ conexoes: [], planilhas: [], acoes: [{ nome: "Anúncios no Meta", canal: "anuncio-pago", inicio: "2026-11-02", fim: "2026-11-02", gasto_centavos: 5000 }] });
  assert.deepEqual([semConexao.ignoradas.length, semConexao.gasto[0].canal, semConexao.gasto[0].centavos], [0, "anuncio-pago", 5000], "sem conexão, a ação de anúncio pago vale");
});

test("a tabela semanal: sem furos, vendas e gasto na semana certa, semana vazia vale zero", () => {
  assert.deepEqual(montarTabelaSemanal({ vendas: {}, gasto: [] }), []);
  const t = montarTabelaSemanal({
    vendas: { "2026-11-03": 4, "2026-11-05": 6, "2026-11-23": 2 },
    gasto: [{ dia: "2026-11-04", canal: "meta-ads", centavos: 1000, fonte: "conexao" }, { dia: "2026-11-05", canal: "meta-ads", centavos: 500, fonte: "conexao" }, { dia: "2026-11-12", canal: "google-ads", centavos: 700, fonte: "planilha" }],
  });
  assert.deepEqual(t.map(s => s.semana), ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
  assert.deepEqual(t.map(s => s.ingressos), [10, 0, 0, 2]);
  assert.deepEqual(t[0].gasto, { "meta-ads": 1500 });
  assert.deepEqual(t[1].gasto, { "google-ads": 700 });
  assert.deepEqual(t[2].gasto, {});
});

const semana = (i: number, ingressos: number, gasto: Record<string, number> = {}): SemanaDaTabela => {
  const d = new Date(Date.UTC(2025, 0, 6 + i * 7));
  return { semana: d.toISOString().slice(0, 10), ingressos, gasto };
};

test("os canais: semanas com gasto, total, variação e o gasto mais comum", () => {
  const tabela = [semana(0, 5, { "meta-ads": 15000 }), semana(1, 5, { "meta-ads": 15000 }), semana(2, 5, {}), semana(3, 5, { "meta-ads": 15000 }), semana(4, 5, { "google-ads": 4000 })];
  const c = resumirCanais(tabela);
  assert.deepEqual(c.map(x => x.canal), ["meta-ads", "google-ads"]);
  assert.equal(c[0].semanasComGasto, 3);
  assert.equal(c[0].gastoTotalCentavos, 45000);
  assert.equal(c[0].medianaCentavos, 15000);
  assert.equal(c[0].rotulo, "Meta Ads");
  assert.ok(c[0].variacao > 0.5, "a semana sem gasto no meio faz o gasto variar");
  const constante = resumirCanais(Array.from({ length: 10 }, (_, i) => semana(i, 1, { "meta-ads": 15000 })));
  assert.equal(constante[0].variacao, 0, "sempre o mesmo valor: variação zero");
});

const entrada = (tabela: SemanaDaTabela[], extra = {}) => ({ tabela, ga4Conectado: false, primeiroDiaDeVisitas: null, ultimoDiaDeVisitas: null, ...extra });
const vendasPorN = (n: number, gasto: (i: number) => Record<string, number>) => Array.from({ length: n }, (_, i) => semana(i, 10, gasto(i)));

test("a prontidão sem nada: tudo falta, não está pronto, sem confiança", () => {
  const p = avaliarProntidao(entrada([]));
  assert.equal(p.pronto, false);
  assert.deepEqual([p.prontos, p.total, p.confianca, p.semanas], [0, 3, null, 0]);
  assert.deepEqual(p.verificacoes.map(v => [v.id, v.estado]), [["vendas", "falta"], ["gasto", "falta"], ["variacao", "falta"], ["visitas", "opcional"]]);
  assert.match(p.verificacoes[0].titulo, /ainda nenhuma/);
});

test("a prontidão do exemplo da tela: vendas ok, pouco gasto, gasto sem variação, visitas opcionais", () => {
  const tabela = [...Array.from({ length: 41 }, (_, i) => semana(i, 10, i >= 29 ? { "meta-ads": 15000 } : {}))];
  const p = avaliarProntidao(entrada(tabela));
  assert.equal(p.pronto, false);
  assert.deepEqual(p.verificacoes.map(v => v.estado), ["ok", "atencao", "atencao", "opcional"]);
  assert.equal(p.verificacoes[0].titulo, "Vendas: 41 semanas");
  assert.equal(p.verificacoes[1].titulo, "Gasto em divulgação: só 12 semanas");
  assert.match(p.verificacoes[1].detalhe, /Meta Ads tem 12 semanas com gasto\. Faltam 14 para o mínimo \(26\)/);
  assert.equal(p.verificacoes[1].acao, "importar");
  assert.match(p.verificacoes[2].detalhe, /quase não mudou \(sempre perto de R\$ 150 por semana\)/);
  assert.deepEqual([p.prontos, p.total], [1, 3]);
});

test("a prontidão completa: confiança pelas semanas em que há vendas e gasto juntos", () => {
  const variado = (i: number): Record<string, number> => ({ "meta-ads": i % 4 === 0 ? 5000 : i % 4 === 1 ? 30000 : i % 4 === 2 ? 12000 : 0 });
  const media = avaliarProntidao(entrada(vendasPorN(60, variado)));
  assert.equal(media.pronto, true);
  assert.deepEqual([media.prontos, media.total, media.confianca, media.semanas], [3, 3, "media", 59]);
  assert.deepEqual(media.verificacoes.map(v => v.estado), ["ok", "ok", "ok", "opcional"]);
  const baixa = avaliarProntidao(entrada(vendasPorN(40, variado)));
  assert.deepEqual([baixa.pronto, baixa.confianca, baixa.semanas], [true, "baixa", 39], "40 semanas, a última sem gasto: 39 juntas");
  assert.equal(avaliarProntidao(entrada(vendasPorN(30, variado))).pronto, false, "30 semanas com 3 em cada 4 com gasto: 23 semanas com gasto, abaixo do mínimo de 26");
  const boa = avaliarProntidao(entrada(vendasPorN(110, variado), { ga4Conectado: true, primeiroDiaDeVisitas: "2025-01-06", ultimoDiaDeVisitas: "2025-03-30" }));
  assert.deepEqual([boa.confianca, boa.verificacoes[3].estado, boa.verificacoes[3].titulo], ["boa", "ok", "Visitas ao site (opcional): 12 semanas"]);
  assert.equal(confiancaPelasSemanas(51), "baixa");
  assert.equal(confiancaPelasSemanas(52), "media");
  assert.equal(confiancaPelasSemanas(103), "media");
  assert.equal(confiancaPelasSemanas(104), "boa");
});

test("gasto só no começo e vendas depois: só contam as semanas em que os dois existem", () => {
  const variado = (i: number): Record<string, number> => (i < 30 ? { "meta-ads": i % 2 === 0 ? 5000 : 20000 } : {});
  const p = avaliarProntidao(entrada(vendasPorN(80, variado)));
  assert.equal(p.pronto, true);
  assert.equal(p.semanas, 30, "as 50 semanas sem gasto não entram na conta da confiança");
});

test("canal com poucas semanas não vale para conferir a variação; GA4 sem dados fica opcional; ações ignoradas passam adiante", () => {
  const p = avaliarProntidao(entrada(vendasPorN(40, (i): Record<string, number> => (i < 5 ? { "meta-ads": 10000 } : {})), { ga4Conectado: true, ignoradas: ["Anúncios no Meta"] }));
  assert.equal(p.verificacoes[2].estado, "falta");
  assert.match(p.verificacoes[2].detalhe, /ao menos 8 semanas/);
  assert.equal(p.verificacoes[3].estado, "opcional", "conectado mas sem visita lida ainda");
  assert.deepEqual(p.ignoradas, ["Anúncios no Meta"]);
});
