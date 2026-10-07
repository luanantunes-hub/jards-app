import assert from "node:assert/strict";
import test from "node:test";
import type { EstadoDaPrestacao } from "../lib/prestacao/checagens";
import {
  aniversarioDaPoupanca,
  aniversarios,
  atualizacaoContinuaValida,
  atualizarPelaPoupanca,
  camposDaGuia,
  competenciaDe,
  erroDaDevolucao,
  guiasDoRegime,
  indiceDoMotivo,
  janelasDaConsulta,
  recolhimentoDoEncerramento,
  referenciaDaGuia,
  situacaoDaDevolucao,
  somarMeses,
  taxasDaSerie,
  valorParaAGuia,
  type CamposDaDevolucao,
  type DevolucaoParaGuia,
} from "../lib/prestacao/devolucoes";
import { checklistDeEnvio, type DadosDoChecklist, type DevolucaoDoChecklist } from "../lib/prestacao/envio";
import { regimePorCodigo } from "../lib/prestacao/regimes";

const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const ANCINE = regimePorCodigo("ancine_in159_2021")!;
const LIE = regimePorCodigo("lie_p10_2026")!;
const SAUDE = regimePorCodigo("pronon_pronas_lxxxvi_a_2025")!;

test("aniversário da poupança: dias 29, 30 e 31 passam para o dia 1º do mês seguinte", () => {
  assert.equal(aniversarioDaPoupanca("2026-01-15"), "2026-01-15");
  assert.equal(aniversarioDaPoupanca("2026-01-28"), "2026-01-28");
  assert.equal(aniversarioDaPoupanca("2026-01-29"), "2026-02-01");
  assert.equal(aniversarioDaPoupanca("2026-03-31"), "2026-04-01");
  assert.equal(aniversarioDaPoupanca("2026-12-30"), "2027-01-01");
  assert.equal(somarMeses("2026-11-10", 3), "2027-02-10");
});

test("aniversários: só os meses cheios até a data", () => {
  assert.deepEqual(aniversarios("2026-01-15", "2026-03-14"), ["2026-01-15"]);
  assert.deepEqual(aniversarios("2026-01-15", "2026-03-15"), ["2026-01-15", "2026-02-15"]);
  assert.deepEqual(aniversarios("2026-01-15", "2026-02-14"), []);
  assert.deepEqual(aniversarios("2026-01-30", "2026-03-01"), ["2026-02-01"]);
});

test("atualização pela poupança: produto das taxas dos meses cheios", () => {
  const taxas = [
    { data: "2026-01-15", valor: 0.5 },
    { data: "2026-02-15", valor: 0.6 },
    { data: "2026-03-15", valor: 0.7 },
  ];
  const a = atualizarPelaPoupanca(100_000, "2026-01-15", "2026-03-20", taxas);
  assert.equal(a.meses, 2);
  assert.equal(a.de, "2026-01-15");
  assert.equal(a.ate, "2026-03-15");
  assert.ok(Math.abs(a.fator - 1.005 * 1.006) < 1e-12);
  assert.equal(a.valor, 101_103);
  assert.deepEqual(a.faltando, []);

  // Sem mês cheio, não rende.
  const curta = atualizarPelaPoupanca(100_000, "2026-01-15", "2026-02-10", taxas);
  assert.equal(curta.meses, 0);
  assert.equal(curta.fator, 1);
  assert.equal(curta.valor, 100_000);
  assert.equal(curta.ate, "2026-01-15");

  // Aniversário sem taxa na série fica apontado.
  const semTaxa = atualizarPelaPoupanca(100_000, "2026-01-15", "2026-05-15", taxas);
  assert.equal(semTaxa.meses, 4);
  assert.deepEqual(semTaxa.faltando, ["2026-04-15"]);
});

test("índice do motivo: saldo e rendimentos sem atualização; irregular pelo índice do regime", () => {
  assert.equal(indiceDoMotivo(ROUANET, "saldo"), "nenhum");
  assert.equal(indiceDoMotivo(ROUANET, "rendimento"), "nenhum");
  assert.equal(indiceDoMotivo(ROUANET, "glosa"), "poupanca");
  assert.equal(indiceDoMotivo(ROUANET, "reprovacao"), "poupanca");
  assert.equal(indiceDoMotivo(SAUDE, "reprovacao"), "poupanca");
  assert.equal(indiceDoMotivo(ANCINE, "glosa"), "selic");
  assert.equal(indiceDoMotivo(LIE, "reprovacao"), "outro");
  assert.equal(indiceDoMotivo(null, "glosa"), "nenhum");
});

test("guias do regime: Rouanet ao FNC, ANCINE por fonte, LIE a confirmar, saúde sem guia fixa", () => {
  const rouanet = guiasDoRegime(ROUANET);
  assert.equal(rouanet.length, 1);
  assert.equal(rouanet[0].unidadeGestora, "340034");
  assert.equal(rouanet[0].codigo, "019473");
  assert.equal(guiasDoRegime(ANCINE).length, 4);
  const lie = guiasDoRegime(LIE);
  assert.equal(lie[0].gestao, "00001");
  assert.equal(lie[0].fonte.aConfirmar, true);
  assert.deepEqual(guiasDoRegime(SAUDE), []);
  assert.deepEqual(guiasDoRegime(null), []);
});

test("referência e valor da guia", () => {
  assert.equal(referenciaDaGuia("26-9999/1"), "2699991");
  assert.equal(referenciaDaGuia("58000.012345/2026-11"), "58000012345202611");
  assert.equal(referenciaDaGuia(" "), null);
  assert.equal(referenciaDaGuia(null), null);
  assert.equal(valorParaAGuia(123_456), "1234,56");
  assert.equal(valorParaAGuia(5), "0,05");
  assert.equal(valorParaAGuia(100_000), "1000,00");
});

const guia = (campos: Partial<DevolucaoParaGuia> = {}): DevolucaoParaGuia => ({
  valor_principal: 1500, valor_atualizado: null, gru_unidade_gestora: "340034", gru_gestao: null, gru_codigo: "019473",
  gru_referencia: "269999", competencia: "10/2026", vencimento: "2026-10-30", ...campos,
});

test("campos da guia: na ordem do PagTesouro, com o total atualizado", () => {
  const campos = camposDaGuia(guia({ valor_atualizado: 1532.1 }), { nome: "Instituto Teste", documento: "12.345.678/0001-95" });
  assert.deepEqual(campos.map(c => c.rotulo), [
    "Unidade gestora (UG)", "Código de recolhimento", "Número de referência", "Competência", "Vencimento",
    "CNPJ ou CPF do contribuinte", "Nome do contribuinte", "Valor principal", "Valor total",
  ]);
  const valor = Object.fromEntries(campos.map(c => [c.rotulo, c.valor]));
  assert.equal(valor["Vencimento"], "30/10/2026");
  assert.equal(valor["CNPJ ou CPF do contribuinte"], "12345678000195");
  assert.equal(valor["Valor principal"], "1500,00");
  assert.equal(valor["Valor total"], "1532,10");

  // Gestão aparece quando o regime a define; sem contribuinte, os campos ficam vazios.
  const lie = camposDaGuia(guia({ gru_unidade_gestora: "180076", gru_gestao: "00001", gru_codigo: "18004-1" }), null);
  assert.equal(lie[1].rotulo, "Gestão");
  assert.equal(lie[1].valor, "00001");
  assert.equal(Object.fromEntries(lie.map(c => [c.rotulo, c.valor]))["Nome do contribuinte"], null);
  assert.equal(Object.fromEntries(lie.map(c => [c.rotulo, c.valor]))["Valor total"], "1500,00");
});

test("situação: paga, vencida ou a pagar", () => {
  const base = { situacao: "a_pagar" as const, pago_em: null, vencimento: "2026-10-30", valor_pago: null };
  assert.deepEqual(situacaoDaDevolucao(base, "2026-10-07"), { estado: "a_pagar", texto: "A pagar até 30/10/2026" });
  assert.deepEqual(situacaoDaDevolucao(base, "2026-10-31"), { estado: "vencida", texto: "Venceu em 30/10/2026" });
  assert.equal(situacaoDaDevolucao({ ...base, vencimento: null }, "2026-10-31").texto, "A pagar");
  const paga = situacaoDaDevolucao({ situacao: "paga", pago_em: "2026-10-20", vencimento: "2026-10-30", valor_pago: 1500 }, "2026-11-10");
  assert.equal(paga.estado, "paga");
  assert.equal(paga.texto.replace(/ /g, " "), "Paga em 20/10/2026, R$ 1.500,00");
});

const campos = (c: Partial<CamposDaDevolucao> = {}): CamposDaDevolucao => ({
  motivo: "saldo", descricao: null, valor_principal: 100, indice: "nenhum", data_base: null, competencia: null,
  vencimento: null, situacao: "a_pagar", pago_em: null, valor_pago: null, observacoes: null, ...c,
});

test("erro da devolução: o mesmo que o banco confere", () => {
  assert.equal(erroDaDevolucao(campos()), null);
  assert.equal(erroDaDevolucao(campos({ valor_principal: 0 })), "Informe o valor a devolver.");
  assert.equal(erroDaDevolucao(campos({ indice: "poupanca" })), "Informe a data-base da atualização.");
  assert.equal(erroDaDevolucao(campos({ indice: "poupanca", data_base: "2026-01-15" })), null);
  assert.equal(erroDaDevolucao(campos({ competencia: "13/2026" })), "A competência é mês e ano: MM/AAAA.");
  assert.equal(erroDaDevolucao(campos({ competencia: "10/2026" })), null);
  assert.equal(erroDaDevolucao(campos({ situacao: "paga" })), "Informe a data e o valor pagos.");
  assert.equal(erroDaDevolucao(campos({ situacao: "paga", pago_em: "2026-10-07", valor_pago: 100 })), null);
  assert.equal(erroDaDevolucao(campos({ descricao: "x".repeat(501) })), "A descrição tem até 500 caracteres.");
});

test("atualização gravada perde a validade quando muda o principal, o índice ou a data-base", () => {
  const base = { valor_principal: 1500, indice: "poupanca" as const, data_base: "2026-01-15" };
  assert.equal(atualizacaoContinuaValida(base, { ...base, valor_principal: 1500.001 }), true);
  assert.equal(atualizacaoContinuaValida(base, { ...base, valor_principal: 1600 }), false);
  assert.equal(atualizacaoContinuaValida(base, { ...base, indice: "selic" }), false);
  assert.equal(atualizacaoContinuaValida(base, { ...base, data_base: "2026-02-01" }), false);
  assert.equal(competenciaDe("2026-10-07"), "10/2026");
});

test("série 195 do Banco Central e janelas da consulta", () => {
  assert.deepEqual(taxasDaSerie([
    { data: "01/01/2026", dataFim: "01/02/2026", valor: "0.6727" },
    { data: "02/01/2026", valor: "0,6728" },
    { data: "2026-01-03", valor: "0.6" },
    { data: "04/01/2026", valor: "x" },
  ]), [{ data: "2026-01-01", valor: 0.6727 }, { data: "2026-01-02", valor: 0.6728 }]);
  assert.deepEqual(taxasDaSerie({ erro: "404" }), []);

  assert.deepEqual(janelasDaConsulta("2015-03-10", "2026-10-07"), [
    { de: "2015-03-10", ate: "2020-03-09" },
    { de: "2020-03-10", ate: "2025-03-09" },
    { de: "2025-03-10", ate: "2026-10-07" },
  ]);
  assert.deepEqual(janelasDaConsulta("2020-02-29", "2026-01-01"), [
    { de: "2020-02-29", ate: "2025-02-28" },
    { de: "2025-03-01", ate: "2026-01-01" },
  ]);
  assert.deepEqual(janelasDaConsulta("2026-01-01", "2026-01-01"), [{ de: "2026-01-01", ate: "2026-01-01" }]);
});

const devolucao = (campos: Partial<DevolucaoDoChecklist> = {}): DevolucaoDoChecklist => ({
  motivo: "saldo", situacao: "a_pagar", valor_principal: 1200, valor_atualizado: null, valor_pago: null, pago_em: null, storage_path: null, ...campos,
});

test("recolhimento do encerramento: só saldo e rendimentos", () => {
  const r = recolhimentoDoEncerramento([
    devolucao(),
    devolucao({ motivo: "rendimento", valor_principal: 35.5, situacao: "paga", valor_pago: 35.5, pago_em: "2026-10-01", storage_path: "x" }),
    devolucao({ motivo: "glosa", valor_principal: 900 }),
  ]);
  assert.deepEqual(r, { guias: 2, aPagar: 1, valorAPagar: 120_000, semComprovante: 0, valorPago: 3_550, pagasEm: ["2026-10-01"] });
});

const estado = (): EstadoDaPrestacao => ({
  regime: ROUANET, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
  hoje: new Date("2026-10-07T12:00:00Z"),
});
const dados = (c: Partial<DadosDoChecklist> = {}): DadosDoChecklist => ({
  regime: ROUANET, etapa: "final", estado: estado(), verificacoes: [], contas: [], marcacoes: [], arquivos: [], ...c,
});
const recolhimentoFnc = (d: DadosDoChecklist) => checklistDeEnvio(d).documentos.find(l => l.codigo === "recolhimento_fnc")!;

test("checklist: o comprovante do recolhimento sai das guias registradas", () => {
  const sem = recolhimentoFnc(dados());
  assert.equal(sem.origem, "pessoa");
  assert.equal(sem.situacao, "pendente");
  assert.match(sem.detalhe, /Devoluções/);

  const aPagar = recolhimentoFnc(dados({ devolucoes: [devolucao(), devolucao({ motivo: "glosa" })] }));
  assert.equal(aPagar.origem, "dados");
  assert.equal(aPagar.situacao, "pendente");
  assert.equal(aPagar.destino, "devolucoes");
  assert.equal(aPagar.detalhe.replace(/ /g, " "), "1 guia do saldo e dos rendimentos está a pagar, R$ 1.200,00.");

  const semComprovante = recolhimentoFnc(dados({ devolucoes: [devolucao({ situacao: "paga", valor_pago: 1200, pago_em: "2026-10-05" })] }));
  assert.equal(semComprovante.situacao, "pendente");
  assert.equal(semComprovante.detalhe, "1 guia paga está sem o comprovante.");

  const pronta = recolhimentoFnc(dados({ devolucoes: [
    devolucao({ situacao: "paga", valor_pago: 1200, pago_em: "2026-10-05", storage_path: "org/prestacoes/p/devolucoes/gru.pdf" }),
    devolucao({ motivo: "rendimento", valor_principal: 35.5, situacao: "paga", valor_pago: 35.5, pago_em: "2026-10-06", storage_path: "org/prestacoes/p/devolucoes/r.pdf" }),
  ] }));
  assert.equal(pronta.situacao, "pronto");
  assert.equal(pronta.detalhe.replace(/ /g, " "), "R$ 1.235,50 recolhidos em 2 guias, pagas até 06/10/2026, com comprovante.");

  // Na ANCINE, o comprovante dos saldos não é obrigatório: sem guia, a pessoa pode dizer que não se aplica.
  const ancine = checklistDeEnvio(dados({ regime: ANCINE, estado: { ...estado(), regime: ANCINE } })).documentos.find(l => l.codigo === "gru_saldos")!;
  assert.equal(ancine.dispensavel, true);
  assert.equal(ancine.situacao, "pendente");
});
