import assert from "node:assert/strict";
import test from "node:test";
import { ErroDaCompra, PARCELAMENTO_LIBERADO, documentoValido, iniciarCompra, lerCorpoDaCompra, situacaoParaOComprador, type PortasDaCompra } from "../lib/ticketeria/pagamento/compra";
import type { Cobranca, PedidoParaCobrar, ProvedorDePagamento } from "../lib/ticketeria/pagamento/provedor";
import { VERSAO_DAS_NOVIDADES } from "../lib/ticketeria/novidades";
import { VERSAO_DOS_TERMOS_DE_COMPRA } from "../lib/ticketeria/termos-de-compra";

const SESSAO = "0d760000-0000-4000-8000-000000000081";
const INGRESSO = "0d760000-0000-4000-8000-000000000031";
const bom = { sessao_id: SESSAO, itens: [{ ingresso_id: INGRESSO, quantidade: 2 }], nome: "Rita  Teste", email: "Rita@Teste.com", documento: "529.982.247-25", termos: VERSAO_DOS_TERMOS_DE_COMPRA };

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
  if (r.ok) assert.deepEqual(r.corpo, { sessao_id: SESSAO, itens: [{ ingresso_id: INGRESSO, quantidade: 2 }], nome: "Rita Teste", email: "rita@teste.com", documento: "52998224725", termos: VERSAO_DOS_TERMOS_DE_COMPRA, meio: "pix", parcelas: 1, cupom: null, lugares: [], origem: null, novidades: null });
  const ruim = (mudanca: object) => lerCorpoDaCompra({ ...bom, ...mudanca });
  for (const [mudanca, problema] of [
    [{ sessao_id: "x" }, "sessão"], [{ itens: [] }, "ingressos"], [{ itens: "x" }, "ingressos"],
    [{ itens: [{ ingresso_id: INGRESSO, quantidade: 0 }] }, "ingressos"], [{ itens: [{ ingresso_id: INGRESSO, quantidade: 1.5 }] }, "ingressos"], [{ itens: [{ ingresso_id: INGRESSO, quantidade: 21 }] }, "ingressos"],
    [{ itens: [{ ingresso_id: INGRESSO, quantidade: 1 }, { ingresso_id: INGRESSO.toUpperCase(), quantidade: 1 }] }, "ingressos"],
    [{ nome: "R" }, "nome"], [{ email: "sem-arroba" }, "e-mail"], [{ documento: "123" }, "CPF ou CNPJ"], [{ termos: "" }, "aceite dos Termos de compra"], [{ termos: "2020-01-01" }, "aceite dos Termos de compra"], [{ termos: undefined }, "aceite dos Termos de compra"],
  ] as [object, string][]) {
    const l = ruim(mudanca);
    assert.equal(l.ok, false);
    if (!l.ok) assert.ok(l.problemas.includes(problema), problema);
  }
  assert.equal(lerCorpoDaCompra(null).ok, false);
  assert.equal(lerCorpoDaCompra({ ...bom, itens: Array.from({ length: 11 }, (_, i) => ({ ingresso_id: `0d760000-0000-4000-8000-0000000000${String(10 + i)}`, quantidade: 1 })) }).ok, false, "mais de 10 tipos de ingresso");
});

function montar(sobre: Partial<PortasDaCompra> = {}, reserva: Partial<{ situacao: "aguardando_pagamento" | "pago"; taxa: number; total: number }> = {}) {
  const chamadas: { reservar: unknown[]; meio: string[]; aceites: [string, string][]; cobrancas: { chave: string; pedido: PedidoParaCobrar }[]; erros: unknown[] } = { reservar: [], meio: [], aceites: [], cobrancas: [], erros: [] };
  const total = reserva.total ?? 7000;
  const taxa = reserva.taxa ?? 175;
  const portas: PortasDaCompra = {
    async contaDaSessao() { return { chave: "chave-da-subconta-0123456789", aprovada: true }; },
    async reservar(corpo, minutos) {
      chamadas.reservar.push([corpo, minutos]);
      return { pedido_id: "0d760000-0000-4000-8000-0000000000e1", codigo: "ABCD2345", situacao: reserva.situacao ?? "aguardando_pagamento", reservado_ate: "2026-11-19T12:15:00.000Z", total_centavos: total, taxa_centavos: taxa, produtor_centavos: total - taxa };
    },
    async registrarAceite(pedido, versao) { chamadas.aceites.push([pedido, versao]); },
    async definirMeio(pedido, meio, parcelas) { chamadas.meio.push(`${pedido}:${meio}:${parcelas}`); },
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
  assert.deepEqual(r, { situacao: "aguardando_pagamento", meio: "pix", pedido_id: "0d760000-0000-4000-8000-0000000000e1", codigo: "ABCD2345", total_centavos: 7000, reservado_ate: "2026-11-19T12:15:00.000Z", pix_copia_e_cola: "00020126-PIX" });
  assert.equal((chamadas.reservar[0] as [unknown, number])[1], 15);
  assert.deepEqual(chamadas.meio, ["0d760000-0000-4000-8000-0000000000e1:pix:null"], "o Pix não tem parcelas");
  assert.deepEqual(chamadas.aceites, [["0d760000-0000-4000-8000-0000000000e1", VERSAO_DOS_TERMOS_DE_COMPRA]], "o pedido guarda a versão dos termos aceita");
  assert.equal(chamadas.cobrancas.length, 1);
  assert.equal(chamadas.cobrancas[0].chave, "chave-da-subconta-0123456789", "a cobrança nasce com a chave da subconta");
  const c = chamadas.cobrancas[0].pedido;
  assert.equal(c.total_centavos, 7000, "o comprador paga só o preço");
  assert.deepEqual(c.split, [{ carteira: "carteira-do-jards", valor_centavos: 175 }]);
  assert.equal(c.comprador_documento, "52998224725", "o documento vai ao provedor");
});

test("o cartão: escolhe o meio, abre a cobrança de cartão NA SUBCONTA com a comissão dividida e devolve o endereço da página segura (nenhum dado de cartão passa por aqui)", async () => {
  const cartoes: { chave: string; pedido: PedidoParaCobrar & { parcelas: number } }[] = [];
  const { portas, chamadas } = montar({
    provedor(chave) {
      return {
        nome: "asaas",
        async criarCobranca(): Promise<Cobranca> { throw new Error("não é Pix"); },
        async criarCobrancaCartao(pedido) { cartoes.push({ chave, pedido }); return { ref: "pay_c", url: "https://sandbox.asaas.com/i/abc", expira_em: pedido.expira_em }; },
        async estornar() { return { ok: true }; },
        lerAviso() { return { ok: false, motivo: "evento_irrelevante" }; },
      };
    },
  });
  const l = lerCorpoDaCompra({ ...bom, meio: "cartao" });
  assert.ok(l.ok);
  if (!l.ok) return;
  assert.equal(l.corpo.meio, "cartao");
  const r = await iniciarCompra(l.corpo, portas);
  assert.deepEqual(r, { situacao: "aguardando_pagamento", meio: "cartao", pedido_id: "0d760000-0000-4000-8000-0000000000e1", codigo: "ABCD2345", total_centavos: 7000, reservado_ate: "2026-11-19T12:15:00.000Z", url_de_pagamento: "https://sandbox.asaas.com/i/abc" });
  assert.deepEqual(chamadas.meio, ["0d760000-0000-4000-8000-0000000000e1:cartao:1"], "à vista");
  assert.equal(cartoes[0].chave, "chave-da-subconta-0123456789");
  assert.equal(cartoes[0].pedido.parcelas, 1);
  assert.deepEqual(cartoes[0].pedido.split, [{ carteira: "carteira-do-jards", valor_centavos: 175 }]);
});

test("o meio e as parcelas: Pix é o padrão; meio desconhecido recusa; parcelamento NÃO está liberado (o aviso de cada parcela ainda não é somado)", () => {
  const ok = lerCorpoDaCompra(bom);
  assert.ok(ok.ok && ok.corpo.meio === "pix" && ok.corpo.parcelas === 1, "sem meio, Pix à vista");
  for (const [mudanca, problema] of [
    [{ meio: "boleto" }, "forma de pagamento"], [{ meio: "cartao", parcelas: 2 }, "parcelas"], [{ meio: "cartao", parcelas: 0 }, "parcelas"], [{ meio: "cartao", parcelas: 1.5 }, "parcelas"],
    [{ meio: "cartao", parcelas: "1" }, "parcelas"], [{ meio: "pix", parcelas: 3 }, "parcelas"], [{ meio: "cartao", parcelas: 7 }, "parcelas"],
  ] as [object, string][]) {
    const l = lerCorpoDaCompra({ ...bom, ...mudanca });
    assert.equal(l.ok, false, JSON.stringify(mudanca));
    if (!l.ok) assert.ok(l.problemas.includes(problema), problema);
  }
  assert.equal(PARCELAMENTO_LIBERADO, false);
  const c = lerCorpoDaCompra({ ...bom, meio: "cartao", parcelas: 1 });
  assert.ok(c.ok && c.corpo.parcelas === 1);
});

test("o meio que a loja não oferece (ou o custo não deixa) vira a frase 'escolha o Pix', e nada é cobrado", async () => {
  const { portas, chamadas } = montar({ async definirMeio() { throw new ErroDaCompra("meio_indisponivel", "Esta forma de pagamento não está disponível para esta compra. Escolha o Pix."); } });
  const l = lerCorpoDaCompra({ ...bom, meio: "cartao" });
  if (!l.ok) throw new Error("corpo");
  await assert.rejects(iniciarCompra(l.corpo, portas), (e: unknown) => e instanceof ErroDaCompra && e.codigo === "meio_indisponivel" && /Pix/.test(e.mensagem));
  assert.equal(chamadas.cobrancas.length, 0);
});

test("se o Asaas não abre a página do cartão, o comprador é avisado sem detalhe e pode pagar com Pix", async () => {
  const { portas, chamadas } = montar({ provedor() { return { nome: "asaas", async criarCobranca() { throw new Error("não"); }, async criarCobrancaCartao() { throw new Error("o Asaas recusou POST /payments: 400 chave=segredo"); }, async estornar() { return { ok: true }; }, lerAviso() { return { ok: false, motivo: "evento_irrelevante" }; } }; } });
  const l = lerCorpoDaCompra({ ...bom, meio: "cartao" });
  if (!l.ok) throw new Error("corpo");
  await assert.rejects(iniciarCompra(l.corpo, portas), (e: unknown) => e instanceof ErroDaCompra && e.codigo === "cobranca_falhou" && /Pix/.test(e.mensagem) && !/Asaas|segredo|400/.test(e.mensagem));
  assert.equal(chamadas.erros.length, 1);
});

test("provedor sem cartão: falha segura", async () => {
  const { portas } = montar();
  const l = lerCorpoDaCompra({ ...bom, meio: "cartao" });
  if (!l.ok) throw new Error("corpo");
  await assert.rejects(iniciarCompra(l.corpo, portas), (e: unknown) => e instanceof ErroDaCompra && e.codigo === "cobranca_falhou");
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

test("o aceite é gravado também no ingresso gratuito, e se não der para gravar a compra falha antes de qualquer cobrança", async () => {
  const gratis = montar({}, { situacao: "pago", total: 0, taxa: 0 });
  const l = lerCorpoDaCompra(bom);
  if (!l.ok) throw new Error("corpo");
  await iniciarCompra(l.corpo, gratis.portas);
  assert.equal(gratis.chamadas.aceites.length, 1);
  const { portas, chamadas } = montar({ async registrarAceite() { throw new Error("banco fora do ar"); } });
  await assert.rejects(iniciarCompra(l.corpo, portas), /banco fora do ar/);
  assert.deepEqual([chamadas.meio.length, chamadas.cobrancas.length], [0, 0], "sem aceite gravado, não há Pix");
});

test("a origem da compra: lida do corpo, aparada, guardada no pedido, e nunca barra a venda", async () => {
  const origem = { canal: "Instagram", acao: "Stories do lote 2!", referencia: "l.instagram.com", utm: { utm_source: "ig", utm_campaign: "lote2", gclid: "nao-entra" } };
  const l = lerCorpoDaCompra({ ...bom, origem });
  assert.ok(l.ok);
  if (!l.ok) return;
  assert.deepEqual(l.corpo.origem, { canal: "instagram", acao: "stories-do-lote-2", referencia: "l.instagram.com", utm: { utm_source: "ig", utm_campaign: "lote2" } });
  for (const torta of [undefined, null, "instagram", 7, [], {}, { canal: "!!!" }]) {
    const r = lerCorpoDaCompra({ ...bom, origem: torta });
    assert.ok(r.ok, "origem torta não é problema");
    if (r.ok) assert.equal(r.corpo.origem, null);
  }

  const gravadas: [string, unknown][] = [];
  const { portas } = montar({ async registrarOrigem(pedido, o) { gravadas.push([pedido, o]); } });
  await iniciarCompra(l.corpo, portas);
  assert.deepEqual(gravadas, [["0d760000-0000-4000-8000-0000000000e1", l.corpo.origem]], "grava a origem no pedido reservado");

  const semOrigem = lerCorpoDaCompra(bom);
  assert.ok(semOrigem.ok);
  if (semOrigem.ok) { gravadas.length = 0; await iniciarCompra(semOrigem.corpo, portas); assert.equal(gravadas.length, 0, "sem origem, não chama o banco"); }

  const quebrada = montar({ async registrarOrigem() { throw new Error("banco fora do ar"); } });
  const compra = await iniciarCompra(l.corpo, quebrada.portas);
  assert.equal(compra.situacao, "aguardando_pagamento", "falhar em guardar a origem não derruba a compra");
  assert.equal(quebrada.chamadas.erros.length, 1, "mas o erro fica no registro");
  assert.equal(quebrada.chamadas.cobrancas.length, 1, "e a cobrança nasce");
});

test("o aceite de novidades: começa desmarcado, só vale com a marca, guarda o WhatsApp só com a marca, e nunca barra a venda", async () => {
  const sem = lerCorpoDaCompra(bom);
  assert.ok(sem.ok);
  if (sem.ok) assert.equal(sem.corpo.novidades, null, "sem a marca, nada é guardado");
  for (const marca of ["true", 1, "sim", null, undefined]) {
    const r = lerCorpoDaCompra({ ...bom, novidades: marca, whatsapp: "(15) 99712-4410" });
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.corpo.novidades, null, `só true vale: ${String(marca)}`);
  }
  const com = lerCorpoDaCompra({ ...bom, novidades: true, whatsapp: "(15) 99712-4410" });
  assert.ok(com.ok);
  if (!com.ok) return;
  assert.deepEqual(com.corpo.novidades, { versao: VERSAO_DAS_NOVIDADES, whatsapp: "5515997124410" });
  const semNumero = lerCorpoDaCompra({ ...bom, novidades: true, whatsapp: "  " });
  assert.ok(semNumero.ok);
  if (semNumero.ok) assert.deepEqual(semNumero.corpo.novidades, { versao: VERSAO_DAS_NOVIDADES, whatsapp: null });
  const ruim = lerCorpoDaCompra({ ...bom, novidades: true, whatsapp: "123" });
  assert.equal(ruim.ok, false);
  if (!ruim.ok) assert.ok(ruim.problemas.includes("WhatsApp"));
  const numeroSemMarca = lerCorpoDaCompra({ ...bom, novidades: false, whatsapp: "123" });
  assert.ok(numeroSemMarca.ok, "número solto sem a marca é ignorado");

  const gravadas: [string, unknown][] = [];
  const { portas } = montar({ async registrarNovidades(pedido, n) { gravadas.push([pedido, n]); } });
  await iniciarCompra(com.corpo, portas);
  assert.deepEqual(gravadas, [["0d760000-0000-4000-8000-0000000000e1", com.corpo.novidades]]);
  if (sem.ok) { gravadas.length = 0; await iniciarCompra(sem.corpo, portas); assert.equal(gravadas.length, 0, "sem a marca, não chama o banco"); }

  const quebrada = montar({ async registrarNovidades() { throw new Error("banco fora do ar"); } });
  const compra = await iniciarCompra(com.corpo, quebrada.portas);
  assert.equal(compra.situacao, "aguardando_pagamento", "falhar em guardar o aceite não derruba a compra");
  assert.equal(quebrada.chamadas.erros.length, 1);
  assert.equal(quebrada.chamadas.cobrancas.length, 1);
});
