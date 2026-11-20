import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanoBDoModelo } from "../components/ticketeria/PlanoBView";
import type { AcaoComResultado } from "../lib/ticketeria/divulgacao";
import type { ResumoDoCanal } from "../lib/ticketeria/modelo";
import { FOLGA_ANTES_DA_SESSAO_EM_DIAS, PARTE_DO_EXPERIMENTO, acaoDoExperimento, custoMedidoPorCanal, proximaSegunda, sugerirExperimento, variacaoDosCanais } from "../lib/ticketeria/modelo-plano-b";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/\u00a0/g, " ");
const canal = (c: string, mediana: number, variacao: number, semanas = 12): ResumoDoCanal => ({ canal: c, rotulo: c, semanasComGasto: semanas, primeiraSemana: "2026-01-05", ultimaSemana: "2026-03-23", gastoTotalCentavos: mediana * semanas, variacao, medianaCentavos: mediana });
const acao = (nome: string, canalDaAcao: string, rotulo: string, gasto: number, ingressos: number): AcaoComResultado => ({ id: nome, evento_id: null, nome, canal: canalDaAcao, inicio: "2026-11-01", fim: "2026-11-07", gasto_centavos: gasto, rotulo_do_canal: rotulo, ingressos, vendido_centavos: ingressos * 5000, custo_por_ingresso_centavos: ingressos > 0 && gasto > 0 ? Math.round(gasto / ingressos) : null });
const HOJE = "2026-11-20"; // sexta-feira

test("custo medido: soma as ações de cada canal; ingressos pelos links, custo por ingresso e aviso de poucos ingressos", () => {
  const linhas = custoMedidoPorCanal([
    acao("A", "anuncio-pago", "Anúncio pago", 100000, 80), acao("B", "anuncio-pago", "Anúncio pago", 220000, 62), acao("C", "email", "E-mail", 0, 96), acao("D", "instagram", "Instagram", 24000, 31), acao("E", "whatsapp", "WhatsApp", 5000, 4),
  ]);
  assert.deepEqual(linhas.map(l => l.canal), ["anuncio-pago", "email", "instagram", "whatsapp"], "do que mais trouxe ingressos para o que menos");
  const pago = linhas[0];
  assert.deepEqual([pago.gastoCentavos, pago.ingressos, pago.acoes, pago.custoPorIngressoCentavos, pago.poucoDado], [320000, 142, 2, 2254, false]);
  assert.equal(linhas[1].custoPorIngressoCentavos, null, "sem gasto não há custo por ingresso");
  assert.equal(linhas[2].poucoDado, false, "31 ingressos");
  assert.equal(linhas[3].poucoDado, true, "4 ingressos");
  assert.deepEqual(custoMedidoPorCanal([]), []);
});

test("variação dos canais: só os com 8 semanas ou mais de gasto; o traço do mínimo fica em 0,5", () => {
  const v = variacaoDosCanais([canal("meta-ads", 15000, 0.1), canal("google-ads", 5500, 0.5), canal("novo", 3000, 0.9, 5)]);
  assert.deepEqual(v.map(l => l.canal), ["meta-ads", "google-ads"]);
  assert.equal(v[0].suficiente, false);
  assert.equal(v[0].nivel, 0.2);
  assert.equal(v[1].suficiente, true);
  assert.equal(v[1].nivel, 1, "passa do dobro do mínimo: cheio");
});

test("a próxima segunda depois de hoje", () => {
  assert.equal(proximaSegunda("2026-11-20"), "2026-11-23", "de uma sexta");
  assert.equal(proximaSegunda("2026-11-22"), "2026-11-23", "de um domingo");
  assert.equal(proximaSegunda("2026-11-23"), "2026-11-30", "de uma segunda: a seguinte");
});

test("o experimento: uma parte do gasto do canal que mais gasta vai para o segundo, por 2 semanas, no mesmo total", () => {
  const s = sugerirExperimento([canal("google-ads", 5500, 0.5), canal("meta-ads", 15000, 0.1)], HOJE, null);
  assert.equal(s.tipo, "sugerido");
  if (s.tipo !== "sugerido") return;
  const e = s.experimento;
  assert.deepEqual([e.de.canal, e.para.canal], ["meta-ads", "google-ads"], "sai de quem gasta mais");
  assert.equal(e.valorCentavos, Math.round((PARTE_DO_EXPERIMENTO * 15000) / 500) * 500);
  assert.equal(e.valorCentavos, 3000);
  assert.ok(e.valorCentavos <= 0.3 * e.de.gastoCentavos, "pouco dinheiro: no máximo 30% do gasto do canal");
  assert.deepEqual([e.inicio, e.fim, e.semanas], ["2026-11-23", "2026-12-06", 2]);
  // O total não muda: o que sai de um entra no outro, e nenhum canal é pausado nem dobrado.
  assert.ok(e.de.gastoCentavos - e.valorCentavos > 0, "não pausa o canal");
  assert.ok(e.para.gastoCentavos + e.valorCentavos < 2 * e.para.gastoCentavos + 1 || e.valorCentavos <= 0.3 * e.de.gastoCentavos);
});

test("o experimento não é sugerido perto de uma sessão, com um canal só ou quando o gasto já varia", () => {
  const dois = [canal("meta-ads", 15000, 0.1), canal("google-ads", 5500, 0.5)];
  const fimDoExperimento = "2026-12-06";
  const limite = new Date(Date.parse(`${fimDoExperimento}T00:00:00Z`) + FOLGA_ANTES_DA_SESSAO_EM_DIAS * 86400000).toISOString().slice(0, 10);
  assert.deepEqual(sugerirExperimento(dois, HOJE, "2026-12-10"), { tipo: "esperar_sessao", sessao: "2026-12-10" });
  assert.deepEqual(sugerirExperimento(dois, HOJE, limite), { tipo: "esperar_sessao", sessao: limite }, "no limite da folga ainda espera");
  assert.equal(sugerirExperimento(dois, HOJE, "2027-01-30").tipo, "sugerido", "sessão longe: pode");
  assert.equal(sugerirExperimento(dois, HOJE, "2026-11-01").tipo, "sugerido", "sessão que já passou não conta");
  assert.equal(sugerirExperimento([canal("meta-ads", 15000, 0.1)], HOJE, null).tipo, "poucos_canais");
  assert.equal(sugerirExperimento([canal("meta-ads", 15000, 0.1), canal("google-ads", 5500, 0.5, 5)], HOJE, null).tipo, "poucos_canais", "canal com menos de 8 semanas de gasto não conta");
  assert.equal(sugerirExperimento([canal("meta-ads", 15000, 0.4), canal("google-ads", 5500, 0.5)], HOJE, null).tipo, "nao_precisa");
  assert.equal(sugerirExperimento([canal("meta-ads", 1500, 0.1), canal("google-ads", 1000, 0.1)], HOJE, null).tipo, "poucos_canais", "gasto pequeno demais para mover sem pesar");
});

test("registrar o experimento como ação: nome claro, canal de anúncio, o período e sem gasto (o total não muda)", () => {
  const s = sugerirExperimento([canal("meta-ads", 15000, 0.1), canal("google-ads", 5500, 0.5)], HOJE, null);
  assert.equal(s.tipo, "sugerido");
  if (s.tipo !== "sugerido") return;
  const c = acaoDoExperimento(s.experimento);
  assert.match(c.nome, /^Experimento: R\$ 30,00 por semana do Meta Ads para o Google Ads$/);
  assert.deepEqual([c.canal, c.inicio, c.fim, c.gasto], ["anuncio-pago", "2026-11-23", "2026-12-06", ""]);
  assert.ok(c.nome.length <= 80);
});

test("a tela do plano B: custo medido, o experimento com as salvaguardas e a variação; nunca pausar, dobrar nem 'para o modelo aprender'", () => {
  const p = html(createElement(PlanoBDoModelo, { acoes: [acao("A", "anuncio-pago", "Anúncio pago", 320000, 142), acao("B", "email", "E-mail", 0, 96)], canais: [canal("meta-ads", 15000, 0.1), canal("google-ads", 5500, 0.5)], hoje: HOJE, proximaSessao: null }));
  for (const x of ["O que já dá para medir: custo por ingresso", "Anúncio pago", "R$ 3.200,00", "142", "R$ 22,54", "É medido, não previsto", "Para descobrir onde rende mais", "Um experimento pequeno: mova R$ 30,00 por semana do Meta Ads para o Google Ads, por 2 semanas.", "O total que você gasta não muda", "Seguro:", "não pausa nada", "fora das semanas de sessão", "Você decide se faz", "De segunda (23/11) a domingo (06/12).", "Registrar como ação", "O quanto o gasto varia", "varia pouco", "varia o bastante", "Experimentar é sempre opcional"]) assert.ok(p.includes(x), `falta: ${x}`);
  assert.ok(!/pause|dobre|para o modelo aprender|laboratório/i.test(p), "o experimento é do produtor");
  const perto = html(createElement(PlanoBDoModelo, { acoes: [], canais: [canal("meta-ads", 15000, 0.1), canal("google-ads", 5500, 0.5)], hoje: HOJE, proximaSessao: "2026-12-10" }));
  assert.ok(perto.includes("Melhor esperar: há uma sessão em 10/12.") && !perto.includes("Registrar como ação") && !perto.includes("O que já dá para medir"));
  assert.ok(html(createElement(PlanoBDoModelo, { acoes: [], canais: [canal("meta-ads", 15000, 0.1)], hoje: HOJE, proximaSessao: null })).includes("o Jards sugere um experimento pequeno para comparar os dois"));
  assert.ok(html(createElement(PlanoBDoModelo, { acoes: [], canais: [canal("meta-ads", 15000, 0.4), canal("google-ads", 5500, 0.5)], hoje: HOJE, proximaSessao: null })).includes("O gasto dos seus canais já varia o bastante"));
});
