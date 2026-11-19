import assert from "node:assert/strict";
import test from "node:test";
import { TAMANHO_MAXIMO_DO_PEDIDO_DE_SAQUE, lerPedidoDeSaque, textoDaRecusa, tratarPedidoDeSaque, type DecisaoDeSaque } from "../lib/ticketeria/pagamento/validacao-saque";

// A leitura e a resposta da validação de saque do Asaas, sem rede e sem banco. Os formatos seguem a documentação (conferida em 19/11/2026).

const TOKEN = "token-da-validacao-de-saque-0123456789-abcdef";
const saque = (extra: Record<string, unknown> = {}, banco: Record<string, unknown> | null = { cpfCnpj: "123.456.789-09", ownerName: "Fulana" }) =>
  JSON.stringify({ type: "TRANSFER", transfer: { object: "transfer", id: "tr_1", status: "PENDING", type: "BANK_ACCOUNT", value: 22.5, netValue: 22.5, transferFee: 0, ...(banco ? { bankAccount: banco } : {}), ...extra } });

test("o saque para a conta bancária: tipo, id, valor em centavos e o CPF de quem recebe, só os números", () => {
  assert.deepEqual(lerPedidoDeSaque(saque()), { ok: true, payload: JSON.parse(saque()), pedido: { tipo: "TRANSFER", id_externo: "tr_1", destino: "conta_bancaria", cpf_cnpj: "12345678909", valor_centavos: 2250 } });
  assert.equal((lerPedidoDeSaque(saque({ value: 19.9 })) as { pedido: { valor_centavos: number } }).pedido.valor_centavos, 1990, "19,90 não vira 1989");
  assert.equal((lerPedidoDeSaque(saque({}, { cpfCnpj: "12.345.678/0001-95" })) as { pedido: { cpf_cnpj: string } }).pedido.cpf_cnpj, "12345678000195");
});

test("transferência entre contas Asaas, estorno de Pix e o resto: o destino e o documento certos", () => {
  const entreContas = lerPedidoDeSaque(saque({ type: "ASAAS_ACCOUNT" }, null)) as { pedido: { destino: string; cpf_cnpj: string | null } };
  assert.deepEqual([entreContas.pedido.destino, entreContas.pedido.cpf_cnpj], ["conta_asaas", null]);
  const semDestino = lerPedidoDeSaque(saque({ type: "PIX" }, null)) as { pedido: { destino: string } };
  assert.equal(semDestino.pedido.destino, "outro", "sem conta bancária nem conta Asaas, é outro");
  const estorno = lerPedidoDeSaque(JSON.stringify({ type: "PIX_REFUND", pixRefund: { id: "rf_1", value: 60, externalAccount: { cpfCnpj: "111.222.333-44", name: "Comprador" } } })) as { pedido: { tipo: string; id_externo: string; valor_centavos: number; cpf_cnpj: string } };
  assert.deepEqual(estorno.pedido, { tipo: "PIX_REFUND", id_externo: "rf_1", destino: "outro", cpf_cnpj: "11122233344", valor_centavos: 6000 });
  const conta = lerPedidoDeSaque(JSON.stringify({ type: "BILL", bill: { id: "b_1", value: 10 } })) as { pedido: { tipo: string; valor_centavos: number } };
  assert.deepEqual([conta.pedido.tipo, conta.pedido.valor_centavos], ["BILL", 1000]);
  const split = lerPedidoDeSaque(JSON.stringify({ type: "PAYMENT_SPLIT", paymentSplit: { id: "sp_1", totalValue: 1.25 } })) as { pedido: { valor_centavos: number } };
  assert.equal(split.pedido.valor_centavos, 125);
});

test("o que não se entende não vira pedido: o chamador responde erro e o Asaas cancela", () => {
  for (const corpo of ["não é json", "[]", "{}", JSON.stringify({ type: "transfer" }), JSON.stringify({ type: "TRANSFER" }), JSON.stringify({ type: "TRANSFER", transfer: {} }),
    JSON.stringify({ type: "TRANSFER", transfer: { id: "x", value: "22" } }), JSON.stringify({ type: "TRANSFER", transfer: { id: "x", value: -1 } }), JSON.stringify({ type: "COISA", coisa: { id: "x", value: 1 } })]) {
    assert.deepEqual(lerPedidoDeSaque(corpo), { ok: false }, corpo);
  }
  const cpfRuim = lerPedidoDeSaque(saque({}, { cpfCnpj: "123" })) as { pedido: { cpf_cnpj: string | null } };
  assert.equal(cpfRuim.pedido.cpf_cnpj, null, "documento que não tem 11 nem 14 números é ignorado");
});

function rodar(extra: Partial<Parameters<typeof tratarPedidoDeSaque>[0]> = {}, decisao: DecisaoDeSaque = { status: "APPROVED", motivo: "dentro_do_saldo_liberavel" }) {
  const chamadas: string[] = [];
  const promessa = tratarPedidoDeSaque({ tokenEsperado: TOKEN, assinatura: TOKEN, corpo: saque(), validar: async pedido => { chamadas.push(`${pedido.tipo}:${pedido.id_externo}:${pedido.valor_centavos}`); return decisao; }, ...extra });
  return { promessa, chamadas };
}

test("aprovado e recusado: a resposta no formato do Asaas, com o motivo sem dado de ninguém", async () => {
  const aprovado = rodar();
  assert.deepEqual(await aprovado.promessa, { status: 200, corpo: { status: "APPROVED" } });
  assert.deepEqual(aprovado.chamadas, ["TRANSFER:tr_1:2250"]);
  const recusado = rodar({}, { status: "REFUSED", motivo: "retido_ate_depois_do_evento" });
  assert.deepEqual(await recusado.promessa, { status: 200, corpo: { status: "REFUSED", refuseReason: "Valor retido até as 18h do dia seguinte ao evento." } });
  assert.equal(textoDaRecusa("motivo_que_nao_existe"), "Operação não permitida pelo Jards.");
});

test("falha fechada: sem token configurado, token errado, corpo ruim ou grande demais, e erro do banco nunca aprovam", async () => {
  const sem = rodar({ tokenEsperado: null });
  assert.deepEqual(await sem.promessa, { status: 503, corpo: { error: "validacao_nao_configurada" } });
  assert.equal((await rodar({ tokenEsperado: "curto" }).promessa).status, 503, "token configurado curto demais");
  for (const assinatura of [null, "", "errado", TOKEN.slice(0, -1), TOKEN + "x"]) {
    const r = rodar({ assinatura });
    assert.deepEqual(await r.promessa, { status: 401, corpo: { error: "token_invalido" } }, String(assinatura));
    assert.deepEqual(r.chamadas, [], "sem o token, o banco nem é consultado");
  }
  assert.equal((await rodar({ corpo: "não é json" }).promessa).status, 400);
  assert.equal((await rodar({ corpo: "x".repeat(TAMANHO_MAXIMO_DO_PEDIDO_DE_SAQUE + 1) }).promessa).status, 413);
  const erros: unknown[] = [];
  const quebrado = await rodar({ validar: async () => { throw new Error("banco fora: senha=segredo"); }, registrarErro: e => erros.push(e) }).promessa;
  assert.deepEqual(quebrado, { status: 500, corpo: { error: "falha_ao_validar" } });
  assert.equal(erros.length, 1);
  assert.ok(!JSON.stringify(quebrado).includes("segredo"), "a mensagem do erro não vaza na resposta");
});
