import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CANTOS_DE_GIZ, ESTILO_DE_GIZ, GRAO_DE_GIZ } from "../lib/giz";

const ler = (caminho: string) => readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("o grão de giz é um ruído fractal usado como máscara, com cantos levemente irregulares", () => {
  assert.match(GRAO_DE_GIZ, /feTurbulence type='fractalNoise'/);
  assert.match(GRAO_DE_GIZ, /0 0 0 3\.2 -0\.6/, "ganho e desvio do alfa do ruído");
  assert.equal(ESTILO_DE_GIZ.maskImage, GRAO_DE_GIZ);
  assert.equal(ESTILO_DE_GIZ.WebkitMaskImage, GRAO_DE_GIZ);
  assert.equal(CANTOS_DE_GIZ, "2px 3px 2px 3px");
});

test("só as barras de comparação usam o giz; a barra de progresso em blocos é lisa", () => {
  assert.match(ler("components/comparativo/BarrasDeValor.tsx"), /ESTILO_DE_GIZ/);
  assert.doesNotMatch(ler("components/ui/BarraEmBlocos.tsx"), /ESTILO_DE_GIZ|CANTOS_DE_GIZ/, "a barra de progresso é em blocos lisos, sem grão");
  assert.doesNotMatch(ler("components/ui/RelationshipScoreGauge.tsx"), /FiltroDeGiz|filter=/, "o medidor de meio círculo não leva giz");
});

test("a barra de progresso virou blocos: barra de captação, lista de Projetos e funil do painel", () => {
  assert.match(ler("components/ui/IndicadoresFinanceiros.tsx"), /<BarraEmBlocos/);
  assert.match(ler("app/(dashboard)/projetos/page.tsx"), /<BarraEmBlocos/);
  const painel = ler("app/(dashboard)/dashboard/page.tsx");
  assert.equal((painel.match(/<BarraEmBlocos/g) ?? []).length, 2, "as barras do funil e a de Aprovado");
  assert.doesNotMatch(painel, /h-\[0\.3125rem\] rounded-full/, "a barra contínua fina saiu do painel");
});

test("os medidores de arco usam o verde folha da identidade, e a lista de Empresas reaproveita a escala do medidor", () => {
  const medidor = ler("components/ui/RelationshipScoreGauge.tsx");
  assert.match(medidor, /export const SEGMENTS/);
  assert.match(medidor, /#3DA86A/);
  assert.doesNotMatch(medidor, /26,139,122|#1A8B7A/i);
  assert.match(ler("components/ui/SegmentedScoreArc.tsx"), /color = "#3DA86A"/);
  const lista = ler("app/(dashboard)/empresas-crm/page.tsx");
  assert.match(lista, /SEGMENTS as GAUGE_SEGMENTS_DO_DETALHE/);
  assert.doesNotMatch(lista, /rgba\(26,139,122/, "sem escala própria no verde antigo");
});

test("os dados de captação e o gráfico de Atividades estão no verde folha; o verde de salvar não mudou", () => {
  const marca = ler("components/ui/IndicadoresFinanceiros.tsx");
  assert.match(marca, /confirmado: "bg-\[#3DA86A\]"/);
  assert.match(marca, /negociacao: "bg-\[#3DA86A\]\/35"/);
  assert.match(ler("app/(dashboard)/atividades/page.tsx"), /const VERDE = "#3DA86A"/);
  assert.match(ler("DESIGN.md"), /\| Verde \| `#2E8932` \| salvar, confirmar e sucesso \|/);
});
