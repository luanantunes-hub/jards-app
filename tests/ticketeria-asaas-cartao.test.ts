import assert from "node:assert/strict";
import test from "node:test";
import { URL_DO_SANDBOX, ProvedorAsaas } from "../lib/ticketeria/pagamento/asaas";

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

test("parcelado: installmentCount e totalValue, com a comissão em totalFixedValue (sem prova no sandbox; o parcelamento está desligado na compra)", async () => {
  const { chamadas, provedor } = asaasFalso({ "POST /customers": { corpo: { id: "cus_1" } }, "POST /payments": { corpo: { id: "pay_1", invoiceUrl: "https://sandbox.asaas.com/i/abc" } } });
  await provedor.criarCobrancaCartao({ ...pedido, parcelas: 3 });
  const c = chamadas[1].corpo as Record<string, unknown>;
  assert.equal(c.installmentCount, 3);
  assert.equal(c.totalValue, 70);
  assert.equal(c.value, undefined);
  assert.deepEqual(c.split, [{ walletId: "carteira-do-jards", totalFixedValue: 1.75 }]);
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
