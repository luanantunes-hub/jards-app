import assert from "node:assert/strict";
import test from "node:test";
import {
  aplicarRecorte,
  conteudoDoHtml,
  conteudoDoVolto,
  conteudoParaHash,
  decodificarBytes,
  diferencaDeLinhas,
  formatoDoArquivo,
  resumoDaMudanca,
  sha256Hex,
  textoDoXmlOffice,
  urlDaApiVolto,
} from "../supabase/functions/_shared/vigia-paginas";

// Trechos no formato das páginas reais (gov.br em Plone clássico, Planalto,
// API do Volto), encurtados.
const PLONE = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>IN 29 — Ministério da Cultura</title>
<script>var x = "<div id='content'>";</script></head><body>
<nav id="main-navigation"><a href="/cultura/pt-br/assuntos">Assuntos</a></nav>
<div id="content">
  <h1 class="documentFirstHeading">INSTRUÇÃO NORMATIVA MINC Nº 29, DE 29 DE JANEIRO DE 2026</h1>
  <div class="documentDescription">Estabelece procedimentos relativos à prestação de contas.</div>
  <div class="social-links"><a href="https://facebook.com/share">Compartilhe por Facebook</a></div>
  <div id="plone-document-byline" class="documentByLine">Publicado em 30/01/2026 11h01 <span>Atualizado em</span> 07/09/2026 16h15</div>
  <div id="content-core"><div id="parent-fieldname-text">
    <p>Art. 1º Esta Instrução&nbsp;Normativa estabelece&#8230;</p>
    <p>Art. 2º O limite é de 15% (<strong>quinze</strong> por cento).</p>
    <table><tr><td>Faixa</td><td>Até R$ 500 mil</td></tr></table>
    <p><a href="anexos/modelo-relatorio.docx/@@download/file">Modelo de relatório</a> e <a href="/cultura/pt-br/noticias">notícias</a></p>
  </div></div>
</div>
<footer id="footer-govbr">Todo o conteúdo deste site está publicado sob a licença</footer>
</body></html>`;

test("Plone clássico: texto principal sem menu, compartilhar nem data de atualização", () => {
  const c = conteudoDoHtml(PLONE, "https://www.gov.br/cultura/pt-br/legislacao/in-29");
  assert.equal(c.titulo, "INSTRUÇÃO NORMATIVA MINC Nº 29, DE 29 DE JANEIRO DE 2026");
  assert.equal(c.atualizadoEm, "07/09/2026 16h15");
  assert.equal(c.texto, [
    "INSTRUÇÃO NORMATIVA MINC Nº 29, DE 29 DE JANEIRO DE 2026",
    "Estabelece procedimentos relativos à prestação de contas.",
    "Art. 1º Esta Instrução Normativa estabelece…",
    "Art. 2º O limite é de 15% (quinze por cento).",
    "Faixa Até R$ 500 mil",
    "Modelo de relatório e notícias",
  ].join("\n"));
  assert.deepEqual(c.arquivos, [{
    nome: "Modelo de relatório",
    url: "https://www.gov.br/cultura/pt-br/legislacao/anexos/modelo-relatorio.docx/@@download/file",
  }]);
});

test("a data de atualização não muda o hash; o texto e os arquivos, sim", async () => {
  const base = "https://www.gov.br/cultura/pt-br/legislacao/in-29";
  const hash = async (html: string) => sha256Hex(conteudoParaHash(conteudoDoHtml(html, base)));
  const original = await hash(PLONE);
  assert.equal(await hash(PLONE.replace("07/09/2026 16h15", "08/10/2026 09h00")), original);
  assert.notEqual(await hash(PLONE.replace("15% (", "20% (")), original);
  assert.notEqual(await hash(PLONE.replace("modelo-relatorio.docx", "modelo-relatorio-2026.docx")), original);
});

test("Planalto: windows-1252 sem charset declarado", () => {
  const html = "<html><head><title>Lcp 222</title></head><body><p>Art. 3º A dedução é limitada.</p><p>Brasília, 26 de novembro de 2025</p></body></html>";
  const bytes = Uint8Array.from([...html].map(c => c.charCodeAt(0)));
  const texto = decodificarBytes(bytes, "text/html");
  assert.match(texto, /Art\. 3º A dedução/);
  const c = conteudoDoHtml(texto, "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp222.htm");
  assert.equal(c.titulo, "Lcp 222");
  assert.equal(c.texto, "Art. 3º A dedução é limitada.\nBrasília, 26 de novembro de 2025");
  assert.equal(decodificarBytes(new TextEncoder().encode("ação"), "text/html; charset=utf-8"), "ação");
});

const VOLTO = {
  "@id": "https://www.gov.br/esporte/pt-br/lie/modelos-e-manuais-3",
  "@type": "Document",
  title: "Modelos e Manuais",
  description: "",
  modified: "2026-07-08T15:27:50+00:00",
  blocks: {
    a: { "@type": "title" },
    b: { "@type": "dateSocialShareBlock" },
    c: {
      "@type": "slate",
      value: [
        { type: "p", children: [{ text: "Os modelos da LIE ficam " }, { type: "link", data: { url: "https://www.gov.br/esporte/pt-br/lie/manual.pdf/@@display-file/file" }, children: [{ text: "neste manual" }] }, { text: "." }] },
        { type: "ul", children: [{ type: "li", children: [{ text: "Formulário PCP/PCF 2026" }] }] },
      ],
    },
    d: {
      "@type": "columnsBlock",
      data: {
        blocks: {
          e: { blocks: { f: { "@type": "html", html: "<p>Art. 1º <a href='/esporte/pt-br/lie/rco.docx/@@download/file'>Modelo RCO</a></p>" } }, blocks_layout: { items: ["f"] } },
        },
        blocks_layout: { items: ["e"] },
      },
    },
  },
  blocks_layout: { items: ["a", "b", "c", "d"] },
  items: [
    { "@id": "https://www.gov.br/esporte/pt-br/lie/modelos-e-manuais-3/formulario-pcp.xlsx", "@type": "File", title: "FormularioPCPPCFatualizado2026" },
    { "@id": "https://www.gov.br/esporte/pt-br/lie/modelos-e-manuais-3/capa.png", "@type": "Image", title: "Capa" },
  ],
};

test("Volto: blocos na ordem, sanfona e colunas, links e arquivos da pasta", () => {
  const c = conteudoDoVolto(VOLTO, VOLTO["@id"]);
  assert.ok(c);
  assert.equal(c.titulo, "Modelos e Manuais");
  assert.equal(c.atualizadoEm, "2026-07-08T15:27:50+00:00");
  assert.equal(c.texto, "Modelos e Manuais\nOs modelos da LIE ficam neste manual.\nFormulário PCP/PCF 2026\nArt. 1º Modelo RCO");
  assert.deepEqual(c.arquivos.map(a => a.nome), ["neste manual", "Modelo RCO", "FormularioPCPPCFatualizado2026"]);
  assert.equal(c.arquivos[2].url, "https://www.gov.br/esporte/pt-br/lie/modelos-e-manuais-3/formulario-pcp.xlsx/@@download/file");
  assert.equal(conteudoDoVolto({ message: "Resource not found" }, VOLTO["@id"]), null);
});

test("endereço da API do Volto só para páginas do gov.br", () => {
  assert.equal(
    urlDaApiVolto("https://www.gov.br/ancine/pt-br/assuntos/manuais"),
    "https://www.gov.br/ancine/++api++/pt-br/assuntos/manuais?b_size=500",
  );
  assert.equal(urlDaApiVolto("https://www.gov.br/ancine/pt-br/manuais/STR.pdf/@@display-file/file"), null);
  assert.equal(urlDaApiVolto("https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp222.htm"), null);
  assert.equal(formatoDoArquivo("https://www.gov.br/x/STR.pdf/@@display-file/file", "application/octet-stream"), "pdf");
  assert.equal(formatoDoArquivo("https://www.gov.br/x/modelo.docx/@@download/file", null), "docx");
  assert.equal(formatoDoArquivo("https://www.gov.br/x/modelo.doc/@@download/file", "application/msword"), "arquivo");
});

test("recorte de fonte enorme: do anexo até o próximo, como está escrito", () => {
  const texto = [
    "Índice",
    "Anexo LXXXVI DAS REGRAS",
    "Anexo LXXXVII DO OUTRO",
    "ANEXO LXXXV",
    "Art. 1º Outro programa.",
    "ANEXO LXXXVI",
    "(Revogado)",
    "ANEXO LXXXVI-A",
    "Art. 1º Ficam estabelecidos os procedimentos do Pronon.",
    "ANEXO LXXXVII",
    "Art. 1º Outro programa.",
  ].join("\n");
  const r = aplicarRecorte(texto, { de: "ANEXO LXXXVI", ate: "ANEXO LXXXVII" });
  assert.equal(r.achou, true);
  assert.equal(r.texto, "ANEXO LXXXVI\n(Revogado)\nANEXO LXXXVI-A\nArt. 1º Ficam estabelecidos os procedimentos do Pronon.");
  assert.deepEqual(aplicarRecorte(texto, { de: "ANEXO XC" }), { texto, achou: false });
  assert.deepEqual(aplicarRecorte(texto, null), { texto, achou: true });
});

test("diferença por linhas e resumo da mudança", () => {
  const antes = ["Art. 1º A.", "Art. 2º O limite é 15%.", "Art. 3º C.", "Art. 4º D."];
  const depois = ["Art. 1º A.", "Art. 2º O limite é 20%.", "Art. 3º C.", "Art. 4º D.", "Art. 5º E."];
  assert.deepEqual(diferencaDeLinhas(antes, depois), [
    { tipo: "igual", linhas: ["Art. 1º A."] },
    { tipo: "retirado", linhas: ["Art. 2º O limite é 15%."] },
    { tipo: "novo", linhas: ["Art. 2º O limite é 20%."] },
    { tipo: "igual", linhas: ["Art. 3º C.", "Art. 4º D."] },
    { tipo: "novo", linhas: ["Art. 5º E."] },
  ]);
  assert.deepEqual(diferencaDeLinhas(antes, antes), [{ tipo: "igual", linhas: antes }]);
  // Acima do limite de passos, tudo o que mudou aparece como trocado.
  assert.deepEqual(diferencaDeLinhas(["a", "b"], ["c", "d"], 1), [
    { tipo: "retirado", linhas: ["a", "b"] },
    { tipo: "novo", linhas: ["c", "d"] },
  ]);

  const manual = { nome: "Manual v2.1", url: "https://www.gov.br/x/manual-v21.pdf/@@display-file/file" };
  const novo = { nome: "Manual v2.2", url: "https://www.gov.br/x/manual-v22.pdf/@@download/file" };
  assert.deepEqual(resumoDaMudanca(null, { texto: "a\nb", arquivos: [manual] }), {
    motivos: ["primeira coleta: 2 linhas", "1 arquivo ligado"],
    resumo: null,
  });
  assert.deepEqual(resumoDaMudanca({ texto: antes.join("\n"), arquivos: [manual] }, { texto: depois.join("\n"), arquivos: [novo] }), {
    motivos: [
      "texto mudou em 2 trechos (2 linhas novas, 1 retirada)",
      "arquivo novo: Manual v2.2",
      "arquivo retirado: Manual v2.1",
    ],
    resumo: "Art. 2º O limite é 20%.",
  });
  assert.deepEqual(resumoDaMudanca({ texto: "a", arquivos: [manual] }, { texto: "a", arquivos: [{ ...manual, url: manual.url.replace("display-file", "download") }] }), {
    motivos: ["o arquivo mudou, mas o texto lido é o mesmo"],
    resumo: null,
  });
});

test("texto de .docx, .xlsx e .odt", () => {
  assert.equal(
    textoDoXmlOffice('<w:document><w:body><w:p><w:r><w:t>Relatório de</w:t></w:r><w:r><w:tab/><w:t>Cumprimento</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">do Objeto &amp; metas</w:t></w:r></w:p></w:body></w:document>'),
    "Relatório de Cumprimento\ndo Objeto & metas",
  );
  assert.equal(textoDoXmlOffice("<sst><si><t>Receita e Despesa</t></si><si><t>Pagamentos</t></si></sst>"), "Receita e Despesa\nPagamentos");
  assert.equal(textoDoXmlOffice("<office:text><text:h>Declaração</text:h><text:p>Declaro<text:s/>que</text:p></office:text>"), "Declaração\nDeclaro que");
});
