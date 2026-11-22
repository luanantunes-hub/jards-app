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
