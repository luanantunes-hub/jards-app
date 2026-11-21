import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { diaCurtoEHora, montarCompras, montarResumoDasVendas, montarVendas, repasseDoPedido, situacaoDaSessao, type EntradaDasVendas, type LinhaDePedido, type TotaisDasVendas } from "../lib/ticketeria/vendas";
import { ComprasDeVendas, DetalheDaCompraSheet, ReembolsosDeVendas, ResumoDeVendas, SessoesDeVendas, VendasView } from "../components/ticketeria/VendasView";

const AGORA = Date.parse("2026-11-19T15:00:00.000Z");
const pedido = (id: string, sessao: string, situacao: string, total: number, taxa: number, custo: number, real: number | null, criado: string, pago: string | null = null): LinhaDePedido => ({
  id, codigo: `COD${id}`.padEnd(8, "X"), comprador_nome: `Comprador ${id}`, comprador_email: `${id}@exemplo.com`, sessao_id: sessao, situacao,
  total_centavos: total, taxa_centavos: taxa, produtor_centavos: total - taxa, custo_meio_centavos: custo, custo_meio_real_centavos: real, pago_em: pago, created_at: criado,
});
const entrada: EntradaDasVendas = {
  pedidos: [
    pedido("1", "s1", "pago", 15000, 375, 99, 99, "2026-11-19T14:00:00.000Z", "2026-11-19T14:02:00.000Z"),
    pedido("2", "s1", "pago", 6000, 150, 99, null, "2026-11-19T13:00:00.000Z", "2026-11-19T13:01:00.000Z"),
    pedido("3", "s2", "aguardando_pagamento", 6000, 150, 99, null, "2026-11-19T14:30:00.000Z"),
    pedido("4", "s3", "cancelado", 12000, 300, 99, null, "2026-11-10T10:00:00.000Z"),
  ],
  quantidadePorPedido: { "1": 3, "2": 1, "3": 1, "4": 2 },
  sessoes: [
    { id: "s3", evento_id: "e1", local_id: "l1", inicio: "2026-11-14T23:00:00.000Z", cancelada_em: null },
    { id: "s1", evento_id: "e1", local_id: "l1", inicio: "2026-11-21T23:00:00.000Z", cancelada_em: null },
    { id: "s2", evento_id: "e2", local_id: "l1", inicio: "2026-12-05T00:00:00.000Z", cancelada_em: null },
    { id: "s4", evento_id: "e2", local_id: "l1", inicio: "2026-11-20T23:00:00.000Z", cancelada_em: "2026-11-18T10:00:00.000Z" },
  ],
  tituloDoEvento: { e1: "Hamlet", e2: "Cabaré" }, fusoDoLocal: { l1: "America/Sao_Paulo" }, lugaresDoLocal: { l1: 4 },
  emitidos: [
    { codigo: "AAAAAAAAA2", nome: "Inteira", pedido_id: "1", usado_em: null, cancelado_em: null }, { codigo: "BBBBBBBBB3", nome: "Inteira", pedido_id: "1", usado_em: null, cancelado_em: null },
    { codigo: "CCCCCCCCC4", nome: "Meia", pedido_id: "1", usado_em: "2026-11-20T00:00:00.000Z", cancelado_em: null }, { codigo: "DDDDDDDDD5", nome: "Inteira", pedido_id: "2", usado_em: null, cancelado_em: "2026-11-19T15:00:00.000Z" },
  ],
  liberadoCentavos: 1000, sacadoCentavos: 500, agora: AGORA,
};

test("o repasse é a parte do produtor menos o custo do Pix (o real, se o Asaas já informou)", () => {
  assert.equal(repasseDoPedido({ produtor_centavos: 14625, custo_meio_centavos: 99, custo_meio_real_centavos: 99 }), 14526);
  assert.equal(repasseDoPedido({ produtor_centavos: 14625, custo_meio_centavos: 99, custo_meio_real_centavos: 50 }), 14575, "o real vale mais que a estimativa");
  assert.equal(repasseDoPedido({ produtor_centavos: 5850, custo_meio_centavos: 99, custo_meio_real_centavos: null }), 5751);
});

test("o resumo conta só o que foi pago e separa liberado, sacado e retido", () => {
  const { resumo } = montarVendas(entrada);
  assert.equal(resumo.vendido_centavos, 21000);
  assert.equal(resumo.compras, 2);
  assert.equal(resumo.ingressos, 3, "ingresso cancelado não conta");
  assert.equal(resumo.repasse_centavos, 14526 + 5751);
  assert.equal(resumo.liberado_centavos, 1000);
  assert.equal(resumo.retido_centavos, 14526 + 5751 - 500 - 1000, "retido = repasse − sacado − liberado");
});

test("retido e liberado nunca ficam negativos", () => {
  const { resumo } = montarVendas({ ...entrada, liberadoCentavos: -50, sacadoCentavos: 999999 });
  assert.equal(resumo.liberado_centavos, 0);
  assert.equal(resumo.retido_centavos, 0);
});

test("sem nenhuma venda tudo é zero", () => {
  const { resumo, sessoes, compras } = montarVendas({ ...entrada, pedidos: [], emitidos: [], quantidadePorPedido: {}, sessoes: [], liberadoCentavos: 0, sacadoCentavos: 0 });
  assert.deepEqual(resumo, { vendido_centavos: 0, ingressos: 0, compras: 0, repasse_centavos: 0, liberado_centavos: 0, retido_centavos: 0 });
  assert.deepEqual([sessoes.length, compras.length], [0, 0]);
});

test("as sessões: as que vão acontecer primeiro (da mais próxima), depois as que passaram (da mais recente), cada uma com a sua situação", () => {
  const { sessoes } = montarVendas(entrada);
  assert.deepEqual(sessoes.map(s => s.id), ["s4", "s1", "s2", "s3"]);
  assert.deepEqual(sessoes.map(s => s.situacao), ["cancelada", "esgotada", "a_venda", "encerrada"]);
  const s1 = sessoes.find(s => s.id === "s1");
  assert.deepEqual([s1?.vendidos, s1?.lugares, s1?.receita_centavos, s1?.evento], [4, 4, 21000, "Hamlet"]);
  assert.match(s1?.quando ?? "", /^Sábado, 21\/11\/2026 às 20:00$/);
});

test("a situação da sessão: cancelada, encerrada, esgotada ou à venda", () => {
  const base = { inicio: "2026-11-21T23:00:00.000Z", cancelada_em: null };
  assert.equal(situacaoDaSessao(base, 4, 4, AGORA), "esgotada");
  assert.equal(situacaoDaSessao(base, 3, 4, AGORA), "a_venda");
  assert.equal(situacaoDaSessao(base, 0, 0, AGORA), "a_venda", "sem capacidade cadastrada nunca é esgotada");
  assert.equal(situacaoDaSessao({ ...base, inicio: "2026-11-19T14:00:00.000Z" }, 4, 4, AGORA), "encerrada");
  assert.equal(situacaoDaSessao({ ...base, cancelada_em: "2026-11-18T00:00:00.000Z" }, 4, 4, AGORA), "cancelada");
});

test("as compras: as mais novas primeiro, com a situação, a quantidade e o detalhe", () => {
  const { compras } = montarVendas(entrada);
  assert.deepEqual(compras.map(c => c.id), ["3", "1", "2", "4"]);
  const c1 = compras.find(c => c.id === "1");
  assert.deepEqual([c1?.situacao, c1?.quantidade, c1?.valor_centavos, c1?.pago_em, c1?.quando], ["pago", 3, 15000, "19/11 às 11:02", "21/11 às 20:00"]);
  assert.deepEqual(c1?.detalhe.ingressos.map(i => [i.codigo, i.usado, i.cancelado]), [["AAAAAAAAA2", false, false], ["BBBBBBBBB3", false, false], ["CCCCCCCCC4", true, false]]);
  assert.deepEqual([c1?.detalhe.total_centavos, c1?.detalhe.taxa_centavos, c1?.detalhe.custo_do_pix_centavos, c1?.detalhe.repasse_centavos], [15000, 375, 99, 14526]);
  const c3 = compras.find(c => c.id === "3");
  assert.deepEqual([c3?.situacao, c3?.pago_em, c3?.detalhe.custo_do_pix_centavos, c3?.detalhe.repasse_centavos], ["aguardando_pagamento", null, null, 0], "compra não paga não tem repasse");
  assert.equal(compras.find(c => c.id === "4")?.situacao, "cancelado");
  assert.equal(compras.find(c => c.id === "2")?.detalhe.ingressos[0].cancelado, true);
});

test("pedido de uma sessão que não está na lista não derruba a tela", () => {
  const { compras } = montarVendas({ ...entrada, sessoes: [] });
  assert.equal(compras.length, 4);
  assert.equal(compras[0].quando, "—");
});

test("a hora curta é a do fuso pedido", () => {
  assert.equal(diaCurtoEHora("2026-11-19T17:02:00.000Z"), "19/11 às 14:02");
  assert.equal(diaCurtoEHora("2026-11-19T17:02:00.000Z", "America/Manaus"), "19/11 às 13:02");
});

test("as telas: resumo com os quatro valores, sessões, compras com filtro e a folha do detalhe", () => {
  const v = montarVendas(entrada);
  const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");
  const resumo = html(createElement(ResumoDeVendas, { resumo: v.resumo }));
  for (const t of ["Vendido", "R$ 210,00", "3 ingressos em 2 compras", "Seu repasse", "Liberado para saque", "R$ 10,00", "Retido", "Liberado às 18h do dia seguinte ao evento"]) assert.ok(resumo.includes(t), `resumo sem: ${t}`);
  assert.match(html(createElement(ResumoDeVendas, { resumo: { ...v.resumo, vendido_centavos: 0 } })), /text-black\/30/, "valor zerado fica apagado");
  const sessoes = html(createElement(SessoesDeVendas, { sessoes: v.sessoes }));
  for (const t of ["Por sessão", "Hamlet", "CANCELADA", "ESGOTADA", "À VENDA", "ENCERRADA", "de 4"]) assert.ok(sessoes.includes(t), `sessões sem: ${t}`);
  const lista = html(createElement(ComprasDeVendas, { compras: v.compras, filtro: "todas" }));
  for (const t of ["Compras", "Todas", "Pagas", "Aguardando", "PAGO", "AGUARDANDO", "CANCELADO", "Ainda não pago"]) assert.ok(lista.includes(t), `compras sem: ${t}`);
  assert.match(lista, /aria-pressed="true"[^>]*>Todas/);
  assert.match(html(createElement(ComprasDeVendas, { compras: [], filtro: "pagas" })), /Nenhuma compra aqui/);
  const folha = html(createElement(DetalheDaCompraSheet, { compra: { ...v.compras[1].detalhe, endereco_do_pedido: "https://jards.com.br/pedido/x" }, onClose: () => {} }));
  for (const t of ["Compra COD1XXXX", "Hamlet", "Ingressos", "AAAAAAAAA2", "USADO", "Pago pelo comprador", "R$ 150,00", "− R$ 3,75", "− R$ 0,99", "Seu repasse", "R$ 145,26", "Ver a página do pedido", "Fechar"]) assert.ok(folha.includes(t), `folha sem: ${t}`);
  assert.match(html(createElement(VendasView, { resumo: v.resumo, sessoes: [], compras: [], filtro: "todas" })), /Nenhuma compra aqui/);
});

test("os reembolsos: só os de pedidos da loja, os mais recentes primeiro, com a situação que a tela entende", () => {
  const { reembolsos } = montarVendas({
    ...entrada,
    reembolsos: [
      { id: "r1", pedido_id: "1", remetente: "rita@exemplo.com", recebido_em: "2026-11-19T19:20:00.000Z", situacao: "falhou", valor_centavos: null },
      { id: "r2", pedido_id: "2", remetente: "carlos@exemplo.com", recebido_em: "2026-11-19T18:02:00.000Z", situacao: "estornado", valor_centavos: 6000 },
      { id: "r3", pedido_id: "1", remetente: "x@exemplo.com", recebido_em: "2026-11-19T20:00:00.000Z", situacao: "recebido", valor_centavos: null },
      { id: "r4", pedido_id: null, remetente: "sem-pedido@exemplo.com", recebido_em: "2026-11-19T21:00:00.000Z", situacao: "nao_encontrado", valor_centavos: null },
      { id: "r5", pedido_id: "999", remetente: "de-outra-loja@exemplo.com", recebido_em: "2026-11-19T21:30:00.000Z", situacao: "falhou", valor_centavos: null },
      { id: "r6", pedido_id: "1", remetente: "y@exemplo.com", recebido_em: "2026-11-19T17:00:00.000Z", situacao: "situacao_nova_desconhecida", valor_centavos: null },
    ],
  });
  assert.deepEqual(reembolsos.map(r => r.id), ["r3", "r1", "r2"], "sem pedido, de outra loja e situação desconhecida ficam de fora; os mais novos primeiro");
  assert.deepEqual(reembolsos.map(r => r.situacao), ["estornando", "falhou", "estornado"], "recebido (em andamento) aparece como estornando");
  assert.deepEqual([reembolsos[1].codigo, reembolsos[1].recebido, reembolsos[2].valor_centavos], ["COD1XXXX", "19/11 às 16:20", 6000]);
  assert.deepEqual(montarVendas(entrada).reembolsos, [], "sem reembolsos, lista vazia");
});

test("a seção Reembolsos: situação e frase de cada um; só o que falhou ganha Tentar de novo; só aparece quando há reembolsos", () => {
  const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/\u00a0/g, " ");
  const lista = [
    { id: "r1", codigo: "ABCD2345", remetente: "rita@exemplo.com", recebido: "19/11 às 16:20", situacao: "falhou" as const, motivo: null, valor_centavos: null },
    { id: "r2", codigo: "KP7M2QX9", remetente: "carlos@exemplo.com", recebido: "19/11 às 15:02", situacao: "estornado" as const, motivo: null, valor_centavos: 12000 },
    { id: "r3", codigo: "H2D5FJ6G", remetente: "ana@exemplo.com", recebido: "19/11 às 11:40", situacao: "fora_do_prazo" as const, motivo: null, valor_centavos: null },
  ];
  const h = html(createElement(ReembolsosDeVendas, { reembolsos: lista, onTentarDeNovo: () => {} }));
  for (const t of ["Reembolsos", "ABCD2345", "FALHOU", "O Asaas não conseguiu estornar", "REEMBOLSADO", "R$ 120,00", "O Pix foi devolvido ao comprador.", "FORA DO PRAZO", "mais de 7 dias"]) assert.ok(h.includes(t), `falta: ${t}`);
  assert.equal((h.match(/Tentar de novo/g) ?? []).length, 1, "só o que falhou");
  assert.match(html(createElement(ReembolsosDeVendas, { reembolsos: lista, onTentarDeNovo: () => {}, tentando: "r1" })), /Tentando…/);
  assert.doesNotMatch(html(createElement(ReembolsosDeVendas, { reembolsos: lista })), /Tentar de novo/, "sem ação, sem botão");
  const v = montarVendas(entrada);
  assert.doesNotMatch(html(createElement(VendasView, { resumo: v.resumo, sessoes: v.sessoes, compras: v.compras, filtro: "todas" })), /Reembolsos/, "sem reembolsos, a seção não aparece");
  assert.match(html(createElement(VendasView, { resumo: v.resumo, sessoes: v.sessoes, compras: v.compras, filtro: "todas", reembolsos: lista })), /Reembolsos/);
});

test("o lugar nas vendas: o detalhe da compra traz o lugar de cada ingresso de setor numerado e a folha o mostra", () => {
  const { compras } = montarVendas({ ...entrada, emitidos: entrada.emitidos.map((e, i) => (i === 0 ? { ...e, assento_rotulo: "Plateia · Fileira C · lugar 7" } : e)) });
  const comLugar = compras.flatMap(c => c.detalhe.ingressos).filter(i => i.assento);
  assert.deepEqual(comLugar.map(i => i.assento), ["Plateia · Fileira C · lugar 7"], "só o ingresso que tem lugar");
  assert.ok(compras.flatMap(c => c.detalhe.ingressos).every(i => i.assento === null || typeof i.assento === "string"), "os outros vêm com lugar nulo");
  const detalhe = compras.find(c => c.detalhe.ingressos.some(i => i.assento))!.detalhe;
  const folha = renderToStaticMarkup(createElement(DetalheDaCompraSheet, { compra: { ...detalhe, endereco_do_pedido: "https://jards.com.br/pedido/x" }, onClose: () => {} })).replace(/\u00a0/g, " ");
  assert.ok(folha.includes("Plateia · Fileira C · lugar 7"));
});

// ─── As vendas paginadas: os totais vêm somados do banco e a lista de compras, de página em página ─────────────────────────────────────────────────────

/** Os totais como a função do banco os soma (só os pedidos pagos; os ingressos válidos; a fila de reembolsos), a partir dos mesmos dados da entrada. */
function totaisComoOBancoSoma(e: EntradaDasVendas): TotaisDasVendas {
  const pagos = e.pedidos.filter(p => p.situacao === "pago");
  const porSessao = new Map<string, { vendidos: number; receita: number }>();
  for (const p of pagos) {
    const atual = porSessao.get(p.sessao_id) ?? { vendidos: 0, receita: 0 };
    porSessao.set(p.sessao_id, { vendidos: atual.vendidos + (e.quantidadePorPedido[p.id] ?? 0), receita: atual.receita + p.total_centavos });
  }
  return {
    compras_pagas: pagos.length, vendido_centavos: pagos.reduce((soma, p) => soma + p.total_centavos, 0), repasse_centavos: pagos.reduce((soma, p) => soma + repasseDoPedido(p), 0),
    ingressos: e.emitidos.filter(i => !i.cancelado_em).length,
    por_sessao: [...porSessao].map(([sessao_id, v]) => ({ sessao_id, ...v })),
    reembolsos: (e.reembolsos ?? []).map(r => ({ ...r, codigo: e.pedidos.find(p => p.id === r.pedido_id)?.codigo ?? "" })),
  };
}

test("o resumo, as sessões e os reembolsos a partir dos totais do banco são os mesmos de montarVendas (a conta não mudou, só quem soma)", () => {
  const comReembolso: EntradaDasVendas = { ...entrada, reembolsos: [{ id: "r1", pedido_id: "1", remetente: "a@exemplo.com", recebido_em: "2026-11-19T14:20:00.000Z", situacao: "estornado", valor_centavos: 15000, origem: "email" }] };
  const inteira = montarVendas(comReembolso);
  const paginada = montarResumoDasVendas(totaisComoOBancoSoma(comReembolso), comReembolso);
  assert.deepEqual(paginada.resumo, inteira.resumo);
  assert.deepEqual(paginada.sessoes, inteira.sessoes);
  assert.deepEqual(paginada.reembolsos, inteira.reembolsos);
  assert.equal(paginada.reembolsos.length, 1, "a fila de reembolsos veio");
});

test("sem nenhuma venda, os totais zerados dão um resumo zerado (loja nova)", () => {
  const vazio: TotaisDasVendas = { compras_pagas: 0, vendido_centavos: 0, repasse_centavos: 0, ingressos: 0, por_sessao: [], reembolsos: [] };
  const r = montarResumoDasVendas(vazio, { ...entrada, liberadoCentavos: 0, sacadoCentavos: 0 });
  assert.deepEqual(r.resumo, { vendido_centavos: 0, ingressos: 0, compras: 0, repasse_centavos: 0, liberado_centavos: 0, retido_centavos: 0 });
  assert.ok(r.sessoes.every(s => s.vendidos === 0 && s.receita_centavos === 0), "as sessões aparecem, sem vendas");
});

test("os totais do banco chegam como texto (bigint): a conta aceita e converte", () => {
  const t = totaisComoOBancoSoma(entrada);
  const comoTexto = { ...t, vendido_centavos: String(t.vendido_centavos) as unknown as number, repasse_centavos: String(t.repasse_centavos) as unknown as number, por_sessao: t.por_sessao.map(x => ({ ...x, vendidos: String(x.vendidos) as unknown as number, receita: String(x.receita) as unknown as number })) };
  assert.deepEqual(montarResumoDasVendas(comoTexto, entrada).resumo, montarVendas(entrada).resumo);
});

test("a página de compras: só os pedidos da página, da mais recente, com os ingressos de cada um", () => {
  const pagina = montarCompras({ ...entrada, pedidos: entrada.pedidos.slice(0, 2) });
  assert.deepEqual(pagina.map(c => c.id), ["1", "2"], "da mais recente para a mais antiga");
  assert.equal(pagina[0].detalhe.ingressos.length, 3, "os ingressos do pedido 1");
  assert.equal(pagina[1].detalhe.ingressos.length, 1);
  assert.equal(montarCompras({ ...entrada, pedidos: [] }).length, 0);
});

test("a lista de compras: 'Ver mais compras' só aparece quando há mais; buscando, o botão trabalha e a tabela esmaece", () => {
  const compras = montarVendas(entrada).compras;
  const com = renderToStaticMarkup(createElement(ComprasDeVendas, { compras, filtro: "todas", haMais: true, onVerMais: () => undefined }));
  assert.match(com, /Ver mais compras/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(ComprasDeVendas, { compras, filtro: "todas" })), /Ver mais compras/, "sem mais páginas, sem o botão");
  const buscando = renderToStaticMarkup(createElement(ComprasDeVendas, { compras, filtro: "todas", haMais: true, carregando: true }));
  assert.match(buscando, /Buscando…/);
  assert.match(buscando, /opacity-60/);
  assert.match(renderToStaticMarkup(createElement(ComprasDeVendas, { compras: [], filtro: "pagas", carregando: true })), /Buscando…/, "trocando o filtro, antes da resposta, não diz 'nenhuma compra'");
});
