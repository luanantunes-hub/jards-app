import assert from "node:assert/strict";
import test from "node:test";
import {
  lerIngresso, lerLote, loteDaVez, mensagemDoErroDoCatalogo, nomeDoProximoLote, ofertaNoSetor, precoDaMeia, precoParaMostrar, publicoPorPadrao, semPreco, situacaoDoLote,
} from "../lib/ticketeria/catalogo";

const FUSO = "America/Sao_Paulo";
const vazio = { inicioDia: "", inicioHora: "", fimDia: "", fimHora: "" };

test("ingresso: categoria da lista, nome e limite de 1 a 50", () => {
  assert.deepEqual(lerIngresso({ nome: " Meia-entrada ", categoria: "meia", limite: "4", publico: true }),
    { ok: true, valor: { nome: "Meia-entrada", categoria: "meia", limite_por_pedido: 4, publico: true } });
  assert.equal(lerIngresso({ nome: "x", categoria: "vip", limite: "4", publico: true }).ok, false);
  assert.equal(lerIngresso({ nome: "", categoria: "inteira", limite: "4", publico: true }).ok, false);
  for (const ruim of ["0", "51", "2,5", ""]) assert.equal(lerIngresso({ nome: "x", categoria: "inteira", limite: ruim, publico: true }).ok, false, ruim);
});

test("gratuito e cortesia não têm preço; a cortesia não aparece ao público por padrão", () => {
  assert.deepEqual([semPreco("gratuito"), semPreco("cortesia"), semPreco("social"), semPreco("inteira")], [true, true, false, false]);
  assert.deepEqual([publicoPorPadrao("cortesia"), publicoPorPadrao("gratuito")], [false, true]);
});

test("lote: preço em reais vira centavos; zero só em gratuito e cortesia", () => {
  assert.deepEqual(lerLote({ nome: "1º lote", preco: "50", quantidade: "1.200", ...vazio }, "inteira", FUSO),
    { ok: true, valor: { nome: "1º lote", preco_centavos: 5000, quantidade: 1200, vendas_inicio: null, vendas_fim: null } });
  const meia = lerLote({ nome: "1º lote", preco: "25,50", quantidade: "10", ...vazio }, "meia", FUSO);
  assert.ok(meia.ok && meia.valor.preco_centavos === 2550);
  assert.equal(lerLote({ nome: "x", preco: "0", quantidade: "10", ...vazio }, "inteira", FUSO).ok, false, "inteira de graça não");
  assert.equal(lerLote({ nome: "x", preco: "", quantidade: "10", ...vazio }, "social", FUSO).ok, false);
  const cortesia = lerLote({ nome: "Cortesias", preco: "", quantidade: "20", ...vazio }, "cortesia", FUSO);
  assert.ok(cortesia.ok && cortesia.valor.preco_centavos === 0);
  assert.equal(lerLote({ nome: "x", preco: "10", quantidade: "20", ...vazio }, "gratuito", FUSO).ok, false, "gratuito com preço não");
  assert.equal(lerLote({ nome: "x", preco: "100001", quantidade: "1", ...vazio }, "inteira", FUSO).ok, false);
  for (const ruim of ["0", "-1", "abc", "200001"]) assert.equal(lerLote({ nome: "x", preco: "10", quantidade: ruim, ...vazio }, "inteira", FUSO).ok, false, ruim);
});

test("lote: a janela de venda no fuso do local, com o fim depois do começo", () => {
  const janela = lerLote({ nome: "1º lote", preco: "50", quantidade: "10", inicioDia: "2026-11-20", inicioHora: "10:00", fimDia: "2026-11-30", fimHora: "" }, "inteira", FUSO);
  assert.ok(janela.ok);
  assert.deepEqual(janela.ok && [janela.valor.vendas_inicio, janela.valor.vendas_fim], ["2026-11-20T13:00:00.000Z", "2026-11-30T03:00:00.000Z"]);
  assert.equal(lerLote({ nome: "x", preco: "50", quantidade: "10", inicioDia: "2026-11-30", inicioHora: "10:00", fimDia: "2026-11-20", fimHora: "10:00" }, "inteira", FUSO).ok, false);
  assert.equal(lerLote({ nome: "x", preco: "50", quantidade: "10", inicioDia: "", inicioHora: "10:00", fimDia: "", fimHora: "" }, "inteira", FUSO).ok, false, "hora sem dia");
});

test("meia é metade da inteira; nome do próximo lote; preço para mostrar", () => {
  assert.deepEqual([precoDaMeia(5000), precoDaMeia(4999)], [2500, 2500]);
  assert.equal(nomeDoProximoLote(1), "2º lote");
  assert.equal(precoParaMostrar(0), "Grátis");
  assert.equal(precoParaMostrar(5000), "R$ 50,00");
});

test("a janela do lote e o lote da vez, na ordem", () => {
  const agora = Date.parse("2026-11-25T12:00:00Z");
  const primeiro = { ordem: 0, vendas_inicio: "2026-11-01T00:00:00Z", vendas_fim: "2026-11-20T00:00:00Z" };
  const segundo = { ordem: 1, vendas_inicio: null, vendas_fim: null };
  const terceiro = { ordem: 2, vendas_inicio: "2026-12-01T00:00:00Z", vendas_fim: null };
  assert.deepEqual([primeiro, segundo, terceiro].map(l => situacaoDoLote(l, agora)), ["encerrado", "na_janela", "antes"]);
  assert.equal(loteDaVez([terceiro, segundo, primeiro], agora), segundo);
  assert.equal(loteDaVez([primeiro], agora), null);
});

test("a oferta do setor: os lotes dos ingressos em uso nele", () => {
  const ingressos = [{ id: "i1", setor_id: "s1", arquivado: false }, { id: "i2", setor_id: "s1", arquivado: true }, { id: "i3", setor_id: "s2", arquivado: false }];
  const lotes = [{ ingresso_id: "i1", quantidade: 60 }, { ingresso_id: "i1", quantidade: 20 }, { ingresso_id: "i2", quantidade: 50 }, { ingresso_id: "i3", quantidade: 10 }];
  assert.deepEqual(ofertaNoSetor({ id: "s1", lugares: 100 }, ingressos, lotes), { lugares: 100, ofertados: 80, livres: 20 });
  assert.deepEqual(ofertaNoSetor({ id: "s1", lugares: 50 }, ingressos, lotes), { lugares: 50, ofertados: 80, livres: -30 }, "o setor diminuído depois mostra o que passou");
});

test("os erros do banco viram frases", () => {
  assert.match(mensagemDoErroDoCatalogo({ message: "lugares_excedidos" }), /lugares do setor/);
  assert.match(mensagemDoErroDoCatalogo({ message: "preco_incoerente" }), /combina/);
  assert.match(mensagemDoErroDoCatalogo({ code: "42501" }), /não pode/);
});
