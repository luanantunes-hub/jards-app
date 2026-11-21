import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExpectativaSheet, ParecidosSheet, RitmoComparado, SemParecido } from "../components/ticketeria/RitmoComparadoView";
import { PrimeirosDados } from "../components/ticketeria/PainelView";
import { ritmoDoEvento, type RitmoDoEvento } from "../lib/ticketeria/modelo-painel";
import { DIAS_DA_CURVA, acumuladoDaSessao, candidatosDoEvento, preverPorComparacao, type CurvaDoEvento } from "../lib/ticketeria/ritmo-comparado";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");
const curva = (id: string, nome: string, final: number, k: number, extra: Partial<CurvaDoEvento> = {}): CurvaDoEvento => ({
  id, nome, quando: "mar/2025", local: "Teatro Municipal", localId: "L1", precoMedioCentavos: 6000, lugares: 200,
  acumulado: Array.from({ length: DIAS_DA_CURVA + 1 }, (_, d) => Math.round(200 * final * (1 - (d / DIAS_DA_CURVA) ** k))), ...extra,
});
const HOJE = "2026-11-20";
const dia = (n: number) => new Date(Date.parse(`${HOJE}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
// Este evento: 126 de 200 a 18 dias da sessão (08/12), com 4 por dia nos últimos 7 dias.
const vendasPorDia: Record<string, number> = { [dia(-25)]: 98 };
for (let i = 0; i < 7; i++) vendasPorDia[dia(-i)] = 4;
const base = ritmoDoEvento({ evento: "Hamlet", vendasPorDia, vendidos: 126, lugares: 200, hoje: HOJE, diaDaSessao: "2026-12-08" }) as RitmoDoEvento;
const parecidas = [curva("a", "Hamlet, temporada 2025", 0.92, 1.5), curva("b", "Ricardo III", 1.0, 1.8), curva("c", "Cabaret Voltaire", 0.78, 1.4), curva("d", "Hamlet, reprise", 0.96, 1.7), curva("e", "Festival de Verão", 0.9, 1.6, { local: "Praça Central", localId: "L2", precoMedioCentavos: 12000 })];
const ATUAL = { id: "atual", localId: "L1", precoMedioCentavos: 6200 };
const ritmo: RitmoDoEvento = { ...base, comparacao: { sessaoId: "atual", localId: "L1", precoMedioCentavos: 6200, acumulado: acumuladoDaSessao("2026-12-08", vendasPorDia), curvas: parecidas } };

test("o ritmo comparado: a frase com a faixa e o selo, o gráfico, a tabela dos usados e o que ficou de fora com o motivo", () => {
  const candidatos = candidatosDoEvento(ATUAL, parecidas);
  const previsao = preverPorComparacao({ vendidos: 126, lugares: 200, diasAteASessao: 18, parecidos: candidatos.filter(c => c.usado).map(c => c.curva) })!;
  assert.equal(previsao.n, 4);
  const h = html(createElement(RitmoComparado, { ritmo, previsao, candidatos }));
  for (const t of ["No ritmo dos eventos parecidos, você chega a", "ingressos", "impreciso", "dos 200 lugares", "Hoje você está em 63% da lotação a 18 dias da sessão", "A conta: o que cada evento parecido vendeu no fim", "Vendas acumuladas até a sessão", "hoje, a 18 dias: 63%", "Eventos parecidos usados na comparação", "Ajustar eventos parecidos", "Hamlet, temporada 2025", "Ricardo III", "Cabaret Voltaire", "Hamlet, reprise", "Teatro Municipal", "R$ 60,00", "Vendido a 18 dias", "Vendido no fim", "Festival de Verão", "(outro local)", "mesmo local, preço na mesma faixa e que vendeu pelo menos 20% da lotação", "não uma garantia"]) assert.ok(h.includes(t), `falta: ${t}`);
  assert.ok(h.includes("<polygon") && h.includes("<polyline"), "o gráfico tem a faixa e a linha do evento");
});

test("com um parecido só: sem faixa, 'muito impreciso' e a frase diz que é estimativa solta", () => {
  const candidatos = candidatosDoEvento(ATUAL, parecidas, { b: false, c: false, d: false });
  const previsao = preverPorComparacao({ vendidos: 126, lugares: 200, diasAteASessao: 18, parecidos: candidatos.filter(c => c.usado).map(c => c.curva) })!;
  const h = html(createElement(RitmoComparado, { ritmo, previsao, candidatos }));
  assert.ok(h.includes("No ritmo do evento parecido, você chega a cerca de") && h.includes("muito impreciso") && h.includes("Só há um evento parecido: sem faixa"));
  assert.ok(h.includes("Ricardo III") && h.includes("(outro local)") && h.includes("text-black/35"), "os desmarcados aparecem esmaecidos");
});

test("com a comparação, a conta simples do ritmo sai do bloco de primeiros dados", () => {
  assert.ok(html(createElement(PrimeirosDados, { ritmo, origem: [] })).includes("Se o ritmo continuar"));
  const sem = html(createElement(PrimeirosDados, { ritmo, origem: [], semConta: true }));
  assert.ok(!sem.includes("Se o ritmo continuar") && sem.includes("Quanto já vendeu"));
});

test("sem evento parecido: não inventa previsão, mostra o medido, a expectativa do produtor e como o evento vira comparável", () => {
  const sem = html(createElement(SemParecido, { ritmo, temHistorico: false, expectativa: null, onExpectativa: () => {}, onImportar: () => {} }));
  for (const t of ["Sem evento parecido, sem previsão por comparação", "Este é o seu primeiro evento com venda.", "126 de 200 ingressos (63%) a 18 dias da sessão", "Quanto você espera vender?", "sua expectativa", "Dizer quanto espero vender", "Depois da sessão, este evento passa a valer como parecido", "importar as vendas anteriores", "não uma falha"]) assert.ok(sem.includes(t), `falta: ${t}`);
  assert.ok(html(createElement(SemParecido, { ritmo, temHistorico: true, expectativa: null })).includes("de outro local, de outro preço ou venderam pouco"));
  const com = html(createElement(SemParecido, { ritmo, temHistorico: true, expectativa: 140, onExpectativa: () => {} }));
  assert.ok(com.includes("140 ingressos") && com.includes("70% da lotação") && com.includes("Você já vendeu 126 dos 140 que espera: com o ritmo de hoje, o evento passa do seu palpite.") && com.includes("Mudar a expectativa"));
  const abaixo = html(createElement(SemParecido, { ritmo, temHistorico: true, expectativa: 200 }));
  assert.ok(abaixo.includes("Você já vendeu 126 dos 200 que espera: com o ritmo de hoje chega a cerca de 198, abaixo do palpite."));
});

test("as folhas: parecidos com a sugestão e o motivo; expectativa com a lotação e a opção de apagar", () => {
  const candidatos = candidatosDoEvento(ATUAL, parecidas);
  const f = html(createElement(ParecidosSheet, { candidatos, onClose: () => {} }));
  for (const t of ["Eventos parecidos", "A escolha fica neste navegador", "Hamlet, temporada 2025", "Sugerido: mesmo local, preço na faixa.", "Festival de Verão", "Não sugerido: outro local.", 'type="checkbox"']) assert.ok(f.includes(t), `falta: ${t}`);
  assert.ok(html(createElement(ParecidosSheet, { candidatos: [], onClose: () => {} })).includes("Ainda não há evento anterior com venda."));
  const e = html(createElement(ExpectativaSheet, { lugares: 200, valorInicial: null, onClose: () => {} }));
  assert.ok(e.includes("Quanto você espera vender?") && e.includes("a lotação é 200") && e.includes("É opcional e fica neste navegador") && !e.includes("Apagar"));
  assert.ok(html(createElement(ExpectativaSheet, { lugares: 200, valorInicial: 140, onClose: () => {} })).includes("Apagar"));
});
