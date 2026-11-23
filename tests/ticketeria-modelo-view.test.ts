import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ModeloDaLoja } from "../components/ticketeria/ModeloView";
import { avaliarProntidao, type SemanaDaTabela } from "../lib/ticketeria/modelo";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");
const semana = (i: number, ingressos: number, gasto: Record<string, number> = {}): SemanaDaTabela => ({ semana: new Date(Date.UTC(2025, 0, 6 + i * 7)).toISOString().slice(0, 10), ingressos, gasto });
const base = { ga4Conectado: false, primeiroDiaDeVisitas: null, ultimoDiaDeVisitas: null };

test("a aba Modelo sem dado: aviso de que não pode rodar, a checklist e os botões que levam ao que resolve", () => {
  const vazio = html(createElement(ModeloDaLoja, { prontidao: avaliarProntidao({ ...base, tabela: [] }) }));
  for (const t of ["O modelo ainda não pode rodar.", "três coisas", "0 de 3 prontos", "Vendas: ainda nenhuma", "Gasto em divulgação: nenhum", "O gasto precisa variar de semana a semana", "Visitas ao site (opcional)", "Importar planilha", "Ir para Conexões", "roda sozinho toda segunda-feira"]) assert.ok(vazio.includes(t), `falta: ${t}`);
});

test("o exemplo da tela: vendas ok, pouco gasto e sem variação", () => {
  const tabela = Array.from({ length: 41 }, (_, i) => semana(i, 10, i >= 29 ? { "meta-ads": 15000 } : {}));
  const p = html(createElement(ModeloDaLoja, { prontidao: avaliarProntidao({ ...base, tabela }) }));
  for (const t of ["duas coisas", "1 de 3 prontos", "Vendas: 41 semanas", "Gasto em divulgação: só 12 semanas", "Faltam 14 para o mínimo (26)", "Importar gastos antigos", "sempre perto de R$ 150 por semana", "pausar ou dobrar o anúncio"]) assert.ok(p.includes(t), `falta: ${t}`);
  assert.ok(!p.includes("Os dados estão prontos"));
});

test("com dado de sobra: os dados estão prontos, com a confiança e as semanas; o cálculo vem depois", () => {
  const variado = (i: number): Record<string, number> => ({ "meta-ads": i % 4 === 0 ? 5000 : i % 4 === 1 ? 30000 : i % 4 === 2 ? 12000 : 0 });
  const prontidao = avaliarProntidao({ ...base, tabela: Array.from({ length: 60 }, (_, i) => semana(i, 10, variado(i))), ignoradas: ["Anúncios no Meta", "Outro"] });
  const p = html(createElement(ModeloDaLoja, { prontidao }));
  for (const t of ["Os dados estão prontos.", "confiança média", "59 semanas com vendas e gasto", "o ideal são 104", "3 de 3 prontos", "O cálculo do modelo chega na próxima etapa", "das ações", "Anúncios no Meta, Outro", "o gasto de anúncios já vem das conexões"]) assert.ok(p.includes(t), `falta: ${t}`);
  assert.ok(!p.includes("ainda não pode rodar"));
  const uma = html(createElement(ModeloDaLoja, { prontidao: { ...prontidao, ignoradas: ["Anúncios no Meta"] } }));
  assert.ok(uma.includes("da ação"));
});

// ─── O resultado do modelo (M-B) ────────────────────────────────────────────

import { ResultadoDoModelo } from "../components/ticketeria/ModeloView";
import { compararComOsLinks, type CanalDoResultado } from "../lib/ticketeria/modelo-resultado";
import type { ResultadoParaATela } from "../lib/ticketeria/modelo-servidor";

const canal = (c: string, porcento: number, baixo: number, alto: number, gasto: number, custo: number | null, extra: Partial<CanalDoResultado> = {}): CanalDoResultado => ({ canal: c, porcento, baixo, alto, ingressos: 100, gasto_centavos: gasto, custo_por_ingresso_centavos: custo, saturacao_gasto_centavos: null, margem_grande: false, gasto_constante: false, curva: [], ...extra });
const canais = [canal("meta-ads", 27, 16, 38, 780000, 2250, { saturacao_gasto_centavos: 30000 }), canal("google-ads", 9, 0.5, 18, 210000, 1820, { margem_grande: true, gasto_constante: true }), canal("instagram", 14, 5, 23, 0, null), canal("email", 9, 3, 15, 0, null)];
const resultado = (extra: Partial<ResultadoParaATela> = {}, semanas = 58, confianca: "baixa" | "media" | "boa" = "media"): ResultadoParaATela => ({
  execucao: { id: "e1", created_at: "2026-11-17T09:00:00Z", semanas, confianca, motor: "pymc-marketing", versao_motor: "1.5.0", r_hat_maximo: 1.01, divergencias: 0, ess_minimo: 700, base: { porcento: 41, baixo: 33, alto: 49, partes: [] } },
  comparacao: compararComOsLinks(canais, { instagram: 22, email: 13, "anuncio-pago": 27, "sem-origem": 38 }), canais, ultimaFalha: null, ...extra,
});

test("o resultado do modelo: confiança, tabela com o modelo ao lado dos links, avisos de margem e de gasto constante", () => {
  const h = html(createElement(ResultadoDoModelo, { resultado: resultado() }));
  for (const t of ["Confiança média.", "Histórico: 58 semanas", "em ordem", "O que essa confiança permite", "Venderia de qualquer jeito", "41%", "±24", "Meta Ads", "R$ 7.800,00", "27%", "±33", "Google Ads", "margem grande", "gasto quase constante", "Instagram", "22%", "E-mail", "13%", "R$ 22,50", "R$ 18,20",
    "Anúncios pagos (Meta e Google juntos", "modelo 36% · links 27%", "impreciso", "Quanto cada canal vendeu", "já alargado 3 vezes", "desconfie do modelo"]) assert.ok(h.includes(t), `falta: ${t}`);
  assert.ok(!h.includes("acima de R$ 300,00 por semana, cada real a mais rende pouco"), "com confiança média o ponto de saturação não aparece: é parte do ranking de canais");
  const boa = html(createElement(ResultadoDoModelo, { resultado: resultado({}, 104, "boa") }));
  assert.ok(boa.includes("Meta Ads: acima de R$ 300,00 por semana, cada real a mais rende pouco.") && !boa.includes("Google Ads: acima de"), "com confiança boa, o ponto de saturação aparece; sem ele, sem frase");
  assert.ok(!h.includes("não deu"));
});

test("o resultado: a rodada que falhou aparece sem esconder a anterior; diagnóstico ruim avisa; sem links nada quebra", () => {
  const falha = html(createElement(ResultadoDoModelo, { resultado: resultado({ ultimaFalha: { motivo: "Só há 20 semanas.", created_at: "2026-11-24T09:00:00Z" } }) }));
  assert.ok(falha.includes("não deu: Só há 20 semanas. Esta tela mostra a anterior."));
  const ruim = resultado({}, 80, "baixa");
  ruim.execucao.r_hat_maximo = 1.2;
  assert.ok(html(createElement(ResultadoDoModelo, { resultado: ruim })).includes("Ajuste instável"));
  assert.ok(html(createElement(ResultadoDoModelo, { resultado: resultado({}, 110, "boa") })).includes("Confiança boa."));
  const semLinks = resultado({ comparacao: compararComOsLinks(canais, {}) });
  const h = html(createElement(ResultadoDoModelo, { resultado: semLinks }));
  assert.ok(h.includes("modelo 36%.") && !h.includes("links 27%"));
});

// ─── Os controles e a quebra da base ────────────────────────────────────────

import { ControlesDoModelo } from "../components/ticketeria/ModeloView";
import { controlesDaTela } from "../lib/ticketeria/modelo-controles";

test("os controles: os dois primeiros em uso, os outros entram com 52 semanas e o GA4 é opcional", () => {
  const t = Array.from({ length: 41 }, (_, i) => ({ controles: { proximidade: (i % 9) / 9, feriado: i % 7 === 0 ? 1 : 0, lote: 0, preco: 0, cupom: 0, visitas: 0 } }));
  const p = html(createElement(ControlesDoModelo, { controles: controlesDaTela(t, { eventos: 3, sessoes: 12, lotes: 4, cupons: 6, datasProprias: 0 }, { conectado: false, semanas: 0 }) }));
  for (const x of ["O que o modelo leva em conta além dos anúncios", "Proximidade da sessão", "3 eventos, 12 sessões", "Feriados e datas de pico", "Adicionar uma data sua", "Preço e lotes", "Entra com 52 semanas · faltam 11", "Cupons", "Visitas ao site, sem anúncio (GA4)", "Opcional", "Conectar o GA4", "Em uso", "só os controles mais importantes", "só ganham peso se os seus dados mostrarem"]) assert.ok(p.includes(x), `falta: ${x}`);
  assert.equal(html(createElement(ControlesDoModelo, { controles: [] })), "", "sem controles não desenha nada");
});

test("a aba Modelo sem dado mostra os controles logo abaixo da checklist", () => {
  const t = Array.from({ length: 41 }, (_, i) => ({ ...semana(i, 10, i >= 29 ? { "meta-ads": 15000 } : {}), controles: { proximidade: (i % 9) / 9, feriado: i % 7 === 0 ? 1 : 0 } }));
  const controles = controlesDaTela(t, { eventos: 1, sessoes: 2, lotes: 1, cupons: 0, datasProprias: 1 }, { conectado: false, semanas: 0 });
  const p = html(createElement(ModeloDaLoja, { prontidao: avaliarProntidao({ ...base, tabela: t, controles }) }));
  assert.ok(p.includes("Mais 1 data sua."));
  assert.ok(p.indexOf("Gasto em divulgação: só 12 semanas") < p.indexOf("O que o modelo leva em conta além dos anúncios"));
});

test("o resultado mostra o que está dentro de “venderia de qualquer jeito”, com parte negativa e margem grande", () => {
  const partes = [
    { chave: "nivel" as const, porcento: 22, baixo: 18, alto: 26 }, { chave: "tendencia" as const, porcento: 9, baixo: 6, alto: 12 }, { chave: "proximidade" as const, porcento: 18, baixo: 14, alto: 22 },
    { chave: "preco_e_lotes" as const, porcento: -4, baixo: -9, alto: 1 },
  ];
  const r = resultado();
  const p = html(createElement(ResultadoDoModelo, { resultado: { ...r, execucao: { ...r.execucao, base: { ...r.execucao.base, partes } } } }));
  for (const x of ["O que está dentro de “venderia de qualquer jeito”: 41% das vendas", "Nível normal da loja", "Tendência e época do ano", "Proximidade da sessão", "18% <span", "Preço e lotes", "−4%", "margem grande"]) assert.ok(p.includes(x), `falta: ${x}`);
  assert.ok(!html(createElement(ResultadoDoModelo, { resultado: r })).includes("O que está dentro de"), "sem partes (resultado antigo) a quebra não aparece");
});

// ─── A previsão: onde investir e o simulador de orçamento ───────────────────

import { RecomendacaoDeInvestimento } from "../components/ticketeria/ModeloView";
import { SimularOrcamentoSheet } from "../components/ticketeria/SimularOrcamentoSheet";
import { FATOR_DA_CURVA } from "../lib/ticketeria/modelo-recomendacao";

const curvaDe = (beta: number, lam: number, testado: number) => Array.from({ length: 16 }, (_, i) => {
  const g = Math.round((i / 15) * FATOR_DA_CURVA * testado);
  return { gasto_centavos: g, ingressos: Math.round(beta * (1 - Math.exp((-lam * g) / testado)) * 100) / 100 };
});
const comCurva = [
  canal("meta-ads", 27, 16, 38, 780000, 2250, { saturacao_gasto_centavos: 18000, curva: curvaDe(40, 3, 30000) }),
  canal("google-ads", 9, 5, 14, 210000, 1820, { curva: curvaDe(20, 1, 15000) }),
  canal("instagram", 14, 5, 23, 0, null),
];
const gasto = { "meta-ads": 20000, "google-ads": 4000 };

test("onde investir: a frase com o canal que mais rende, a tabela, a barra de limite e o aviso de previsão", () => {
  const p = html(createElement(RecomendacaoDeInvestimento, { canais: comCurva, gastoSemanal: gasto }));
  for (const x of ["O modelo aponta o Google Ads como o canal em que o próximo real rende mais.", "Mais R$ 100 por semana no Google Ads trazem cerca de", "no Meta Ads, cerca de", "O Meta Ads já está perto do limite: acima de R$ 180,00 por semana", "Onde vale investir mais", "Ingressos por R$ 100 a mais", "Custo do ingresso extra", "R$ 200,00", "R$ 40,00", "perto do limite", "espaço para crescer", "Isto é uma previsão, não uma garantia"]) assert.ok(p.includes(x), `falta: ${x}`);
  assert.ok(!p.includes("Instagram"), "sem gasto e sem curva, o canal não entra");
  assert.ok(p.indexOf("Google Ads</td>") < p.indexOf("Meta Ads</td>"), "o que mais rende vem primeiro");
  assert.equal(html(createElement(RecomendacaoDeInvestimento, { canais: comCurva, gastoSemanal: {} })), "", "sem gasto por semana não há o que prever");
});

test("todos os canais perto do limite: a frase diz que gastar mais rende pouco", () => {
  const p = html(createElement(RecomendacaoDeInvestimento, { canais: [comCurva[0]], gastoSemanal: { "meta-ads": 20000 } }));
  assert.ok(p.includes("estão perto do limite") && p.includes("Gastar mais neles rende pouco"));
  assert.ok(!p.includes("aponta o"));
});

test("o resultado mostra a recomendação (confiança boa) só quando recebe o gasto por semana", () => {
  const com = html(createElement(ResultadoDoModelo, { resultado: resultado({ canais: comCurva }, 104, "boa"), gastoSemanal: gasto }));
  assert.ok(com.includes("Onde vale investir mais") && com.includes("Ingressos por R$ 100 a mais"));
  assert.ok(!html(createElement(ResultadoDoModelo, { resultado: resultado({ canais: comCurva }, 104, "boa") })).includes("Ingressos por R$ 100 a mais"));
});

test("simular orçamento: o gasto de hoje, a divisão sugerida, o que esperar e o que a frase diz de gastar mais ou menos", () => {
  const p = html(createElement(SimularOrcamentoSheet, { canais: comCurva, gastoSemanal: gasto, valorInicial: "300", onClose: () => {} }));
  for (const x of ["Simular orçamento", "Gasto por semana (todos os canais, em reais)", "Em geral você gasta R$ 240,00 por semana", "Hoje", "Dividindo como sugerido", "Meta Ads", "Google Ads", "Ingressos esperados por semana, pelos anúncios", "Custo por ingresso", "entre ", "Sobre os R$ 60,00 a mais por semana, o modelo espera", "É uma previsão, não uma garantia"]) assert.ok(p.includes(x), `falta: ${x}`);
  const menos = html(createElement(SimularOrcamentoSheet, { canais: comCurva, gastoSemanal: gasto, valorInicial: "100", onClose: () => {} }));
  assert.ok(menos.includes("Com R$ 140,00 a menos por semana, o modelo espera"));
  const alto = html(createElement(SimularOrcamentoSheet, { canais: comCurva, gastoSemanal: gasto, valorInicial: "400", onClose: () => {} }));
  assert.ok(alto.includes("passa do que você já testou") || alto.includes("passam do que você já testou") || alto.includes("a mais por semana"), "ou avisa da faixa, ou só diz o ganho");
  const ruim = html(createElement(SimularOrcamentoSheet, { canais: comCurva, gastoSemanal: gasto, valorInicial: "abc", onClose: () => {} }));
  assert.ok(ruim.includes("Digite um valor em reais") && !ruim.includes("Dividindo como sugerido"));
  assert.ok(html(createElement(SimularOrcamentoSheet, { canais: [comCurva[2]], gastoSemanal: {}, onClose: () => {} })).includes("Ainda não há canal com anúncio e curva para simular"));
});

test("a cautela: com menos de 104 semanas a tela não recomenda canal, só mostra a tabela como indício; com confiança boa recomenda", () => {
  const media = html(createElement(RecomendacaoDeInvestimento, { canais: comCurva, gastoSemanal: gasto, confianca: "media", semanas: 58 }));
  assert.ok(media.includes("Com 58 semanas ainda não dá para recomendar um canal com segurança.") && media.includes("A tabela abaixo é um indício"));
  assert.ok(!media.includes("rende mais no") && media.includes("Onde vale investir mais") && media.includes("Ingressos por R$ 100 a mais"), "a tabela continua");
  const boa = html(createElement(RecomendacaoDeInvestimento, { canais: comCurva, gastoSemanal: gasto, confianca: "boa", semanas: 104 }));
  assert.ok(boa.includes("O modelo aponta o Google Ads como o canal em que o próximo real rende mais.") && boa.includes("confirme com um pequeno experimento") && !boa.includes("ainda não dá para recomendar"));
});

test("a cautela no simulador: aviso de indício com pouco histórico e faixa com margem alargada", () => {
  const media = html(createElement(SimularOrcamentoSheet, { canais: comCurva, gastoSemanal: gasto, valorInicial: "300", confianca: "media", semanas: 58, onClose: () => {} }));
  assert.ok(media.includes("Com 58 semanas de dados, trate este resultado como indício") && media.includes("com margem alargada"));
  const boa = html(createElement(SimularOrcamentoSheet, { canais: comCurva, gastoSemanal: gasto, valorInicial: "300", confianca: "boa", semanas: 104, onClose: () => {} }));
  assert.ok(!boa.includes("trate este resultado como indício"));
});
