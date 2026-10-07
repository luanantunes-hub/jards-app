import assert from "node:assert/strict";
import test from "node:test";
import type { EstadoDaPrestacao } from "../lib/prestacao/checagens";
import { checklistDeEnvio, type ArquivoDoChecklist, type DadosDoChecklist } from "../lib/prestacao/envio";
import {
  extensao,
  manifestoCsv,
  nomeDoPacote,
  padraoDosNomes,
  planoDoPacote,
  regraDeArquivo,
  sha256,
  slug,
  textoDasFaltas,
  type DadosDoPacote,
  type MetadadosDoArquivo,
} from "../lib/prestacao/pacote";
import { regimePorCodigo } from "../lib/prestacao/regimes";

const ROUANET = regimePorCodigo("rouanet_in29_2026")!;
const ANCINE = regimePorCodigo("ancine_in159_2021")!;
const LIE = regimePorCodigo("lie_p10_2026")!;
const MB = 1024 * 1024;

type Despesa = EstadoDaPrestacao["despesas"][number];
const despesa = (id: string, campos: Partial<Despesa> = {}) =>
  ({ id, nome_arquivo: `${id}.pdf`, status: "aceito", no_id: null, tipo: "nfe", valor_extraido: 100, data_doc: "2026-08-10", fornecedor_id: "f1", numero_documento: id.toUpperCase(), ...campos }) as Despesa;

const estado = (regime = ROUANET, campos: Partial<EstadoDaPrestacao> = {}): EstadoDaPrestacao => ({
  regime,
  despesas: [
    despesa("d2", { data_doc: "2026-09-01", numero_documento: "456", fornecedor_id: "f2" }),
    despesa("d1", { data_doc: "2026-08-10", numero_documento: "123" }),
    despesa("d3", { status: "rejeitado" }),
  ],
  fornecedores: [
    { id: "f1", nome: null, razao_social: "Teatro Vivo Produções Ltda", nome_fantasia: null } as EstadoDaPrestacao["fornecedores"][number],
    { id: "f2", nome: "João Silva", razao_social: null, nome_fantasia: null } as EstadoDaPrestacao["fornecedores"][number],
  ],
  documentosDosFornecedores: [], itens: [], lancamentos: [],
  pagamentos: [
    { id: "p2", despesa_id: "d1", lancamento_id: null, forma: "pix", data: "2026-08-20", valor: 50, favorecido_documento: null, numero_documento: null },
    { id: "p1", despesa_id: "d1", lancamento_id: null, forma: "pix", data: "2026-08-12", valor: 50, favorecido_documento: null, numero_documento: null },
  ],
  hoje: new Date("2026-10-07T12:00:00Z"),
  ...campos,
});

const caminho = (pasta: string, id: string, ext = "pdf") => `org/prestacoes/p/${pasta}/${id}.${ext}`;
const arquivoDoEnvio = (codigo: string, nome = `${codigo}.pdf`): ArquivoDoChecklist =>
  ({ id: `a-${codigo}-${nome}`, etapa: "final", codigo, storage_path: caminho("envio", `${codigo}-${nome}`), nome_arquivo: nome, mime_type: nome.endsWith(".pdf") ? "application/pdf" : "image/png", tamanho_bytes: MB, created_at: "2026-10-07T10:00:00Z" });

function dados(regime = ROUANET, campos: Partial<DadosDoPacote> = {}, checklist: Partial<DadosDoChecklist> = {}): DadosDoPacote {
  const e = campos.estado ?? estado(regime);
  const arquivosDoEnvio = campos.arquivosDoEnvio ?? [];
  const lista = checklistDeEnvio({ regime, etapa: "final", estado: e, verificacoes: [], contas: [], marcacoes: [], arquivos: arquivosDoEnvio, ...checklist });
  const arquivosDasDespesas = e.despesas.map(d => ({ id: d.id, storage_path: caminho("comprovantes", d.id), nome_arquivo: d.nome_arquivo }));
  const metadados = new Map<string, MetadadosDoArquivo>([
    ...arquivosDasDespesas.map(a => [a.storage_path, { tamanho: MB, mime: "application/pdf" }] as const),
    ...arquivosDoEnvio.map(a => [a.storage_path, { tamanho: a.tamanho_bytes, mime: a.mime_type }] as const),
  ]);
  return {
    regime, etapa: "final", checklist: lista, estado: e,
    prestacao: { titulo: "Festival (teste)", identificador_oficial: "26-9999" },
    arquivosDasDespesas, arquivosDoEnvio, devolucoes: [], extratos: [], metadados, ...campos,
  };
}

test("nomes: slug sem acento e extensão do original", () => {
  assert.equal(slug("Teatro Vivo Produções Ltda."), "teatro-vivo-producoes-ltda");
  assert.equal(slug("  NF-e nº 123/2026  "), "nf-e-n-123-2026");
  assert.equal(slug("a".repeat(50), 10), "aaaaaaaaaa");
  // Corta entre palavras quando dá.
  assert.equal(slug("Teatro Vivo Produções Ltda (teste)", 30), "teatro-vivo-producoes-ltda");
  assert.equal(extensao("Nota.PDF"), "pdf");
  assert.equal(extensao(null, "image/jpeg"), "jpg");
  assert.equal(extensao("sem-extensao"), "pdf");
  assert.equal(nomeDoPacote("pre-pacote", { titulo: "Festival", identificador_oficial: "26-9999" }, "final", new Date(2026, 9, 7, 9, 5)), "pre-pacote-26-9999-final-20261007-0905.zip");
});

test("regra e padrão do regime", () => {
  assert.equal(regraDeArquivo(ROUANET)?.mb, 5);
  assert.equal(regraDeArquivo(ANCINE)?.mb, 15);
  assert.equal(regraDeArquivo(LIE)?.mb, 25);
  assert.equal(regraDeArquivo(null), null);
  assert.equal(padraoDosNomes(ROUANET), "salic");
  assert.equal(padraoDosNomes(ANCINE), "str");
  assert.equal(padraoDosNomes(LIE), "geral");
});

test("Salic: comprovantes na ordem do espelho, sem a despesa rejeitada", () => {
  const plano = planoDoPacote(dados());
  const comprovantes = plano.itens.filter(i => i.vinculo.tipo === "despesa");
  assert.deepEqual(comprovantes.map(i => i.caminho), [
    "comprovantes/001_teatro-vivo-producoes-ltda_123.pdf",
    "comprovantes/002_joao-silva_456.pdf",
  ]);
  assert.match(comprovantes[0].origem, /^Despesa: Teatro Vivo Produções Ltda, nº 123, 10\/08\/2026, R\$ 100,00 · 1ª do espelho do Salic$/);
  assert.equal(plano.padrao, "salic");
  assert.equal(plano.comProblema, 0);
});

test("STR: uma linha da RP por pagamento, a partir da 12, o documento repetido em cada linha", () => {
  const plano = planoDoPacote(dados(ANCINE, { estado: estado(ANCINE) }));
  const fiscais = plano.itens.filter(i => i.vinculo.tipo === "despesa");
  assert.deepEqual(fiscais.map(i => i.caminho), [
    "documentos-fiscais/00012_P.pdf",
    "documentos-fiscais/00013_P.pdf",
    "documentos-fiscais/00014_P.pdf",
  ]);
  assert.deepEqual(fiscais.map(i => i.vinculo.tipo === "despesa" && [i.vinculo.id, i.vinculo.pagamentoId, i.vinculo.linha]), [
    ["d1", "p1", 12], ["d1", "p2", 13], ["d2", null, 14],
  ]);
  assert.equal(plano.aBaixar, 2);
  assert.match(fiscais[0].origem, /linha 12 da RP · pagamento de 12\/08\/2026, R\$ 50,00$/);
});

test("contrato e outros comprovantes que não são fiscais vão para outros/", () => {
  const e = estado(ANCINE);
  const comContrato = { ...e, despesas: [...e.despesas, despesa("c1", { tipo: "contrato", numero_documento: null, data_doc: "2026-07-01" })] };
  const plano = planoDoPacote(dados(ANCINE, { estado: comContrato }));
  const outros = plano.itens.filter(i => i.caminho.startsWith("outros/"));
  assert.deepEqual(outros.map(i => i.caminho), ["outros/001_contrato_teatro-vivo-producoes-ltda.pdf"]);
  assert.match(outros[0].origem, /^Contrato: Teatro Vivo Produções Ltda, 01\/07\/2026/);
  assert.equal(plano.itens.filter(i => i.caminho.startsWith("documentos-fiscais/")).length, 3);
});

test("geral (LIE): por data, com a data no nome", () => {
  const plano = planoDoPacote(dados(LIE, { estado: estado(LIE) }));
  assert.deepEqual(plano.itens.filter(i => i.vinculo.tipo === "despesa").map(i => i.caminho), [
    "comprovantes/001_2026-08-10_teatro-vivo-producoes-ltda_123.pdf",
    "comprovantes/002_2026-09-01_joao-silva_456.pdf",
  ]);
});

test("documentos do checklist, devoluções e extratos, com a regra conferida antes de gerar", () => {
  const relatorio = arquivoDoEnvio("relatorio_objeto");
  const foto = { ...arquivoDoEnvio("relatorio_objeto", "foto.png"), tamanho_bytes: 6 * MB };
  const base = dados(ROUANET, { arquivosDoEnvio: [relatorio, foto] });
  const metadados = new Map(base.metadados);
  metadados.set(caminho("devolucoes", "g1"), { tamanho: 1000, mime: "application/pdf" });
  const plano = planoDoPacote({
    ...base,
    metadados,
    devolucoes: [
      { id: "g1", motivo: "saldo", situacao: "paga", storage_path: caminho("devolucoes", "g1"), nome_arquivo: "gru.pdf", mime_type: "application/pdf", valor_principal: 10, valor_atualizado: null, valor_pago: 10 },
      { id: "g2", motivo: "glosa", situacao: "a_pagar", storage_path: null, nome_arquivo: null, mime_type: null, valor_principal: 50, valor_atualizado: 52, valor_pago: null },
    ],
  });
  const docs = plano.itens.filter(i => i.vinculo.tipo === "documento");
  const indice = ROUANET.envio && "documentos" in ROUANET.envio ? ROUANET.envio.documentos.filter(d => d.em.includes("final")).findIndex(d => d.codigo === "relatorio_objeto") + 1 : 0;
  assert.ok(indice > 0);
  const n = String(indice).padStart(2, "0");
  assert.deepEqual(docs.map(i => i.caminho), [`documentos/${n}_relatorio-objeto_01.pdf`, `documentos/${n}_relatorio-objeto_02.png`]);
  assert.deepEqual(docs[1].problemas, ["Não está em PDF.", "Tem 6 MB; o limite é 5 MB."]);
  assert.deepEqual(plano.itens.filter(i => i.vinculo.tipo === "devolucao").map(i => i.caminho), ["devolucoes/01_gru-saldo.pdf"]);
  assert.equal(plano.comProblema, 1);
  assert.equal(plano.podeGerarPacote, false);

  // Extrato só entra quando o checklist pede (LIE sim, Rouanet não); arquivo sumido aparece.
  const extrato = { id: "e1", conta_id: "c1", conta: "Conta Movimento", nome_arquivo: "extrato.ofx", storage_path: caminho("extratos", "e1", "ofx"), periodo_inicio: "2026-08-01", periodo_fim: "2026-08-31" };
  const lie = planoDoPacote({ ...dados(LIE, { estado: estado(LIE) }), extratos: [extrato] });
  const e = lie.itens.find(i => i.vinculo.tipo === "extrato")!;
  assert.equal(e.caminho, "extratos/conta-movimento_2026-08-01_2026-08-31.ofx");
  assert.deepEqual(e.problemas, ["Não foi achado no armazenamento."]);
  assert.equal(planoDoPacote({ ...dados(), extratos: [extrato] }).itens.some(i => i.vinculo.tipo === "extrato"), false);
});

test("pacote só sem obrigatório pendente; o pré-pacote lista o que falta", () => {
  const plano = planoDoPacote(dados());
  assert.equal(plano.podeGerarPacote, false);
  assert.match(plano.motivo!, /obrigatórios? do checklist/);
  assert.ok(plano.faltas.length > 0);
  assert.ok(plano.faltas.findIndex(f => !f.obrigatorio) === -1 || plano.faltas.findIndex(f => !f.obrigatorio) > plano.faltas.findIndex(f => f.obrigatorio));
  const texto = textoDasFaltas(plano, "final");
  assert.match(texto, /^O que falta para a prestação final\r\n/);
  assert.match(texto, /- \[obrigatório\] /);

  // Sem regime: nem pacote, nem regra.
  const semRegime = planoDoPacote(dados(null as never, { regime: null, estado: estado(ROUANET) }));
  assert.equal(semRegime.podeGerarPacote, false);
  assert.match(semRegime.motivo!, /regime/);
});

test("pacote liberado com o checklist completo e os arquivos na regra", () => {
  const base = dados();
  const completo = {
    ...base,
    checklist: { ...base.checklist, resumo: { ...base.checklist.resumo, obrigatoriosPendentes: 0 } },
  };
  const plano = planoDoPacote(completo);
  assert.equal(plano.podeGerarPacote, true);
  assert.equal(plano.motivo, null);
  assert.equal(plano.tamanhoTotal, 2 * MB);
});

test("manifesto em CSV e SHA-256", async () => {
  const csv = manifestoCsv([
    { arquivo: "comprovantes/001_a.pdf", origem: "Despesa: Teatro; Vivo, nº 1", tamanho: 10, sha256: "ab", observacao: "" },
  ]);
  assert.equal(csv, 'arquivo;origem;tamanho_bytes;sha256;observacao\r\ncomprovantes/001_a.pdf;"Despesa: Teatro; Vivo, nº 1";10;ab;\r\n');
  assert.equal(await sha256(new TextEncoder().encode("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("relatório: blocos com identificação, checklist, o que falta e arquivos", async () => {
  const { conteudoDoRelatorio } = await import("../lib/prestacao/relatorio-pdf");
  const d = dados();
  const plano = planoDoPacote(d);
  const manifesto = plano.itens.map(i => ({ arquivo: i.caminho, origem: i.origem, tamanho: i.tamanho ?? 0, sha256: "a".repeat(64), observacao: "" }));
  const blocos = conteudoDoRelatorio({ tipo: "pre-pacote", dados: d, plano, manifesto, geradoEm: new Date(2026, 9, 7, 9, 5), proponente: { nome: "Instituto Teste", documento: "12.345.678/0001-95" } });
  assert.deepEqual(blocos.filter(b => b.tipo === "secao").map(b => b.tipo === "secao" && b.texto), ["Checklist do envio", "O que falta", "Resumo financeiro", "Arquivos do pacote"]);
  assert.equal(blocos[1].tipo, "aviso");
  const pares = blocos.find(b => b.tipo === "pares");
  assert.ok(pares?.tipo === "pares" && pares.pares.some(([r, v]) => r === "Identificador oficial" && v === "26-9999"));
  const arquivos = blocos.filter(b => b.tipo === "tabela").at(-1);
  assert.ok(arquivos?.tipo === "tabela" && arquivos.linhas.length === 2 && arquivos.linhas[0][3] === "aaaaaaaaaaaaaaaa…");
  const resumo = blocos.filter(b => b.tipo === "pares")[1];
  assert.ok(resumo.tipo === "pares" && resumo.pares[0][1].replace(/\u00a0/g, " ") === "2 comprovantes, R$ 200,00");
});

test("relatório: texto na Helvetica, linhas quebradas e PDF com várias páginas", async () => {
  const { paraWinAnsi, quebrarLinhas, relatorioEmPdf } = await import("../lib/prestacao/relatorio-pdf");
  assert.equal(paraWinAnsi("R$\u00a01.234,56 ≤ 5 MB → ok 🙂 ação"), "R$ 1.234,56 <= 5 MB -> ok ? ação");
  const medidor = { largura: (t: string) => t.length };
  assert.deepEqual(quebrarLinhas("um dois três quatro", 9, 1, medidor), ["um dois", "três", "quatro"]);
  assert.deepEqual(quebrarLinhas("abcdefghijkl", 5, 1, medidor), ["abcde", "fghij", "kl"]);

  const linhas = Array.from({ length: 120 }, (_, i) => [`comprovantes/${String(i + 1).padStart(3, "0")}_fornecedor.pdf`, "Despesa: Teatro Vivo Produções Ltda, nº 123, 10/08/2026, R$ 1.234,56", "1 MB", "abcdef0123456789…"]);
  const bytes = await relatorioEmPdf([
    { tipo: "titulo", texto: "Relatório da prestação de contas" },
    { tipo: "aviso", texto: "Pré-pacote: não é o envio." },
    { tipo: "pares", pares: [["Prestação", "Festival (teste) — edição 2026"]] },
    { tipo: "secao", texto: "Arquivos do pacote" },
    { tipo: "tabela", colunas: [{ titulo: "Arquivo", largura: 0.3 }, { titulo: "Origem", largura: 0.4 }, { titulo: "Tamanho", largura: 0.1, direita: true }, { titulo: "SHA-256", largura: 0.2 }], linhas },
    { tipo: "lista", itens: [{ texto: "Obrigatório: relatório do objeto", alerta: true }] },
  ], "Festival (teste) · gerado em 07/10/2026");
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const { PDFDocument } = await import("pdf-lib");
  const lido = await PDFDocument.load(bytes);
  assert.ok(lido.getPageCount() >= 3, `páginas: ${lido.getPageCount()}`);
});
