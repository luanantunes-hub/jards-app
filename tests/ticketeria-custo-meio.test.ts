import assert from "node:assert/strict";
import test from "node:test";
import { CUSTOS_PROVISORIOS_DO_ASAAS, custoDoMeio, mensagemDoErroDoMeio, parcelasOferecidas, liquidoDoProdutorPorMeio, regraDoMeio, valorDasParcelas, valoresDoPedido } from "../lib/ticketeria/pagamento/custo-meio";
import { taxaDoIngresso, totaisDoPedido } from "../lib/ticketeria/pagamento/taxa";
import { partidasDaDevolucao, partidasDoPagamento, equilibrada, saldos } from "../lib/ticketeria/pagamento/razao";

const pix = CUSTOS_PROVISORIOS_DO_ASAAS[0], aVista = CUSTOS_PROVISORIOS_DO_ASAAS[1], parcelado = CUSTOS_PROVISORIOS_DO_ASAAS[2];

// Os mesmos casos de supabase/tests/ticketeria_custo_meio.test.sql: o banco e o código fazem a mesma conta.
test("o custo do meio sobre o total pago: os mesmos casos do teste de banco", () => {
  assert.deepEqual([custoDoMeio(6150, pix), custoDoMeio(6150, aVista), custoDoMeio(6150, parcelado), custoDoMeio(100, pix), custoDoMeio(100, aVista), custoDoMeio(0, aVista)], [199, 233, 264, 199, 52, 49]);
  assert.equal(custoDoMeio(5000, aVista), 199, "2,99% de R$ 50 = R$ 1,495 sobe para R$ 1,50, mais R$ 0,49");
});

test("o custo arredonda para cima e o provedor nunca cobra mais do que o descontado (o Jards não perde um centavo)", () => {
  for (const regra of [pix, aVista, parcelado]) {
    for (const total of [1, 100, 5000, 6150, 12300, 99999]) {
      const exato = (total * regra.percentual_bps) / 10000 + regra.fixo_centavos;
      const custo = custoDoMeio(total, regra);
      assert.ok(custo >= exato - 1e-9 && custo < exato + 1, `${regra.meio} ${regra.parcelas_de}-${regra.parcelas_ate} sobre ${total}`);
    }
  }
});

test("o comprador paga só o preço; as taxas saem da parte do produtor (ingresso de R$ 50 no Pix: R$ 1,25 do Jards, R$ 1,99 do Asaas, R$ 46,76 do produtor)", () => {
  const regra = { percentual_bps: 250, fixo_centavos: 0, quem_paga: "produtor" as const };
  const cinquenta = totaisDoPedido([{ preco_centavos: 5000, quantidade: 1 }], regra);
  assert.deepEqual(cinquenta, { total_centavos: 5000, taxa_centavos: 125, produtor_centavos: 4875 });
  assert.deepEqual(valoresDoPedido(cinquenta, pix), { a_pagar_centavos: 5000, taxa_jards_centavos: 125, custo_meio_centavos: 199, produtor_recebe_centavos: 4676 });
  const sessenta = totaisDoPedido([{ preco_centavos: 6000, quantidade: 1 }], regra);
  assert.deepEqual(valoresDoPedido(sessenta, aVista), { a_pagar_centavos: 6000, taxa_jards_centavos: 150, custo_meio_centavos: 229, produtor_recebe_centavos: 5621 });
  assert.deepEqual(valoresDoPedido(sessenta, parcelado), { a_pagar_centavos: 6000, taxa_jards_centavos: 150, custo_meio_centavos: 259, produtor_recebe_centavos: 5591 });
});

test("o custo que come toda a parte do produtor (ingresso baratíssimo) deixa o meio indisponível", () => {
  const regra = { percentual_bps: 250, fixo_centavos: 0, quem_paga: "produtor" as const };
  assert.equal(valoresDoPedido(totaisDoPedido([{ preco_centavos: 200, quantidade: 1 }], regra), pix), null, "R$ 2,00 não paga o Pix de R$ 1,99 mais a taxa");
  assert.notEqual(valoresDoPedido(totaisDoPedido([{ preco_centavos: 300, quantidade: 1 }], regra), pix), null);
});

test("a tela do produtor: quanto ele recebe líquido por ingresso, no Pix e em cada parcelamento que a loja oferece", () => {
  const regra = { percentual_bps: 250, fixo_centavos: 0, quem_paga: "produtor" as const };
  const soAVista = liquidoDoProdutorPorMeio(5000, regra, CUSTOS_PROVISORIOS_DO_ASAAS, 1);
  assert.equal(soAVista.taxa_jards_centavos, 125);
  assert.deepEqual(soAVista.meios, [
    { meio: "pix", parcelas: null, custo_meio_centavos: 199, produtor_recebe_centavos: 4676 },
    { meio: "cartao", parcelas: 1, custo_meio_centavos: 199, produtor_recebe_centavos: 4676 },
  ]);
  const ate3 = liquidoDoProdutorPorMeio(5000, regra, CUSTOS_PROVISORIOS_DO_ASAAS, 3);
  assert.deepEqual(ate3.meios.map(m => [m.meio, m.parcelas]), [["pix", null], ["cartao", 1], ["cartao", 2], ["cartao", 3]]);
  assert.deepEqual(liquidoDoProdutorPorMeio(0, regra, CUSTOS_PROVISORIOS_DO_ASAAS, 6), { taxa_jards_centavos: 0, meios: [] }, "cortesia e gratuito: nada cobrado");
});

test("a taxa é de 2,5% por ingresso pago: dois ingressos pagam duas vezes, o centavo arredonda, e cortesia e gratuito não pagam", () => {
  const regra = { percentual_bps: 250, fixo_centavos: 0, quem_paga: "produtor" as const };
  assert.equal(taxaDoIngresso(6000, regra), 150);
  assert.equal(taxaDoIngresso(1990, regra), 50, "R$ 0,4975 sobe para R$ 0,50");
  assert.equal(totaisDoPedido([{ preco_centavos: 6000, quantidade: 2 }], regra).total_centavos, 12000, "o comprador paga só o preço");
  assert.equal(taxaDoIngresso(0, regra), 0);
  assert.deepEqual(totaisDoPedido([{ preco_centavos: 0, quantidade: 4 }], regra), { total_centavos: 0, taxa_centavos: 0, produtor_centavos: 0 });
});

test("o razão do pagamento: o provedor guarda o custo dele, e a soma segue zero", () => {
  const partidas = partidasDoPagamento({ total_centavos: 5000, produtor_centavos: 4875, taxa_centavos: 125, custo_meio_centavos: 199 });
  assert.deepEqual(saldos(partidas), { psp_a_receber: 4801, produtor: -4676, plataforma: -125 });
  assert.ok(equilibrada(partidas));
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
  assert.deepEqual(valorDasParcelas(6000, 3), { valor_centavos: 2000, ultima_centavos: 2000 });
  assert.deepEqual(valorDasParcelas(6001, 3), { valor_centavos: 2000, ultima_centavos: 2001 });
  assert.deepEqual(valorDasParcelas(6000, 1), { valor_centavos: 6000, ultima_centavos: 6000 });
});

test("os erros do banco ao escolher o meio viram frases", () => {
  assert.match(mensagemDoErroDoMeio({ message: "parcelas_indisponiveis" }), /parcelas/);
  assert.match(mensagemDoErroDoMeio({ message: "reserva_expirada" }), /reserva acabou/);
  assert.match(mensagemDoErroDoMeio({ message: "outra coisa" }), /Tente de novo/);
});

test("a devolução total: o comprador recebe o preço, o Jards devolve a comissão, e o custo do Pix que o Asaas não devolve fica com o produtor", () => {
  const pedido = { total_centavos: 5000, produtor_centavos: 4875, taxa_centavos: 125, custo_meio_centavos: 199 };
  const pagamento = partidasDoPagamento(pedido);
  const pix = partidasDaDevolucao(pedido, false);
  assert.deepEqual(pix, [{ conta: "psp_a_receber", valor_centavos: -5000 }, { conta: "produtor", valor_centavos: 4875 }, { conta: "plataforma", valor_centavos: 125 }]);
  assert.ok(equilibrada(pix));
  // Depois do pagamento e da devolução: o Jards em zero (a comissão de R$ 1,25 voltou e ele não cobre nada); o produtor deve os R$ 1,99 da taxa residual.
  assert.deepEqual(saldos([...pagamento, ...pix]), { psp_a_receber: -199, produtor: 199, plataforma: 0 });
});

test("a devolução total no cartão, quando o Asaas devolve a taxa de transação: ninguém perde", () => {
  const pedido = { total_centavos: 5000, produtor_centavos: 4875, taxa_centavos: 125, custo_meio_centavos: 199 };
  const cartao = partidasDaDevolucao(pedido, true);
  assert.deepEqual(cartao, [{ conta: "psp_a_receber", valor_centavos: -4801 }, { conta: "produtor", valor_centavos: 4676 }, { conta: "plataforma", valor_centavos: 125 }]);
  assert.ok(equilibrada(cartao));
  assert.deepEqual(saldos([...partidasDoPagamento(pedido), ...cartao]), { psp_a_receber: 0, produtor: 0, plataforma: 0 });
});

test("a devolução fecha em zero em qualquer valor, meio e resposta do Asaas; o Jards nunca cobre o custo; o pedido gratuito não tem devolução", () => {
  for (const total of [100, 5000, 6000, 12000, 99999]) {
    const taxa = taxaDoIngresso(total, { percentual_bps: 250, fixo_centavos: 0, quem_paga: "produtor" });
    for (const custo of [49, 199, 450]) {
      if (custo > total - taxa) continue;
      for (const devolveu of [false, true]) {
        const pedido = { total_centavos: total, produtor_centavos: total - taxa, taxa_centavos: taxa, custo_meio_centavos: custo };
        const soma = partidasDaDevolucao(pedido, devolveu).reduce((acc, p) => acc + p.valor_centavos, 0);
        assert.equal(soma, 0, `${total} ${custo} ${devolveu}`);
        const finais = saldos([...partidasDoPagamento(pedido), ...partidasDaDevolucao(pedido, devolveu)]);
        assert.equal(finais.plataforma, 0, "o Jards fica em zero: devolveu a comissão e não cobre custo nenhum");
        assert.equal(finais.produtor, devolveu ? 0 : custo, "o produtor arca só com o que o Asaas não devolveu");
      }
    }
  }
  assert.deepEqual(partidasDaDevolucao({ total_centavos: 0, produtor_centavos: 0, taxa_centavos: 0 }, false), []);
});
