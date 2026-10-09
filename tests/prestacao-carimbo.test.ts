import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CHECAGENS, type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checarCarimbo } from "../lib/prestacao/checagens/checar-carimbo";
import {
  frenteDoCarimbo,
  LEI_DO_MODELO,
  LEI_EM_VIGOR,
  leiDoCarimbo,
  nomeDosCarimbos,
  notasDoCarimbo,
  problemaDoAtesto,
  regimePedeCarimbo,
  versoDoCarimbo,
} from "../lib/prestacao/carimbo";
import { gerarFolhaDeCarimbos } from "../lib/prestacao/carimbo-pdf";
import { referenciaDaPrestacao, regimeUsaProcesso } from "../lib/prestacao/devolucoes";
import { formularioLie } from "../lib/prestacao/formulario-lie";
import { gravarFormularioLie } from "../lib/prestacao/formulario-lie-xlsx";
import { criticasDaGradeRh } from "../lib/prestacao/grade-rh";
import { gravarGradeRh } from "../lib/prestacao/grade-rh-xlsx";
import { devolucaoDaGlosa } from "../lib/prestacao/pos-envio";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import { PastaDeTrabalho } from "../lib/xlsx-modelo";

// P8.8: o carimbo e o atesto das notas da LIE, a folha de carimbos em PDF e o
// número do processo no SEI na GRU e nos cabeçalhos dos formulários.

const P10 = regimePorCodigo("lie_p10_2026")!;
const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const FORMULARIO = new Uint8Array(readFileSync(new URL("../public/modelos/lie/formulario-pcp-pcf-2026.xlsx", import.meta.url)));
const GRADE_RH = new Uint8Array(readFileSync(new URL("../public/modelos/lie/grade-horaria-rh-2026.xlsx", import.meta.url)));

type Despesa = EstadoDaPrestacao["despesas"][number];
const nota = (id: string, campos: Partial<Despesa> = {}): Despesa =>
  ({ id, tipo: "nfe", status: "aceito", nome_arquivo: `${id}.pdf`, no_id: null, data_doc: "2026-04-10", valor_extraido: 100, fornecedor_id: null, numero_documento: "1", chave_acesso: null, iss: 0, inss: 0, irrf: 0, outras_retencoes: 0, identificacao_projeto: "presente", atestado_em: null, ...campos }) as Despesa;

function estado(campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao {
  return {
    regime: P10, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
    prestacao: { data_termo: "2026-03-01", data_inicio_execucao: "2026-03-01", data_fim_execucao: "2026-10-31" },
    hoje: new Date("2026-08-01T12:00:00Z"),
    ...campos,
  } as EstadoDaPrestacao;
}

test("o texto do carimbo e do atesto como no modelo, com a lei escolhida", () => {
  assert.deepEqual(frenteDoCarimbo("2600123", null), ["Nº SLIE/SLI 2600123", "MINISTÉRIO DO ESPORTE", "SECRETARIA EXECUTIVA", "LEI 11.438/2006"]);
  assert.deepEqual(frenteDoCarimbo(null, LEI_EM_VIGOR), ["Nº SLIE/SLI ______________", "MINISTÉRIO DO ESPORTE", "SECRETARIA EXECUTIVA", "LEI COMPLEMENTAR 222/2025"]);
  assert.deepEqual(versoDoCarimbo(null), ["ATESTO QUE O SERVIÇO FOI RECEBIDO EM: _____/____/____", "______________________________", "ASSINATURA"]);
  assert.equal(versoDoCarimbo("2026-04-12")[0], "ATESTO QUE O SERVIÇO FOI RECEBIDO EM: 12/04/2026");
  assert.equal(leiDoCarimbo("  "), LEI_DO_MODELO);
  assert.equal(nomeDosCarimbos("26.00123"), "Carimbos_SLI_2600123.pdf");
});

test("as notas que levam carimbo e o atesto fora da data", () => {
  const despesas = [nota("a"), nota("b", { tipo: "folha_pagamento" }), nota("c", { tipo: "guia_tributo" }), nota("d", { status: "rejeitado" }), nota("e", { tipo: "rpa" })];
  assert.deepEqual(notasDoCarimbo(despesas).map(d => d.id), ["a", "e"]);
  const vigencia = { inicio: "2026-03-01", fim: "2026-10-31" };
  assert.equal(problemaDoAtesto({ data_doc: "2026-04-10", atestado_em: "2026-04-12" }, vigencia), null);
  assert.equal(problemaDoAtesto({ data_doc: "2026-04-10", atestado_em: null }, vigencia), null);
  assert.equal(problemaDoAtesto({ data_doc: "2026-04-10", atestado_em: "2026-04-09" }, vigencia), "antes_da_emissao");
  assert.equal(problemaDoAtesto({ data_doc: null, atestado_em: "2026-02-20" }, vigencia), "antes_da_vigencia");
  assert.equal(problemaDoAtesto({ data_doc: "2026-10-30", atestado_em: "2026-11-03" }, vigencia), "depois_da_vigencia");
});

test("só a LIE pede o carimbo; a checagem junta as notas sem atesto e aponta cada atesto fora da data", () => {
  assert.equal(regimePedeCarimbo(P10), true);
  assert.equal(regimePedeCarimbo(ROUANET), false);
  assert.ok(CHECAGENS.some(c => c.id === "carimbo"));

  const despesas = [
    nota("ok", { atestado_em: "2026-04-11" }),
    nota("sem1"), nota("sem2", { tipo: "nfse" }),
    nota("antes", { nome_arquivo: "nf-77.pdf", atestado_em: "2026-04-01" }),
    nota("folha", { tipo: "folha_pagamento" }),
  ];
  const durante = checarCarimbo(estado({ despesas }));
  assert.deepEqual(durante.map(a => [a.codigo, a.severidade, a.chave]), [
    ["ATESTO_AUSENTE", "info", "ATESTO_AUSENTE:prestacao:-"],
    ["ATESTO_FORA_DA_DATA", "alerta", "ATESTO_FORA_DA_DATA:despesa:antes"],
  ]);
  assert.equal(durante[0].mensagem, "2 notas estão sem a data do atesto de recebimento: carimbe a frente com o número do SLI, ateste o verso com a data e a assinatura e registre a data em Envio, Carimbo e atesto.");
  assert.equal(durante[1].mensagem, "nf-77.pdf foi atestada antes da emissão: o atesto é de 01/04/2026, a emissão de 10/04/2026.");
  assert.equal(durante[1].fonte?.regra?.codigo, "carimbo_e_atesto");
  // Depois do fim da execução, a falta do atesto vira alerta.
  const depois = checarCarimbo(estado({ despesas, hoje: new Date("2026-11-15T12:00:00Z") }));
  assert.equal(depois[0].severidade, "alerta");
  const fora = checarCarimbo(estado({ despesas: [nota("x", { nome_arquivo: "nf-9.pdf", data_doc: "2026-10-30", atestado_em: "2026-11-03" })] }));
  assert.equal(fora[0].mensagem, "nf-9.pdf foi atestada depois do fim da execução: o atesto é de 03/11/2026, a emissão de 30/10/2026 e a vigência vai de 01/03/2026 a 31/10/2026.");
  // Fora da LIE, nada.
  assert.deepEqual(checarCarimbo(estado({ regime: ROUANET, despesas })), []);
});

test("folha de carimbos em PDF: um bloco por nota, com o texto do modelo", async () => {
  const notas = Array.from({ length: 7 }, (_, i) => ({ documento: `NF ${i + 1}`, fornecedor: "Loja", emissao: "2026-04-10", valor: "R$ 100,00", atestadoEm: i === 0 ? "2026-04-12" : null }));
  const bytes = await gerarFolhaDeCarimbos({ projeto: "Escolinha de Vôlei", sli: "2600871", lei: LEI_EM_VIGOR, notas });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const { PDFDocument } = await import("pdf-lib");
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 2, "5 notas por página");
});

test("o processo no SEI é a referência da GRU da LIE; nos outros regimes, o identificador", () => {
  assert.equal(regimeUsaProcesso(P10), true);
  assert.equal(regimeUsaProcesso(ROUANET), false);
  assert.equal(referenciaDaPrestacao(P10, { identificador_oficial: "2600123", numero_processo: "71000.012345/2026-11" }), "71000012345202611");
  assert.equal(referenciaDaPrestacao(P10, { identificador_oficial: "2600123", numero_processo: null }), null, "sem processo, a referência fica para preencher");
  assert.equal(referenciaDaPrestacao(ROUANET, { identificador_oficial: "26-9999", numero_processo: "x" }), "269999");
  const glosa = devolucaoDaGlosa({ descricao: "Despesa fora da vigência", valor: 500, data_base: "2026-05-01" }, P10, null, { identificador_oficial: "2600123", numero_processo: "71000.012345/2026-11" }, "2026-10-21");
  assert.deepEqual([glosa.campos.gru_unidade_gestora, glosa.campos.gru_gestao, glosa.campos.gru_codigo, glosa.campos.gru_referencia], ["180076", "00001", "18004-1", "71000012345202611"]);
});

test("o processo vai no cabeçalho do formulário PCP/PCF e da grade de RH", async () => {
  const f = formularioLie({ estado: estado(), etapa: "parcial", prestacao: { titulo: "Vôlei", sli: "2600871", proponente: "Associação", processo: "71000.012345/2026-11" } });
  assert.equal(f.cabecalho.processo, "71000.012345/2026-11");
  assert.ok(!f.criticas.some(c => c.campo === "Nº do processo"), "com o processo, não há o que preencher à mão");
  const sem = formularioLie({ estado: estado(), etapa: "parcial", prestacao: { titulo: "Vôlei", sli: "2600871", proponente: "Associação" } });
  assert.deepEqual(sem.criticas.filter(c => c.campo === "Nº do processo").map(c => [c.mensagem, c.destino?.tipo]), [
    ["Informe o número do processo no SEI nos dados oficiais da prestação: ele vai nas abas EXECUTADO, GRADE, EVENTOS e A EXECUTAR.", "dados"],
  ]);
  const pasta = await PastaDeTrabalho.abrir(await gravarFormularioLie(FORMULARIO, f));
  assert.equal(pasta.planilha("EXECUTADO").ler("E5"), "05. Nº DO PROCESSO: 71000.012345/2026-11");
  assert.equal(pasta.planilha("GRADE").ler("A6"), "Nº PROCESSO: 71000.012345/2026-11");
  assert.equal(pasta.planilha("EVENTOS").ler("A6"), "Nº PROCESSO: 71000.012345/2026-11");
  assert.equal(pasta.planilha("A EXECUTAR").ler("A5"), "3 - PROCESSO Nº: 71000.012345/2026-11");

  const rh = (await PastaDeTrabalho.abrir(await gravarGradeRh(GRADE_RH, { projeto: "Vôlei", proponente: "Associação", sli: "2600871", processo: "71000.012345/2026-11", cargos: [] }))).planilha("Cronograma Execução");
  assert.equal(rh.ler("A4"), "Nº PROCESSO: 71000.012345/2026-11");
  const cargo = { id: "c", no_id: "x", cargo: "Professor", quantidade: 1, horarios: ["08:00-12:00"], carga_semanal: 4, contratacao: "rpa" as const };
  assert.ok(!criticasDaGradeRh([cargo], { sli: "1", proponente: "A", processo: "71000.012345/2026-11" }).some(c => c.campo === "Nº do processo"));
});
