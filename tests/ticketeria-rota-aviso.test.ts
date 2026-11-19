import assert from "node:assert/strict";
import test from "node:test";
import { ProvedorAsaas, provedorAsaas } from "../lib/ticketeria/pagamento/asaas";
import type { PortasDosAvisos } from "../lib/ticketeria/pagamento/avisos";
import { TAMANHO_MAXIMO_DO_AVISO, tratarAvisoDoProvedor } from "../lib/ticketeria/pagamento/rota-aviso";

// O tratamento do aviso do Asaas ponta a ponta, sem rede e sem banco (T5, parte 3).

const CHAVE = "chave-falsa-do-asaas-0123456789";
const TOKEN = "token-do-webhook-0123456789-abcdefghij";
const PEDIDO = "0d740000-0000-4000-8000-000000000001";
const provedor = () => new ProvedorAsaas({ chave: CHAVE, tokenDoWebhook: TOKEN, fetch: (async () => new Response("{}")) as typeof fetch });
const corpo = (evento = "PAYMENT_RECEIVED", id = "evt_1") => JSON.stringify({ id, event: evento, payment: { id: "pay_1", externalReference: PEDIDO, value: 106 } });

function portas() {
  const registros: string[] = [];
  const p: PortasDosAvisos = {
    async registrar(a) { registros.push(`registrar:${a.id_externo}`); return "novo"; },
    async confirmar(pedido, prov, ref, valor) { registros.push(`confirmar:${pedido}:${prov}:${ref}:${valor}`); return "pago"; },
    async concluir(_p, id, resultado) { registros.push(`concluir:${id}:${resultado}`); },
  };
  return { p, registros };
}

test("sem o provedor configurado a rota é inerte: 503 e nada gravado", async () => {
  const { p, registros } = portas();
  assert.deepEqual(await tratarAvisoDoProvedor({ provedor: null, portas: () => p, corpo: corpo(), assinatura: TOKEN }), { status: 503, corpo: { error: "provedor_nao_configurado" } });
  assert.deepEqual(registros, []);
  assert.equal(provedorAsaas({}), null, "sem chave nem token no ambiente, não há provedor");
});

test("token errado: 401 e nada gravado; aviso de pagamento certo: 200 e o pedido é confirmado em centavos", async () => {
  const { p, registros } = portas();
  assert.deepEqual(await tratarAvisoDoProvedor({ provedor: provedor(), portas: () => p, corpo: corpo(), assinatura: "errado" }), { status: 401, corpo: { resultado: "assinatura_invalida" } });
  assert.deepEqual(registros, []);
  assert.deepEqual(await tratarAvisoDoProvedor({ provedor: provedor(), portas: () => p, corpo: corpo(), assinatura: TOKEN }), { status: 200, corpo: { resultado: "pago" } });
  assert.deepEqual(registros, ["registrar:evt_1", `confirmar:${PEDIDO}:asaas:pay_1:10600`, "concluir:evt_1:pago"]);
});

test("corpo inválido: 400; corpo grande demais: 413 sem nem ler; evento que não muda nada: 200 sem gravar", async () => {
  const { p, registros } = portas();
  assert.equal((await tratarAvisoDoProvedor({ provedor: provedor(), portas: () => p, corpo: "não é json", assinatura: TOKEN })).status, 400);
  assert.equal((await tratarAvisoDoProvedor({ provedor: provedor(), portas: () => p, corpo: "x".repeat(TAMANHO_MAXIMO_DO_AVISO + 1), assinatura: TOKEN })).status, 413);
  assert.deepEqual(await tratarAvisoDoProvedor({ provedor: provedor(), portas: () => p, corpo: corpo("PAYMENT_CREATED"), assinatura: TOKEN }), { status: 200, corpo: { resultado: "ignorado" } });
  assert.deepEqual(registros, []);
});

test("falha passageira do banco: 500 (o provedor reenvia) e o erro vai para o registro, sem vazar a mensagem na resposta", async () => {
  const erros: unknown[] = [];
  const { p } = portas();
  const quebrada: PortasDosAvisos = { ...p, async confirmar() { throw new Error("conexão caiu: senha=segredo"); } };
  const r = await tratarAvisoDoProvedor({ provedor: provedor(), portas: () => quebrada, corpo: corpo(), assinatura: TOKEN, registrarErro: e => erros.push(e) });
  assert.deepEqual(r, { status: 500, corpo: { error: "falha_ao_processar" } });
  assert.equal(erros.length, 1);
  assert.ok(!JSON.stringify(r).includes("segredo"));
});
