import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { copiarFormula, deslocarFormula, letrasDaColuna, numeroDaColuna, PastaDeTrabalho, Planilha } from "../lib/xlsx-modelo";
import { lerZip, partesDoZip } from "../lib/zip";

const MODELO = new Uint8Array(readFileSync(new URL("../public/modelos/lie/formulario-pcp-pcf-2026.xlsx", import.meta.url)));

const juntar = (partes: Uint8Array[]) => {
  const total = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let i = 0;
  for (const p of partes) { total.set(p, i); i += p.length; }
  return total;
};

test("colunas e referências nas fórmulas", () => {
  assert.equal(numeroDaColuna("A"), 1);
  assert.equal(numeroDaColuna("AB"), 28);
  assert.equal(letrasDaColuna(28), "AB");
  assert.equal(letrasDaColuna(702), "ZZ");
  // A partir da linha 31, desce 5; texto entre aspas, função e outra planilha não mudam.
  assert.equal(deslocarFormula("SUM(C7:C30)+C31-$E$31", 30, 5), "SUM(C7:C35)+C36-$E$36");
  assert.equal(deslocarFormula('IF(A40>0,"B40",LOG10(A2))', 31, 2), 'IF(A42>0,"B40",LOG10(A2))');
  assert.equal(deslocarFormula("Outra!A40+A40", 31, 2, "Esta"), "Outra!A40+A42");
  assert.equal(deslocarFormula("'Esta'!$A$40", 31, 2, "Esta"), "'Esta'!$A$42");
  // Cópia: relativas andam, as com $ ficam.
  assert.equal(copiarFormula("SUM(D9:K9)+$C$9", 3), "SUM(D12:K12)+$C$9");
});

test("lê o ZIP gravado sem compressão e o modelo comprimido", async () => {
  const zip = juntar(partesDoZip([{ nome: "a.txt", dados: new TextEncoder().encode("olá") }, { nome: "pasta/b.xml", dados: new Uint8Array([1, 2, 3]) }]));
  const lidos = await lerZip(zip);
  assert.equal(new TextDecoder().decode(lidos.get("a.txt")), "olá");
  assert.deepEqual([...lidos.get("pasta/b.xml")!], [1, 2, 3]);
  const modelo = await lerZip(MODELO);
  assert.ok(new TextDecoder().decode(modelo.get("xl/workbook.xml")).includes("RECEITA E DESPESA"));
});

test("escreve, insere linhas com estilo, mesclagem e fórmula, e recalcula", () => {
  const xml = '<worksheet><dimension ref="A1:C5"/><sheetData>'
    + '<row r="1"><c r="A1" s="1" t="s"><v>0</v></c></row>'
    + '<row r="2" ht="15"><c r="A2" s="2"/><c r="B2" s="2"/><c r="C2" s="3"><f>B2*2</f><v>0</v></c></row>'
    + '<row r="3" ht="15"><c r="A3" s="4"/><c r="B3" s="4"/><c r="C3" s="3"><f>B3*2</f><v>0</v></c></row>'
    + '<row r="4"><c r="A4" s="5" t="s"><v>1</v></c><c r="B4" s="6"><f>SUM(B2:B3)</f><v>0</v></c><c r="C4" s="6"><f>+C2+C3</f></c></row>'
    + '</sheetData><mergeCells count="1"><mergeCell ref="A2:A2"/></mergeCells>'
    + '<conditionalFormatting sqref="B2:B3"><cfRule type="expression"><formula>B2&gt;C3</formula></cfRule></conditionalFormatting></worksheet>';
  const p = new Planilha("Teste", xml, ["Título: ", "TOTAL"]);
  p.completar("A1", "Projeto & Cia");
  assert.equal(p.ler("A1"), "Título: Projeto & Cia");
  p.inserirLinhas(3, 2, 2);
  for (const [i, v] of [10, 20, 30].entries()) p.escrever(`B${2 + i}`, v);
  p.escrever("B5", 40);
  assert.equal(p.formula("B6"), "SUM(B2:B5)");
  assert.equal(p.formula("C4"), "B4*2");
  assert.equal(p.ler("A6"), "TOTAL");
  p.recalcular();
  assert.equal(p.ler("B6"), 100);
  assert.equal(p.ler("C6"), 20 + 80);
  const saida = p.xml();
  assert.match(saida, /<row r="3" ht="15"><c r="A3" s="2"\/><c r="B3" s="2" t="n"><v>20<\/v><\/c>/);
  assert.match(saida, /<mergeCell ref="A3:A3"\/><mergeCell ref="A4:A4"\/>/);
  assert.match(saida, /<dimension ref="A1:C7"\/>/);
  assert.match(saida, /sqref="B2:B5"><cfRule type="expression"><formula>B2&gt;C5<\/formula>/);
  assert.match(saida, /<t xml:space="preserve">Título: Projeto &amp; Cia<\/t>/);
});

test("repete um bloco de linhas com valores, estilos, mesclagens e fórmulas relativas", () => {
  const xml = '<worksheet><dimension ref="A1:C6"/><sheetData>'
    + '<row r="1"><c r="A1" s="1" t="s"><v>0</v></c></row>'
    + '<row r="2" ht="20"><c r="A2" s="7" t="s"><v>1</v></c><c r="B2" s="8"/></row>'
    + '<row r="3"><c r="A3" s="2"/><c r="B3" s="2"/><c r="C3" s="3"><f>B3*2</f><v>0</v></c></row>'
    + '<row r="4"><c r="A4" s="7" t="s"><v>1</v></c><c r="B4" s="8"/></row>'
    + '<row r="5"><c r="A5" s="2"/><c r="B5" s="2"/><c r="C5" s="3"><f>B5*2+$B$1</f><v>0</v></c></row>'
    + '<row r="6"><c r="A6" s="9" t="s"><v>2</v></c><c r="C6"><f>SUM(C3:C5)</f></c></row>'
    + '</sheetData><mergeCells count="3"><mergeCell ref="A2:B2"/><mergeCell ref="A4:B4"/><mergeCell ref="A1:C1"/></mergeCells></worksheet>';
  const p = new Planilha("Teste", xml, ["Grade", "NÚCLEO:", "TOTAL"]);
  // O bloco 4–5 (o segundo núcleo) se repete antes da linha 6.
  p.copiarLinhas(4, 5, 6);
  assert.equal(p.ler("A6"), "NÚCLEO:");
  assert.equal(p.formula("C7"), "B7*2+$B$1", "relativa anda, absoluta fica");
  assert.equal(p.ler("A8"), "TOTAL");
  assert.equal(p.formula("C8"), "SUM(C3:C5)", "como no Excel, inserir logo abaixo do intervalo não o estende");
  p.completar("A6", "Quadra");
  assert.equal(p.ler("A6"), "NÚCLEO: Quadra");
  assert.equal(p.ler("A4"), "NÚCLEO:", "a origem não muda");
  const saida = p.xml();
  assert.match(saida, /<row r="6"><c r="A6" s="7" t="(?:s|inlineStr)">/);
  assert.match(saida, /<c r="B6" s="8"\/>/);
  assert.match(saida, /<mergeCell ref="A4:B4"\/>[\s\S]*<mergeCell ref="A6:B6"\/>/);
  assert.equal((saida.match(/<mergeCell /g) ?? []).length, 4);
  assert.match(saida, /<dimension ref="A1:C8"\/>/);
  // Bloco do meio repetido antes dele mesmo: as linhas de origem descem e a cópia lê o que eram.
  const q = new Planilha("Teste", xml, ["Grade", "NÚCLEO:", "TOTAL"]);
  q.copiarLinhas(2, 3, 2);
  assert.equal(q.formula("C3"), "B3*2");
  assert.equal(q.formula("C5"), "B5*2");
  assert.equal(q.formula("C7"), "B7*2+$B$1");
  assert.equal(q.formula("C8"), "SUM(C5:C7)", "a soma desce com a origem");
});

test("o modelo da LIE reabre com as abas, a área de impressão deslocada e os totais calculados", async () => {
  const pasta = await PastaDeTrabalho.abrir(MODELO);
  assert.equal(pasta.nomes.length, 10);
  const p = pasta.planilha("PAGAMENTOS");
  pasta.inserirLinhas("PAGAMENTOS", 32, 4, 31);
  for (let i = 0; i < 30; i++) p.escrever(`H${7 + i}`, 10);
  const bytes = pasta.gravar();
  const arquivos = await lerZip(bytes);
  assert.match(new TextDecoder().decode(arquivos.get("xl/workbook.xml")), /PAGAMENTOS!\$A\$1:\$H\$39<\/definedName>[\s\S]*fullCalcOnLoad="1"/);
  const reaberta = await PastaDeTrabalho.abrir(bytes);
  assert.equal(reaberta.planilha("PAGAMENTOS").formula("H37"), "SUM(H7:H36)");
  assert.equal(reaberta.planilha("PAGAMENTOS").ler("H37"), 300);
  assert.ok(arquivos.has("xl/media/image1.png"), "o logotipo continua no arquivo");
});
