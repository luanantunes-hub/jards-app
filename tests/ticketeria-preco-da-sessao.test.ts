import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarPrecosDaSessao, metadeDoPreco, precoDoLoteNaSessao } from "@/lib/ticketeria/preco-da-sessao";
import { faixasDoIngresso } from "@/lib/ticketeria/vitrine";

// O preço por sessão (plano, seção 11, P0): a conta tem de ser a mesma de fn_ticketeria_preco_do_lote, no banco.

const INTEIRA = { id: "lote-inteira", preco_centavos: 6000, espelho_de: null };
const MEIA = { id: "lote-meia", preco_centavos: 3000, espelho_de: "lote-inteira" };

test("sem preço próprio da sessão, vale o preço do lote (como sempre)", () => {
  const vazio = new Map<string, number>();
  assert.equal(precoDoLoteNaSessao(INTEIRA, vazio), 6000);
  assert.equal(precoDoLoteNaSessao(MEIA, vazio), 3000);
});

test("com preço próprio na inteira, a sessão cobra o dela; a meia vira a metade", () => {
  const precos = new Map([["lote-inteira", 8000]]);
  assert.equal(precoDoLoteNaSessao(INTEIRA, precos), 8000);
  assert.equal(precoDoLoteNaSessao(MEIA, precos), 4000);
});

test("a metade arredonda para cima no meio e nunca fica abaixo de 1 centavo", () => {
  assert.equal(metadeDoPreco(8001), 4001, "4000,5 sobe");
  assert.equal(metadeDoPreco(8000), 4000);
  assert.equal(metadeDoPreco(1), 1, "metade de 1 centavo não é zero");
  assert.equal(metadeDoPreco(2), 1);
});

test("outra sessão não é afetada: cada sessão tem o seu mapa de preços", () => {
  const sexta = new Map([["lote-inteira", 8000]]);
  const quarta = new Map<string, number>();
  assert.equal(precoDoLoteNaSessao(INTEIRA, sexta), 8000);
  assert.equal(precoDoLoteNaSessao(INTEIRA, quarta), 6000);
});

test("o preço de um lote não vaza para o de outro ingresso", () => {
  const outro = { id: "lote-outro", preco_centavos: 5000, espelho_de: null };
  assert.equal(precoDoLoteNaSessao(outro, new Map([["lote-inteira", 8000]])), 5000);
});

test("aplicar nos lotes troca só o preço e mantém o resto, e a vitrine mostra o preço da sessão", () => {
  const lotes = [{ ...INTEIRA, ordem: 0, quantidade: 100, vendas_inicio: null, vendas_fim: null, ocupados: 0 }];
  const aplicados = aplicarPrecosDaSessao(lotes, new Map([["lote-inteira", 7500]]));
  assert.equal(aplicados[0].preco_centavos, 7500);
  assert.equal(aplicados[0].quantidade, 100);
  assert.equal(lotes[0].preco_centavos, 6000, "não altera o que recebeu");
  assert.deepEqual(faixasDoIngresso(aplicados, Date.now()), [{ preco_centavos: 7500, livres: 100 }]);
});

// ─── Com o fator do preço dinâmico (P2) ─────────────────────────────────────

test("com fator, o preço da sessão (ou do lote) vale vezes o fator, e a meia é a metade do que vale da inteira", () => {
  const lotes = [{ ...INTEIRA, ordem: 0 }, { ...MEIA, ordem: 0 }];
  const sem = aplicarPrecosDaSessao(lotes, new Map(), 11000);
  assert.deepEqual(sem.map(l => l.preco_centavos), [6600, 3300], "fator 110% sobre o lote: R$ 66,00 e R$ 33,00");
  const com = aplicarPrecosDaSessao(lotes, new Map([["lote-inteira", 8000]]), 11000);
  assert.deepEqual(com.map(l => l.preco_centavos), [8800, 4400], "e sobre o preço próprio da sessão: R$ 88,00 e R$ 44,00");
});

test("fator 10000 é exatamente a conta de antes, e o gratuito segue em zero", () => {
  const precos = new Map([["lote-inteira", 8001]]);
  assert.equal(precoDoLoteNaSessao(INTEIRA, precos, 10000), 8001);
  assert.equal(precoDoLoteNaSessao(MEIA, precos, 10000), 4001, "metade de R$ 80,01 sobe para R$ 40,01");
  assert.equal(precoDoLoteNaSessao({ id: "g", preco_centavos: 0, espelho_de: null }, new Map(), 12000), 0);
});

test("a meia com fator usa a inteira da lista e arredonda como o banco (para cima no meio, mínimo 1 centavo)", () => {
  const inteira = { id: "i", preco_centavos: 6001, espelho_de: null };
  const meia = { id: "m", preco_centavos: 3001, espelho_de: "i" };
  const [i, m] = aplicarPrecosDaSessao([inteira, meia], new Map(), 11000);
  assert.equal(i.preco_centavos, 6601, "6001 × 1,1 = 6601,1");
  assert.equal(m.preco_centavos, 3301, "metade de 6601 = 3300,5 sobe para 3301");
  assert.equal(aplicarPrecosDaSessao([{ id: "x", preco_centavos: 1, espelho_de: null }], new Map(), 1000)[0].preco_centavos, 1, "nunca abaixo de 1 centavo");
});

test("fator por lote: cada setor da sessão tem o seu, e a meia segue o fator da inteira que ela espelha", () => {
  const vip = { id: "vip", preco_centavos: 10000, espelho_de: null };
  const vipMeia = { id: "vip-meia", preco_centavos: 5000, espelho_de: "vip" };
  const anel = { id: "anel", preco_centavos: 3000, espelho_de: null };
  const fatores = new Map([["vip", 12000], ["vip-meia", 12000], ["anel", 9000]]);
  const [a, b, c] = aplicarPrecosDaSessao([vip, vipMeia, anel], new Map(), l => fatores.get(l.id) ?? 10000);
  assert.deepEqual([a.preco_centavos, b.preco_centavos, c.preco_centavos], [12000, 6000, 2700]);
});
