import assert from "node:assert/strict";
import test from "node:test";
import { TAXA_ZERO, taxaDoIngresso, totaisDoPedido } from "../lib/ticketeria/pagamento/taxa";
import { equilibrada, partidasDoPagamento, saldos } from "../lib/ticketeria/pagamento/razao";
import { ProvedorDeMentira, provedorDeMentira } from "../lib/ticketeria/pagamento/provedor-de-mentira";
import { processarAviso, type PortasDosAvisos } from "../lib/ticketeria/pagamento/avisos";
import { conciliar } from "../lib/ticketeria/pagamento/conciliacao";
import { lerPedidoReservado, mensagemDoErroDaReserva } from "../lib/ticketeria/pagamento/reserva";

// Os mesmos casos de supabase/tests/ticketeria_pagamentos.test.sql ("a taxa de um ingresso"): o banco e o código fazem a mesma conta.
const CASOS_DA_TAXA: [number, number, number, "comprador" | "produtor", number][] = [
  [5000, 1000, 100, "comprador", 600], [5000, 0, 0, "comprador", 0], [0, 1000, 100, "comprador", 0], [333, 1000, 0, "comprador", 33],
  [335, 1000, 0, "comprador", 34], [100, 3000, 90, "produtor", 100], [5000, 1000, 100, "produtor", 600], [1, 3000, 10000, "comprador", 10000],
];

test("a taxa de um ingresso: os mesmos casos do teste de banco", () => {
  for (const [preco, bps, fixo, quem_paga, esperado] of CASOS_DA_TAXA) {
    assert.equal(taxaDoIngresso(preco, { percentual_bps: bps, fixo_centavos: fixo, quem_paga }), esperado, `${preco} ${bps} ${fixo} ${quem_paga}`);
  }
  assert.equal(taxaDoIngresso(5000, TAXA_ZERO), 0, "sem regra, zero");
});

test("os totais do pedido: o mesmo pedido do teste de banco (3 inteiras divididas entre dois lotes)", () => {
  const itens = [{ preco_centavos: 5000, quantidade: 2 }, { preco_centavos: 8000, quantidade: 1 }];
  assert.deepEqual(totaisDoPedido(itens, { percentual_bps: 500, fixo_centavos: 50, quem_paga: "comprador" }), { total_centavos: 19050, taxa_centavos: 1050, produtor_centavos: 18000 });
  const produtorPaga = totaisDoPedido(itens, { percentual_bps: 500, fixo_centavos: 50, quem_paga: "produtor" });
  assert.deepEqual(produtorPaga, { total_centavos: 18000, taxa_centavos: 1050, produtor_centavos: 16950 }, "o comprador paga o preço; a taxa sai da parte do produtor");
  for (const totais of [produtorPaga]) assert.equal(totais.total_centavos, totais.taxa_centavos + totais.produtor_centavos);
  assert.deepEqual(totaisDoPedido([{ preco_centavos: 0, quantidade: 4 }], { percentual_bps: 1000, fixo_centavos: 100, quem_paga: "comprador" }), { total_centavos: 0, taxa_centavos: 0, produtor_centavos: 0 }, "gratuito não paga taxa");
});

test("o razão do pagamento: soma zero, sem partida zerada, saldos de cada conta", () => {
  const partidas = partidasDoPagamento({ total_centavos: 10600, produtor_centavos: 10000, taxa_centavos: 600 });
  assert.deepEqual(partidas, [{ conta: "psp_a_receber", valor_centavos: 10600 }, { conta: "produtor", valor_centavos: -10000 }, { conta: "plataforma", valor_centavos: -600 }]);
  assert.ok(equilibrada(partidas));
  assert.deepEqual(saldos([...partidas, ...partidas]), { psp_a_receber: 21200, produtor: -20000, plataforma: -1200 });
  const semTaxa = partidasDoPagamento({ total_centavos: 5000, produtor_centavos: 5000, taxa_centavos: 0 });
  assert.equal(semTaxa.length, 2, "taxa zero não vira partida");
  assert.ok(equilibrada(semTaxa));
  assert.equal(equilibrada([{ conta: "produtor", valor_centavos: 100 }]), false);
  assert.equal(equilibrada([{ conta: "produtor", valor_centavos: 100 }, { conta: "plataforma", valor_centavos: -99 }]), false);
});

const SEGREDO = "segredo-de-teste-1234567890";
const PEDIDO = "0d740000-0000-4000-8000-000000000001";

test("o provedor de mentira: a cobrança, a assinatura do aviso e o que ele recusa", async () => {
  const provedor = new ProvedorDeMentira(SEGREDO);
  const cobranca = await provedor.criarCobranca({ id: PEDIDO, codigo: "ABCD2345", total_centavos: 10600, expira_em: "2026-12-01T00:00:00Z", comprador_email: "a@b.com" });
  assert.equal(cobranca.ref, `mentira_${PEDIDO}`);
  assert.match(cobranca.pix_copia_e_cola ?? "", /ABCD2345:10600/);
  const { corpo, assinatura } = provedor.simularAviso({ id_externo: "evt-1", tipo: "pagamento_confirmado", pedido_id: PEDIDO, ref: cobranca.ref, valor_centavos: 10600 });
  assert.deepEqual(provedor.lerAviso(corpo, assinatura), { ok: true, aviso: JSON.parse(corpo) });
  assert.deepEqual(provedor.lerAviso(corpo.replace("10600", "1"), assinatura), { ok: false, motivo: "assinatura_invalida" }, "corpo mexido");
  assert.deepEqual(provedor.lerAviso(corpo, null), { ok: false, motivo: "assinatura_invalida" });
  assert.deepEqual(provedor.lerAviso(corpo, "zz"), { ok: false, motivo: "assinatura_invalida" });
  assert.deepEqual(new ProvedorDeMentira("outro-segredo-1234567").lerAviso(corpo, assinatura), { ok: false, motivo: "assinatura_invalida" }, "outro segredo");
  const torto = provedor.simularAviso({ id_externo: "evt-2", tipo: "pagamento_confirmado", pedido_id: "nao-e-uuid", ref: "r", valor_centavos: 1 });
  assert.deepEqual(provedor.lerAviso(torto.corpo, torto.assinatura), { ok: false, motivo: "corpo_invalido" });
  assert.throws(() => new ProvedorDeMentira("curto"));
});

test("o provedor de mentira nunca roda em produção nem sem o segredo", () => {
  assert.equal(provedorDeMentira({ NODE_ENV: "production", TICKETERIA_SEGREDO_DE_MENTIRA: SEGREDO }), null);
  assert.equal(provedorDeMentira({ NODE_ENV: "development", VERCEL_ENV: "production", TICKETERIA_SEGREDO_DE_MENTIRA: SEGREDO }), null);
  assert.equal(provedorDeMentira({ NODE_ENV: "development" }), null);
  assert.ok(provedorDeMentira({ NODE_ENV: "development", VERCEL_ENV: "preview", TICKETERIA_SEGREDO_DE_MENTIRA: SEGREDO }) instanceof ProvedorDeMentira);
});

function portasFalsas(confirmar: PortasDosAvisos["confirmar"]) {
  const avisos = new Map<string, { processado: boolean; resultado?: string }>();
  const chamadas: string[] = [];
  const portas: PortasDosAvisos = {
    async registrar(aviso) {
      const existente = avisos.get(aviso.id_externo);
      if (existente?.processado) return "ja_processado";
      if (!existente) avisos.set(aviso.id_externo, { processado: false });
      return "novo";
    },
    async confirmar(...args) { chamadas.push(args[0]); return confirmar(...args); },
    async concluir(_provedor, id, resultado) { avisos.set(id, { processado: true, resultado }); },
  };
  return { portas, avisos, chamadas };
}

test("o aviso de pagamento: confirma uma vez, ignora o repetido e o que não é pagamento", async () => {
  const provedor = new ProvedorDeMentira(SEGREDO);
  let pagos = 0;
  const { portas, avisos, chamadas } = portasFalsas(async () => (pagos++ === 0 ? "pago" : "ja_pago"));
  const aviso = provedor.simularAviso({ id_externo: "evt-1", tipo: "pagamento_confirmado", pedido_id: PEDIDO, ref: "r1", valor_centavos: 10600 });
  assert.deepEqual(await processarAviso(provedor, portas, aviso.corpo, aviso.assinatura), { status: 200, resultado: "pago", pedido_id: PEDIDO });
  assert.deepEqual(await processarAviso(provedor, portas, aviso.corpo, aviso.assinatura), { status: 200, resultado: "repetido", pedido_id: PEDIDO }, "o mesmo aviso não confirma de novo");
  assert.equal(chamadas.length, 1);
  const outro = provedor.simularAviso({ id_externo: "evt-2", tipo: "pagamento_confirmado", pedido_id: PEDIDO, ref: "r1", valor_centavos: 10600 });
  assert.equal((await processarAviso(provedor, portas, outro.corpo, outro.assinatura)).resultado, "ja_pago", "outro aviso do mesmo pagamento: o banco responde que já está pago");
  const recusa = provedor.simularAviso({ id_externo: "evt-3", tipo: "pagamento_recusado", pedido_id: PEDIDO, ref: "r1", valor_centavos: 10600 });
  assert.equal((await processarAviso(provedor, portas, recusa.corpo, recusa.assinatura)).resultado, "ignorado");
  assert.equal(avisos.get("evt-3")?.resultado, "ignorado");
  assert.deepEqual(await processarAviso(provedor, portas, aviso.corpo, "0".repeat(64)), { status: 401, resultado: "assinatura_invalida" });
});

test("o aviso cujo pedido não pode virar pago pede o estorno; a falha passageira deixa o provedor mandar de novo", async () => {
  const provedor = new ProvedorDeMentira(SEGREDO);
  const vencida = portasFalsas(async () => { throw new Error("reserva_expirada_sem_lugar"); });
  const aviso = provedor.simularAviso({ id_externo: "evt-9", tipo: "pagamento_confirmado", pedido_id: PEDIDO, ref: "r9", valor_centavos: 5000 });
  assert.deepEqual(await processarAviso(provedor, vencida.portas, aviso.corpo, aviso.assinatura), { status: 200, resultado: "estornar", pedido_id: PEDIDO, motivo: "reserva_expirada_sem_lugar" });
  assert.deepEqual(provedor.estornos, [{ ref: "r9", valor: 5000 }]);

  let tentativas = 0;
  const instavel = portasFalsas(async () => { if (tentativas++ === 0) throw new Error("fetch failed"); return "pago"; });
  await assert.rejects(processarAviso(provedor, instavel.portas, aviso.corpo, aviso.assinatura), /fetch failed/);
  assert.equal((await processarAviso(provedor, instavel.portas, aviso.corpo, aviso.assinatura)).resultado, "pago", "o reenvio termina o serviço (o aviso não foi concluído)");
});

test("a conciliação: conferidos, sem extrato, sem pedido e valor divergente", () => {
  const pedidos = [
    { id: "p1", codigo: "A", provedor_ref: "r1", total_centavos: 1000 },
    { id: "p2", codigo: "B", provedor_ref: "r2", total_centavos: 2000 },
    { id: "p3", codigo: "C", provedor_ref: "r3", total_centavos: 3000 },
  ];
  const extrato = [{ ref: "r1", valor_centavos: 1000 }, { ref: "r2", valor_centavos: 1900 }, { ref: "r9", valor_centavos: 500 }];
  const c = conciliar(pedidos, extrato);
  assert.deepEqual(c.conferidos.map(x => x.pedido.id), ["p1"]);
  assert.deepEqual(c.valorDivergente.map(x => x.pedido.id), ["p2"]);
  assert.deepEqual(c.semExtrato.map(x => x.id), ["p3"]);
  assert.deepEqual(c.semPedido, [{ ref: "r9", valor_centavos: 500 }]);
  assert.equal(c.diferenca_centavos, 3400 - 6000);
});

test("a resposta da reserva é conferida, e os erros viram frases", () => {
  const ok = { pedido_id: PEDIDO, codigo: "ABCD2345", situacao: "aguardando_pagamento", reservado_ate: "2026-12-01T00:00:00Z", total_centavos: 10600, taxa_centavos: 600, produtor_centavos: 10000 };
  assert.deepEqual(lerPedidoReservado(ok), ok);
  assert.equal(lerPedidoReservado({ ...ok, total_centavos: 10601 }), null, "o total tem de fechar");
  assert.equal(lerPedidoReservado({ ...ok, situacao: "talvez" }), null);
  assert.equal(lerPedidoReservado(null), null);
  assert.match(mensagemDoErroDaReserva({ message: "esgotado" }), /lugares/);
  assert.match(mensagemDoErroDaReserva({ message: "sessao_indisponivel" }), /não está mais à venda/);
  assert.match(mensagemDoErroDaReserva({ message: "outra coisa" }), /Tente de novo/);
});
