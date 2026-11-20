import assert from "node:assert/strict";
import test from "node:test";
import { chaveDoArtigo, lerArtigoDou, textoDeHtml, triarArtigo } from "../supabase/functions/_shared/vigia-dou";

// Atos no formato do XML do INLABS, encurtados a partir de edições reais.
function xml(campos: { tipo: string; orgao: string; titulo: string; ementa?: string; texto: string; idMateria?: string }) {
  return `\uFEFF<xml><article id="51428188" name="ato" idOficio="1" pubName="DO1" artType="${campos.tipo}" pubDate="23/09/2026" artClass="" artCategory="${campos.orgao}" artSize="12" artNotes="" numberPage="3" pdfPage="http://pesquisa.in.gov.br/imprensa/jsp/visualiza/index.jsp?data=23/09/2026&amp;jornal=515&amp;pagina=3" editionNumber="180" idMateria="${campos.idMateria ?? "24398476"}">
  <body>
    <Identifica><![CDATA[ ${campos.titulo}]]></Identifica>
    <Data><![CDATA[]]></Data>
    <Ementa><![CDATA[ ${campos.ementa ?? ""}]]></Ementa>
    <Titulo />
    <SubTitulo />
    <Texto><![CDATA[<p class="identifica">${campos.titulo}</p>${campos.texto}]]></Texto>
  </body>
</article></xml>`;
}

const LEI_PRONON = xml({
  tipo: "Lei",
  orgao: "Atos do Poder Legislativo",
  titulo: "LEI Nº 15.513, DE 22 DE SETEMBRO DE 2026",
  ementa: "Altera a Lei nº 12.715, de 17 de setembro de 2012, para prorrogar a faculdade de dedução do imposto sobre a renda dos valores correspondentes a doações e patrocínios destinados ao Programa Nacional de Apoio à Atenção Oncológica (Pronon) e ao Programa Nacional de Apoio à Atenção da Saúde da Pessoa com Deficiência (Pronas/PCD).",
  texto: "<p>Faço saber que o Congresso Nacional decreta e eu sanciono a seguinte Lei:</p><p>Art. 1º Esta Lei altera a Lei nº 12.715 &amp; prorroga a dedução.</p>",
});

test("lê o ato do XML do INLABS", () => {
  const artigo = lerArtigoDou(LEI_PRONON);
  assert.ok(artigo);
  assert.equal(artigo.publicadoEm, "2026-09-23");
  assert.equal(artigo.edicao, "DO1");
  assert.equal(artigo.tipo, "Lei");
  assert.equal(artigo.orgao, "Atos do Poder Legislativo");
  assert.equal(artigo.titulo, "LEI Nº 15.513, DE 22 DE SETEMBRO DE 2026");
  assert.match(artigo.ementa, /^Altera a Lei nº 12\.715/);
  assert.equal(artigo.pdf, "http://pesquisa.in.gov.br/imprensa/jsp/visualiza/index.jsp?data=23/09/2026&jornal=515&pagina=3");
  assert.match(artigo.texto, /Art\. 1º Esta Lei altera a Lei nº 12\.715 & prorroga a dedução\.$/);
  assert.equal(chaveDoArtigo(artigo), "dou:24398476");
  assert.equal(lerArtigoDou("<xml>sem ato</xml>"), null);
  assert.equal(textoDeHtml("<p>Art.&nbsp;1º</p><p>&#8220;vigência&#8221;</p>"), "Art. 1º “vigência”");
});

const triar = (campos: Parameters<typeof xml>[0]) => triarArtigo(lerArtigoDou(xml(campos))!);

test("a mudança de regra de um regime vira aviso", () => {
  assert.deepEqual(triarArtigo(lerArtigoDou(LEI_PRONON)!), { categoria: "norma", motivos: ["PRONON", "PRONAS/PCD"] });
  const instrucao = triar({
    tipo: "Instrução Normativa",
    orgao: "Ministério da Cultura/Gabinete do Ministro",
    titulo: "INSTRUÇÃO NORMATIVA MINC Nº 40, DE 1º DE OUTUBRO DE 2026",
    ementa: "Altera a Instrução Normativa MinC nº 29, de 2026, que regulamenta o mecanismo de incentivo da Lei nº 8.313, de 23 de dezembro de 1991.",
    texto: "<p>Art. 1º O art. 40 passa a vigorar com a seguinte redação.</p>",
  });
  assert.deepEqual(instrucao, { categoria: "norma", motivos: ["Lei Rouanet (Lei 8.313/1991)", "Ministério da Cultura"] });
  const esporte = triar({
    tipo: "Portaria",
    orgao: "Ministério do Esporte/Gabinete do Ministro",
    titulo: "PORTARIA MESP Nº 102, DE 29 DE SETEMBRO DE 2026",
    ementa: "Estabelece critérios e orientações para a execução de emendas parlamentares no âmbito do Ministério do Esporte.",
    texto: "<p>Art. 9º A prestação de contas observará a Portaria Conjunta MGI/MF/CGU nº 33, de 2023.</p>",
  });
  assert.deepEqual(esporte, { categoria: "norma", motivos: ["Ministério do Esporte", 'cita "prestação de contas"'] });
});

test("atos de rotina e de outros assuntos não viram aviso", () => {
  // Aprovação de projetos da Rouanet, publicada todos os dias.
  assert.equal(triar({
    tipo: "Portaria",
    orgao: "Ministério da Cultura/Secretaria de Fomento e Incentivo à Cultura",
    titulo: "PORTARIA SEFIC/MINC Nº 680, DE 6 DE OUTUBRO DE 2026",
    texto: "<p>O SECRETÁRIO DE FOMENTO E INCENTIVO À CULTURA, no uso das atribuições legais, resolve:</p><p>Art. 1º Aprovar os projetos culturais relacionados no anexo, para os quais os proponentes ficam autorizados a captar recursos, mediante doações ou patrocínios, na forma prevista na Lei nº 8.313, de 23 de dezembro de 1991.</p>",
  }).categoria, "rotina");
  // A lista do anexo, que sai como outro arquivo.
  assert.equal(triar({
    tipo: "Portaria",
    orgao: "Ministério da Cultura/Secretaria de Fomento e Incentivo à Cultura",
    titulo: "",
    texto: "<p>ÁREA: 3 Música (Artigo 18 , § 1º ) 267858 - Educação Musical Popular CNPJ/CPF: 51.282.675/0001-01 Lei nº 8.313</p>",
  }).categoria, "rotina");
  // Projetos desportivos aprovados.
  assert.equal(triar({
    tipo: "Deliberação",
    orgao: "Ministério do Esporte/Secretaria Executiva/Diretoria de Programas e Políticas de Incentivo ao Esporte",
    titulo: "DELIBERAÇÃO Nº 1.859, DE 6 DE OUTUBRO DE 2026",
    ementa: "Dá publicidade aos projetos desportivos, relacionados no anexo I, aprovados nas reuniões ordinárias.",
    texto: "<p>Lei nº 11.438, de 29 de dezembro de 2006.</p>",
  }).categoria, "rotina");
  // Indeferimento de um projeto do PRONON.
  assert.equal(triar({
    tipo: "Portaria",
    orgao: "Ministério da Saúde/Secretaria Executiva",
    titulo: "PORTARIA SE/MS Nº 985, DE 7 DE OUTUBRO DE 2026",
    ementa: "Indefere Projeto no âmbito do Programa Nacional de Apoio à Atenção Oncológica (PRONON).",
    texto: "<p>Art. 1º Fica indeferido o projeto.</p>",
  }).categoria, "rotina");
  // Despacho da ANCINE sobre um processo.
  assert.equal(triar({
    tipo: "Despacho",
    orgao: "Ministério da Cultura/Agência Nacional do Cinema",
    titulo: "Despacho nº 139-E, DE 5 DE OUTUBRO DE 2026",
    texto: "<p>Medida Provisória nº 2.228-1, de 2001.</p>",
  }).categoria, "rotina");
  // Programa com nome parecido (PRONASCI), em outro órgão.
  assert.deepEqual(triar({
    tipo: "Portaria",
    orgao: "Ministério do Planejamento e Orçamento/Gabinete do Ministro",
    titulo: "",
    texto: "<p>Crédito suplementar PRONASCI - Programa Nacional de Segurança Pública com Cidadania.</p>",
  }), { categoria: null, motivos: [] });
  // Órgão vigiado, mas sem tratar de prestação de contas ou incentivo.
  assert.deepEqual(triar({
    tipo: "Portaria",
    orgao: "Ministério da Cultura/Gabinete do Ministro",
    titulo: "PORTARIA MINC Nº 320, DE 29 DE SETEMBRO DE 2026",
    ementa: "Estabelece as metas de desempenho institucional.",
    texto: "<p>Art. 1º Ficam estabelecidas as metas.</p>",
  }), { categoria: null, motivos: [] });
  // Regras do SUS: a saúde só entra pelo PRONON e pelo PRONAS/PCD.
  assert.equal(triar({
    tipo: "Portaria",
    orgao: "Ministério da Saúde/Gabinete do Ministro",
    titulo: "Portaria GM/MS Nº 12.252, DE 29 DE SETEMBRO DE 2026",
    ementa: "Dispõe sobre as regras relativas a emendas individuais.",
    texto: "<p>A prestação de contas dos recursos repassados fundo a fundo.</p>",
  }).categoria, null);
});
