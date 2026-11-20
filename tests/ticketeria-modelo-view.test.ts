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
  execucao: { id: "e1", created_at: "2026-11-17T09:00:00Z", semanas, confianca, motor: "pymc-marketing", versao_motor: "1.5.0", r_hat_maximo: 1.01, divergencias: 0, ess_minimo: 700, base: { porcento: 41, baixo: 33, alto: 49 } },
  comparacao: compararComOsLinks(canais, { instagram: 22, email: 13, "anuncio-pago": 27, "sem-origem": 38 }), canais, ultimaFalha: null, ...extra,
});

test("o resultado do modelo: confiança, tabela com o modelo ao lado dos links, avisos de margem e de gasto constante", () => {
  const h = html(createElement(ResultadoDoModelo, { resultado: resultado() }));
  for (const t of ["Confiança média.", "58 semanas de histórico (o ideal são 104)", "58 de 104 semanas", "Venderia de qualquer jeito", "41%", "±8", "Meta Ads", "R$ 7.800,00", "27%", "±11", "Google Ads", "margem grande", "gasto quase constante", "Instagram", "22%", "E-mail", "13%", "R$ 22,50", "R$ 18,20",
    "Anúncios pagos (Meta e Google juntos", "modelo 36% · links 27%", "Meta Ads: acima de R$ 300,00 por semana, cada real a mais rende pouco.", "costuma ser otimista", "desconfie do modelo"]) assert.ok(h.includes(t), `falta: ${t}`);
  assert.ok(!h.includes("Google Ads: acima de"), "sem ponto de saturação, sem frase");
  assert.ok(!h.includes("não deu"));
});

test("o resultado: a rodada que falhou aparece sem esconder a anterior; diagnóstico ruim avisa; sem links nada quebra", () => {
  const falha = html(createElement(ResultadoDoModelo, { resultado: resultado({ ultimaFalha: { motivo: "Só há 20 semanas.", created_at: "2026-11-24T09:00:00Z" } }) }));
  assert.ok(falha.includes("não deu: Só há 20 semanas. Esta tela mostra a anterior."));
  const ruim = resultado({}, 80, "baixa");
  ruim.execucao.r_hat_maximo = 1.2;
  assert.ok(html(createElement(ResultadoDoModelo, { resultado: ruim })).includes("ainda não se firmou direito"));
  assert.ok(html(createElement(ResultadoDoModelo, { resultado: resultado({}, 110, "boa") })).includes("Confiança boa."));
  const semLinks = resultado({ comparacao: compararComOsLinks(canais, {}) });
  const h = html(createElement(ResultadoDoModelo, { resultado: semLinks }));
  assert.ok(h.includes("modelo 36%.") && !h.includes("links 27%"));
});
