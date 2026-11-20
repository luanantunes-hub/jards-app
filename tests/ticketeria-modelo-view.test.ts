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
