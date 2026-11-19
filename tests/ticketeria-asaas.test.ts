import assert from "node:assert/strict";
import test from "node:test";
import { ErroDoAsaas, ProvedorAsaas, URL_DO_SANDBOX, provedorAsaas } from "../lib/ticketeria/pagamento/asaas";
import { processarAviso, type PortasDosAvisos } from "../lib/ticketeria/pagamento/avisos";

// O adaptador do Asaas, provado só com respostas falsas (nenhuma chamada de verdade). Os campos seguem a documentação pública da API v3.

const CHAVE = "chave-falsa-do-asaas-0123456789";
const TOKEN = "token-do-webhook-0123456789-abcdefghij";
const PEDIDO = "0d740000-0000-4000-8000-000000000001";

type Chamada = { metodo: string; url: string; cabecalhos: Record<string, string>; corpo: unknown };
type Resposta = { status?: number; corpo?: unknown };

function asaasFalso(respostas: Record<string, Resposta | Resposta[]>) {
  const chamadas: Chamada[] = [];
  const http = (async (url: string | URL | Request, init?: RequestInit) => {
    const caminho = String(url).replace(URL_DO_SANDBOX, "");
    const metodo = init?.method ?? "GET";
    chamadas.push({ metodo, url: String(url), cabecalhos: Object.fromEntries(Object.entries(init?.headers ?? {})), corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const chave = `${metodo} ${caminho}`;
    const r = respostas[chave];
    const resposta = Array.isArray(r) ? r.shift() : r;
    if (!resposta) return new Response(JSON.stringify({ errors: [{ code: "nao_simulado", description: chave }] }), { status: 404 });
    return new Response(JSON.stringify(resposta.corpo ?? {}), { status: resposta.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { http, chamadas };
}

const pedido = { id: PEDIDO, codigo: "ABCD2345", total_centavos: 10600, expira_em: "2026-12-01T13:15:00Z", comprador_nome: "Rita Teste", comprador_email: "rita@teste.invalid", comprador_documento: "529.982.247-25" };
const criar = (http: typeof fetch) => new ProvedorAsaas({ chave: CHAVE, tokenDoWebhook: TOKEN, fetch: http });

test("a cobrança Pix: cria o cliente, a cobrança e busca o copia e cola, com a chave no cabeçalho e o valor em reais", async () => {
  const { http, chamadas } = asaasFalso({
    "POST /customers": { corpo: { id: "cus_1" } },
    "POST /payments": { corpo: { id: "pay_1", invoiceUrl: "https://sandbox.asaas.com/i/pay_1" } },
    "GET /payments/pay_1/pixQrCode": { corpo: { payload: "00020126PIXCOPIAECOLA", encodedImage: "xxx", expirationDate: "2026-12-01 23:59:59" } },
  });
  const cobranca = await criar(http).criarCobranca({ ...pedido, split: [{ carteira: "wallet-do-jards", valor_centavos: 600 }] });
  assert.deepEqual(cobranca, { ref: "pay_1", pix_copia_e_cola: "00020126PIXCOPIAECOLA", url: "https://sandbox.asaas.com/i/pay_1", expira_em: pedido.expira_em });
  assert.deepEqual(chamadas.map(c => `${c.metodo} ${c.url.replace(URL_DO_SANDBOX, "")}`), ["POST /customers", "POST /payments", "GET /payments/pay_1/pixQrCode"]);
  for (const chamada of chamadas) assert.equal(chamada.cabecalhos.access_token, CHAVE, "a chave vai no cabeçalho access_token");
  assert.deepEqual(chamadas[0].corpo, { name: "Rita Teste", cpfCnpj: "52998224725", email: "rita@teste.invalid", externalReference: PEDIDO, notificationDisabled: true });
  assert.deepEqual(chamadas[1].corpo, {
    customer: "cus_1", billingType: "PIX", value: 106, dueDate: "2026-12-01", externalReference: PEDIDO, description: "Ingressos, pedido ABCD2345",
    split: [{ walletId: "wallet-do-jards", fixedValue: 6 }],
  });
  assert.equal(chamadas[2].corpo, undefined, "o GET não leva corpo (a API responde 403)");
});

test("sem o CPF ou CNPJ de quem paga, a cobrança não nasce (o Asaas o exige) e nada é chamado", async () => {
  const { http, chamadas } = asaasFalso({});
  for (const documento of [undefined, null, "", "123", "529.982.247-2"]) {
    await assert.rejects(criar(http).criarCobranca({ ...pedido, comprador_documento: documento }), /CPF ou o CNPJ/);
  }
  assert.equal(chamadas.length, 0);
  const { http: http2 } = asaasFalso({ "POST /customers": { corpo: { id: "c" } }, "POST /payments": { corpo: { id: "p" } }, "GET /payments/p/pixQrCode": { corpo: { payload: "x" } } });
  assert.ok((await criar(http2).criarCobranca({ ...pedido, comprador_documento: "11.222.333/0001-81" })).ref, "CNPJ de 14 dígitos vale");
});

test("o erro do Asaas vira ErroDoAsaas com o status e o código, sem a chave", async () => {
  const { http } = asaasFalso({ "POST /customers": { status: 400, corpo: { errors: [{ code: "invalid_cpfCnpj", description: "CPF inválido" }] } } });
  await assert.rejects(criar(http).criarCobranca(pedido), (erro: unknown) => {
    assert.ok(erro instanceof ErroDoAsaas);
    assert.equal(erro.status, 400);
    assert.deepEqual(erro.codigos, ["invalid_cpfCnpj"]);
    assert.ok(!erro.message.includes(CHAVE));
    return true;
  });
});

test("estorno e cancelamento: ok, recusa do Asaas (sem saldo) e falha de verdade", async () => {
  const { http, chamadas } = asaasFalso({
    "POST /payments/pay_1/refund": [{ corpo: { id: "pay_1" } }, { status: 400, corpo: { errors: [{ code: "insufficient_balance" }] } }, { status: 500, corpo: {} }],
    "DELETE /payments/pay_2": [{ corpo: { deleted: true } }, { status: 404, corpo: {} }],
  });
  const asaas = criar(http);
  assert.deepEqual(await asaas.estornar("pay_1", 10600), { ok: true });
  assert.deepEqual(chamadas[0].corpo, { value: 106, description: "Estorno do pedido" });
  assert.deepEqual(await asaas.estornar("pay_1", 10600), { ok: false, motivo: "insufficient_balance" }, "sem saldo: o Asaas recusa e o núcleo fica sabendo");
  await assert.rejects(asaas.estornar("pay_1", 10600), ErroDoAsaas, "erro do servidor não é recusa: sobe, para tentar de novo");
  assert.deepEqual(await asaas.cancelarCobranca("pay_2"), { ok: true });
  assert.deepEqual(await asaas.cancelarCobranca("pay_2"), { ok: false });
});

function aviso(evento: string, extra: Record<string, unknown> = {}, pagamento: Record<string, unknown> = {}) {
  return JSON.stringify({ id: "evt_1", event: evento, dateCreated: "2026-12-01 10:00:00", payment: { object: "payment", id: "pay_1", value: 106, netValue: 104.01, externalReference: PEDIDO, status: "RECEIVED", ...pagamento }, ...extra });
}

test("o aviso do Asaas: pagamento, estorno e chargeback viram avisos do núcleo, com o valor em centavos", () => {
  const asaas = criar(asaasFalso({}).http);
  assert.deepEqual(asaas.lerAviso(aviso("PAYMENT_RECEIVED"), TOKEN), { ok: true, aviso: { id_externo: "evt_1", tipo: "pagamento_confirmado", pedido_id: PEDIDO, ref: "pay_1", valor_centavos: 10600 } });
  assert.equal((asaas.lerAviso(aviso("PAYMENT_CONFIRMED"), TOKEN) as { aviso: { tipo: string } }).aviso.tipo, "pagamento_confirmado");
  assert.equal((asaas.lerAviso(aviso("PAYMENT_REFUNDED"), TOKEN) as { aviso: { tipo: string } }).aviso.tipo, "estorno_confirmado");
  assert.equal((asaas.lerAviso(aviso("PAYMENT_CHARGEBACK_REQUESTED"), TOKEN) as { aviso: { tipo: string } }).aviso.tipo, "chargeback_recebido");
  assert.equal((asaas.lerAviso(aviso("PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"), TOKEN) as { aviso: { tipo: string } }).aviso.tipo, "pagamento_recusado");
  assert.equal((asaas.lerAviso(aviso("PAYMENT_RECEIVED", {}, { value: 19.9 }), TOKEN) as { aviso: { valor_centavos: number } }).aviso.valor_centavos, 1990, "19,90 não vira 1989");
  assert.equal((asaas.lerAviso(aviso("PAYMENT_RECEIVED", {}, { externalReference: PEDIDO.toUpperCase() }), TOKEN) as { aviso: { pedido_id: string } }).aviso.pedido_id, PEDIDO);
});

test("o aviso do Asaas: token errado, corpo ruim e o que não é nosso ou não muda nada", () => {
  const asaas = criar(asaasFalso({}).http);
  for (const token of [null, "", "errado", TOKEN.slice(0, -1), TOKEN + "x"]) assert.deepEqual(asaas.lerAviso(aviso("PAYMENT_RECEIVED"), token), { ok: false, motivo: "assinatura_invalida" }, String(token));
  assert.deepEqual(asaas.lerAviso("não é json", TOKEN), { ok: false, motivo: "corpo_invalido" });
  assert.deepEqual(asaas.lerAviso(JSON.stringify({ event: "PAYMENT_RECEIVED" }), TOKEN), { ok: false, motivo: "corpo_invalido" }, "sem id do evento");
  assert.deepEqual(asaas.lerAviso(aviso("PAYMENT_RECEIVED", {}, { value: "106" }), TOKEN), { ok: false, motivo: "corpo_invalido" });
  for (const evento of ["PAYMENT_CREATED", "PAYMENT_OVERDUE", "PAYMENT_UPDATED", "PAYMENT_SPLIT_DONE", "PAYMENT_CHECKOUT_VIEWED", "ALGUM_EVENTO_NOVO"]) {
    assert.deepEqual(asaas.lerAviso(aviso(evento), TOKEN), { ok: false, motivo: "evento_irrelevante" }, evento);
  }
  for (const ref of [null, "", "pedido-do-painel", 123]) {
    assert.deepEqual(asaas.lerAviso(aviso("PAYMENT_RECEIVED", {}, { externalReference: ref }), TOKEN), { ok: false, motivo: "evento_irrelevante" }, `cobrança que não é nossa: ${String(ref)}`);
  }
});

test("o aviso de pagamento do Asaas confirma o pedido uma vez; o irrelevante responde 200 sem gravar", async () => {
  const asaas = criar(asaasFalso({}).http);
  const confirmados: string[] = [];
  const vistos = new Set<string>();
  const portas: PortasDosAvisos = {
    async registrar(a) { if (vistos.has(a.id_externo)) return "ja_processado"; vistos.add(a.id_externo); return "novo"; },
    async confirmar(pedidoId, provedor, ref, valor) { confirmados.push(`${pedidoId}|${provedor}|${ref}|${valor}`); return "pago"; },
    async concluir() {},
  };
  const corpo = aviso("PAYMENT_RECEIVED");
  assert.deepEqual(await processarAviso(asaas, portas, corpo, TOKEN), { status: 200, resultado: "pago", pedido_id: PEDIDO });
  assert.deepEqual(await processarAviso(asaas, portas, corpo, TOKEN), { status: 200, resultado: "repetido", pedido_id: PEDIDO }, "at least once: o reenvio não confirma de novo");
  assert.deepEqual(confirmados, [`${PEDIDO}|asaas|pay_1|10600`]);
  assert.deepEqual(await processarAviso(asaas, portas, aviso("PAYMENT_OVERDUE", { id: "evt_2" }), TOKEN), { status: 200, resultado: "ignorado" });
  assert.deepEqual(await processarAviso(asaas, portas, corpo, "errado"), { status: 401, resultado: "assinatura_invalida" });
  assert.equal(vistos.size, 1, "o irrelevante não foi gravado");
});

test("o Asaas só liga configurado, e a produção exige as três travas", () => {
  assert.equal(provedorAsaas({}), null);
  assert.equal(provedorAsaas({ ASAAS_API_KEY: CHAVE }), null, "sem o token do webhook");
  assert.ok(provedorAsaas({ ASAAS_API_KEY: CHAVE, ASAAS_WEBHOOK_TOKEN: TOKEN }) instanceof ProvedorAsaas, "sandbox por padrão");
  const producao = { ASAAS_API_KEY: CHAVE, ASAAS_WEBHOOK_TOKEN: TOKEN, ASAAS_AMBIENTE: "producao", ASAAS_URL: "https://api.exemplo.invalid/v3", TICKETERIA_DINHEIRO_REAL: "sim" };
  assert.ok(provedorAsaas(producao) instanceof ProvedorAsaas);
  assert.equal(provedorAsaas({ ...producao, TICKETERIA_DINHEIRO_REAL: undefined }), null, "sem a trava do dinheiro real");
  assert.equal(provedorAsaas({ ...producao, ASAAS_URL: undefined }), null, "sem a URL conferida");
  assert.equal(provedorAsaas({ ...producao, ASAAS_URL: "http://api.exemplo.invalid/v3" }), null, "só https");
  assert.throws(() => new ProvedorAsaas({ chave: "curta", tokenDoWebhook: TOKEN }));
  assert.throws(() => new ProvedorAsaas({ chave: CHAVE, tokenDoWebhook: "curto" }));
});

test("o QR do Pix de uma conta sem chave Pix falha na primeira vez (invalid_action) e funciona na seguinte: o adaptador tenta de novo", async () => {
  const { http, chamadas } = asaasFalso({
    "POST /customers": { corpo: { id: "cus_1" } },
    "POST /payments": { corpo: { id: "pay_1", invoiceUrl: "https://sandbox.asaas.com/i/pay_1" } },
    "GET /payments/pay_1/pixQrCode": [{ status: 400, corpo: { errors: [{ code: "invalid_action" }] } }, { corpo: { payload: "00020126PIXCOPIAECOLA" } }],
  });
  const provedor = new ProvedorAsaas({ chave: CHAVE, tokenDoWebhook: TOKEN, fetch: http, esperaDoQrMs: 0 });
  const cobranca = await provedor.criarCobranca(pedido);
  assert.equal(cobranca.pix_copia_e_cola, "00020126PIXCOPIAECOLA");
  assert.equal(chamadas.filter(c => c.url.endsWith("/pixQrCode")).length, 2);
});

test("o QR do Pix não insiste em outros erros nem mais de 3 vezes", async () => {
  const outro = asaasFalso({
    "POST /customers": { corpo: { id: "cus_1" } },
    "POST /payments": { corpo: { id: "pay_1" } },
    "GET /payments/pay_1/pixQrCode": { status: 400, corpo: { errors: [{ code: "invalid_object" }] } },
  });
  await assert.rejects(new ProvedorAsaas({ chave: CHAVE, tokenDoWebhook: TOKEN, fetch: outro.http, esperaDoQrMs: 0 }).criarCobranca(pedido), /invalid_object/);
  assert.equal(outro.chamadas.filter(c => c.url.endsWith("/pixQrCode")).length, 1, "outro erro: uma chamada só");
  const sempre = asaasFalso({
    "POST /customers": { corpo: { id: "cus_1" } },
    "POST /payments": { corpo: { id: "pay_1" } },
    "GET /payments/pay_1/pixQrCode": [1, 2, 3, 4].map(() => ({ status: 400, corpo: { errors: [{ code: "invalid_action" }] } })),
  });
  await assert.rejects(new ProvedorAsaas({ chave: CHAVE, tokenDoWebhook: TOKEN, fetch: sempre.http, esperaDoQrMs: 0 }).criarCobranca(pedido), /invalid_action/);
  assert.equal(sempre.chamadas.filter(c => c.url.endsWith("/pixQrCode")).length, 3);
});
