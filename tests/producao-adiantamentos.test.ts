import assert from "node:assert/strict";
import test from "node:test";
import { lerValorEmReais } from "../lib/producao/bordero";
import {
  contaDoAdiantamento, diasDoPeriodo, lerAdiantamento, lerDiaria, lerGasto, mensagemDoErroDeAdiantamento, planilhaDasDiarias, planilhaDosAdiantamentos, textoDaPrestacao,
  textoDoReciboDaDiaria, totaisDasDiarias, totalDaDiariaEmCentavos, totalEmAberto, type AdiantamentoDaTemporada, type DiariaDaTemporada, type GastoDoAdiantamento,
} from "../lib/producao/adiantamentos";

const adiantamento = (extra: Partial<AdiantamentoDaTemporada> = {}): AdiantamentoDaTemporada => ({ id: "a", pessoa_id: "p", descricao: "Verba da estrada", valor: 1000, data: "2027-03-01", devolvido: 0, situacao: "aberto", observacao: null, ...extra });
const gasto = (valor: number, data = "2027-03-03", extra: Partial<GastoDoAdiantamento> = {}): GastoDoAdiantamento => ({ id: `g${valor}${data}`, adiantamento_id: "a", descricao: "Combustível", valor, data, documento: null, ...extra });
const diaria = (extra: Partial<DiariaDaTemporada> = {}): DiariaDaTemporada => ({ id: "d", pessoa_id: "p", de: "2027-03-01", ate: "2027-03-05", dias: 5, valor_dia: 200, recibo: null, pago_em: null, observacao: null, ...extra });

test("adiantamento: o saldo é o valor menos o prestado menos o devolvido", () => {
  const conta = contaDoAdiantamento(adiantamento({ devolvido: 100 }), [gasto(300), gasto(250.5)]);
  assert.equal(conta.valorCentavos, 100000);
  assert.equal(conta.prestadoCentavos, 55050);
  assert.equal(conta.devolvidoCentavos, 10000);
  assert.equal(conta.saldoCentavos, 34950);
  assert.equal(conta.encerravel, false);
  assert.match(conta.avisos[0], /Falta prestar ou devolver R\$\s?349,50/);
});

test("adiantamento: encerra só com o saldo zerado e avisa quando passa", () => {
  const zerado = contaDoAdiantamento(adiantamento({ devolvido: 700 }), [gasto(300)]);
  assert.equal(zerado.saldoCentavos, 0);
  assert.equal(zerado.encerravel, true);
  assert.deepEqual(zerado.avisos, []);
  assert.equal(contaDoAdiantamento(adiantamento({ situacao: "encerrado", devolvido: 700 }), [gasto(300)]).encerravel, false, "já encerrado");
  const passa = contaDoAdiantamento(adiantamento(), [gasto(1200)]);
  assert.equal(passa.saldoCentavos, -20000);
  assert.match(passa.avisos[0], /passam do valor entregue em R\$\s?200,00/);
  assert.deepEqual(contaDoAdiantamento(adiantamento(), []).avisos, [], "sem prestação ainda, sem aviso");
});

test("adiantamento: o que está com as pessoas é a soma dos saldos dos abertos", () => {
  assert.equal(totalEmAberto([
    { adiantamento: adiantamento(), gastos: [gasto(300)] },
    { adiantamento: adiantamento({ valor: 500 }), gastos: [] },
    { adiantamento: adiantamento({ valor: 800, situacao: "encerrado" }), gastos: [gasto(800)] },
  ]), 70000 + 50000);
});

const camposAdi = { pessoaId: "p", descricao: " Verba da estrada ", valor: "1.000", data: "2027-03-01", devolvido: "", observacao: "" };

test("adiantamento: leitura do que a pessoa digita", () => {
  assert.deepEqual(lerAdiantamento(camposAdi, lerValorEmReais), { ok: true, valor: { pessoa_id: "p", descricao: "Verba da estrada", valor: 1000, data: "2027-03-01", devolvido: 0, observacao: null } });
  const erro = (extra: Partial<typeof camposAdi>) => { const r = lerAdiantamento({ ...camposAdi, ...extra }, lerValorEmReais); return r.ok ? "ok" : r.campo; };
  assert.equal(erro({ pessoaId: "" }), "pessoaId");
  assert.equal(erro({ descricao: " " }), "descricao");
  assert.equal(erro({ valor: "0" }), "valor");
  assert.equal(erro({ data: "" }), "data");
  assert.equal(erro({ devolvido: "2.000" }), "devolvido");
  assert.equal(erro({ observacao: "x".repeat(301) }), "observacao");
});

test("adiantamento: leitura do gasto, prestação em texto e planilha", () => {
  assert.deepEqual(lerGasto({ descricao: " Combustível ", valor: "300", data: "2027-03-03", documento: " NF 12 " }, lerValorEmReais), { ok: true, valor: { descricao: "Combustível", valor: 300, data: "2027-03-03", documento: "NF 12" } });
  assert.equal((lerGasto({ descricao: "", valor: "10", data: "2027-03-03", documento: "" }, lerValorEmReais) as { campo: string }).campo, "descricao");
  assert.equal((lerGasto({ descricao: "x", valor: "0", data: "2027-03-03", documento: "" }, lerValorEmReais) as { campo: string }).campo, "valor");
  assert.equal((lerGasto({ descricao: "x", valor: "10", data: "03/03", documento: "" }, lerValorEmReais) as { campo: string }).campo, "data");
  const texto = textoDaPrestacao({ pessoa: "Pessoa Um", adiantamento: adiantamento({ devolvido: 100 }), gastos: [gasto(250, "2027-03-05", { documento: "NF 9" }), gasto(300)] });
  assert.match(texto, /Prestação de contas: Verba da estrada — Pessoa Um/);
  assert.match(texto, /03\/03\/2027 · Combustível: R\$\s?300,00\n\s+05\/03\/2027 · Combustível \(NF 9\): R\$\s?250,00/, "em ordem de data");
  assert.match(texto, /Devolvido: R\$\s?100,00/);
  assert.match(texto, /Saldo: R\$\s?350,00$/);
  const planilha = planilhaDosAdiantamentos({ temporada: "Turnê", itens: [{ pessoa: "Pessoa Um", adiantamento: adiantamento(), gastos: [gasto(300)] }] });
  assert.ok(planilha.startsWith("﻿"));
  assert.ok(planilha.includes("Pessoa Um;Verba da estrada;01/03/2027;1000,00;300,00;0,00;700,00;Aberto"));
});

test("diária: dias do período, total e totais", () => {
  assert.equal(diasDoPeriodo("2027-03-01", "2027-03-05"), 5);
  assert.equal(diasDoPeriodo("2027-03-05", "2027-03-05"), 1);
  assert.equal(diasDoPeriodo("2027-03-05", "2027-03-01"), 0);
  assert.equal(diasDoPeriodo("2027-02-27", "2027-03-02"), 4, "atravessa o mês");
  assert.equal(diasDoPeriodo("", "2027-03-02"), 0);
  assert.equal(totalDaDiariaEmCentavos(diaria({ dias: 3, valor_dia: 150.5 })), 45150);
  assert.deepEqual(totaisDasDiarias([diaria(), diaria({ dias: 2, valor_dia: 100, recibo: "R1", pago_em: "2027-03-20" })]), { totalCentavos: 120000, pagoCentavos: 20000, aPagarCentavos: 100000, dias: 7 });
});

const camposDia = { pessoaId: "p", de: "2027-03-01", ate: "2027-03-05", dias: "", valorDia: "200", recibo: "", pagoEm: "", observacao: "" };

test("diária: leitura do que a pessoa digita", () => {
  assert.deepEqual(lerDiaria(camposDia, lerValorEmReais), { ok: true, valor: { pessoa_id: "p", de: "2027-03-01", ate: "2027-03-05", dias: 5, valor_dia: 200, recibo: null, pago_em: null, observacao: null } });
  assert.equal((lerDiaria({ ...camposDia, dias: "3" }, lerValorEmReais) as { valor: { dias: number } }).valor.dias, 3, "menos dias que o período (folgas)");
  assert.equal((lerDiaria({ ...camposDia, recibo: "R-1", pagoEm: "2027-03-20" }, lerValorEmReais) as { valor: { pago_em: string } }).valor.pago_em, "2027-03-20");
  const erro = (extra: Partial<typeof camposDia>) => { const r = lerDiaria({ ...camposDia, ...extra }, lerValorEmReais); return r.ok ? "ok" : r.campo; };
  assert.equal(erro({ pessoaId: "" }), "pessoaId");
  assert.equal(erro({ de: "" }), "de");
  assert.equal(erro({ ate: "2027-02-01" }), "ate");
  assert.equal(erro({ ate: "2029-03-05" }), "ate", "mais de 366 dias");
  assert.equal(erro({ dias: "6" }), "dias");
  assert.equal(erro({ dias: "0" }), "dias");
  assert.equal(erro({ valorDia: "abc" }), "valorDia");
  assert.equal(erro({ pagoEm: "2027-03-20" }), "recibo", "pagar pede o recibo");
  assert.equal(erro({ recibo: "x".repeat(61) }), "recibo");
});

test("diária: recibo em texto e planilha", () => {
  const recibo = textoDoReciboDaDiaria({ pessoa: "Pessoa Um", temporada: "Turnê 2027", diaria: diaria({ recibo: "R-7", pago_em: "2027-03-20" }) });
  assert.match(recibo, /Recibo nº R-7/);
  assert.match(recibo, /Recebi o valor de R\$\s?1\.000,00, referente a 5 diárias de R\$\s?200,00, de 01\/03\/2027 a 05\/03\/2027, na temporada "Turnê 2027"\./);
  assert.match(recibo, /Nome: Pessoa Um/);
  assert.match(recibo, /Pago em 20\/03\/2027\./);
  assert.match(textoDoReciboDaDiaria({ pessoa: "P", temporada: "T", diaria: diaria({ dias: 1, de: "2027-03-01", ate: "2027-03-01" }) }), /1 diária de/);
  assert.match(textoDoReciboDaDiaria({ pessoa: "P", temporada: "T", diaria: diaria() }), /Pagamento: ______/);
  const planilha = planilhaDasDiarias({ temporada: "Turnê", itens: [{ pessoa: "Pessoa Um", diaria: diaria({ recibo: "R-7", pago_em: "2027-03-20" }) }, { pessoa: "Pessoa Dois", diaria: diaria({ dias: 2, valor_dia: 100 }) }] });
  assert.ok(planilha.includes("Pessoa Um;01/03/2027;05/03/2027;5;200,00;1000,00;R-7;20/03/2027"));
  assert.ok(planilha.endsWith("A pagar (R$);200,00\r\n"));
});

test("adiantamento e diária: mensagens do banco viram texto claro", () => {
  assert.match(mensagemDoErroDeAdiantamento({ message: "adiantamento_encerrado" }), /encerrado/);
  assert.match(mensagemDoErroDeAdiantamento({ message: "adiantamento_com_saldo" }), /saldo zerado/);
  assert.match(mensagemDoErroDeAdiantamento({ message: "prestacao_passa_do_adiantamento" }), /passam do valor entregue/);
  assert.match(mensagemDoErroDeAdiantamento({ message: "diaria_paga" }), /paga/);
  assert.match(mensagemDoErroDeAdiantamento({ message: "diaria_sem_recibo" }), /recibo/);
  assert.match(mensagemDoErroDeAdiantamento({ message: "diaria_sobreposta" }), /se cruza/);
  assert.match(mensagemDoErroDeAdiantamento({ message: "dias_ou_periodo_invalido" }), /Confira o período/);
  assert.match(mensagemDoErroDeAdiantamento({ code: "42501" }), /permissão de dinheiro/);
  assert.match(mensagemDoErroDeAdiantamento({ code: "23503" }), /arquive/);
  assert.match(mensagemDoErroDeAdiantamento({}), /Não foi possível salvar/);
});
