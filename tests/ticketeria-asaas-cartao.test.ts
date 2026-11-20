import assert from "node:assert/strict";
import test from "node:test";
import { URL_DO_SANDBOX, ProvedorAsaas, ehParcelamentoDoAsaas } from "../lib/ticketeria/pagamento/asaas";

// A cobrança no cartão do Asaas, provada com respostas falsas: a pessoa paga na página segura (invoiceUrl); nenhum dado de cartão passa pelo Jards.

function asaasFalso(respostas: Record<string, { status?: number; corpo?: unknown }>) {
  const chamadas: { metodo: string; caminho: string; chave: string; corpo: Record<string, unknown> | undefined }[] = [];
  const http = (async (url: string | URL | Request, init?: RequestInit) => {
    const caminho = String(url).replace(URL_DO_SANDBOX, "");
    const metodo = init?.method ?? "GET";
    chamadas.push({ metodo, caminho, chave: (init?.headers as Record<string, string>).access_token, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = respostas[`${metodo} ${caminho}`];
    if (!r) return new Response(JSON.stringify({ errors: [{ code: "nao_simulado" }] }), { status: 404 });
    return new Response(JSON.stringify(r.corpo ?? {}), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { chamadas, provedor: new ProvedorAsaas({ chave: "chave-da-subconta-0123456789", tokenDoWebhook: "x".repeat(32), fetch: http }) };
}

const pedido = { id: "0d760000-0000-4000-8000-0000000000e1", codigo: "ABCD2345", total_centavos: 7000, expira_em: "2026-11-19T15:15:00.000Z", comprador_nome: "Rita Teste", comprador_email: "rita@exemplo.com", comprador_documento: "52998224725", split: [{ carteira: "carteira-do-jards", valor_centavos: 175 }] };

test("cartão à vista: cobrança CREDIT_CARD com o valor e a comissão em fixedValue; devolve a página segura", async () => {
  const { chamadas, provedor } = asaasFalso({ "POST /customers": { corpo: { id: "cus_1" } }, "POST /payments": { corpo: { id: "pay_1", invoiceUrl: "https://sandbox.asaas.com/i/abc" } } });
  const r = await provedor.criarCobrancaCartao({ ...pedido, parcelas: 1 });
  assert.deepEqual(r, { ref: "pay_1", url: "https://sandbox.asaas.com/i/abc", expira_em: "2026-11-19T15:15:00.000Z" });
  const c = chamadas[1].corpo as Record<string, unknown>;
  assert.equal(c.billingType, "CREDIT_CARD");
  assert.equal(c.value, 70);
  assert.equal(c.installmentCount, undefined);
  assert.deepEqual(c.split, [{ walletId: "carteira-do-jards", fixedValue: 1.75 }]);
  assert.equal(c.externalReference, pedido.id, "o aviso traz o pedido de volta");
  assert.equal(chamadas[1].chave, "chave-da-subconta-0123456789", "nasce na subconta");
  assert.equal(JSON.stringify(chamadas).match(/cardNumber|ccv|expiryMonth|creditCard/i), null, "nenhum campo de cartão é enviado");
});

test("o CPF ou CNPJ vai só ao cliente do Asaas (e é exigido)", async () => {
  const { chamadas, provedor } = asaasFalso({ "POST /customers": { corpo: { id: "cus_1" } }, "POST /payments": { corpo: { id: "pay_1", invoiceUrl: "https://sandbox.asaas.com/i/abc" } } });
  await provedor.criarCobrancaCartao({ ...pedido, parcelas: 1 });
  assert.equal(chamadas[0].corpo?.cpfCnpj, "52998224725");
  assert.equal(JSON.stringify(chamadas[1]).includes("52998224725"), false);
  await assert.rejects(provedor.criarCobrancaCartao({ ...pedido, comprador_documento: null, parcelas: 1 }), /CPF ou o CNPJ/);
});

const PARCELAMENTO = "34d6e600-a882-4adc-9d1f-99c73a426156";
const PEDIDO_DO_AVISO = "0d760000-0000-4000-8000-0000000000e1";

test("parcelado: installmentCount e totalValue, com a comissão em totalFixedValue; o ref devolvido é o do parcelamento (provado no sandbox em 20/11/2026)", async () => {
  const { chamadas, provedor } = asaasFalso({ "POST /customers": { corpo: { id: "cus_1" } }, "POST /payments": { corpo: { id: "pay_1", installment: PARCELAMENTO, invoiceUrl: "https://sandbox.asaas.com/i/abc" } } });
  const r = await provedor.criarCobrancaCartao({ ...pedido, parcelas: 3 });
  assert.equal(r.ref, PARCELAMENTO, "o pedido é estornado inteiro pelo parcelamento, e não pela primeira parcela");
  const c = chamadas[1].corpo as Record<string, unknown>;
  assert.equal(c.installmentCount, 3);
  assert.equal(c.totalValue, 70);
  assert.equal(c.value, undefined);
  assert.deepEqual(c.split, [{ walletId: "carteira-do-jards", totalFixedValue: 1.75 }]);
  // O Asaas que não devolve o parcelamento: cai no id da cobrança, como antes.
  const sem = asaasFalso({ "POST /customers": { corpo: { id: "cus_1" } }, "POST /payments": { corpo: { id: "pay_1", invoiceUrl: "https://sandbox.asaas.com/i/abc" } } });
  assert.equal((await sem.provedor.criarCobrancaCartao({ ...pedido, parcelas: 3 })).ref, "pay_1");
});

test("o aviso de uma parcela traz o parcelamento: o ref do pedido passa a ser o dele", () => {
  const { provedor } = asaasFalso({});
  const aviso = (evento: string, pagamento: Record<string, unknown> = {}) => JSON.stringify({ id: "evt_p1", event: evento, payment: { object: "payment", id: "pay_1", value: 23.33, netValue: 22.5, externalReference: PEDIDO_DO_AVISO, installment: PARCELAMENTO, ...pagamento } });
  const token = "x".repeat(32);
  assert.deepEqual(provedor.lerAviso(aviso("PAYMENT_CONFIRMED"), token), { ok: true, aviso: { id_externo: "evt_p1", tipo: "pagamento_confirmado", pedido_id: PEDIDO_DO_AVISO, ref: PARCELAMENTO, valor_centavos: 2333, liquido_centavos: 2250, parcelamento_id: PARCELAMENTO } });
  const estorno = provedor.lerAviso(aviso("PAYMENT_REFUNDED"), token);
  assert.ok(estorno.ok && estorno.aviso.parcelamento_id === undefined && estorno.aviso.ref === "pay_1", "só o pagamento confirmado carrega o parcelamento");
  const lixo = provedor.lerAviso(aviso("PAYMENT_CONFIRMED", { installment: "nao-e-uuid" }), token);
  assert.ok(lixo.ok && lixo.aviso.parcelamento_id === undefined && lixo.aviso.ref === "pay_1", "um installment que não é um id válido é ignorado");
});

test("ler o parcelamento: o total e o líquido de todas as parcelas; 404 vira nulo; erro do servidor sobe", async () => {
  const { chamadas, provedor } = asaasFalso({ [`GET /installments/${PARCELAMENTO}`]: { corpo: { id: PARCELAMENTO, value: 100, netValue: 97.05, installmentCount: 3 } } });
  assert.deepEqual(await provedor.consultarParcelamento(PARCELAMENTO), { valor_centavos: 10000, liquido_centavos: 9705, parcelas: 3 });
  assert.equal(chamadas[0].chave, "chave-da-subconta-0123456789");
  assert.equal(await provedor.consultarParcelamento("nao-e-uuid"), null);
  assert.equal(chamadas.length, 1, "um id inválido nem chega ao Asaas");
  const outro = "2b94ec03-c9f3-45d0-acfd-20769bebc08d";
  assert.equal(await provedor.consultarParcelamento(outro), null, "o Asaas não acha (404)");
  const semLiquido = asaasFalso({ [`GET /installments/${PARCELAMENTO}`]: { corpo: { value: 100, installmentCount: 3 } } });
  assert.deepEqual(await semLiquido.provedor.consultarParcelamento(PARCELAMENTO), { valor_centavos: 10000, liquido_centavos: null, parcelas: 3 }, "sem netValue: vale a estimativa");
  const quebrado = asaasFalso({ [`GET /installments/${PARCELAMENTO}`]: { status: 500, corpo: {} } });
  await assert.rejects(quebrado.provedor.consultarParcelamento(PARCELAMENTO));
  const estranho = asaasFalso({ [`GET /installments/${PARCELAMENTO}`]: { corpo: { value: "100", installmentCount: 3 } } });
  assert.equal(await estranho.provedor.consultarParcelamento(PARCELAMENTO), null);
});

test("estornar o parcelamento: POST /installments/{id}/refund, 4xx vira recusa com o motivo, 5xx sobe", async () => {
  const bom = asaasFalso({ [`POST /installments/${PARCELAMENTO}/refund`]: { corpo: { id: PARCELAMENTO } } });
  assert.deepEqual(await bom.provedor.estornarParcelamento(PARCELAMENTO), { ok: true });
  assert.equal(bom.chamadas[0].chave, "chave-da-subconta-0123456789");
  const recusa = asaasFalso({ [`POST /installments/${PARCELAMENTO}/refund`]: { status: 400, corpo: { errors: [{ code: "invalid_action" }] } } });
  assert.deepEqual(await recusa.provedor.estornarParcelamento(PARCELAMENTO), { ok: false, motivo: "invalid_action" });
  const queda = asaasFalso({ [`POST /installments/${PARCELAMENTO}/refund`]: { status: 503, corpo: {} } });
  await assert.rejects(queda.provedor.estornarParcelamento(PARCELAMENTO));
  assert.deepEqual(await bom.provedor.estornarParcelamento("pay_1"), { ok: false, motivo: "parcelamento_invalido" }, "um id de cobrança única não é de parcelamento");
  assert.equal(ehParcelamentoDoAsaas(PARCELAMENTO), true);
  assert.equal(ehParcelamentoDoAsaas("pay_0_w3r3bywa1odgen"), false);
});

test("sem a página de pagamento na resposta (ou fora de https), não há cobrança utilizável: erro", async () => {
  for (const corpo of [{ id: "pay_1" }, { id: "pay_1", invoiceUrl: "http://inseguro.exemplo/i/abc" }, { id: "pay_1", invoiceUrl: "javascript:alert(1)" }]) {
    const { provedor } = asaasFalso({ "POST /customers": { corpo: { id: "cus_1" } }, "POST /payments": { corpo } });
    await assert.rejects(provedor.criarCobrancaCartao({ ...pedido, parcelas: 1 }), /página de pagamento/);
  }
});

test("o Asaas recusa (400): sobe o erro com os códigos, sem a chave", async () => {
  const { provedor } = asaasFalso({ "POST /customers": { corpo: { id: "cus_1" } }, "POST /payments": { status: 400, corpo: { errors: [{ code: "invalid_object" }] } } });
  await assert.rejects(provedor.criarCobrancaCartao({ ...pedido, parcelas: 1 }), (e: unknown) => e instanceof Error && /invalid_object/.test(e.message) && !/chave-da-subconta/.test(e.message));
});
