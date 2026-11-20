import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HistoricoDaLoja, ImportarPlanilhaSheet, prepararImportacao } from "../components/ticketeria/HistoricoView";
import { lerCsv, type ImportacaoDaLista } from "../lib/ticketeria/historico";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/ /g, " ");
const importacoes: ImportacaoDaLista[] = [
  { id: "1", tipo: "vendas", arquivo: "sympla-2025.csv", periodo_inicio: "2025-03-03", periodo_fim: "2025-12-14", linhas: 214, total_ingressos: 1240, total_valor_centavos: 7180000, created_at: "2026-11-20T12:00:00Z" },
  { id: "2", tipo: "gasto", arquivo: "gastos-meta-2025.csv", periodo_inicio: "2025-05-01", periodo_fim: "2025-11-30", linhas: 180, total_ingressos: 0, total_valor_centavos: 942000, created_at: "2026-11-20T12:00:00Z" },
];

test("a aba Histórico: a lista de importações, o total de cada uma, as semanas e o vazio", () => {
  const lista = html(createElement(HistoricoDaLoja, { importacoes, semanas: { vendas: 41, gasto: 31 } }));
  for (const t of ["sympla-2025.csv", "Vendas", "Gastos", "03/03/2025 a 14/12/2025", "214", "1.240 ingressos · R$ 71.800,00", "R$ 9.420,00", "Desfazer", "41 semanas", "31 semanas", "31 de 104 semanas", "nunca saem do seu computador"]) assert.ok(lista.includes(t), `falta: ${t}`);
  assert.ok(html(createElement(HistoricoDaLoja, { importacoes, semanas: { vendas: 1, gasto: 0 }, desfazendo: "1" })).includes("Desfazendo…"));
  assert.ok(html(createElement(HistoricoDaLoja, { importacoes: [importacoes[0]], semanas: { vendas: 41, gasto: 0 } })).includes("41 de 104 semanas"), "só um tipo: mostra o que tem");
  const vazio = html(createElement(HistoricoDaLoja, { importacoes: [], semanas: { vendas: 0, gasto: 0 } }));
  assert.ok(vazio.includes("Nenhuma planilha importada") && vazio.includes("Importar planilha") && !vazio.includes("<table"));
});

const csv = lerCsv("Data do pedido;Nome;E-mail;Qtd;Valor total;Canal\n03/03/2025;Rita Teste;rita@teste.com;4;240,00;Instagram\n03/03/2025;João;joao@teste.com;2;120,00;\n04/03/2025;Lia;lia@teste.com;7;420,00;whatsapp\n");
const arquivo = { nome: "sympla-2025.csv", cabecalho: csv.cabecalho, linhas: csv.linhas, separador: csv.separador, truncado: false };

test("a folha de importar: sem arquivo pede o arquivo; com arquivo mostra as colunas, a prévia e o total", () => {
  const vazia = html(createElement(ImportarPlanilhaSheet, { existentes: [], onClose: () => {} }));
  for (const t of ["Importar planilha", "Só os totais por dia são enviados", "Vendas de ingressos", "Gastos de divulgação", "Escolha o arquivo CSV", "Escolher arquivo", "Baixar modelo"]) assert.ok(vazia.includes(t), `falta: ${t}`);
  assert.ok(!vazia.includes("Onde está cada coisa"));
  const cheia = html(createElement(ImportarPlanilhaSheet, { existentes: [], arquivoInicial: arquivo, onClose: () => {} }));
  for (const t of ["sympla-2025.csv", "3 linhas", "separador “;”", "Onde está cada coisa", "Dia da venda", "Quantidade de ingressos", "Valor (opcional)", "Origem ou canal (opcional)", "03/03/2025", "instagram", "sem origem", "R$ 240,00",
    "Total: 13 ingressos (R$ 780,00) em 3 linhas, de 03/03/2025 a 04/03/2025. Nenhuma linha com problema.", "Importar 3 linhas"]) assert.ok(cheia.includes(t), `falta: ${t}`);
  assert.ok(!cheia.includes("Rita Teste") && !cheia.includes("rita@teste.com"), "nomes e e-mails da planilha nunca aparecem nem entram no que se envia");
});

test("a folha: gastos pedem o valor; coluna ruim avisa; período repetido avisa; erro e importando", () => {
  const g = lerCsv("Dia;Gasto;Plataforma\n01/05/2025;120,00;Meta\n02/05/2025;95,5;Google\n");
  const gastos = html(createElement(ImportarPlanilhaSheet, { existentes: [], arquivoInicial: { nome: "g.csv", cabecalho: g.cabecalho, linhas: g.linhas, separador: g.separador, truncado: false }, tipoInicial: "gasto", onClose: () => {} }));
  for (const t of ["Dia do gasto", "Valor gasto", "R$ 120,00", "meta", "Importar 2 linhas", "Total: R$ 215,50 em 2 linhas"]) assert.ok(gastos.includes(t), `falta: ${t}`);
  assert.ok(!gastos.includes("Quantidade de ingressos"), "gasto não tem quantidade");
  const ruim = html(createElement(ImportarPlanilhaSheet, { existentes: [], arquivoInicial: arquivo, mapaInicial: { dia: 1, ingressos: 3, valor: 4, canal: 5 }, onClose: () => {} }));
  assert.ok(ruim.includes("Nenhuma linha deu para ler") && /<button[^>]*disabled=""[^>]*>Importar<\/button>/.test(ruim), "coluna de dia errada: nada a importar");
  const repetida = html(createElement(ImportarPlanilhaSheet, { existentes: importacoes, arquivoInicial: arquivo, onClose: () => {} }));
  assert.ok(repetida.includes("já existe uma importação de vendas neste período (sympla-2025.csv)") && repetida.includes("contar duas vezes"));
  assert.ok(html(createElement(ImportarPlanilhaSheet, { existentes: [], arquivoInicial: arquivo, erro: "Não foi possível importar agora.", importando: true, onClose: () => {} })).includes("Importando…"));
  const comProblema = html(createElement(ImportarPlanilhaSheet, { existentes: [], arquivoInicial: { ...arquivo, linhas: [...arquivo.linhas, ["ontem", "X", "x@x", "1", "1", ""]] }, onClose: () => {} }));
  assert.ok(comProblema.includes("1 linha ficou de fora (a primeira: linha 5, dia que não dá para ler)"));
});

test("preparar a importação: vendas e gastos pelo mesmo caminho; só os totais saem", () => {
  const v = prepararImportacao(arquivo, "vendas", { dia: 0, ingressos: 3, valor: 4, canal: 5 });
  assert.deepEqual(v.linhas.map(l => Object.keys(l).sort()), v.linhas.map(() => ["canal", "dia", "ingressos", "valor_centavos"]), "só dia, canal, ingressos e valor");
  assert.equal(v.totalIngressos, 13);
});
