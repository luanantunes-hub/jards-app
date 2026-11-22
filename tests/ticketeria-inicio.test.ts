import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { montarInicio } from "../lib/ticketeria/inicio";
import { InicioView, tetoDoEixo } from "../components/ticketeria/InicioView";
import type { EntradaDasVendas, LinhaDePedido } from "../lib/ticketeria/vendas";

// 19/11/2026, 12:07 em Brasília (15:07 UTC).
const AGORA = Date.parse("2026-11-19T15:07:00.000Z");
const pedido = (id: string, situacao: string, total: number, criado: string, pago: string | null, email = `${id}@exemplo.com`): LinhaDePedido => ({
  id, codigo: `COD${id}`.padEnd(8, "X"), comprador_nome: `Comprador ${id}`, comprador_email: email, sessao_id: "s1", situacao,
  total_centavos: total, taxa_centavos: Math.round(total * 0.025), produtor_centavos: total - Math.round(total * 0.025), custo_meio_centavos: 99, custo_meio_real_centavos: 99, pago_em: pago, created_at: criado,
});
const entrada: EntradaDasVendas = {
  pedidos: [
    pedido("1", "pago", 15000, "2026-11-19T14:00:00.000Z", "2026-11-19T14:02:00.000Z", "a@exemplo.com"),   // hoje, 11:02
    pedido("2", "pago", 6000, "2026-11-19T04:00:00.000Z", "2026-11-19T04:01:00.000Z", "a@exemplo.com"),    // hoje, 01:01
    pedido("3", "pago", 9000, "2026-11-18T20:00:00.000Z", "2026-11-18T20:03:00.000Z", "c@exemplo.com"),    // ontem, 17:03
    pedido("4", "aguardando_pagamento", 6000, "2026-11-19T14:30:00.000Z", null),
    pedido("5", "cancelado", 12000, "2026-11-10T10:00:00.000Z", null),
    pedido("6", "cancelado", 3000, "2026-11-12T10:00:00.000Z", null),                                      // este foi reembolsado
    pedido("7", "pago", 4000, "2026-06-05T12:00:00.000Z", "2026-06-05T12:01:00.000Z", "d@exemplo.com"),   // meses atrás
  ],
  quantidadePorPedido: { "1": 3, "2": 1, "3": 2, "4": 1, "5": 2, "6": 1, "7": 1 },
  sessoes: [{ id: "s1", evento_id: "e1", local_id: "l1", sala_id: "sa1", inicio: "2026-11-21T23:00:00.000Z", cancelada_em: null }],
  tituloDoEvento: { e1: "Hamlet" }, fusoDoLocal: { l1: "America/Sao_Paulo" }, lugaresDaSala: { sa1: 10 },
  emitidos: [],
  reembolsos: [{ id: "r1", pedido_id: "6", remetente: "c@exemplo.com", recebido_em: "2026-11-13T10:00:00.000Z", situacao: "estornado", valor_centavos: 3000 }],
  liberadoCentavos: 1000, sacadoCentavos: 500, agora: AGORA,
};

test("hoje e ontem: valor, ingressos e a linha acumulada por hora (hoje para na hora atual)", () => {
  const { hoje } = montarInicio(entrada);
  assert.equal(hoje.vendido_centavos, 21000);
  assert.equal(hoje.ingressos, 4);
  assert.equal(hoje.ontem_vendido_centavos, 9000);
  assert.equal(hoje.ontem_ingressos, 2);
  assert.equal(hoje.hora, "12:07");
  assert.equal(hoje.serie_hoje.length, 24);
  assert.equal(hoje.serie_hoje[0], 0);
  assert.equal(hoje.serie_hoje[1], 6000, "a venda de 01:01 entra na hora 1");
  assert.equal(hoje.serie_hoje[11], 21000, "e a de 11:02 na hora 11");
  assert.equal(hoje.serie_hoje[12], 21000);
  assert.equal(hoje.serie_hoje[13], null, "depois da hora atual a linha de hoje não existe");
  assert.equal(hoje.serie_ontem[17], 9000);
  assert.equal(hoje.serie_ontem[23], 9000);
});

test("saldos e próxima sessão vêm das vendas", () => {
  const i = montarInicio(entrada);
  assert.equal(i.saldos.liberado_centavos, 1000);
  assert.equal(i.proxima?.evento, "Hamlet");
  assert.equal(i.proxima?.lugares, 10);
});

test("período 'tudo': vendas por situação, volume por mês e maiores compradores", () => {
  const t = montarInicio(entrada).periodos.tudo;
  assert.deepEqual(t.vendas.pagas, { quantidade: 4, valor_centavos: 34000 });
  assert.deepEqual(t.vendas.aguardando, { quantidade: 1, valor_centavos: 6000 });
  assert.deepEqual(t.vendas.canceladas, { quantidade: 1, valor_centavos: 12000 }, "o cancelado que foi reembolsado conta só como reembolsado");
  assert.deepEqual(t.vendas.reembolsadas, { quantidade: 1, valor_centavos: 3000 });
  assert.equal(t.vendido.total_centavos, 34000);
  assert.equal(t.vendido.serie.length, 6, "de junho a novembro");
  assert.equal(t.vendido.serie[0], 4000);
  assert.equal(t.vendido.serie[5], 30000);
  assert.equal(t.vendido.de, "jun. de 2026");
  assert.equal(t.vendido.ate, "nov. de 2026");
  assert.equal(t.ingressos.total, 7);
  assert.equal(t.compradores[0].email, "a@exemplo.com");
  assert.equal(t.compradores[0].valor_centavos, 21000);
  assert.equal(t.compradores[0].compras, 2);
  assert.ok(t.repasse_centavos > 0 && t.repasse_centavos < t.vendido.total_centavos);
});

test("período de 7 dias: um valor por dia, sem as vendas antigas", () => {
  const s = montarInicio(entrada).periodos["7d"];
  assert.equal(s.vendido.serie.length, 7);
  assert.equal(s.vendido.serie[6], 21000, "o último é hoje");
  assert.equal(s.vendido.serie[5], 9000, "o penúltimo é ontem");
  assert.equal(s.vendido.total_centavos, 30000);
  assert.deepEqual(s.vendas.pagas, { quantidade: 3, valor_centavos: 30000 });
  assert.equal(s.vendas.canceladas.quantidade, 0, "o cancelado de 10/11 está fora dos 7 dias");
  assert.equal(s.vendido.de, "13 de nov.");
  assert.equal(s.vendido.ate, "19 de nov.");
});

test("período de 30 dias tem 30 colunas e uma loja sem vendas ainda tem gráfico de duas colunas", () => {
  assert.equal(montarInicio(entrada).periodos["30d"].vendido.serie.length, 30);
  const vazio = montarInicio({ ...entrada, pedidos: [], quantidadePorPedido: {}, reembolsos: [] });
  assert.equal(vazio.tem_pedidos, false);
  assert.equal(vazio.periodos.tudo.vendido.serie.length, 2);
  assert.equal(vazio.hoje.vendido_centavos, 0);
});

test("compras não concluídas: as mais recentes sem pagamento, sem as reembolsadas", () => {
  const n = montarInicio(entrada).nao_concluidas;
  assert.deepEqual(n.map(c => c.id), ["4", "5"]);
  assert.equal(n[0].situacao, "aguardando_pagamento");
  assert.equal(n[0].quando, "19 de nov. 11:30");
  assert.equal(n[1].situacao, "cancelado");
});

test("o eixo dos gráficos tem teto redondo", () => {
  assert.equal(tetoDoEixo(0), 1);
  assert.equal(tetoDoEixo(1800), 2000);
  assert.equal(tetoDoEixo(2300), 2500);
  assert.equal(tetoDoEixo(4100), 5000);
  assert.equal(tetoDoEixo(9000), 10000);
});

test("a tela mostra hoje, ontem, saldos, os cartões da visão geral e só rótulos (sem texto explicativo)", () => {
  const dados = montarInicio(entrada);
  const html = renderToStaticMarkup(createElement(InicioView, { dados, periodo: "tudo", onPeriodo: () => {}, ver: d => createElement("a", { href: d }, "Ver tudo") }));
  for (const rotulo of ["Hoje", "Ontem", "Liberado para saque", "Retido", "Próxima sessão", "Visão geral", "Desde o início", "30 dias", "7 dias", "Vendas", "Volume vendido", "Ingressos", "Sessões", "Compras não concluídas", "Reembolsos", "Principais compradores"]) {
    if (rotulo === "Hoje") continue; // o título "Hoje" vem do cabeçalho da página
    assert.ok(html.includes(rotulo), rotulo);
  }
  assert.ok(html.includes('aria-label="Hoje"'));
  assert.ok(html.includes("Hamlet"));
  assert.ok(html.includes("a@exemplo.com"));
  assert.equal(html.includes("<svg"), true);
  assert.ok(!/\bpara\b.{0,40}\bvocê\b/i.test(html), "sem frases explicando a tela");
});
