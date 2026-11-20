import assert from "node:assert/strict";
import test from "node:test";
import * as X from "xlsx";
import { adivinharColunas, consolidarVendas } from "../lib/ticketeria/historico";
import { MAX_ABAS, celulaEmTexto, escolherAba, lerPlanilhaDoExcel, type AbaLida } from "../lib/ticketeria/historico-xlsx";
import { MAX_LINHAS_DO_ARQUIVO } from "../lib/ticketeria/historico";

type Celula = X.CellObject | string | number | null;
const DATA = (serie: number): X.CellObject => ({ t: "n", v: serie, z: "dd/mm/yyyy" });
const aba = (linhas: Celula[][]): X.WorkSheet => {
  const ws: X.WorkSheet = {};
  linhas.forEach((l, r) => l.forEach((c, i) => {
    if (c === null) return;
    ws[X.utils.encode_cell({ r, c: i })] = typeof c === "object" ? c : typeof c === "number" ? { t: "n", v: c } : { t: "s", v: c };
  }));
  ws["!ref"] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, linhas.length - 1), c: Math.max(0, ...linhas.map(l => l.length - 1)) } });
  return ws;
};
const arquivo = (abas: Record<string, Celula[][]>): Uint8Array => {
  const livro = X.utils.book_new();
  for (const [nome, linhas] of Object.entries(abas)) X.utils.book_append_sheet(livro, aba(linhas), nome);
  return X.write(livro, { type: "array", bookType: "xlsx" }) as Uint8Array;
};

const PEDIDOS: Celula[][] = [
  ["Data do pedido", "Qtd", "Valor total", "Canal de divulgação", "Nome"],
  [DATA(45719), 4, 240, "instagram", "Rita"], // 03/03/2025
  [DATA(45719), 2, 120.5, "", "Caio"],
  [DATA(45720), 7, 420.456, "whatsapp", "Ana"],
  [null, null, null, null, null],
];

test("o Excel vira texto no formato que o CSV já usa: data AAAA-MM-DD sem fuso, número com vírgula e no máximo 2 casas", () => {
  const [pedidos] = lerPlanilhaDoExcel(X, arquivo({ Pedidos: PEDIDOS }));
  assert.equal(pedidos.nome, "Pedidos");
  assert.deepEqual(pedidos.cabecalho, ["Data do pedido", "Qtd", "Valor total", "Canal de divulgação", "Nome"]);
  assert.deepEqual(pedidos.linhas, [["2025-03-03", "4", "240", "instagram", "Rita"], ["2025-03-03", "2", "120,5", "", "Caio"], ["2025-03-04", "7", "420,46", "whatsapp", "Ana"]]);
  assert.equal(pedidos.truncado, false);
});

test("a importação segue igual: as colunas são adivinhadas e as vendas somadas por dia e canal", () => {
  const [pedidos] = lerPlanilhaDoExcel(X, arquivo({ Pedidos: PEDIDOS }));
  const mapa = adivinharColunas(pedidos.cabecalho);
  assert.deepEqual(mapa, { dia: 0, ingressos: 1, valor: 2, canal: 3 });
  const r = consolidarVendas(pedidos.linhas, mapa);
  assert.equal(r.totalIngressos, 13);
  assert.equal(r.totalCentavos, 78096);
  assert.equal(r.linhas.length, 3);
  assert.deepEqual(r.problemas, []);
  assert.equal(r.inicio, "2025-03-03");
  assert.equal(r.fim, "2025-03-04");
});

test("com várias abas, a que tem data, quantidade e valor é a escolhida; aba vazia ou sem linhas fica de fora", () => {
  const abas = lerPlanilhaDoExcel(X, arquivo({ Resumo: [["Item", "Total"], ["Ingressos", 1240]], Vazia: [["só cabeçalho", "outra"]], Pedidos: PEDIDOS, Cupons: [["Código", "Desconto"], ["AMIGO10", 10]] }));
  assert.deepEqual(abas.map(a => a.nome), ["Resumo", "Pedidos", "Cupons"]);
  assert.equal(abas[escolherAba(abas, "vendas")].nome, "Pedidos");
  assert.equal(abas[escolherAba(abas, "gasto")].nome, "Pedidos", "a única com data");
  assert.equal(escolherAba([], "vendas"), -1);
});

test("escolherAba: sem nenhuma aba com data, vale a de mais linhas dentro do mesmo grupo e, em empate, a primeira", () => {
  const a = (nome: string, n: number): AbaLida => ({ nome, cabecalho: ["x", "y"], linhas: Array.from({ length: n }, () => ["1", "2"]), truncado: false });
  assert.equal(escolherAba([a("A", 2), a("B", 5), a("C", 5)], "vendas"), 1);
});

test("células de texto, número, booleano e erro: texto e número passam; o resto vira vazio", () => {
  assert.equal(celulaEmTexto(X, { t: "s", v: "oi" }), "oi");
  assert.equal(celulaEmTexto(X, { t: "n", v: 7 }), "7");
  assert.equal(celulaEmTexto(X, { t: "n", v: 12.349999 }), "12,35");
  assert.equal(celulaEmTexto(X, { t: "b", v: true }), "");
  assert.equal(celulaEmTexto(X, { t: "e", v: 7 }), "");
  assert.equal(celulaEmTexto(X, undefined), "");
  assert.equal(celulaEmTexto(X, { t: "n", v: 45719.75, z: "dd/mm/yyyy hh:mm" }), "2025-03-03", "a hora fica de fora");
  assert.equal(celulaEmTexto(X, { t: "n", v: 0, z: "dd/mm/yyyy" }), "", "data zero do Excel não é data");
});

test("arquivo grande é cortado no limite de linhas e avisa", () => {
  const muitas: Celula[][] = [["Data", "Qtd"], ...Array.from({ length: MAX_LINHAS_DO_ARQUIVO + 5 }, () => [DATA(45719), 1] as Celula[])];
  const [a] = lerPlanilhaDoExcel(X, arquivo({ Grande: muitas }));
  assert.equal(a.linhas.length, MAX_LINHAS_DO_ARQUIVO);
  assert.equal(a.truncado, true);
});

test("só as primeiras abas são lidas", () => {
  const todas = Object.fromEntries(Array.from({ length: MAX_ABAS + 3 }, (_, i) => [`Aba ${i + 1}`, [["a", "b"], [1, 2]] as Celula[][]]));
  assert.equal(lerPlanilhaDoExcel(X, arquivo(todas)).length, MAX_ABAS);
});
