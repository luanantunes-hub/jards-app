import assert from "node:assert/strict";
import test from "node:test";
import { URL_DO_SANDBOX, ProvedorAsaas } from "../lib/ticketeria/pagamento/asaas";
import {
  RESPOSTAS, decidirReembolso, enderecoDoRemetente, enderecosDeReembolso, lerAssuntoDoReembolso, tratarEmailDeReembolso,
  type PedidoParaReembolso, type PortasDoReembolso,
} from "../lib/ticketeria/pagamento/reembolso";
import { equilibrada } from "../lib/ticketeria/pagamento/razao";

const PEDIDO_ID = "0d760000-0000-4000-8000-0000000000e1";
const pedido = (sobre: Partial<PedidoParaReembolso> = {}): PedidoParaReembolso => ({
  id: PEDIDO_ID, loja_id: "0d760000-0000-4000-8000-000000000061", codigo: "ABCD2345", comprador_nome: "Rita Teste", comprador_email: "rita@exemplo.com", situacao: "pago",
  total_centavos: 12000, taxa_centavos: 300, produtor_centavos: 11700, custo_meio_centavos: 99, pago_em: "2026-11-15T12:00:00.000Z", provedor: "asaas", provedor_ref: "pay_1", reembolsado_em: null, ingresso_usado: false, ...sobre,
});
const CHEGOU = "2026-11-19T12:00:00.000Z";

test("o assunto: reembolso, com ou sem Re:, hífen, travessão ou dois-pontos, e o código de 8 ou 10 letras", () => {
  assert.deepEqual(lerAssuntoDoReembolso("reembolso - ABCD2345"), { codigo: "ABCD2345" });
  assert.deepEqual(lerAssuntoDoReembolso("Reembolso - k7m2qx9htr"), { codigo: "K7M2QX9HTR" });
  assert.deepEqual(lerAssuntoDoReembolso("RE: Reembolso – ABCD2345"), { codigo: "ABCD2345" });
  assert.deepEqual(lerAssuntoDoReembolso("Enc: reembolso: ABCD2345 obrigado"), { codigo: "ABCD2345" });
  assert.deepEqual(lerAssuntoDoReembolso("  reembolso ABCD2345"), { codigo: "ABCD2345" });
  assert.deepEqual(lerAssuntoDoReembolso("reembolso - código do ingresso"), { codigo: null }, "o texto de exemplo sem código não vira código");
  assert.deepEqual(lerAssuntoDoReembolso("reembolso"), { codigo: null });
  assert.equal(lerAssuntoDoReembolso("Pedido de reembolso ABCD2345"), null, "tem de começar por reembolso");
  assert.equal(lerAssuntoDoReembolso("nota fiscal"), null);
  assert.equal(lerAssuntoDoReembolso(""), null);
});

test("o endereço do remetente", () => {
  assert.equal(enderecoDoRemetente("Rita Teste <Rita@Exemplo.com>"), "rita@exemplo.com");
  assert.equal(enderecoDoRemetente(" RITA@exemplo.com "), "rita@exemplo.com");
});

test("os endereços que valem como pedido de reembolso: o público e o de recebimento do Resend", () => {
  assert.deepEqual(enderecosDeReembolso({}), ["luan.antunes@jards.com.br"]);
  assert.deepEqual(enderecosDeReembolso({ TICKETERIA_EMAIL_DE_REEMBOLSO: "Reembolso@Jards.com.br", NEXT_PUBLIC_PRESTACAO_EMAIL_DOMINIO: "@entrada.jards.com.br" }), ["reembolso@jards.com.br", "reembolso@entrada.jards.com.br"]);
});

test("a decisão: estorna só com tudo certo; recusa na dúvida, e cada recusa com o seu motivo", () => {
  const base = { remetente: "Rita <rita@exemplo.com>", recebidoEm: CHEGOU };
  assert.deepEqual(decidirReembolso({ ...base, pedido: pedido() }), { acao: "estornar" });
  const recusa = (sobre: Partial<PedidoParaReembolso> | null, remetente = base.remetente, recebidoEm = base.recebidoEm) => {
    const d = decidirReembolso({ pedido: sobre === null ? null : pedido(sobre), remetente, recebidoEm });
    assert.equal(d.acao, "recusar");
    return d.acao === "recusar" ? d.situacao : "";
  };
  assert.equal(recusa(null), "nao_encontrado");
  assert.equal(recusa({ reembolsado_em: "2026-11-18T00:00:00.000Z", situacao: "cancelado", pago_em: null }), "ja_reembolsado");
  assert.equal(recusa({}, "outra@exemplo.com"), "remetente_diferente");
  assert.equal(recusa({ situacao: "aguardando_pagamento", pago_em: null }), "nao_elegivel");
  assert.equal(recusa({ pago_em: "2026-11-11T11:00:00.000Z" }), "fora_do_prazo", "8 dias e uma hora: fora");
  assert.equal(recusa({ ingresso_usado: true }), "nao_elegivel");
  assert.equal(recusa({ provedor: null, provedor_ref: null }), "nao_elegivel");
  assert.equal(recusa({ total_centavos: 0, taxa_centavos: 0, produtor_centavos: 0 }), "nao_elegivel");
  assert.deepEqual(decidirReembolso({ ...base, pedido: pedido({ pago_em: "2026-11-12T12:00:00.000Z" }) }), { acao: "estornar" }, "exatamente 7 dias: ainda vale");
  assert.equal(recusa({}, base.remetente, "isto-não-é-data"), "nao_elegivel");
});

function portas(sobre: Partial<PortasDoReembolso> = {}, achado: PedidoParaReembolso | null = pedido()) {
  const c = { alertas: [] as { assunto: string; texto: string }[], chamadas: [] as string[], respostas: [] as { para: string; assunto: string; texto: string }[], erros: [] as unknown[], marcado: null as null | { situacao: string; motivo: string; pedido?: string }, partidas: null as unknown, ref: null as string | null };
  const p: PortasDoReembolso = {
    async registrar() { c.chamadas.push("registrar"); return { id: "rb1", novo: true, situacao: "recebido" }; },
    async buscarPedido() { c.chamadas.push("buscar"); return achado; },
    async reivindicar() { c.chamadas.push("reivindicar"); return true; },
    async marcar(_id, situacao, motivo, pedidoId) { c.chamadas.push("marcar"); c.marcado = { situacao, motivo, pedido: pedidoId }; },
    async autorizarEstorno() { c.chamadas.push("autorizar"); },
    async estornar() { c.chamadas.push("estornar"); return { ok: true, ref: "pay_1" }; },
    async concluir(_id, partidas, ref) { c.chamadas.push("concluir"); c.partidas = partidas; c.ref = ref; },
    async responder(para, m) { c.chamadas.push("responder"); c.respostas.push({ para, ...m }); },
    async avisarOJards(a) { c.alertas.push(a); },
    async nomeDoOrganizador() { return "Cia Atores de Mar"; },
    registrarErro: e => c.erros.push(e),
    ...sobre,
  };
  return { p, c };
}
const email = (sobre: object = {}) => ({ email_id: "email-1", remetente: "Rita Teste <rita@exemplo.com>", assunto: "reembolso - ABCD2345", recebido_em: CHEGOU, ...sobre });

test("o caminho feliz: registra, reivindica, autoriza a ordem, estorna, grava e só então responde", async () => {
  const { p, c } = portas();
  assert.deepEqual(await tratarEmailDeReembolso(email(), p), { resultado: "estornado" });
  assert.deepEqual(c.chamadas, ["registrar", "buscar", "reivindicar", "autorizar", "estornar", "concluir", "responder"]);
  assert.ok(equilibrada(c.partidas as never), "a devolução fecha em zero no razão");
  assert.deepEqual(c.partidas, [{ conta: "psp_a_receber", valor_centavos: -12000 }, { conta: "produtor", valor_centavos: 11700 }, { conta: "plataforma", valor_centavos: 300 }], "Pix: o Asaas não devolve o custo, a devolução é a inversa do pagamento");
  assert.equal(c.ref, "pay_1");
  assert.equal(c.respostas[0].para, "rita@exemplo.com");
  assert.match(c.respostas[0].texto, /R\$ 120,00/);
  assert.match(c.respostas[0].texto, /cancelados/);
});

test("o mesmo e-mail de novo (o Resend reenvia) não faz nada, nem estorna", async () => {
  const { p, c } = portas({ async registrar() { return { id: "rb1", novo: false, situacao: "estornado" }; } });
  assert.deepEqual(await tratarEmailDeReembolso(email(), p), { resultado: "repetido" });
  assert.deepEqual(c.chamadas, []);
});

test("um e-mail que ficou em 'recebido' (a conta caiu no meio) é retomado", async () => {
  const { p, c } = portas({ async registrar() { return { id: "rb1", novo: false, situacao: "recebido" }; } });
  assert.deepEqual(await tratarEmailDeReembolso(email(), p), { resultado: "estornado" });
  assert.ok(c.chamadas.includes("estornar"));
});

test("quem não consegue reivindicar (outro e-mail já está estornando o pedido) não estorna", async () => {
  const { p, c } = portas({ async reivindicar() { return false; } });
  assert.deepEqual(await tratarEmailDeReembolso(email(), p), { resultado: "repetido" });
  assert.ok(!c.chamadas.includes("estornar"));
});

test("o assunto que não é de reembolso é ignorado, sem registrar nada", async () => {
  const { p, c } = portas();
  assert.deepEqual(await tratarEmailDeReembolso(email({ assunto: "dúvida sobre o evento" }), p), { resultado: "ignorado" });
  assert.deepEqual(c.chamadas, []);
});

test("fora do prazo: nada é estornado, o motivo fica na fila e a resposta é a cordial, com a data da compra e o organizador", async () => {
  const { p, c } = portas({}, pedido({ pago_em: "2026-11-01T12:00:00.000Z" }));
  assert.deepEqual(await tratarEmailDeReembolso(email(), p), { resultado: "fora_do_prazo" });
  assert.ok(!c.chamadas.includes("estornar") && !c.chamadas.includes("autorizar"));
  assert.equal(c.marcado?.situacao, "fora_do_prazo");
  assert.match(c.marcado?.motivo ?? "", /18 dias/);
  assert.match(c.respostas[0].texto, /7 dias corridos/);
  assert.match(c.respostas[0].texto, /01\/11\/2026/);
  assert.match(c.respostas[0].texto, /Cia Atores de Mar/);
  assert.match(c.respostas[0].texto, /cancelado ou adiado/);
});

test("código que não existe e remetente diferente recebem a MESMA resposta: ela não revela se o código existe", async () => {
  const a = portas({}, null);
  assert.deepEqual(await tratarEmailDeReembolso(email(), a.p), { resultado: "nao_encontrado" });
  const b = portas({}, pedido());
  assert.deepEqual(await tratarEmailDeReembolso(email({ remetente: "intruso@exemplo.com" }), b.p), { resultado: "remetente_diferente" });
  assert.equal(a.c.respostas[0].texto, b.c.respostas[0].texto);
  assert.equal(b.c.respostas[0].para, "intruso@exemplo.com", "a resposta vai para quem escreveu, nunca para o comprador");
  assert.equal(b.c.marcado?.situacao, "remetente_diferente", "e fica na fila do Jards");
  assert.ok(!b.c.chamadas.includes("estornar"));
});

test("assunto sem código: nada é buscado, fica na fila como não encontrado", async () => {
  const { p, c } = portas();
  assert.deepEqual(await tratarEmailDeReembolso(email({ assunto: "reembolso - código do ingresso" }), p), { resultado: "nao_encontrado" });
  assert.ok(!c.chamadas.includes("buscar"));
});

test("pedido já reembolsado: avisa e não estorna de novo", async () => {
  const { p, c } = portas({}, pedido({ situacao: "cancelado", pago_em: null, reembolsado_em: "2026-11-18T10:00:00.000Z" }));
  assert.deepEqual(await tratarEmailDeReembolso(email(), p), { resultado: "ja_reembolsado" });
  assert.match(c.respostas[0].texto, /já foi reembolsado/);
  assert.ok(!c.chamadas.includes("estornar"));
});

test("ingresso já usado: fila do Jards, com resposta de que será analisado", async () => {
  const { p, c } = portas({}, pedido({ ingresso_usado: true }));
  assert.deepEqual(await tratarEmailDeReembolso(email(), p), { resultado: "nao_elegivel" });
  assert.match(c.respostas[0].texto, /análise/);
  assert.match(c.marcado?.motivo ?? "", /usado/);
});

test("o Asaas recusa o estorno (sem saldo, por exemplo): fica na fila como falhou, o comprador é avisado e nada é gravado", async () => {
  const { p, c } = portas({ async estornar() { return { ok: false, motivo: "insufficient_balance" }; } });
  assert.deepEqual(await tratarEmailDeReembolso(email(), p), { resultado: "falhou" });
  assert.ok(!c.chamadas.includes("concluir"));
  assert.equal(c.marcado?.situacao, "falhou");
  assert.match(c.marcado?.motivo ?? "", /insufficient_balance/);
  assert.match(c.respostas[0].texto, /análise/);
});

test("erro ao falar com o Asaas: também vira falhou (o registro fica, e ninguém estorna dobrado)", async () => {
  const { p, c } = portas({ async estornar() { throw new Error("rede"); } });
  assert.deepEqual(await tratarEmailDeReembolso(email(), p), { resultado: "falhou" });
  assert.equal(c.erros.length, 1);
  assert.equal(c.marcado?.situacao, "falhou");
});

test("estorno feito e gravação falhou: o erro grita no registro, o comprador recebe a confirmação e o registro fica 'estornando' (nunca estorna de novo)", async () => {
  const { p, c } = portas({ async concluir() { throw new Error("banco fora do ar"); } });
  assert.deepEqual(await tratarEmailDeReembolso(email(), p), { resultado: "estornado" });
  assert.match(String(c.erros[0]), /ESTORNO FEITO NO ASAAS, MAS NÃO GRAVADO/);
  assert.match(String(c.erros[0]), /ABCD2345/);
  assert.equal(c.respostas.length, 1);
  assert.equal(c.marcado, null, "não marca falhou: o dinheiro já voltou");
});

test("falha ao responder não derruba nada", async () => {
  const { p, c } = portas({ async responder() { throw new Error("e-mail fora do ar"); } });
  assert.deepEqual(await tratarEmailDeReembolso(email(), p), { resultado: "estornado" });
  assert.equal(c.erros.length, 1);
});

test("as respostas não deixam texto do comprador virar HTML", () => {
  const m = RESPOSTAS.estornado(pedido({ comprador_nome: "Rita <script>x</script>" }));
  assert.doesNotMatch(m.html, /<script>/);
  assert.match(m.html, /&lt;script&gt;/);
});

// O estorno no Asaas, com respostas falsas (os campos seguem o que o sandbox devolveu em 19/11/2026).
function asaasFalso(respostas: Record<string, { status?: number; corpo?: unknown }>) {
  const chamadas: { metodo: string; caminho: string; corpo: { value?: number; description?: string; splitRefunds?: { id: string; value: number }[] } | undefined }[] = [];
  const http = (async (url: string | URL | Request, init?: RequestInit) => {
    const caminho = String(url).replace(URL_DO_SANDBOX, "");
    const metodo = init?.method ?? "GET";
    chamadas.push({ metodo, caminho, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = respostas[`${metodo} ${caminho}`];
    if (!r) return new Response(JSON.stringify({ errors: [{ code: "nao_simulado" }] }), { status: 404 });
    return new Response(JSON.stringify(r.corpo ?? {}), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { chamadas, provedor: new ProvedorAsaas({ chave: "chave-da-subconta-0123456789", tokenDoWebhook: "x".repeat(32), fetch: http }) };
}

test("estorno do Pix com a comissão: acha o split da carteira do Jards na cobrança e estorna o valor inteiro com splitRefunds", async () => {
  const { chamadas, provedor } = asaasFalso({
    "GET /payments/pay_1": { corpo: { id: "pay_1", split: [{ id: "split_outro", walletId: "carteira-x" }, { id: "split_jards", walletId: "carteira-jards" }] } },
    "POST /payments/pay_1/refund": { corpo: { status: "REFUNDED" } },
  });
  assert.deepEqual(await provedor.estornarPixComComissao("pay_1", 12000, 300, "carteira-jards"), { ok: true, ref: "pay_1" });
  assert.deepEqual(chamadas[1].corpo, { value: 120, description: "Reembolso do pedido", splitRefunds: [{ id: "split_jards", value: 3 }] });
});

test("sem comissão, estorna sem splitRefunds e sem consultar a cobrança", async () => {
  const { chamadas, provedor } = asaasFalso({ "POST /payments/pay_1/refund": { corpo: {} } });
  assert.deepEqual(await provedor.estornarPixComComissao("pay_1", 6000, 0, "carteira-jards"), { ok: true, ref: "pay_1" });
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].corpo?.splitRefunds, undefined);
});

test("se a cobrança não traz o split da comissão, NÃO estorna (a comissão ficaria com o Jards)", async () => {
  const { chamadas, provedor } = asaasFalso({ "GET /payments/pay_1": { corpo: { id: "pay_1", split: [{ id: "split_outro", walletId: "carteira-x" }] } } });
  assert.deepEqual(await provedor.estornarPixComComissao("pay_1", 12000, 300, "carteira-jards"), { ok: false, motivo: "split_da_comissao_nao_encontrado" });
  assert.ok(!chamadas.some(c => c.metodo === "POST"));
});

test("o Asaas recusa o estorno (400): devolve ok falso com os códigos, sem lançar", async () => {
  const { provedor } = asaasFalso({
    "GET /payments/pay_1": { corpo: { split: [{ id: "split_jards", walletId: "carteira-jards" }] } },
    "POST /payments/pay_1/refund": { status: 400, corpo: { errors: [{ code: "invalid_action" }] } },
  });
  assert.deepEqual(await provedor.estornarPixComComissao("pay_1", 12000, 300, "carteira-jards"), { ok: false, motivo: "invalid_action" });
});

test("o Jards é avisado por e-mail quando um reembolso precisa de gente: falhou, estorno não gravado e análise; o que se resolve sozinho não faz barulho", async () => {
  const falhou = portas({ async estornar() { return { ok: false, motivo: "insufficient_balance" }; } });
  await tratarEmailDeReembolso(email(), falhou.p);
  assert.equal(falhou.c.alertas.length, 1);
  assert.match(falhou.c.alertas[0].assunto, /FALHOU.*ABCD2345/);
  assert.match(falhou.c.alertas[0].texto, /insufficient_balance/);
  assert.match(falhou.c.alertas[0].texto, /R\$ 120,00/);
  assert.match(falhou.c.alertas[0].texto, /Tentar de novo|tentar de novo/);

  const naoGravou = portas({ async concluir() { throw new Error("banco fora do ar"); } });
  await tratarEmailDeReembolso(email(), naoGravou.p);
  assert.match(naoGravou.c.alertas[0].assunto, /URGENTE.*ABCD2345/);
  assert.match(naoGravou.c.alertas[0].texto, /pay_1/);
  assert.match(naoGravou.c.alertas[0].texto, /nunca estorna de novo/);

  const analise = portas({}, pedido({ ingresso_usado: true }));
  await tratarEmailDeReembolso(email(), analise.p);
  assert.match(analise.c.alertas[0].assunto, /analisar.*ABCD2345/);
  assert.match(analise.c.alertas[0].texto, /usado/);

  for (const calmo of [portas(), portas({}, pedido({ pago_em: "2026-11-01T12:00:00.000Z" })), portas({}, null), portas({}, pedido({ reembolsado_em: "2026-11-18T10:00:00.000Z", situacao: "cancelado", pago_em: null }))]) {
    await tratarEmailDeReembolso(email(), calmo.p);
    assert.equal(calmo.c.alertas.length, 0, "estorno feito, fora do prazo, não encontrado e já reembolsado não avisam");
  }
});

test("falha ao avisar o Jards não derruba nada e vai ao registro", async () => {
  const { p, c } = portas({ async estornar() { return { ok: false, motivo: "x" }; }, async avisarOJards() { throw new Error("e-mail fora do ar"); } });
  assert.deepEqual(await tratarEmailDeReembolso(email(), p), { resultado: "falhou" });
  assert.equal(c.erros.length, 1);
});

test("o aviso não vaza o e-mail nem o nome do comprador", async () => {
  const { p, c } = portas({ async estornar() { return { ok: false, motivo: "x" }; } });
  await tratarEmailDeReembolso(email(), p);
  const tudo = c.alertas.map(a => a.assunto + a.texto).join(" ");
  assert.doesNotMatch(tudo, /rita@exemplo\.com|Rita/);
});
