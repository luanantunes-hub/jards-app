import assert from "node:assert/strict";
import test from "node:test";
import { ErroDaCompra, documentoValido, iniciarCompra, lerCorpoDaCompra, situacaoParaOComprador, type PortasDaCompra } from "../lib/ticketeria/pagamento/compra";
import type { Cobranca, PedidoParaCobrar, ProvedorDePagamento } from "../lib/ticketeria/pagamento/provedor";

const SESSAO = "0d760000-0000-4000-8000-000000000081";
const INGRESSO = "0d760000-0000-4000-8000-000000000031";
const bom = { sessao_id: SESSAO, itens: [{ ingresso_id: INGRESSO, quantidade: 2 }], nome: "Rita  Teste", email: "Rita@Teste.com", documento: "529.982.247-25" };

test("CPF e CNPJ: só com os dígitos verificadores certos", () => {
  assert.equal(documentoValido("529.982.247-25"), true);
  assert.equal(documentoValido("52998224725"), true);
  assert.equal(documentoValido("12.345.678/0001-95"), true);
  assert.equal(documentoValido("111.111.111-11"), false, "todos iguais");
  assert.equal(documentoValido("529.982.247-26"), false);
  assert.equal(documentoValido("12.345.678/0001-96"), false);
  assert.equal(documentoValido("123"), false);
  assert.equal(documentoValido(""), false);
});

test("o corpo da compra: lido, aparado e conferido", () => {
  const r = lerCorpoDaCompra(bom);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.corpo, { sessao_id: SESSAO, itens: [{ ingresso_id: INGRESSO, quantidade: 2 }], nome: "Rita Teste", email: "rita@teste.com", documento: "52998224725" });
  const ruim = (mudanca: object) => lerCorpoDaCompra({ ...bom, ...mudanca });
  for (const [mudanca, problema] of [
    [{ sessao_id: "x" }, "sessão"], [{ itens: [] }, "ingressos"], [{ itens: "x" }, "ingressos"],
    [{ itens: [{ ingresso_id: INGRESSO, quantidade: 0 }] }, "ingressos"], [{ itens: [{ ingresso_id: INGRESSO, quantidade: 1.5 }] }, "ingressos"], [{ itens: [{ ingresso_id: INGRESSO, quantidade: 21 }] }, "ingressos"],
    [{ itens: [{ ingresso_id: INGRESSO, quantidade: 1 }, { ingresso_id: INGRESSO.toUpperCase(), quantidade: 1 }] }, "ingressos"],
    [{ nome: "R" }, "nome"], [{ email: "sem-arroba" }, "e-mail"], [{ documento: "123" }, "CPF ou CNPJ"],
  ] as [object, string][]) {
    const l = ruim(mudanca);
    assert.equal(l.ok, false);
    if (!l.ok) assert.ok(l.problemas.includes(problema), problema);
  }
  assert.equal(lerCorpoDaCompra(null).ok, false);
  assert.equal(lerCorpoDaCompra({ ...bom, itens: Array.from({ length: 11 }, (_, i) => ({ ingresso_id: `0d760000-0000-4000-8000-0000000000${String(10 + i)}`, quantidade: 1 })) }).ok, false, "mais de 10 tipos de ingresso");
});

function montar(sobre: Partial<PortasDaCompra> = {}, reserva: Partial<{ situacao: "aguardando_pagamento" | "pago"; taxa: number; total: number }> = {}) {
  const chamadas: { reservar: unknown[]; meio: string[]; cobrancas: { chave: string; pedido: PedidoParaCobrar }[]; erros: unknown[] } = { reservar: [], meio: [], cobrancas: [], erros: [] };
  const total = reserva.total ?? 7000;
  const taxa = reserva.taxa ?? 175;
  const portas: PortasDaCompra = {
    async contaDaSessao() { return { chave: "chave-da-subconta-0123456789", aprovada: true }; },
    async reservar(corpo, minutos) {
      chamadas.reservar.push([corpo, minutos]);
      return { pedido_id: "0d760000-0000-4000-8000-0000000000e1", codigo: "ABCD2345", situacao: reserva.situacao ?? "aguardando_pagamento", reservado_ate: "2026-11-19T12:15:00.000Z", total_centavos: total, taxa_centavos: taxa, produtor_centavos: total - taxa };
    },
    async definirMeioPix(pedido) { chamadas.meio.push(pedido); },
    provedor(chave) {
      const p: ProvedorDePagamento = {
        nome: "asaas",
        async criarCobranca(pedido): Promise<Cobranca> { chamadas.cobrancas.push({ chave, pedido }); return { ref: "pay_1", pix_copia_e_cola: "00020126-PIX", url: null, expira_em: pedido.expira_em }; },
        async estornar() { return { ok: true }; },
        lerAviso() { return { ok: false, motivo: "evento_irrelevante" }; },
      };
      return p;
    },
    carteiraDoJards: "carteira-do-jards",
    registrarErro: erro => chamadas.erros.push(erro),
    ...sobre,
  };
  return { portas, chamadas };
}

test("compra com Pix: reserva 15 minutos, escolhe o Pix, abre a cobrança NA SUBCONTA e divide a comissão para o Jards", async () => {
  const { portas, chamadas } = montar();
  const l = lerCorpoDaCompra(bom);
  assert.ok(l.ok);
  if (!l.ok) return;
  const r = await iniciarCompra(l.corpo, portas);
  assert.deepEqual(r, { situacao: "aguardando_pagamento", pedido_id: "0d760000-0000-4000-8000-0000000000e1", codigo: "ABCD2345", total_centavos: 7000, reservado_ate: "2026-11-19T12:15:00.000Z", pix_copia_e_cola: "00020126-PIX" });
  assert.equal((chamadas.reservar[0] as [unknown, number])[1], 15);
  assert.deepEqual(chamadas.meio, ["0d760000-0000-4000-8000-0000000000e1"]);
  assert.equal(chamadas.cobrancas.length, 1);
  assert.equal(chamadas.cobrancas[0].chave, "chave-da-subconta-0123456789", "a cobrança nasce com a chave da subconta");
  const c = chamadas.cobrancas[0].pedido;
  assert.equal(c.total_centavos, 7000, "o comprador paga só o preço");
  assert.deepEqual(c.split, [{ carteira: "carteira-do-jards", valor_centavos: 175 }]);
  assert.equal(c.comprador_documento, "52998224725", "o documento vai ao provedor");
});

test("ingresso gratuito: já nasce pago, sem Pix nem cobrança", async () => {
  const { portas, chamadas } = montar({}, { situacao: "pago", total: 0, taxa: 0 });
  const l = lerCorpoDaCompra(bom);
  if (!l.ok) throw new Error("corpo");
  assert.deepEqual(await iniciarCompra(l.corpo, portas), { situacao: "pago", pedido_id: "0d760000-0000-4000-8000-0000000000e1", codigo: "ABCD2345", total_centavos: 0 });
  assert.deepEqual([chamadas.meio.length, chamadas.cobrancas.length], [0, 0]);
});

test("sem comissão, a cobrança vai sem divisão", async () => {
  const { portas, chamadas } = montar({}, { taxa: 0 });
  const l = lerCorpoDaCompra(bom);
  if (!l.ok) throw new Error("corpo");
  await iniciarCompra(l.corpo, portas);
  assert.equal(chamadas.cobrancas[0].pedido.split, undefined);
});

test("sem conta aprovada, nada é reservado", async () => {
  const l = lerCorpoDaCompra(bom);
  if (!l.ok) throw new Error("corpo");
  for (const conta of [null, { chave: "x".repeat(30), aprovada: false }]) {
    const { portas, chamadas } = montar({ async contaDaSessao() { return conta; } });
    await assert.rejects(iniciarCompra(l.corpo, portas), (e: unknown) => e instanceof ErroDaCompra && e.codigo === "vendas_indisponiveis");
    assert.equal(chamadas.reservar.length, 0);
  }
});

test("sem a carteira do Jards, a comissão não tem para onde ir: as vendas pausam (e a reserva nem sai)", async () => {
  const { portas, chamadas } = montar({ carteiraDoJards: null });
  const l = lerCorpoDaCompra(bom);
  if (!l.ok) throw new Error("corpo");
  await assert.rejects(iniciarCompra(l.corpo, portas), (e: unknown) => e instanceof ErroDaCompra && e.codigo === "vendas_indisponiveis");
  assert.equal(chamadas.reservar.length, 0, "nem reserva");
  assert.equal(chamadas.erros.length, 1);
});

test("o erro da reserva chega ao comprador como frase", async () => {
  const { portas } = montar({ async reservar() { throw new ErroDaCompra("reserva_recusada", "Não há mais lugares nesta quantidade."); } });
  const l = lerCorpoDaCompra(bom);
  if (!l.ok) throw new Error("corpo");
  await assert.rejects(iniciarCompra(l.corpo, portas), (e: unknown) => e instanceof ErroDaCompra && e.codigo === "reserva_recusada" && /lugares/.test(e.mensagem));
});

test("se o Asaas falha, o comprador recebe uma frase sem detalhe do provedor e o erro vai ao registro", async () => {
  const { portas, chamadas } = montar({ provedor() { return { nome: "asaas", async criarCobranca() { throw new Error("o Asaas recusou POST /payments: 400 (invalid_object) chave=segredo"); }, async estornar() { return { ok: true }; }, lerAviso() { return { ok: false, motivo: "evento_irrelevante" }; } }; } });
  const l = lerCorpoDaCompra(bom);
  if (!l.ok) throw new Error("corpo");
  await assert.rejects(iniciarCompra(l.corpo, portas), (e: unknown) => e instanceof ErroDaCompra && e.codigo === "cobranca_falhou" && !/Asaas|segredo|400/.test(e.mensagem));
  assert.equal(chamadas.erros.length, 1);
});

test("cobrança sem o copia e cola é falha, não Pix vazio", async () => {
  const { portas } = montar({ provedor() { return { nome: "asaas", async criarCobranca(p) { return { ref: "pay_1", pix_copia_e_cola: null, url: null, expira_em: p.expira_em }; }, async estornar() { return { ok: true }; }, lerAviso() { return { ok: false, motivo: "evento_irrelevante" }; } }; } });
  const l = lerCorpoDaCompra(bom);
  if (!l.ok) throw new Error("corpo");
  await assert.rejects(iniciarCompra(l.corpo, portas), (e: unknown) => e instanceof ErroDaCompra && e.codigo === "cobranca_falhou");
});

test("a situação para o comprador: reserva vencida sem pagamento é expirada", () => {
  const agora = new Date("2026-11-19T12:20:00.000Z");
  assert.equal(situacaoParaOComprador("aguardando_pagamento", "2026-11-19T12:15:00.000Z", agora), "expirada");
  assert.equal(situacaoParaOComprador("aguardando_pagamento", "2026-11-19T12:25:00.000Z", agora), "aguardando_pagamento");
  assert.equal(situacaoParaOComprador("pago", "2026-11-19T12:15:00.000Z", agora), "pago", "pago vale mesmo com a reserva vencida");
  assert.equal(situacaoParaOComprador("cancelado", "2026-11-19T12:25:00.000Z", agora), "cancelada");
});
