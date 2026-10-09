import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CHECAGENS, type EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checarRecursosHumanos } from "../lib/prestacao/checagens/checar-rh";
import { checklistDeEnvio, type DadosDoChecklist, type LinhaDoChecklist } from "../lib/prestacao/envio";
import {
  cargaDivergente,
  cargaDosHorarios,
  cargosSugeridos,
  contratacaoDoPagamento,
  criticasDaGradeRh,
  faltasDoCargo,
  horasDoDia,
  itensDeRh,
  linhasDaGradeRh,
  nomeDaGradeRh,
  pagosDoCargo,
  regimePedeGradeRh,
  resumoDosHorarios,
  type CargoDaGrade,
} from "../lib/prestacao/grade-rh";
import { BLOCO_GRADE_RH, gravarGradeRh } from "../lib/prestacao/grade-rh-xlsx";
import type { NoOrcamento } from "../lib/prestacao/orcamento";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import { PastaDeTrabalho } from "../lib/xlsx-modelo";
import { lerZip } from "../lib/zip";

// P8.7: a grade horária dos recursos humanos da LIE, as checagens que cruzam a
// grade com quem foi pago e o arquivo no modelo da DPPIE.

const P10 = regimePorCodigo("lie_p10_2026")!;
const P424 = regimePorCodigo("lie_p424_2020")!;
const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const MODELO = new Uint8Array(readFileSync(new URL("../public/modelos/lie/grade-horaria-rh-2026.xlsx", import.meta.url)));

const no = (id: string, parent_id: string | null, nome: string, campos: Partial<NoOrcamento> = {}): NoOrcamento => ({
  id, versao_id: "v1", parent_id, tipo: campos.tipo ?? "item", codigo: null, nome, descricao: null, uf: null, municipio: null,
  grupo_custo: null, unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null, valor_total: 0, valor_remanejado: 0,
  ordem: 0, ...campos,
});

const NOS: NoOrcamento[] = [
  no("g1", null, "Recursos Humanos - Atividade Fim", { tipo: "meta" }),
  no("prof", "g1", "Professor de educação física", { unidade: "Mês", quantidade: 2, ocorrencias: 10 }),
  no("mon", "g1", "Monitor", { unidade: "Mês", quantidade: 3, ocorrencias: 10 }),
  no("g2", null, "Material Esportivo", { tipo: "meta" }),
  no("bola", "g2", "Bola oficial"),
  no("arb", "g2", "Arbitragem"),
];

const cargo = (id: string, campos: Partial<CargoDaGrade> = {}): CargoDaGrade => ({
  id, no_id: null, cargo: "Professor", quantidade: 1, horarios: ["08:00-12:00", "", "08:00-12:00", "", "08:00-12:00", "", ""],
  carga_semanal: 12, contratacao: "rpa", ...campos,
});

type Despesa = EstadoDaPrestacao["despesas"][number];
type Fornecedor = EstadoDaPrestacao["fornecedores"][number];

const despesa = (id: string, no_id: string, tipo: string, fornecedor_id: string | null, status = "aceito"): Despesa =>
  ({ id, no_id, tipo, fornecedor_id, status, nome_arquivo: `${id}.pdf`, valor_extraido: 1000, data_doc: "2026-05-10", numero_documento: "1", chave_acesso: null, iss: 0, inss: 0, irrf: 0, outras_retencoes: 0, identificacao_projeto: "presente" }) as unknown as Despesa;

const fornecedor = (id: string, nome: string, tipo_pessoa: "pf" | "pj" = "pf"): Fornecedor =>
  ({ id, nome, razao_social: tipo_pessoa === "pj" ? nome : null, tipo_pessoa, documento: id }) as unknown as Fornecedor;

function estado(campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao {
  return {
    regime: P10, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
    nos: NOS, cargos: [], hoje: new Date("2026-08-01T12:00:00Z"),
    ...campos,
  } as EstadoDaPrestacao;
}

test("horas escritas como as pessoas escrevem", () => {
  assert.equal(horasDoDia("08:00-12:00"), 4);
  assert.equal(horasDoDia("8h às 12h e 14h às 18h"), 8);
  assert.equal(horasDoDia("08:00–12:00 / 13:00–17:00"), 8);
  assert.equal(horasDoDia("14h30 às 16h"), 1.5);
  assert.equal(horasDoDia("das 8 até 12"), 4);
  assert.equal(horasDoDia(""), 0);
  assert.equal(horasDoDia("Folga"), 0, "sem número, o dia não conta");
  assert.equal(horasDoDia("manhã 8"), null, "número que não forma intervalo não é lido");
  assert.equal(horasDoDia("10:00-09:00"), null, "o fim vem depois do início");
  assert.deepEqual(cargaDosHorarios(["08:00-12:00", "", "08:00-12:00", "manhã", "8 às 12", "", ""]), { horas: 12, ilegiveis: [] });
  assert.deepEqual(cargaDosHorarios(["08:00-12:00", "x 9"]), { horas: 4, ilegiveis: ["Terça"] });
  assert.equal(resumoDosHorarios(["08:00-12:00", "08:00-12:00", "08:00-12:00", "08:00-12:00", "08:00-12:00", "08:00-10:00", ""]), "Seg a Sex 08:00-12:00 · Sáb 08:00-10:00");
  assert.equal(resumoDosHorarios(["14:00-18:00", "", "14:00-18:00", "14:00-18:00"]), "Seg 14:00-18:00 · Qua e Qui 14:00-18:00");
  assert.equal(resumoDosHorarios([]), "");
});

test("o que falta no cargo e a carga que não bate com os horários", () => {
  assert.deepEqual(faltasDoCargo(cargo("c")), []);
  assert.deepEqual(faltasDoCargo(cargo("c", { horarios: [], carga_semanal: null, contratacao: null })), ["os horários", "a carga horária semanal", "a forma de contratação"]);
  assert.equal(cargaDivergente(cargo("c")), null);
  assert.deepEqual(cargaDivergente(cargo("c", { carga_semanal: "20" })), { escrita: 20, somada: 12 }, "o numeric do banco chega como texto");
  assert.equal(cargaDivergente(cargo("c", { carga_semanal: 12.4 })), null, "meia hora de folga");
});

test("forma de contratação pelo documento e pessoas pagas pelo item", () => {
  assert.equal(contratacaoDoPagamento({ tipo: "folha_pagamento" }), "clt");
  assert.equal(contratacaoDoPagamento({ tipo: "rpa" }), "rpa");
  assert.equal(contratacaoDoPagamento({ tipo: "nfse" }, { id: "x", tipo_pessoa: "pj" }), "pj");
  assert.equal(contratacaoDoPagamento({ tipo: "nfse" }, { id: "x", tipo_pessoa: "pf" }), null, "nota de pessoa física não diz a forma");
  assert.equal(contratacaoDoPagamento({ tipo: "recibo" }), null);
  const despesas = [
    despesa("d1", "prof", "rpa", "ana"), despesa("d2", "prof", "rpa", "ana"), despesa("d3", "prof", "nfse", "bia"),
    despesa("d4", "prof", "rpa", "caio", "rejeitado"), despesa("d5", "prof", "guia_tributo", "inss"), despesa("d6", "mon", "rpa", "dan"),
  ];
  const pagos = pagosDoCargo({ no_id: "prof" }, despesas, [fornecedor("ana", "Ana"), fornecedor("bia", "Bia Serviços ME", "pj")]);
  assert.deepEqual(pagos.map(p => [p.fornecedorId, p.despesas.length, [...p.formas]]), [["ana", 2, ["rpa"]], ["bia", 1, ["pj"]]], "a recusada e a guia de encargos ficam de fora");
  assert.deepEqual(pagosDoCargo({ no_id: null }, despesas, []), []);
});

test("itens de RH: pelo agrupador ou pelo pagamento em folha ou RPA; sugestões só dos sem cargo", () => {
  const despesas = [despesa("d1", "arb", "rpa", "juiz"), despesa("d2", "bola", "nfe", "loja")];
  assert.deepEqual(itensDeRh(NOS, despesas).map(n => n.id), ["prof", "mon", "arb"]);
  // Na ordem da árvore, não na do item solto: o agrupador vem primeiro.
  const arvore = [
    no("ga", null, "Recursos Humanos - Atividade Meio", { tipo: "meta", ordem: 2 }),
    no("coord", "ga", "Coordenador", { ordem: 1 }),
    no("gb", null, "Recursos Humanos - Atividade Fim", { tipo: "meta", ordem: 1 }),
    no("p2", "gb", "Monitor", { ordem: 2 }),
    no("p1", "gb", "Professor", { ordem: 1 }),
  ];
  assert.deepEqual(itensDeRh(arvore, []).map(n => n.id), ["p1", "p2", "coord"]);
  assert.deepEqual(cargosSugeridos(NOS, despesas, [{ no_id: "prof" }]), [
    { no_id: "mon", cargo: "Monitor", quantidade: 3 },
    { no_id: "arb", cargo: "Arbitragem", quantidade: 1 },
  ]);
});

test("a LIE P10 pede a grade de RH na PCP; a P424 e a Rouanet, não", () => {
  assert.equal(regimePedeGradeRh(P10), true);
  assert.equal(regimePedeGradeRh(P424), false);
  assert.equal(regimePedeGradeRh(ROUANET), false);
  assert.ok(CHECAGENS.some(c => c.id === "recursos_humanos"));
});

test("checagens: item de RH sem cargo, pessoas pagas acima da grade e forma de contratação", () => {
  const despesas = [
    despesa("d1", "prof", "rpa", "ana"), despesa("d2", "prof", "rpa", "bruno"), despesa("d3", "prof", "nfse", "bia"),
    despesa("d4", "mon", "folha_pagamento", "dan"),
  ];
  const fornecedores = [fornecedor("ana", "Ana Souza"), fornecedor("bruno", "Bruno Lima"), fornecedor("bia", "Bia Serviços ME", "pj"), fornecedor("dan", "Dan")];
  const cargos = [cargo("c1", { no_id: "prof", cargo: "Professor", quantidade: 2, contratacao: "rpa" })];
  const achados = checarRecursosHumanos(estado({ despesas, fornecedores, cargos } as Partial<EstadoDaPrestacao>));
  assert.deepEqual(achados.map(a => [a.codigo, a.severidade, a.chave]), [
    ["RH_SEM_GRADE", "info", "RH_SEM_GRADE:prestacao:-:mon"],
    ["RH_ACIMA_DA_GRADE", "alerta", "RH_ACIMA_DA_GRADE:prestacao:-:c1"],
    ["RH_FORMA_DE_CONTRATACAO", "alerta", "RH_FORMA_DE_CONTRATACAO:prestacao:-:c1|bia"],
  ]);
  assert.equal(achados[0].mensagem, `O item de recursos humanos "Monitor" não tem cargo na grade de RH: cadastre o cargo com os horários, a carga semanal e a forma de contratação, ligado ao item.`);
  assert.equal(achados[0].fonte?.dispositivo, "art. 65, VII");
  assert.equal(achados[1].mensagem, `3 pessoas foram pagas pelo item "Professor de educação física", e a grade de RH prevê 2 contratados no cargo Professor. Se houve substituição, explique; senão, ajuste a quantidade na grade.`);
  assert.equal(achados[2].mensagem, "Bia Serviços ME foi pago por nota fiscal (PJ) no cargo Professor, mas a grade de RH prevê RPA, pago por recibo de autônomo. Corrija a forma de contratação na grade ou o documento da despesa.");
  assert.equal(achados[2].fonte?.regra?.codigo, "contratacao_de_pessoal");

  // Fora da LIE P10, o item sem cargo não é cobrado; a grade que existe ainda é conferida.
  const naP424 = checarRecursosHumanos(estado({ regime: P424, despesas, fornecedores, cargos } as Partial<EstadoDaPrestacao>));
  assert.deepEqual(naP424.map(a => a.codigo), ["RH_ACIMA_DA_GRADE", "RH_FORMA_DE_CONTRATACAO"]);
  // Tudo de acordo: nada.
  const ok = checarRecursosHumanos(estado({
    despesas: [despesa("d1", "prof", "rpa", "ana"), despesa("d4", "mon", "folha_pagamento", "dan")],
    fornecedores,
    cargos: [cargo("c1", { no_id: "prof", quantidade: 2 }), cargo("c2", { no_id: "mon", cargo: "Monitor", contratacao: "clt", quantidade: 3 })],
  } as Partial<EstadoDaPrestacao>));
  assert.deepEqual(ok, []);
});

test("críticas da planilha: cabeçalho, cargo incompleto, horário ilegível, carga e item", () => {
  const criticas = criticasDaGradeRh([
    cargo("c1", { cargo: "Professor", no_id: "prof", carga_semanal: 20 }),
    cargo("c2", { cargo: "Coordenador", horarios: ["08:00-17:00", "manhã 8"], contratacao: null, ordem: 1 }),
  ], { sli: "", proponente: "Associação" });
  assert.deepEqual(criticas.map(c => `${c.tipo}|${c.campo}|${c.mensagem}`), [
    "corrigir|Nº SLI|A prestação não tem o número do SLI: o cabeçalho sai sem ele.",
    "aviso|Carga horária semanal|Professor: os horários somam 12 h por semana, e a carga semanal diz 20 h.",
    "aviso|Cargo|Coordenador: falta a forma de contratação.",
    "aviso|Horários|Coordenador: não deu para somar o horário de terça; escreva como 08:00-12:00 para o Jards conferir a carga.",
    "aviso|Item do orçamento|Coordenador não está ligado a um item do orçamento: o Jards não confere quem foi pago no cargo.",
    "aviso|Nº do processo|Informe o número do processo no SEI nos dados oficiais da prestação: ele vai no cabeçalho.",
  ]);
  assert.deepEqual(criticasDaGradeRh([], { sli: "2600123", proponente: "A" }).map(c => c.mensagem), ["Nenhum cargo na grade de RH: o arquivo sai só com o cabeçalho."]);
  assert.equal(nomeDaGradeRh("26.00123"), "Grade_RH_2600123.xlsx");
});

test("grava no modelo da DPPIE: cabeçalho, cargos e linhas a mais", async () => {
  const cargos = Array.from({ length: 8 }, (_, i) => cargo(`c${i}`, {
    cargo: `Cargo ${i + 1}`, ordem: i, atribuicoes: i === 0 ? "Coordena os núcleos" : null, formacao: i === 0 ? "Superior em Educação Física" : null,
    contratacao: i === 0 ? "clt" : "rpa", quantidade: i + 1, carga_semanal: i === 0 ? "12.5" : 12,
  }));
  assert.deepEqual(linhasDaGradeRh(cargos)[0], {
    cargo: "Cargo 1", atribuicoes: "Coordena os núcleos", quantidade: 1, horarios: ["08:00-12:00", "", "08:00-12:00", "", "08:00-12:00", "", ""],
    carga: 12.5, contratacao: "CLT", formacao: "Superior em Educação Física",
  });
  const bytes = await gravarGradeRh(MODELO, { projeto: "Futebol nos Bairros", proponente: "Associação Esportiva", sli: "2600864", cargos });
  const p = (await PastaDeTrabalho.abrir(bytes)).planilha(BLOCO_GRADE_RH.aba);
  assert.match(String(p.ler("A2")), /^NOME DO PROJETO:\s+Futebol nos Bairros$/);
  assert.match(String(p.ler("A3")), /^PROPONENTE:\s+Associação Esportiva$/);
  assert.equal(p.ler("H4"), "Nº SLI: 2600864");
  const linha = (r: number) => "ACDEFGHIJKLMN".split("").map(c => p.ler(`${c}${r}`) ?? null);
  assert.deepEqual(linha(7), ["Cargo 1", "Coordena os núcleos", 1, "08:00-12:00", null, "08:00-12:00", null, "08:00-12:00", null, null, 12.5, "CLT", "Superior em Educação Física"]);
  // 8 cargos: o modelo tem 6 linhas; as instruções descem 2.
  assert.equal(p.ler("A14"), "Cargo 8");
  assert.equal(p.ler("D14"), 8);
  assert.equal(p.ler("A15"), "INSTRUÇÕES DE PREENCHIMENTO");
  const folha = new TextDecoder().decode((await lerZip(bytes)).get("xl/worksheets/sheet1.xml"));
  for (const r of ["A13:B13", "A14:B14", "A15:N15"]) assert.ok(folha.includes(`<mergeCell ref="${r}"/>`), `faltou a mesclagem ${r}`);
  assert.ok((await lerZip(bytes)).has("xl/media/image1.png"), "o logotipo continua no arquivo");

  // Sem cargos, o arquivo sai só com o cabeçalho.
  const vazio = (await PastaDeTrabalho.abrir(await gravarGradeRh(MODELO, { projeto: "X", proponente: "", sli: "", cargos: [] }))).planilha(BLOCO_GRADE_RH.aba);
  assert.equal(vazio.ler("A7"), null);
  assert.equal(vazio.ler("A13"), "INSTRUÇÕES DE PREENCHIMENTO");
});

const porCodigo = (linhas: readonly LinhaDoChecklist[]) => Object.fromEntries(linhas.map(l => [l.codigo, l]));
const checklist = (campos: Partial<EstadoDaPrestacao>, verificacoes: DadosDoChecklist["verificacoes"] = []) => {
  const dados: DadosDoChecklist = { regime: P10, etapa: "parcial", estado: estado(campos), verificacoes, contas: [], marcacoes: [], arquivos: [] };
  return porCodigo(checklistDeEnvio(dados).documentos);
};

test("envio: a grade de RH pelos dados, na PCP", () => {
  assert.equal(checklist({}).grade_rh.detalhe, "Cadastre a grade de RH: os cargos da equipe, com os horários, a carga semanal e a forma de contratação.");
  assert.equal(checklist({}).grade_rh.destino, "atividades");
  const incompleto = checklist({ cargos: [cargo("c1"), cargo("c2", { contratacao: null })] });
  assert.equal(incompleto.grade_rh.detalhe, "1 cargo está sem horários, carga semanal ou forma de contratação.");
  const comPendencia = checklist({ cargos: [cargo("c1", { quantidade: 2 })] }, [{ check_codigo: "RH_ACIMA_DA_GRADE", status: "aberta" }] as DadosDoChecklist["verificacoes"]);
  assert.equal(comPendencia.grade_rh.detalhe, "1 pendência aberta na grade de RH.");
  const pronto = checklist({ cargos: [cargo("c1", { quantidade: 2 }), cargo("c2", { quantidade: 3 })] });
  assert.equal(pronto.grade_rh.situacao, "pronto");
  assert.equal(pronto.grade_rh.detalhe, "2 cargos e 5 contratados na grade, sem pendência aberta.");
  // A pendência da grade de RH não conta no relatório do objeto, que também se resolve na aba Atividades.
  const objetoPronto = {
    metas: [{ id: "m1", descricao: "Aulas", unidade: "aulas", previsto: 10, realizado: 10, justificativa: null }],
    atividades: [{ id: "a1", titulo: "Aula", data_realizacao: "2026-06-01", data_inicio: null, data_fim: null, local_id: null, meta_id: "m1", status_realizacao: "realizado" as const }],
    evidencias: [{ id: "e1", tipo: "foto", requisitos: ["alcance_objeto"], nome_arquivo: "aula.jpg", url: null, atividade_id: "a1", meta_id: null, local_id: null, capturada_em: null, latitude: null, longitude: null, justificativa: null }],
    cargos: [cargo("c1")],
  } as Partial<EstadoDaPrestacao>;
  assert.equal(checklist(objetoPronto, [{ check_codigo: "RH_ACIMA_DA_GRADE", status: "aberta" }] as DadosDoChecklist["verificacoes"]).rco.situacao, "pronto");
  assert.equal(checklist(objetoPronto, [{ check_codigo: "OBJETO_SEM_METAS", status: "aberta" }] as DadosDoChecklist["verificacoes"]).rco.situacao, "pendente", "a do objeto continua contando");
});
