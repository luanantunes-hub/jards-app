import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { EstadoDaPrestacao } from "../lib/prestacao/checagens";
import type { NoOrcamento } from "../lib/prestacao/orcamento";
import { chaveDoComplemento, rascunhoDoRelatorio } from "../lib/prestacao/relatorio-objeto";
import { gravarRco, nomeDoRco, segmentosDoCorpo, textoDoBloco } from "../lib/prestacao/rco-docx";
import { gravarPlanilhaDeRemanejamento, nomeDaPlanilhaDeRemanejamento, planilhaDeRemanejamento } from "../lib/prestacao/remanejamento-lie";
import { regimePorCodigo } from "../lib/prestacao/regimes";
import { PastaDeTrabalho } from "../lib/xlsx-modelo";
import { lerZip } from "../lib/zip";

// P8.3: o RCO 2026 em .docx e a planilha de remanejamento (Modelo I) da LIE.

const LIE = regimePorCodigo("lie_p10_2026")!;
const modelo = (arquivo: string) => new Uint8Array(readFileSync(new URL(`../public/modelos/lie/${arquivo}`, import.meta.url)));

// ─── RCO ────────────────────────────────────────────────────────────────────

const ESTADO_RCO = {
  regime: LIE, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
  metas: [
    { id: "m1", descricao: "Alunos atendidos", unidade: "alunos", previsto: 90, realizado: 92, justificativa: null },
    { id: "m2", descricao: "Festival de encerramento", unidade: "festival", previsto: 1, realizado: null, justificativa: null },
  ],
  locais: [{ id: "l1", pais: "Brasil", uf: "SP", municipio: "Campinas", status: "realizado", inicio: "2026-03-05", fim: null, justificativa: null }],
  alteracoes: [{ id: "a1", numero: 1, status: "aprovada", solicitada_em: "2026-05-01", tipo: "remanejamento", justificativa: "Mais bolas, menos cones.", decidida_em: "2026-05-10" }],
} as unknown as EstadoDaPrestacao;

async function documento(bytes: Uint8Array) {
  const xml = new TextDecoder().decode((await lerZip(bytes)).get("word/document.xml"));
  const corpo = xml.slice(xml.indexOf("<w:body>") + 8, xml.lastIndexOf("</w:body>"));
  return { xml, blocos: segmentosDoCorpo(corpo).filter(s => s.bloco).map(s => textoDoBloco(s.xml)) };
}

test("RCO: corpo separado em parágrafos e tabelas de primeiro nível", () => {
  const corpo = '<w:p><w:r><w:t>A</w:t></w:r></w:p><w:p/><w:bookmarkStart w:id="0"/><w:tbl><w:tr><w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/>';
  const s = segmentosDoCorpo(corpo);
  assert.deepEqual(s.map(x => [x.bloco, textoDoBloco(x.xml)]), [[true, "A"], [true, ""], [false, ""], [true, "B"], [false, ""]]);
  assert.equal(s.map(x => x.xml).join(""), corpo);
});

test("RCO: título da etapa, dados, objeto, resultados, metas e considerações no modelo", async () => {
  const rascunho = rascunhoDoRelatorio({
    regime: LIE, estado: ESTADO_RCO,
    prestacao: { titulo: "Futebol na Escola", identificador_oficial: "2600123", proponente: { nome: "Associação Esportiva", cnpj: "11222333000181" } },
    guardados: { [chaveDoComplemento("rco", "objeto")]: "Ensinar futebol a 90 alunos da rede pública.", [chaveDoComplemento("rco", "resultados")]: "O projeto ampliou a prática esportiva no bairro." },
  });
  const bytes = await gravarRco(modelo("modelo-rco-2026.docx"), rascunho, { etapa: "parcial", projeto: "Futebol na Escola", sli: "2600123", proponente: "Associação Esportiva", cnpj: "11222333000181" });
  const { xml, blocos } = await documento(bytes);
  const comeca = (prefixo: string) => blocos.find(b => b.startsWith(prefixo));
  assert.equal(comeca("PRESTAÇÃO DE CONTAS"), "PRESTAÇÃO DE CONTAS PARCIAL");
  assert.equal(comeca("PROCESSO Nº:"), "PROCESSO Nº: [preencher]");
  assert.equal(comeca("SLIE/SLI:"), "SLIE/SLI: 2600123");
  assert.equal(comeca("PROPONENTE:"), "PROPONENTE: Associação Esportiva");
  assert.equal(comeca("CNPJ:"), "CNPJ: 11.222.333/0001-81");
  assert.equal(comeca("MODALIDADES:"), "MODALIDADES: [preencher]");
  assert.match(comeca("A execução do projeto desportivo")!, /firmado entre a entidade “Associação Esportiva” e o Ministério do Esporte\./);
  assert.equal(comeca("Constitui-se como objeto"), "Constitui-se como objeto do projeto: Ensinar futebol a 90 alunos da rede pública.");
  // As orientações saem; o conteúdo da prestação entra no lugar.
  for (const orientacao of ["Relatar os resultados", "Em caso de alterações ao longo", "Informar o local de execução", "Neste tópico, deverá conter", "ATENÇÃO: Atentar-se", "Apresentar neste campo"]) {
    assert.equal(comeca(orientacao), undefined, orientacao);
  }
  assert.ok(blocos.includes("O projeto ampliou a prática esportiva no bairro."));
  assert.ok(blocos.some(b => /Alteração nº 1 \(remanejamento\), aprovada em 10\/05\/2026\. Mais bolas, menos cones\./.test(b)));
  assert.ok(blocos.some(b => /Campinas/.test(b)), "a tabela de locais entra");
  const tabelaDeMetas = blocos.find(b => b.startsWith("MetaIndicadorPrevistoAlcançado"));
  assert.ok(tabelaDeMetas?.includes("Alunos atendidos") && tabelaDeMetas.includes("[alcançado]"), tabelaDeMetas);
  // Meta sem resultado: a frase de cumprimento dá lugar à lacuna, em vermelho.
  assert.equal(comeca("Ressalta-se que foi atingido"), undefined);
  assert.ok(blocos.some(b => b.startsWith("[explique as metas não atingidas")));
  assert.match(xml, /<w:color w:val="FF0000"\/><\/w:rPr><w:t xml:space="preserve">\[explique as metas não atingidas/);
  // A lista de documentos, a tabela de aplicação financeira e a autenticação ficam.
  assert.ok(comeca("DOCUMENTOS COMPROBATÓRIOS"));
  assert.ok(comeca("DETALHAMENTO DAS AÇÕES"));
  assert.ok(comeca("Atesto a veracidade"));
  assert.equal(nomeDoRco({ etapa: "parcial", sli: "2600123", projeto: "Futebol" }), "RCO_PCP_2600123.docx");
});

test("RCO final com metas cumpridas: a frase de cumprimento fica", async () => {
  const estado = { ...ESTADO_RCO, metas: [{ id: "m1", descricao: "Alunos atendidos", unidade: "alunos", previsto: 90, realizado: 92, justificativa: null }] } as EstadoDaPrestacao;
  const rascunho = rascunhoDoRelatorio({ regime: LIE, estado, prestacao: { titulo: "Futebol", identificador_oficial: null, proponente: null }, guardados: {} });
  const { blocos } = await documento(await gravarRco(modelo("modelo-rco-2026.docx"), rascunho, { etapa: "final", projeto: "Futebol", sli: null, proponente: null, cnpj: null }));
  assert.ok(blocos.includes("PRESTAÇÃO DE CONTAS FINAL"));
  assert.ok(blocos.includes("Ressalta-se que foi atingido o objeto pactuado e cumprido fielmente o Plano de Trabalho aprovado."));
  assert.ok(blocos.includes("SLIE/SLI: [preencher]"));
  // Sem proponente, o trecho em vermelho do modelo fica para a pessoa.
  assert.match(blocos.find(b => b.startsWith("A execução do projeto"))!, /firmado entre o\/a “Proponente”/);
  assert.ok(blocos.some(b => b.startsWith("Constitui-se como objeto do projeto: especificar")));
  assert.ok(!blocos.includes("[preencher: objeto e objetivos]"), "o objeto vazio mantém a orientação do modelo");
});

// ─── Planilha de remanejamento ──────────────────────────────────────────────

const no = (id: string, parent_id: string | null, nome: string, campos: Partial<NoOrcamento> = {}): NoOrcamento => ({
  id, versao_id: "v1", parent_id, tipo: campos.tipo ?? "item", codigo: null, nome, descricao: null, uf: null, municipio: null,
  grupo_custo: null, unidade: null, quantidade: null, ocorrencias: null, valor_unitario: null, valor_total: 0, valor_remanejado: 0,
  ordem: 0, ...campos,
});

const ESTADO_REMANEJAMENTO = {
  nos: [
    no("g1", null, "Material Esportivo", { tipo: "meta", grupo_custo: "execucao", ordem: 1 }),
    no("i11", "g1", "Bola oficial", { unidade: "Unidade", quantidade: 10, ocorrencias: 1, valor_unitario: 480, valor_total: 4_800, ordem: 1 }),
    no("i12", "g1", "Cones", { unidade: "Unidade", quantidade: 20, ocorrencias: 1, valor_unitario: 10, valor_total: 200, ordem: 2 }),
  ],
  despesas: [
    { id: "d1", no_id: "i11", tipo: "nfe", status: "aceito", valor_extraido: 2_400 },
    { id: "d2", no_id: "i12", tipo: "nfe", status: "aceito", valor_extraido: 50 },
  ],
  pagamentos: [],
} as unknown as EstadoDaPrestacao;

test("remanejamento: blocos por item com aprovado, executado, proposto e o valor remanejado", () => {
  const p = planilhaDeRemanejamento({
    estado: ESTADO_REMANEJAMENTO, projeto: "Futebol na Escola",
    alteracao: { numero: 1, justificativa: "Mais bolas, menos cones.", movimentos: [
      { no_id: "i11", nome: "Bola oficial", parent_id: null, grupo_custo: null, de: 4_800, para: 4_950 },
      { no_id: "i12", nome: "Cones", parent_id: null, grupo_custo: null, de: 200, para: 50 },
      { no_id: null, nome: "Apito", parent_id: "g1", grupo_custo: null, de: 0, para: 0 },
    ] },
  });
  assert.deepEqual(p.itens.map(i => [i.codigo, i.nome, i.aprovado, i.executado, i.proposto, i.total, i.remanejado]), [
    ["1.1", "Bola oficial", 480_000, 240_000, 255_000, 495_000, 15_000],
    ["1.2", "Cones", 20_000, 5_000, 0, 5_000, -15_000],
  ]);
  assert.deepEqual(p.totais, { negativos: -15_000, positivos: 15_000 });
  assert.deepEqual(p.criticas, []);
  assert.equal(nomeDaPlanilhaDeRemanejamento(p), "Remanejamento_1_Futebol-na-Escola.xlsx");

  const abaixo = planilhaDeRemanejamento({
    estado: ESTADO_REMANEJAMENTO, projeto: "X",
    alteracao: { numero: 2, justificativa: null, movimentos: [
      { no_id: "i11", nome: "Bola oficial", parent_id: null, grupo_custo: null, de: 4_800, para: 2_000 },
      { no_id: null, nome: "Apito", parent_id: "g1", grupo_custo: null, de: 0, para: 100 },
    ] },
  });
  assert.deepEqual(abaixo.criticas, [
    "Bola oficial: o total proposto (R$ 2.000,00) fica abaixo do já executado (R$ 2.400,00).",
    "Apito: item novo; preencha o nº que ele terá no plano de trabalho.",
    "A alteração não tem justificativa: a coluna JUSTIFICATIVA sai vazia.",
  ].map(s => s.replace(/R\$ /g, "R$ ")));
});

test("remanejamento: grava os blocos sobre o modelo e limpa os que sobram", async () => {
  const p = planilhaDeRemanejamento({
    estado: ESTADO_REMANEJAMENTO, projeto: "Futebol na Escola",
    alteracao: { numero: 1, justificativa: "Mais bolas, menos cones.", movimentos: [
      { no_id: "i11", nome: "Bola oficial", parent_id: null, grupo_custo: null, de: 4_800, para: 4_950 },
      { no_id: "i12", nome: "Cones", parent_id: null, grupo_custo: null, de: 200, para: 50 },
    ] },
  });
  const pasta = await PastaDeTrabalho.abrir(await gravarPlanilhaDeRemanejamento(modelo("planilha-remanejamento-readequacao.xlsx"), p));
  const a = pasta.planilha("Remanejamento-Readequação");
  assert.equal(a.ler("B1"), "Projeto: Futebol na Escola\nProcesso nº: ");
  assert.deepEqual(["B7", "C7", "F7", "G7", "H7", "I7", "J7", "J8", "J11", "J14", "J15"].map(c => a.ler(c)), ["1.1", "Bola oficial", "Unidade", 10, 1, 480, 4_800, 2_400, 2_550, 4_950, 150]);
  assert.equal(a.ler("K7"), "Mais bolas, menos cones.");
  assert.deepEqual(["B18", "J18", "J19", "J22", "J25", "J26"].map(c => a.ler(c)), ["1.2", 200, 50, 0, 50, -150]);
  assert.equal(a.ler("B29"), null, "o código de exemplo do bloco 3 sai");
  assert.equal(a.ler("B370"), null);
  assert.deepEqual([a.ler("J380"), a.ler("J381")], [-150, 150]);
  assert.ok(pasta.nomes.includes("EXEMPLO"), "o exemplo do modelo continua");
});
