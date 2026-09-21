import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cotaTemDisponibilidade, formatCotaValor, valorForaDaFaixa } from "../lib/cotas";

const root = new URL("../", import.meta.url);

test("cota fixa ou com faixa exibe referência sem substituir o valor negociado", () => {
  assert.equal(formatCotaValor({ valor: 200000, valor_maximo: null }), "R$ 200.000,00");
  assert.equal(formatCotaValor({ valor: 200000, valor_maximo: 500000 }), "R$ 200.000,00 a R$ 500.000,00");
});

test("cota ilimitada permanece disponível após vendas; limitada respeita o teto", () => {
  assert.equal(cotaTemDisponibilidade({ unidades: 1, unidades_vendidas: 2, unidades_ilimitadas: true }), true);
  assert.equal(cotaTemDisponibilidade({ unidades: 2, unidades_vendidas: 2, unidades_ilimitadas: false }), false);
  assert.equal(cotaTemDisponibilidade({ unidades: 2, unidades_vendidas: 1, unidades_ilimitadas: false }), true);
});

test("faixa alerta fora dos limites sem bloquear negociações; valor fixo é adaptável", () => {
  assert.equal(valorForaDaFaixa({ valor: 200000, valor_maximo: 500000 }, 550000), true);
  assert.equal(valorForaDaFaixa({ valor: 200000, valor_maximo: 500000 }, 300000), false);
  assert.equal(valorForaDaFaixa({ valor: 200000, valor_maximo: null }, 550000), false);
});

test("aceite e inscrição persistem o preço negociado e ignoram teto apenas para ilimitadas", async () => {
  const migration = await readFile(new URL("supabase/migrations/20260920000004_cotas_faixa_produto_ilimitadas.sql", root), "utf8");
  assert.match(migration, /if not v_cota\.unidades_ilimitadas and coalesce\(v_cota\.unidades_vendidas/);
  assert.match(migration, /valor_vendido = new\.valor/);
  assert.match(migration, /new\.empresa_pub_id, 1, new\.valor/);
  assert.match(migration, /new\.valor := coalesce\(new\.valor, v_cota\.valor\)/);
});
