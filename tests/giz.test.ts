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

test("o filtro SVG usa o mesmo ruído e o mesmo ganho do grão HTML", () => {
  const filtro = ler("components/ui/FiltroDeGiz.tsx");
  assert.match(filtro, /baseFrequency="0\.8"/);
  assert.match(filtro, /0 0 0 3\.2 -0\.6/);
  assert.match(filtro, /operator="in"/);
});

test("barras de comparação, barra de captação, funil do painel e medidor de meio círculo usam o giz", () => {
  assert.match(ler("components/comparativo/BarrasDeValor.tsx"), /ESTILO_DE_GIZ/);
  assert.match(ler("components/ui/IndicadoresFinanceiros.tsx"), /ESTILO_DE_GIZ/);
  const painel = ler("app/(dashboard)/dashboard/page.tsx");
  assert.equal((painel.match(/ESTILO_DE_GIZ/g) ?? []).length, 3, "import + as duas barras do funil");
  const medidor = ler("components/ui/RelationshipScoreGauge.tsx");
  assert.match(medidor, /<FiltroDeGiz id=\{filtroDeGiz\}/);
  assert.match(medidor, /<g filter=\{`url\(#\$\{filtroDeGiz\}\)`\}>/);
});
