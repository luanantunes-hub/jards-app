import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { despesaDoDocumento, ehXml, identificadorNoTexto, lerDocumentoFiscal, lerXml, rotuloDoDocumento, type DocumentoFiscalLido } from "../lib/prestacao/documento-fiscal";
import { lerChaveAcesso } from "../lib/prestacao/despesas";
import { decodificarArquivo } from "../lib/prestacao/extrato";

const exemplo = async (nome: string) => decodificarArquivo(new Uint8Array(await readFile(`tests/fixtures/fiscal/${nome}`)));

async function ler(nome: string): Promise<DocumentoFiscalLido> {
  const leitura = lerDocumentoFiscal(await exemplo(nome));
  assert.ok(leitura.ok, `${nome}: ${leitura.ok ? "" : leitura.motivo}`);
  return leitura.documento;
}

const EMITENTE = "11222333000181";
const PROPONENTE = "11444777000161";
const contexto = {
  fornecedores: [{ id: "f1", documento: EMITENTE }],
  proponente: { documento: PROPONENTE, nome: "Associação Cultural Exemplo" },
  identificador: "235678",
  chavesUsadas: [],
};

test("xml: namespaces, CDATA, entidades e DOCTYPE sem expansão", () => {
  const raiz = lerXml(`<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x "expandido">]><ns:a xmlns:ns="u"><ns:b k='1'>A &amp; B &#233; &x;</ns:b><c/><!-- nada --><d><![CDATA[<cru>]]></d></ns:a>`);
  assert.ok(raiz);
  assert.equal(raiz.nome, "a");
  assert.deepEqual(raiz.filhos.map(f => f.nome), ["b", "c", "d"]);
  assert.equal(raiz.filhos[0].texto, "A & B é &x;", "entidade declarada no DOCTYPE não expande");
  assert.equal(raiz.filhos[0].atributos.k, "1");
  assert.equal(raiz.filhos[2].texto, "<cru>");
  assert.equal(lerXml("<a><b></a>"), null, "tag sem fechar");
  assert.equal(lerXml("texto qualquer"), null);
  assert.equal(lerXml("<a/><b/>"), null, "duas raízes");
});

test("NF-e autorizada: emitente, tomador, chave, itens, retenções e o PRONAC nas informações complementares", async () => {
  const nfe = await ler("nfe-autorizada.xml");
  assert.equal(nfe.formato, "nfe");
  assert.equal(nfe.tipo, "nfe");
  assert.deepEqual([nfe.modelo, nfe.serie, nfe.numero, nfe.emissao], ["55", "1", "1234", "2026-03-15"]);
  assert.equal(nfe.chave, "35260311222333000181550010000012341123456785");
  assert.equal(lerChaveAcesso(nfe.chave)?.ok, true, "a chave do XML passa no dígito verificador");
  assert.deepEqual(nfe.emitente, { documento: EMITENTE, nome: "Som & Luz Locações Ltda" });
  assert.deepEqual(nfe.tomador, { documento: PROPONENTE, nome: "Associação Cultural Exemplo" });
  assert.equal(nfe.valor, 2500);
  assert.deepEqual(nfe.retencoes, { iss: 0, inss: 0, irrf: 37.5, outras: 116.25 });
  assert.equal(nfe.descricao, "Locação de mesa de som; Locação de caixas acústicas");
  assert.deepEqual([nfe.autorizada, nfe.situacao], [true, "autorizada"]);

  const sugestao = despesaDoDocumento(nfe, contexto);
  assert.equal(sugestao.fornecedorId, "f1");
  assert.equal(sugestao.campos.identificacao_projeto, "presente", "PRONAC 23-5678 casa com 235678");
  assert.deepEqual(sugestao.avisos, []);
  assert.deepEqual(sugestao.campos, {
    tipo: "nfe", valor_extraido: 2500, data_doc: "2026-03-15", descricao_servico: "Locação de mesa de som; Locação de caixas acústicas",
    numero_documento: "1234", serie: "1", chave_acesso: "35260311222333000181550010000012341123456785",
    iss: 0, inss: 0, irrf: 37.5, outras_retencoes: 116.25, identificacao_projeto: "presente",
  });
});

test("NFC-e sem protocolo vira cupom e pede conferência na SEFAZ", async () => {
  const nfce = await ler("nfce-sem-protocolo.xml");
  assert.deepEqual([nfce.tipo, nfce.modelo, nfce.valor, nfce.autorizada, nfce.tomador.documento], ["cupom", "65", 77, null, null]);
  assert.equal(rotuloDoDocumento(nfce), "NFC-e");
  const { avisos, fornecedorId } = despesaDoDocumento(nfce, { ...contexto, fornecedores: [] });
  assert.equal(fornecedorId, null);
  assert.deepEqual(avisos.map(a => a.nivel), ["info", "info", "info"]);
  assert.match(avisos[0].texto, /protocolo de autorização/);
  assert.match(avisos[1].texto, /Mercado Exemplo \(11\.222\.333\/0001-81\) não está nos fornecedores/);
  assert.match(avisos[2].texto, /235678\) não aparece/);
});

test("NFS-e nacional: ISS retido pelo tomador, INSS, IRRF, CSLL, PIS e COFINS retidos, e o líquido confere", async () => {
  const nfse = await ler("nfse-nacional.xml");
  assert.deepEqual([nfse.formato, nfse.tipo, nfse.numero, nfse.serie, nfse.emissao], ["nfse_nacional", "nfse", "42", null, "2026-03-20"]);
  assert.equal(nfse.chave?.length, 50);
  assert.equal(lerChaveAcesso(nfse.chave)?.ok, true);
  assert.equal(nfse.valor, 1000);
  assert.deepEqual(nfse.retencoes, { iss: 50, inss: 110, irrf: 15, outras: 46.5 });
  assert.equal(nfse.liquidoInformado, 778.5);
  assert.deepEqual(nfse.tomador, { documento: PROPONENTE, nome: "Associação Cultural Exemplo" });
  const sugestao = despesaDoDocumento(nfse, contexto);
  assert.deepEqual(sugestao.avisos, [], "líquido igual ao valor menos as retenções");
  assert.equal(sugestao.campos.identificacao_projeto, "presente");
});

test("NFS-e ABRASF 2: tomador diferente do proponente; o líquido informado confere", async () => {
  const nfse = await ler("nfse-abrasf-v2.xml");
  assert.deepEqual([nfse.formato, nfse.numero, nfse.emissao, nfse.valor], ["nfse_abrasf", "2026000123", "2026-04-02", 3000]);
  assert.deepEqual(nfse.retencoes, { iss: 60, inss: 330, irrf: 45, outras: 0 });
  assert.deepEqual(nfse.emitente, { documento: EMITENTE, nome: "Produtora Exemplo Ltda" });
  assert.equal(nfse.tomador.documento, "34028316000103");
  assert.equal(nfse.autorizada, null);
  const { avisos } = despesaDoDocumento(nfse, contexto);
  assert.equal(avisos[0].nivel, "alerta");
  assert.match(avisos[0].texto, /emitida para Outra Empresa Tomadora SA \(34\.028\.316\/0001-03\), e não para o proponente/);
  assert.match(avisos[1].texto, /não aparece/);
  assert.equal(avisos.length, 2, "líquido 2.565 = 3.000 − 435: sem aviso");
});

test("NFS-e ABRASF 1 em ISO-8859-1, com vírgula decimal e cancelada", async () => {
  const nfse = await ler("nfse-abrasf-v1-cancelada.xml");
  assert.deepEqual([nfse.numero, nfse.valor, nfse.retencoes.iss, nfse.descricao], ["881", 1500, 0, "Montagem de palco"]);
  assert.equal(nfse.emitente.nome, "Palcos Exemplo ME");
  assert.equal(nfse.tomador.nome, "Associação Cultural Exemplo", "acentos lidos do Latin-1");
  assert.deepEqual([nfse.autorizada, nfse.situacao], [false, "cancelada"]);
  const { avisos } = despesaDoDocumento(nfse, contexto);
  assert.deepEqual(avisos[0], { nivel: "alerta", texto: "A nota está cancelada: não serve como comprovante." });
});

test("NFS-e de São Paulo: retenção de IR sem ISS retido, PRONAC depois da quebra de linha", async () => {
  const nfse = await ler("nfse-sp.xml");
  assert.deepEqual([nfse.formato, nfse.numero, nfse.emissao, nfse.valor, nfse.chave], ["nfse_sp", "8812", "2026-02-10", 800, null]);
  assert.deepEqual(nfse.retencoes, { iss: 0, inss: 0, irrf: 12, outras: 0 });
  assert.deepEqual(nfse.emitente, { documento: EMITENTE, nome: "Design Exemplo Ltda" });
  assert.deepEqual([nfse.autorizada, nfse.situacao], [true, "autorizada"]);
  const sugestao = despesaDoDocumento(nfse, contexto);
  assert.deepEqual([sugestao.avisos.length, sugestao.campos.identificacao_projeto, sugestao.fornecedorId], [0, "presente", "f1"]);
});

test("evento, XML de outro assunto e nota repetida", async () => {
  const evento = lerDocumentoFiscal(await exemplo("evento-cancelamento.xml"));
  assert.deepEqual(evento, { ok: false, codigo: "evento", motivo: "Este XML é um evento (cancelamento ou carta de correção), não a nota." });
  const outro = lerDocumentoFiscal("<pedido><item>1</item></pedido>");
  assert.equal(outro.ok ? "" : outro.codigo, "desconhecido", "XML de outro formato ainda pode ir para a IA");
  const invalido = lerDocumentoFiscal("isto não é xml");
  assert.equal(invalido.ok ? "" : invalido.codigo, "invalido");

  const nfe = await ler("nfe-autorizada.xml");
  const { avisos } = despesaDoDocumento(nfe, { ...contexto, chavesUsadas: [{ chave: "3526 0311 2223 3300 0181 5500 1000 0012 3411 2345 6785", nome: "nota.pdf" }] });
  assert.deepEqual(avisos, [{ nivel: "alerta", texto: 'Esta nota já está na prestação, em "nota.pdf".' }]);
});

test("identificador do projeto: com separadores, sem grudar em outros números", () => {
  assert.equal(identificadorNoTexto("235678", ["PRONAC 23.5678"]), true);
  assert.equal(identificadorNoTexto("235678", ["CNPJ 12235678000190"]), false, "dentro de outro número não conta");
  assert.equal(identificadorNoTexto("235678", ["PRONAC 2356789"]), false);
  assert.equal(identificadorNoTexto("2025/123", ["Processo 2025123"]), true);
  assert.equal(identificadorNoTexto("12", ["12"]), false, "curto demais para conferir");
  assert.equal(identificadorNoTexto(null, ["235678"]), false);
});

test("arquivo XML pelo nome ou pelo tipo", () => {
  assert.equal(ehXml({ name: "NOTA.XML", type: "" }), true);
  assert.equal(ehXml({ name: "nota", type: "application/xml" }), true);
  assert.equal(ehXml({ name: "nota", type: "text/xml" }), true);
  assert.equal(ehXml({ name: "nota.pdf", type: "application/pdf" }), false);
});
