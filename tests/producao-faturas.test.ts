import assert from "node:assert/strict";
import test from "node:test";
import { lerValorEmReais } from "../lib/producao/bordero";
import {
  calcularFatura, faturaEmitida, gerarParcelas, lerFatura, lerParcela, liquidoDaFaturaEmCentavos, mensagemDoErroDeFatura, planilhaDasFaturas, proximaSituacaoDaFatura,
  situacaoAnteriorDaFatura, somarMeses, totaisDasFaturas, type FaturaDaTemporada, type ParcelaDaFatura,
} from "../lib/producao/faturas";

const fatura = (extra: Partial<FaturaDaTemporada> = {}): FaturaDaTemporada => ({
  id: "f", acordo_id: null, contratante: "Sesc", descricao: "Cachê", situacao: "em_aberto", valor: 10000, retencoes: 1000, nota_numero: null, emissao: null, vencimento: null, observacao: null, ...extra,
});
const parcela = (id: string, valor: number, vencimento: string, recebido_em: string | null = null): ParcelaDaFatura => ({ id, fatura_id: "f", rotulo: null, valor, vencimento, recebido_em });

test("fatura: a situação anda um passo, volta só da revisão e abre/quita travam", () => {
  assert.equal(proximaSituacaoDaFatura("rascunho"), "revisao");
  assert.equal(proximaSituacaoDaFatura("em_aberto"), "quitada");
  assert.equal(proximaSituacaoDaFatura("quitada"), null);
  assert.equal(situacaoAnteriorDaFatura("revisao"), "rascunho");
  assert.equal(situacaoAnteriorDaFatura("rascunho"), null);
  assert.equal(situacaoAnteriorDaFatura("em_aberto"), null);
  assert.deepEqual(["rascunho", "revisao", "em_aberto", "quitada"].map(s => faturaEmitida(s as never)), [false, false, true, true]);
});

test("fatura: o líquido é o valor menos as retenções", () => {
  assert.equal(liquidoDaFaturaEmCentavos({ valor: 10000, retencoes: 1000 }), 900000);
  assert.equal(liquidoDaFaturaEmCentavos({ valor: 100.5, retencoes: 0.5 }), 10000);
});

test("fatura: parcelado, recebido, a receber e atrasado", () => {
  const parcelas = [parcela("a", 4000, "2027-04-10", "2027-04-11"), parcela("b", 3000, "2027-05-10"), parcela("c", 2000, "2027-07-10")];
  const conta = calcularFatura(fatura(), parcelas, "2027-06-01");
  assert.equal(conta.liquidoCentavos, 900000);
  assert.equal(conta.parceladoCentavos, 900000);
  assert.equal(conta.recebidoCentavos, 400000);
  assert.equal(conta.aReceberCentavos, 500000);
  assert.equal(conta.atrasadoCentavos, 300000, "a de 10/05 venceu e não foi recebida");
  assert.deepEqual(conta.parcelasAtrasadas, ["b"]);
  assert.equal(conta.fecha, true);
  assert.deepEqual(conta.avisos, ["1 parcela atrasada."]);
});

test("fatura: antes de abrir nada foi cobrado, e o aviso diz o que falta parcelar", () => {
  const conta = calcularFatura(fatura({ situacao: "rascunho" }), [parcela("a", 4000, "2027-04-10")], "2027-06-01");
  assert.equal(conta.aReceberCentavos, 0);
  assert.equal(conta.atrasadoCentavos, 0);
  assert.equal(conta.faltaParcelarCentavos, 500000);
  assert.equal(conta.fecha, false);
  assert.match(conta.avisos[0], /Faltam R\$\s?5\.000,00 para parcelar/);
  assert.match(calcularFatura(fatura({ situacao: "rascunho" }), [parcela("a", 9500, "2027-04-10")], "2027-06-01").avisos[0], /passam do valor líquido em R\$\s?500,00/);
});

test("fatura: totais só contam as em aberto e quitadas", () => {
  const totais = totaisDasFaturas([
    { fatura: fatura(), parcelas: [parcela("a", 9000, "2027-04-10", "2027-04-11")] },
    { fatura: fatura({ id: "g", situacao: "em_aberto", valor: 2000, retencoes: 0 }), parcelas: [parcela("b", 2000, "2027-05-10")] },
    { fatura: fatura({ id: "h", situacao: "rascunho" }), parcelas: [parcela("c", 9000, "2027-06-10")] },
  ], "2027-06-01");
  assert.deepEqual(totais, { aReceberCentavos: 200000, recebidoCentavos: 900000, atrasadoCentavos: 200000, retidoCentavos: 100000 });
});

test("fatura: somar meses mantém o fim do mês", () => {
  assert.equal(somarMeses("2027-01-31", 1), "2027-02-28");
  assert.equal(somarMeses("2028-01-31", 1), "2028-02-29");
  assert.equal(somarMeses("2027-11-15", 3), "2028-02-15");
  assert.equal(somarMeses("2027-03-10", 0), "2027-03-10");
});

test("fatura: gerar parcelas iguais, com os centavos nas primeiras, e com sinal", () => {
  const iguais = gerarParcelas(100000, 3, "2027-04-10");
  assert.deepEqual(iguais.map(p => p.valorCentavos), [33334, 33333, 33333]);
  assert.deepEqual(iguais.map(p => p.vencimento), ["2027-04-10", "2027-05-10", "2027-06-10"]);
  assert.deepEqual(iguais.map(p => p.rotulo), ["Parcela 1", "Parcela 2", "Parcela 3"]);
  assert.equal(gerarParcelas(100000, 1, "2027-04-10")[0].rotulo, null);
  const comSinal = gerarParcelas(100000, 3, "2027-04-10", 30);
  assert.deepEqual(comSinal.map(p => [p.rotulo, p.valorCentavos]), [["Sinal", 30000], ["Parcela 2", 35000], ["Parcela 3", 35000]]);
  assert.equal(comSinal.reduce((soma, p) => soma + p.valorCentavos, 0), 100000);
  assert.deepEqual(gerarParcelas(0, 3, "2027-04-10"), []);
  assert.deepEqual(gerarParcelas(100000, 0, "2027-04-10"), []);
});

const campos = { contratante: " Sesc ", descricao: " Cachê ", valor: "10.000", retencoes: "1.000", notaNumero: "", emissao: "", vencimento: "2027-05-10", observacao: "" };

test("fatura: leitura do que a pessoa digita", () => {
  assert.deepEqual(lerFatura(campos, lerValorEmReais), { ok: true, valor: { contratante: "Sesc", descricao: "Cachê", valor: 10000, retencoes: 1000, nota_numero: null, emissao: null, vencimento: "2027-05-10", observacao: null } });
  const erro = (extra: Partial<typeof campos>) => { const r = lerFatura({ ...campos, ...extra }, lerValorEmReais); return r.ok ? "ok" : r.campo; };
  assert.equal(erro({ contratante: " " }), "contratante");
  assert.equal(erro({ descricao: "x".repeat(121) }), "descricao");
  assert.equal(erro({ valor: "0" }), "valor");
  assert.equal(erro({ retencoes: "10.001" }), "retencoes");
  assert.equal(erro({ notaNumero: "x".repeat(61) }), "notaNumero");
  assert.equal(erro({ emissao: "2027-13-40" }), "emissao");
  assert.equal(erro({ vencimento: "amanhã" }), "vencimento");
  assert.equal(erro({ retencoes: "" }), "ok", "sem retenção vale zero");
});

test("fatura: leitura da parcela", () => {
  assert.deepEqual(lerParcela({ rotulo: " Sinal ", valor: "4.000", vencimento: "2027-04-10" }, lerValorEmReais), { ok: true, valor: { rotulo: "Sinal", valor: 4000, vencimento: "2027-04-10" } });
  assert.equal((lerParcela({ rotulo: "", valor: "0", vencimento: "2027-04-10" }, lerValorEmReais) as { campo: string }).campo, "valor");
  assert.equal((lerParcela({ rotulo: "", valor: "10", vencimento: "" }, lerValorEmReais) as { campo: string }).campo, "vencimento");
  assert.equal((lerParcela({ rotulo: "x".repeat(41), valor: "10", vencimento: "2027-04-10" }, lerValorEmReais) as { campo: string }).campo, "rotulo");
});

test("fatura: planilha com uma linha por parcela, o atraso e os totais", () => {
  const planilha = planilhaDasFaturas({
    temporada: "Turnê 2027", hoje: "2027-06-01",
    faturas: [{ fatura: fatura({ nota_numero: "NF-1" }), parcelas: [parcela("a", 4500, "2027-04-10", "2027-04-11"), parcela("b", 4500, "2027-05-10")] }],
  });
  assert.ok(planilha.startsWith("﻿"));
  assert.ok(planilha.includes("Sesc;Cachê;Em aberto;NF-1;10000,00;1000,00;;4500,00;10/04/2027;Recebida em 11/04/2027"));
  assert.ok(planilha.includes("10/05/2027;Atrasada"));
  assert.ok(planilha.includes("A receber (R$);4500,00"));
  assert.ok(planilha.endsWith("Atrasado (R$);4500,00\r\n"));
});

test("fatura: mensagens do banco viram texto claro", () => {
  assert.match(mensagemDoErroDeFatura({ message: "fatura_quitada" }), /quitada/);
  assert.match(mensagemDoErroDeFatura({ message: "fatura_emitida" }), /em aberto/);
  assert.match(mensagemDoErroDeFatura({ message: "fatura_nao_emitida" }), /em aberto/);
  assert.match(mensagemDoErroDeFatura({ message: "fatura_nao_quitada" }), /recebidas/);
  assert.match(mensagemDoErroDeFatura({ message: "parcelas_nao_fecham" }), /somar o valor líquido/);
  assert.match(mensagemDoErroDeFatura({ message: "parcelas_passam_do_valor" }), /passam do valor líquido/);
  assert.match(mensagemDoErroDeFatura({ message: "fatura_situacao_invalida" }), /um passo/);
  assert.match(mensagemDoErroDeFatura({ message: "acordo_invalido" }), /a receber/);
  assert.match(mensagemDoErroDeFatura({ code: "42501" }), /permissão de dinheiro/);
  assert.match(mensagemDoErroDeFatura({ code: "23505" }), /número de nota/);
  assert.match(mensagemDoErroDeFatura({}), /Não foi possível salvar/);
});
