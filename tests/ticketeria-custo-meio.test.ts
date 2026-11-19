import assert from "node:assert/strict";
import test from "node:test";
import { CUSTOS_PROVISORIOS_DO_ASAAS, custoDoMeio, mensagemDoErroDoMeio, parcelasOferecidas, regraDoMeio, valorDasParcelas, valoresParaPagar } from "../lib/ticketeria/pagamento/custo-meio";
import { taxaDoIngresso, totaisDoPedido } from "../lib/ticketeria/pagamento/taxa";

const pix = CUSTOS_PROVISORIOS_DO_ASAAS[0], aVista = CUSTOS_PROVISORIOS_DO_ASAAS[1], parcelado = CUSTOS_PROVISORIOS_DO_ASAAS[2];

// Os mesmos casos de supabase/tests/ticketeria_custo_meio.test.sql ("o custo por dentro"): o banco e o código fazem a mesma conta.
test("o custo do meio por dentro: os mesmos casos do teste de banco", () => {
  assert.deepEqual([custoDoMeio(6150, pix), custoDoMeio(6150, aVista), custoDoMeio(6150, parcelado), custoDoMeio(100, pix), custoDoMeio(100, aVista), custoDoMeio(0, aVista)], [199, 241, 274, 199, 54, 51]);
});

test("o produtor recebe o preço cheio: descontado o custo do cartão, sobra pelo menos o líquido", () => {
  for (const regra of [pix, aVista, parcelado]) {
    for (const liquido of [1, 100, 6150, 12300, 99999]) {
      const totalPago = liquido + custoDoMeio(liquido, regra);
      const custoReal = (totalPago * regra.percentual_bps) / 10000 + regra.fixo_centavos; // o que o provedor desconta do total pago
      assert.ok(totalPago - custoReal >= liquido - 1e-9, `${regra.meio} ${regra.parcelas_de}-${regra.parcelas_ate} sobre ${liquido}`);
      assert.ok(totalPago - custoReal < liquido + 1, "e não sobra muito mais que isso (no máximo um centavo)");
    }
  }
});

test("a tela mostra os três valores separados: o preço, a taxa de 2,5% do Jards e o custo do meio", () => {
  // Um ingresso de R$ 60 com a taxa de 2,5%, paga pelo comprador (R$ 1,50), e o exemplo de R$ 50 no Pix (R$ 53,24).
  const regra = { percentual_bps: 250, fixo_centavos: 0, quem_paga: "comprador" as const };
  const totais = totaisDoPedido([{ preco_centavos: 6000, quantidade: 1 }], regra);
  assert.deepEqual(totais, { total_centavos: 6150, taxa_centavos: 150, produtor_centavos: 6000 });
  assert.deepEqual(valoresParaPagar(totais, pix), { preco_centavos: 6000, taxa_jards_centavos: 150, custo_meio_centavos: 199, a_pagar_centavos: 6349 });
  assert.deepEqual(valoresParaPagar(totais, aVista), { preco_centavos: 6000, taxa_jards_centavos: 150, custo_meio_centavos: 241, a_pagar_centavos: 6391 });
  assert.deepEqual(valoresParaPagar(totais, parcelado), { preco_centavos: 6000, taxa_jards_centavos: 150, custo_meio_centavos: 274, a_pagar_centavos: 6424 });
  const cinquenta = totaisDoPedido([{ preco_centavos: 5000, quantidade: 1 }], regra);
  assert.deepEqual(valoresParaPagar(cinquenta, pix), { preco_centavos: 5000, taxa_jards_centavos: 125, custo_meio_centavos: 199, a_pagar_centavos: 5324 }, "R$ 50,00 + R$ 1,25 + R$ 1,99 = R$ 53,24");
});

test("a taxa é de 2,5% por ingresso pago: dois ingressos pagam duas vezes, o centavo arredonda, e cortesia e gratuito não pagam", () => {
  const regra = { percentual_bps: 250, fixo_centavos: 0, quem_paga: "comprador" as const };
  assert.equal(taxaDoIngresso(6000, regra), 150);
  assert.equal(taxaDoIngresso(1990, regra), 50, "R$ 0,4975 sobe para R$ 0,50");
  assert.equal(totaisDoPedido([{ preco_centavos: 6000, quantidade: 2 }], regra).total_centavos, 12300);
  assert.equal(taxaDoIngresso(0, regra), 0);
  assert.deepEqual(totaisDoPedido([{ preco_centavos: 0, quantidade: 4 }], regra), { total_centavos: 0, taxa_centavos: 0, produtor_centavos: 0 });
});

test("a regra do meio por parcelas, e as parcelas que a loja oferece (o produtor escolhe)", () => {
  assert.equal(regraDoMeio(CUSTOS_PROVISORIOS_DO_ASAAS, "pix", null), pix);
  assert.equal(regraDoMeio(CUSTOS_PROVISORIOS_DO_ASAAS, "cartao", null), aVista);
  assert.equal(regraDoMeio(CUSTOS_PROVISORIOS_DO_ASAAS, "cartao", 4), parcelado);
  assert.equal(regraDoMeio(CUSTOS_PROVISORIOS_DO_ASAAS, "cartao", 7), null, "sem custo cadastrado, a parcela não existe");
  assert.deepEqual(parcelasOferecidas(CUSTOS_PROVISORIOS_DO_ASAAS, 1), [1], "a loja que não liga o parcelamento só tem à vista");
  assert.deepEqual(parcelasOferecidas(CUSTOS_PROVISORIOS_DO_ASAAS, 3), [1, 2, 3]);
  assert.deepEqual(parcelasOferecidas(CUSTOS_PROVISORIOS_DO_ASAAS, 6), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(parcelasOferecidas(CUSTOS_PROVISORIOS_DO_ASAAS, 12), [1, 2, 3, 4, 5, 6], "até onde há custo cadastrado");
});

test("o valor de cada parcela: a última leva o resto dos centavos", () => {
  assert.deepEqual(valorDasParcelas(6408, 3), { valor_centavos: 2136, ultima_centavos: 2136 });
  assert.deepEqual(valorDasParcelas(6409, 3), { valor_centavos: 2136, ultima_centavos: 2137 });
  assert.deepEqual(valorDasParcelas(6375, 1), { valor_centavos: 6375, ultima_centavos: 6375 });
});

test("os erros do banco ao escolher o meio viram frases", () => {
  assert.match(mensagemDoErroDoMeio({ message: "parcelas_indisponiveis" }), /parcelas/);
  assert.match(mensagemDoErroDoMeio({ message: "reserva_expirada" }), /reserva acabou/);
  assert.match(mensagemDoErroDoMeio({ message: "outra coisa" }), /Tente de novo/);
});
