import assert from "node:assert/strict";
import test from "node:test";
import { lerValorEmReais } from "../lib/producao/bordero";
import {
  lerPedido, mensagemDoErroDePedido, passosDoPedido, pedidoApagavel, pedidoEditavel, pendenciaEditavel, pendenciaVencida, planilhaDosPedidos, resumoDoPedido,
  totaisDosPedidos, type PedidoDaTemporada,
} from "../lib/producao/pedidos";

const pedido = (extra: Partial<PedidoDaTemporada> = {}): PedidoDaTemporada => ({
  id: "p", orcamento_linha_id: null, solicitante_id: null, descricao: "Cachê do diretor", favorecido: "Fulano", valor: 5000, justificativa: null, situacao: "rascunho",
  aprovado_por: null, aprovado_em: null, motivo_recusa: null, pendencia: null, pendencia_ate: null, ...extra,
});

test("pedido: os passos que a tela oferece, por situação e por quem", () => {
  const editor = { podeEditar: true, podeAprovar: false };
  const aprovador = { podeEditar: false, podeAprovar: true };
  const admin = { podeEditar: true, podeAprovar: true };
  const leitor = { podeEditar: false, podeAprovar: false };
  assert.deepEqual(passosDoPedido("rascunho", editor), ["enviar"]);
  assert.deepEqual(passosDoPedido("rascunho", aprovador), []);
  assert.deepEqual(passosDoPedido("pendente", editor), ["retirar"]);
  assert.deepEqual(passosDoPedido("pendente", aprovador), ["aprovar", "recusar"]);
  assert.deepEqual(passosDoPedido("pendente", admin), ["aprovar", "recusar", "retirar"]);
  assert.deepEqual(passosDoPedido("aprovado", editor), ["pagar"]);
  assert.deepEqual(passosDoPedido("pagando", editor), ["concluir"]);
  assert.deepEqual(passosDoPedido("recusado", editor), ["reabrir"]);
  assert.deepEqual(passosDoPedido("pago", admin), []);
  for (const situacao of ["rascunho", "pendente", "aprovado", "pagando", "pago", "recusado"] as const) assert.deepEqual(passosDoPedido(situacao, leitor), [], situacao);
});

test("pedido: o que se edita, o que se apaga e a pendência", () => {
  assert.deepEqual((["rascunho", "pendente", "aprovado", "pagando", "pago", "recusado"] as const).map(pedidoEditavel), [true, false, false, false, false, false]);
  assert.deepEqual((["rascunho", "pendente", "aprovado", "pagando", "pago", "recusado"] as const).map(pedidoApagavel), [true, false, false, false, false, true]);
  assert.deepEqual((["rascunho", "pendente", "aprovado", "pagando", "pago", "recusado"] as const).map(pendenciaEditavel), [true, true, true, true, false, true]);
});

test("pedido: pendência vencida só conta enquanto o pedido está andando", () => {
  const base = { pendencia: "Falta a nota", pendencia_ate: "2027-05-01" };
  assert.equal(pendenciaVencida(pedido({ ...base, situacao: "aprovado" }), "2027-06-01"), true);
  assert.equal(pendenciaVencida(pedido({ ...base, situacao: "aprovado" }), "2027-04-01"), false);
  assert.equal(pendenciaVencida(pedido({ ...base, situacao: "pago" }), "2027-06-01"), false);
  assert.equal(pendenciaVencida(pedido({ ...base, situacao: "recusado" }), "2027-06-01"), false);
  assert.equal(pendenciaVencida(pedido({ pendencia: null, pendencia_ate: "2027-05-01" }), "2027-06-01"), false);
  assert.equal(pendenciaVencida(pedido({ pendencia: "Sem data", pendencia_ate: null }), "2027-06-01"), false);
});

test("pedido: totais do que espera, do que está aprovado e a pagar e do pago", () => {
  const totais = totaisDosPedidos([
    pedido({ valor: 100, situacao: "pendente" }), pedido({ valor: 200.5, situacao: "pendente" }), pedido({ valor: 300, situacao: "aprovado", pendencia: "x", pendencia_ate: "2027-01-01" }),
    pedido({ valor: 400, situacao: "pagando" }), pedido({ valor: 500, situacao: "pago" }), pedido({ valor: 999, situacao: "recusado" }), pedido({ valor: 888, situacao: "rascunho" }),
  ], "2027-06-01");
  assert.deepEqual(totais, { aguardandoCentavos: 30050, aprovadoAPagarCentavos: 70000, pagoCentavos: 50000, pendenciasVencidas: 1 });
});

const campos = { descricao: " Cachê do diretor ", favorecido: " Fulano ", valor: "5.000", justificativa: "", pendencia: "", pendenciaAte: "" };

test("pedido: leitura do que a pessoa digita", () => {
  assert.deepEqual(lerPedido(campos, lerValorEmReais), { ok: true, valor: { descricao: "Cachê do diretor", favorecido: "Fulano", valor: 5000, justificativa: null, pendencia: null, pendencia_ate: null } });
  assert.deepEqual(lerPedido({ ...campos, pendencia: "Falta a nota", pendenciaAte: "2027-05-01" }, lerValorEmReais), { ok: true, valor: { descricao: "Cachê do diretor", favorecido: "Fulano", valor: 5000, justificativa: null, pendencia: "Falta a nota", pendencia_ate: "2027-05-01" } });
  assert.equal((lerPedido({ ...campos, pendenciaAte: "2027-05-01" }, lerValorEmReais) as { valor: { pendencia_ate: string | null } }).valor.pendencia_ate, null, "data sem texto da pendência não vale");
  const erro = (extra: Partial<typeof campos>) => { const r = lerPedido({ ...campos, ...extra }, lerValorEmReais); return r.ok ? "ok" : r.campo; };
  assert.equal(erro({ descricao: " " }), "descricao");
  assert.equal(erro({ descricao: "x".repeat(121) }), "descricao");
  assert.equal(erro({ favorecido: "x".repeat(121) }), "favorecido");
  assert.equal(erro({ valor: "0" }), "valor");
  assert.equal(erro({ valor: "abc" }), "valor");
  assert.equal(erro({ justificativa: "x".repeat(401) }), "justificativa");
  assert.equal(erro({ pendencia: "x".repeat(201) }), "pendencia");
  assert.equal(erro({ pendencia: "ok", pendenciaAte: "31/12" }), "pendenciaAte");
});

test("pedido: planilha e frase da lista", () => {
  const planilha = planilhaDosPedidos({
    temporada: "Turnê 2027", hoje: "2027-06-01", rotuloDaLinha: () => "Cachê · Elenco",
    pedidos: [pedido({ situacao: "pendente", orcamento_linha_id: "l", pendencia: "Falta a nota; urgente", pendencia_ate: "2027-05-01" }), pedido({ id: "q", descricao: "Táxi", favorecido: null, valor: 80, situacao: "recusado", motivo_recusa: "Sem verba" })],
  });
  assert.ok(planilha.startsWith("﻿"));
  assert.ok(planilha.includes("Cachê do diretor;Fulano;5000,00;Aguardando aprovação;Cachê · Elenco;\"Falta a nota; urgente\";01/05/2027;"));
  assert.ok(planilha.includes("Táxi;;80,00;Recusado;;;;Sem verba"));
  assert.ok(planilha.includes("Aguardando aprovação (R$);5000,00"));
  assert.match(resumoDoPedido(pedido({ situacao: "aprovado" })), /R\$\s?5\.000,00 para Fulano · aprovado/);
  assert.match(resumoDoPedido(pedido({ favorecido: null })), /^R\$\s?5\.000,00 · rascunho$/);
});

test("pedido: mensagens do banco viram texto claro", () => {
  assert.match(mensagemDoErroDePedido({ message: "alcada_insuficiente" }), /passa da sua alçada/);
  assert.match(mensagemDoErroDePedido({ message: "pedido_sem_lancamento" }), /lançamentos ligados/);
  assert.match(mensagemDoErroDePedido({ message: "pedido_sem_motivo" }), /motivo da recusa/);
  assert.match(mensagemDoErroDePedido({ message: "pedido_pago" }), /pago: nada muda/);
  assert.match(mensagemDoErroDePedido({ message: "pedido_enviado" }), /Depois de enviado/);
  assert.match(mensagemDoErroDePedido({ message: "pedido_passo_invalido" }), /Esse passo/);
  assert.match(mensagemDoErroDePedido({ message: "sem_permissao", code: "42501" }), /alçada/);
  assert.match(mensagemDoErroDePedido({ code: "42501" }), /permissão de dinheiro/);
  assert.match(mensagemDoErroDePedido({}), /Não foi possível salvar/);
});
