// Grava as planilhas da saúde (P9.3) num .xlsx com quatro abas: Planilha II,
// Tabela 1, informações compiladas e relação de bens. Não há modelo oficial
// em vigor (o Manual Orientativo do Anexo LXXXVI-A não foi publicado): as
// abas saem do zero, com as colunas do roteiro de análise do MS. A biblioteca
// de planilhas (SheetJS) entra como parâmetro, para a tela carregá-la só
// quando gera o arquivo.

import type * as XLSXTipos from "xlsx";
import { MESES, type PlanilhasDaSaude } from "./planilhas-saude";

type Xlsx = typeof XLSXTipos;
type Celula = string | number | Date | null;

export type CabecalhoDasPlanilhas = { titulo: string; nup: string | null; proponente: string | null };

const MOEDA = "#,##0.00";
const DATA = "dd/mm/yyyy";
const AVISO = "Colunas do roteiro de análise dos aspectos contábeis e financeiros do Ministério da Saúde; o Manual Orientativo do Anexo LXXXVI-A, com os modelos novos, ainda não foi publicado.";

const reais = (c: number | null) => (c === null ? null : c / 100);
const data = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`) : null);

function aba(X: Xlsx, linhas: Celula[][], larguras: number[], formatos: { coluna: number; desde: number; ate: number; z: string }[], mesclas: XLSXTipos.Range[] = []) {
  const ws = X.utils.aoa_to_sheet(linhas, { cellDates: true });
  ws["!cols"] = larguras.map(wch => ({ wch }));
  ws["!merges"] = mesclas;
  for (const f of formatos) {
    for (let r = f.desde; r <= f.ate; r++) {
      const ref = X.utils.encode_cell({ r, c: f.coluna });
      if (ws[ref] && (ws[ref].t === "n" || ws[ref].t === "d")) ws[ref].z = f.z;
    }
  }
  return ws;
}

export function gravarPlanilhasDaSaude(X: Xlsx, p: PlanilhasDaSaude, cab: CabecalhoDasPlanilhas): Uint8Array {
  const livro = X.utils.book_new();
  const periodo = p.ano === null ? "Prestação final (execução inteira)" : `Prestação anual do exercício de ${p.ano}`;
  const identificacao = [`Projeto: ${cab.titulo}`, cab.nup ? `NUP ${cab.nup}` : null, cab.proponente ? `Instituição: ${cab.proponente}` : null, periodo].filter(Boolean).join(" · ");

  // Planilha II: duas linhas de cabeçalho, a segunda para os requisitos.
  const inicio = 6;
  const linhasII: Celula[][] = [
    ["PLANILHA II – CONCILIAÇÃO BANCÁRIA"],
    [identificacao],
    [AVISO],
    [],
    ["N.", "Favorecido", "Descrição da despesa", "Tipo de documento", "Número do documento", "Emissão do documento", "Página do processo (SEI)", "Valor do documento", "Imposto retido na fonte", "Valor pago", "Data do pagamento", "Atendidos os requisitos do documento?", null, null],
    [null, null, null, null, null, null, null, null, null, null, null, "Nome da instituição", "Nome do projeto", "Nr. de processo"],
    ...p.planilhaII.map(l => [
      l.n, l.favorecido, l.descricao, l.tipo, l.numero, data(l.emissao), l.paginaSei,
      reais(l.valorDocumento), reais(l.impostoRetido), reais(l.valorPago), data(l.dataPagamento),
      l.requisitos.nomeInstituicao, l.requisitos.nomeProjeto, l.requisitos.processo,
    ]),
    ["Total", null, null, null, null, null, null,
      reais(p.planilhaII.reduce((s, l) => s + l.valorDocumento, 0)),
      reais(p.planilhaII.reduce((s, l) => s + l.impostoRetido, 0)),
      reais(p.planilhaII.reduce((s, l) => s + l.valorPago, 0)), null, null, null, null],
  ];
  const fimII = inicio + p.planilhaII.length;
  const mesclasII: XLSXTipos.Range[] = [
    ...Array.from({ length: 11 }, (_, c) => ({ s: { r: 4, c }, e: { r: 5, c } })),
    { s: { r: 4, c: 11 }, e: { r: 4, c: 13 } },
  ];
  X.utils.book_append_sheet(livro, aba(X, linhasII, [5, 32, 36, 16, 16, 12, 16, 15, 14, 15, 12, 14, 14, 14], [
    { coluna: 5, desde: inicio, ate: fimII, z: DATA },
    { coluna: 10, desde: inicio, ate: fimII, z: DATA },
    ...[7, 8, 9].map(coluna => ({ coluna, desde: inicio, ate: fimII, z: MOEDA })),
  ], mesclasII), "Planilha II");

  // Tabela 1: 12 meses por ano, com o total de cada ano e o geral.
  const anos = [...new Set(p.tabela1.map(l => l.ano))];
  const linhasT1: Celula[][] = [["TABELA 1 – RENDIMENTOS DE APLICAÇÃO FINANCEIRA"], [identificacao], ["Rendimento líquido de cada mês na Conta Movimento: o rendimento creditado menos o IR e o IOF debitados."], [], ["Mês/Ano", "Rendimento", "IR e IOF", "Rendimento líquido"]];
  for (const ano of anos) {
    const doAno = p.tabela1.filter(l => l.ano === ano);
    for (const l of doAno) linhasT1.push([`${MESES[l.mes - 1]}/${ano}`, reais(l.rendimento), reais(l.impostos), reais(l.liquido)]);
    linhasT1.push([`Total de ${ano}`, reais(doAno.reduce((s, l) => s + l.rendimento, 0)), reais(doAno.reduce((s, l) => s + l.impostos, 0)), reais(doAno.reduce((s, l) => s + l.liquido, 0))]);
  }
  if (anos.length > 1) {
    linhasT1.push(["Total", reais(p.tabela1.reduce((s, l) => s + l.rendimento, 0)), reais(p.tabela1.reduce((s, l) => s + l.impostos, 0)), reais(p.tabela1.reduce((s, l) => s + l.liquido, 0))]);
  }
  X.utils.book_append_sheet(livro, aba(X, linhasT1, [20, 16, 14, 18], [1, 2, 3].map(coluna => ({ coluna, desde: 5, ate: linhasT1.length, z: MOEDA }))), "Tabela 1");

  // Informações compiladas.
  const c = p.compiladas;
  const valoresIC: Celula[][] = [
    ...(c.saldoAnterior === null ? [] : [["Saldo dos exercícios anteriores", reais(c.saldoAnterior)]]),
    ["Recursos recebidos na Conta Movimento", reais(c.recursosRecebidos)],
    ["Rendimentos líquidos (Tabela 1)", reais(c.rendimentos)],
    ["Total de recursos", reais(c.totalDeRecursos)],
    ["Total de despesas pagas (Planilha II)", reais(c.totalDeDespesas)],
    ["Saldo remanescente", reais(c.saldoRemanescente)],
    ["Saldo residual da Conta Captação", reais(c.saldoDaCaptacao)],
  ];
  const linhasIC: Celula[][] = [
    ["INFORMAÇÕES COMPILADAS"], [identificacao], [],
    ...valoresIC,
    [],
    ["Os valores saem dos lançamentos do extrato importado e dos pagamentos registrados; confira com os extratos do banco."],
  ];
  X.utils.book_append_sheet(livro, aba(X, linhasIC, [42, 18], [{ coluna: 1, desde: 3, ate: 2 + valoresIC.length, z: MOEDA }]), "Informações compiladas");

  // Relação de bens.
  const linhasB: Celula[][] = [
    ["RELAÇÃO DE BENS, EQUIPAMENTOS E MATERIAIS PERMANENTES"], [identificacao],
    ["Bens adquiridos ou produzidos com o recurso do projeto, com a identificação no inventário físico."], [],
    ["N.", "Descrição", "Quantidade", "Valor", "Identificação (patrimônio)", "Nota fiscal", "Fornecedor", "Destinação"],
    ...p.bens.map(b => [b.n, b.descricao, b.quantidade, reais(b.valor), b.identificacao, b.documento, b.fornecedor, b.destinacao]),
  ];
  X.utils.book_append_sheet(livro, aba(X, linhasB, [5, 38, 11, 14, 22, 26, 30, 28], [{ coluna: 3, desde: 5, ate: linhasB.length, z: MOEDA }]), "Bens");

  return new Uint8Array(X.write(livro, { bookType: "xlsx", type: "array" }) as ArrayBuffer);
}
