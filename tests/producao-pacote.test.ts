import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { crc32, montarZip, nomeDeArquivoSeguro } from "../lib/producao/zip";
import { montarPacote, nomeDoPacote, type DadosDoPacote } from "../lib/producao/pacote";

/** Lê o zip de volta (só o formato armazenado que o escritor produz): nome, CRC e conteúdo de cada arquivo, pelo diretório central. */
function lerZip(zip: Uint8Array) {
  const visao = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const fim = zip.length - 22;
  assert.equal(visao.getUint32(fim, true), 0x06054b50, "fim do diretório central");
  const quantidade = visao.getUint16(fim + 10, true);
  let posicao = visao.getUint32(fim + 16, true);
  const lidos: { nome: string; crc: number; texto: string }[] = [];
  for (let i = 0; i < quantidade; i += 1) {
    assert.equal(visao.getUint32(posicao, true), 0x02014b50, "entrada do diretório central");
    const crc = visao.getUint32(posicao + 16, true);
    const tamanho = visao.getUint32(posicao + 24, true);
    const tamanhoDoNome = visao.getUint16(posicao + 28, true);
    const deslocamento = visao.getUint32(posicao + 42, true);
    const nome = new TextDecoder("utf-8", { ignoreBOM: true }).decode(zip.subarray(posicao + 46, posicao + 46 + tamanhoDoNome));
    assert.equal(visao.getUint32(deslocamento, true), 0x04034b50, "cabeçalho local");
    const inicio = deslocamento + 30 + visao.getUint16(deslocamento + 26, true) + visao.getUint16(deslocamento + 28, true);
    lidos.push({ nome, crc, texto: new TextDecoder("utf-8", { ignoreBOM: true }).decode(zip.subarray(inicio, inicio + tamanho)) });
    posicao += 46 + tamanhoDoNome;
  }
  return lidos;
}

test("zip: o CRC-32 bate com o valor conhecido", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
});

test("zip: nomes seguros", () => {
  assert.equal(nomeDeArquivoSeguro("a/b\\c:d*e?f\"g<h>i|j"), "a b c d e f g h i j");
  assert.equal(nomeDeArquivoSeguro("../../etc/passwd"), "etc passwd");
  assert.equal(nomeDeArquivoSeguro("   "), "arquivo");
  assert.equal(nomeDeArquivoSeguro("...segredo.csv"), "segredo.csv");
  assert.equal(nomeDeArquivoSeguro("x".repeat(200)).length, 80);
  assert.equal(nomeDeArquivoSeguro("Orçamento — Turnê.csv"), "Orçamento — Turnê.csv");
});

test("zip: o que se escreve se lê de volta, com acentos, vazio e nomes repetidos", () => {
  const zip = montarZip([
    { nome: "resumo.txt", conteudo: "Olá, mundo — ação\n" },
    { nome: "planilha.csv", conteudo: "﻿a;b\r\n1;2\r\n" },
    { nome: "planilha.csv", conteudo: "segunda" },
    { nome: "vazio.txt", conteudo: "" },
    { nome: "binario.bin", conteudo: Uint8Array.from([0, 1, 2, 255]) },
  ], new Date(2027, 2, 5, 14, 30, 10));
  const lidos = lerZip(zip);
  assert.deepEqual(lidos.map(item => item.nome), ["resumo.txt", "planilha.csv", "planilha (2).csv", "vazio.txt", "binario.bin"]);
  assert.equal(lidos[0].texto, "Olá, mundo — ação\n");
  assert.equal(lidos[1].texto, "﻿a;b\r\n1;2\r\n");
  assert.equal(lidos[2].texto, "segunda");
  assert.equal(lidos[3].texto, "");
  assert.equal(lidos[0].crc, crc32(new TextEncoder().encode("Olá, mundo — ação\n")));
});

test("zip: um leitor de verdade (unzip, quando existe) aceita o arquivo", { skip: (() => { try { execFileSync("unzip", ["-v"], { stdio: "ignore" }); return false; } catch { return "unzip não está instalado"; } })() }, () => {
  const pasta = mkdtempSync(join(tmpdir(), "pacote-"));
  try {
    const arquivo = join(pasta, "teste.zip");
    writeFileSync(arquivo, montarZip([{ nome: "a.csv", conteudo: "x;y\r\n1;2\r\n" }, { nome: "b.txt", conteudo: "Olá" }]));
    const saida = execFileSync("unzip", ["-t", arquivo], { encoding: "utf8" });
    assert.match(saida, /No errors detected/);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

const vazio: DadosDoPacote = {
  temporada: "Turnê 2027", hoje: "2027-06-01", orcamentos: [], linhas: [], acordos: [], datasDoAcordo: () => [], pedidos: [], lancamentos: [], divisoes: [], faturas: [], parcelas: [],
  adiantamentos: [], gastos: [], diarias: [], nomeDaPessoa: () => "Pessoa",
};

test("pacote: sem nada, só o resumo", () => {
  const arquivos = montarPacote(vazio);
  assert.deepEqual(arquivos.map(item => item.nome), ["resumo.txt"]);
  assert.match(String(arquivos[0].conteudo), /Sem orçamento nesta temporada/);
});

test("pacote: com dinheiro de tudo, uma planilha por assunto e o resumo com os totais", () => {
  const dados: DadosDoPacote = {
    ...vazio,
    orcamentos: [{ id: "o1", nome: "Base", situacao: "aprovado" }],
    linhas: [{ id: "l1", orcamento_id: "o1", categoria: "cache", descricao: "Cachê", estimativa: 8000, aprovado: 8000, revisado: null, comprometido: 0, pago: 0, ordem: 0, acordo_id: "k1" }],
    acordos: [{ id: "k1", contraparte: "Elenco", tipo: "cache", sentido: "a_pagar", situacao: "assinado", valor_fixo: 8000, garantia: null, percentual_bilheteria: null, bonus_publico: null, bonus_valor: null, despesas_nossas: null, despesas_da_contraparte: null, retencoes: null, observacao: null, assinado_em: "2027-02-10" }],
    datasDoAcordo: () => ["01/03", "02/03"],
    pedidos: [{ id: "p1", orcamento_linha_id: "l1", solicitante_id: null, descricao: "Cachê do diretor", favorecido: null, valor: 500, justificativa: null, situacao: "pendente", aprovado_por: null, aprovado_em: null, motivo_recusa: null, pendencia: null, pendencia_ate: null }],
    lancamentos: [{ id: "n1", descricao: "Sinal", favorecido: "Elenco", documento: null, data: "2027-03-01", valor: 3000, observacao: null }],
    divisoes: [{ id: "d1", lancamento_id: "n1", orcamento_linha_id: "l1", valor: 3000 }],
    faturas: [{ id: "f1", acordo_id: null, contratante: "Sesc", descricao: "Cachê", situacao: "em_aberto", valor: 10000, retencoes: 1000, nota_numero: null, emissao: null, vencimento: null, observacao: null }],
    parcelas: [{ id: "q1", fatura_id: "f1", rotulo: null, valor: 9000, vencimento: "2027-05-10", recebido_em: null }],
    adiantamentos: [{ id: "a1", pessoa_id: "x", descricao: "Verba", valor: 1000, data: "2027-03-01", devolvido: 0, situacao: "aberto", observacao: null }],
    gastos: [{ id: "g1", adiantamento_id: "a1", descricao: "Combustível", valor: 300, data: "2027-03-03", documento: null }],
    diarias: [{ id: "r1", pessoa_id: "x", de: "2027-03-01", ate: "2027-03-05", dias: 5, valor_dia: 200, recibo: null, pago_em: null, observacao: null }],
    nomeDaPessoa: () => "Pessoa Um",
  };
  const arquivos = montarPacote(dados);
  assert.deepEqual(arquivos.map(item => item.nome), ["resumo.txt", "orcamento 1 - Base.csv", "acordos.csv", "pedidos de pagamento.csv", "lancamentos.csv", "faturas.csv", "adiantamentos.csv", "diarias.csv"]);
  const resumo = String(arquivos[0].conteudo);
  assert.match(resumo, /Orçamento "Base": previsto R\$\s?8\.000,00 · comprometido R\$\s?8\.000,00 · pago R\$\s?3\.000,00 · a pagar R\$\s?5\.000,00/, "comprometido do acordo e pago dos lançamentos");
  assert.match(resumo, /Faturas: a receber R\$\s?9\.000,00/);
  assert.match(resumo, /Adiantamentos: R\$\s?700,00 ainda com as pessoas/);
  assert.match(resumo, /Diárias: total R\$\s?1\.000,00 · pago R\$\s?0,00 · a pagar R\$\s?1\.000,00/);
  assert.match(String(arquivos.find(item => item.nome === "acordos.csv")?.conteudo), /Elenco;Cachê;A pagar;Assinado;10\/02\/2027;8000,00;;;;;8000,00;01\/03 \| 02\/03/);
  assert.match(String(arquivos.find(item => item.nome === "lancamentos.csv")?.conteudo), /Cachê · Cachê: R\$/, "a divisão traz o nome da linha do orçamento");
  const zip = lerZip(montarZip(arquivos));
  assert.equal(zip.length, 8);
});

test("pacote: nome do arquivo baixado", () => {
  assert.equal(nomeDoPacote("Turnê 2027", "2027-06-01"), "dinheiro-turnê-2027-2027-06-01.zip");
  assert.equal(nomeDoPacote("A/B: C", "2027-06-01"), "dinheiro-a-b-c-2027-06-01.zip");
});
