import assert from "node:assert/strict";
import test from "node:test";
import {
  baixarArquivoDoChat,
  enderecoPermitido,
  impressaoDigital,
  LIMITE_ARQUIVO_BYTES,
  lerReferenciasDeArquivo,
  MAX_ARQUIVOS_POR_CHAMADA,
  tipoPeloConteudo,
} from "../lib/mcp/prestacao/arquivos";
import { arquivosDeTesteVencidos, caminhoDoDiagnostico, IDADE_MAXIMA_DO_TESTE_MS, pastaDoDiagnostico, pastaENomeDoDiagnostico } from "../lib/mcp/prestacao/diagnostico";

const LINK = "https://files.oaiusercontent.com/file-abc?sig=1";

test("as referências do ChatGPT aceitam objetos com link e descartam o que não dá para baixar", () => {
  const lidas = lerReferenciasDeArquivo([
    { name: "nota.pdf", id: "file-1", mime_type: "application/pdf", download_link: LINK },
    { name: "sem-link.pdf", id: "file-2" },
    "file-3",
    LINK,
    null,
    42,
    { download_link: "" },
  ]);
  assert.equal(lidas.length, 2);
  assert.deepEqual(lidas[0], { nome: "nota.pdf", id: "file-1", mime_type: "application/pdf", download_link: LINK });
  assert.equal(lidas[1].download_link, LINK);
  assert.equal(lidas[1].nome, "arquivo");
});

test("o que não é lista vira lista vazia, e a lista é cortada no limite da plataforma", () => {
  for (const valor of [undefined, null, "texto", 7, {}]) assert.deepEqual(lerReferenciasDeArquivo(valor), []);
  const muitas = Array.from({ length: MAX_ARQUIVOS_POR_CHAMADA + 5 }, (_, i) => ({ name: `n${i}`, download_link: LINK }));
  assert.equal(lerReferenciasDeArquivo(muitas).length, MAX_ARQUIVOS_POR_CHAMADA);
});

test("só endereço https público passa: nada de rede interna, número, usuário ou protocolo estranho", () => {
  assert.ok(enderecoPermitido(LINK));
  const recusados = [
    "http://files.oaiusercontent.com/a",
    "ftp://files.oaiusercontent.com/a",
    "file:///etc/passwd",
    "https://localhost/a",
    "https://app.localhost/a",
    "https://servico.internal/a",
    "https://impressora.local/a",
    "https://intranet/a",
    "https://127.0.0.1/a",
    "https://169.254.169.254/latest/meta-data",
    "https://10.0.0.5/a",
    "https://[::1]/a",
    "https://usuario:senha@files.oaiusercontent.com/a",
    "não é endereço",
    "",
  ];
  for (const texto of recusados) assert.equal(enderecoPermitido(texto), null, texto);
});

test("só domínio de arquivos do ChatGPT passa: nome público qualquer, mesmo parecido, não vale", () => {
  for (const ok of [LINK, "https://cdn.openai.com/a", "https://files.chatgpt.com/a", "https://oaiusercontent.com/a", "https://a.b.oaiusercontent.com/a"]) {
    assert.ok(enderecoPermitido(ok), ok);
  }
  const recusados = [
    "https://127.0.0.1.nip.io/x",
    "https://169.254.169.254.nip.io/x",
    "https://evil.example.com/x",
    "https://files.oaiusercontent.com.evil.com/x",
    "https://notoaiusercontent.com/x",
    "https://oaiusercontent.com.br/x",
    "https://openai.com.evil.test/x",
    "https://evil-openai.com/x",
    "https://metadata.google.internal/x",
  ];
  for (const texto of recusados) assert.equal(enderecoPermitido(texto), null, texto);
});

test("MCP_ARQUIVOS_HOSTS_EXTRAS acrescenta domínios sem mexer no código, com os subdomínios deles", () => {
  const antes = process.env.MCP_ARQUIVOS_HOSTS_EXTRAS;
  try {
    assert.equal(enderecoPermitido("https://arquivos.exemplo.com.br/a"), null);
    process.env.MCP_ARQUIVOS_HOSTS_EXTRAS = " exemplo.com.br, .outro.net ,";
    assert.ok(enderecoPermitido("https://arquivos.exemplo.com.br/a"));
    assert.ok(enderecoPermitido("https://x.outro.net/a"));
    assert.equal(enderecoPermitido("https://exemplo.com.br.evil.com/a"), null);
    assert.equal(enderecoPermitido("https://127.0.0.1.nip.io/a"), null, "o extra não abre o resto");
  } finally {
    if (antes === undefined) delete process.env.MCP_ARQUIVOS_HOSTS_EXTRAS;
    else process.env.MCP_ARQUIVOS_HOSTS_EXTRAS = antes;
  }
});

function respostaFalsa(corpo: Buffer | string, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(typeof corpo === "string" ? corpo : new Uint8Array(corpo), { status: init.status ?? 200, headers: init.headers });
}

test("baixa o arquivo, devolve os bytes e o host, e não manda credencial nem segue redirecionamento sozinho", async () => {
  const chamadas: Array<{ url: string; redirect: unknown }> = [];
  const buscar = (async (entrada: URL | string, opcoes?: RequestInit) => {
    chamadas.push({ url: String(entrada), redirect: opcoes?.redirect });
    return respostaFalsa("%PDF-1.7 conteúdo");
  }) as typeof fetch;

  const resultado = await baixarArquivoDoChat(LINK, buscar);
  assert.ok(resultado.ok);
  assert.equal(resultado.bytes.toString("latin1").startsWith("%PDF-"), true);
  assert.equal(resultado.host, "files.oaiusercontent.com");
  assert.deepEqual(chamadas, [{ url: LINK, redirect: "manual" }]);
});

test("link de domínio que não é do ChatGPT é recusado sem fazer requisição nenhuma, e o diagnóstico mostra o domínio", async () => {
  let requisicoes = 0;
  const buscar = (async () => {
    requisicoes++;
    return respostaFalsa("%PDF-1.7");
  }) as unknown as typeof fetch;

  const alheio = await baixarArquivoDoChat("https://127.0.0.1.nip.io/x", buscar);
  assert.ok(!alheio.ok);
  assert.equal(alheio.host, "127.0.0.1.nip.io");
  assert.match(alheio.erro, /domínio que o Jards não aceita/);

  const numerico = await baixarArquivoDoChat("https://10.0.0.5/x", buscar);
  assert.ok(!numerico.ok);
  assert.equal(numerico.host, null);
  assert.match(numerico.erro, /https público/);
  assert.equal(requisicoes, 0, "nenhuma requisição saiu");
});

test("redirecionamento para fora das regras é recusado, e o que passa é conferido a cada salto", async () => {
  const para = (location: string) => (async () => respostaFalsa("", { status: 302, headers: { location } })) as unknown as typeof fetch;

  const interno = await baixarArquivoDoChat(LINK, para("https://169.254.169.254/latest"));
  assert.ok(!interno.ok);
  assert.match(interno.erro, /redirecionou para um endereço não permitido/);

  const aberto = await baixarArquivoDoChat(LINK, para("http://files.oaiusercontent.com/x"));
  assert.ok(!aberto.ok);

  const deOutroDominio = await baixarArquivoDoChat(LINK, para("https://127.0.0.1.nip.io/x"));
  assert.ok(!deOutroDominio.ok);
  assert.match(deOutroDominio.erro, /redirecionou para um endereço não permitido \(127\.0\.0\.1\.nip\.io\)/, "o domínio recusado aparece, para quem diagnostica");

  let saltos = 0;
  const infinito = (async () => {
    saltos++;
    return respostaFalsa("", { status: 302, headers: { location: `https://files.oaiusercontent.com/${saltos}` } });
  }) as unknown as typeof fetch;
  const laco = await baixarArquivoDoChat(LINK, infinito);
  assert.ok(!laco.ok);
  assert.match(laco.erro, /Redirecionamentos demais/);
  assert.ok(saltos <= 4, `seguiu ${saltos} redirecionamentos`);

  const relativo = (async (entrada: URL | string) =>
    String(entrada) === LINK ? respostaFalsa("", { status: 301, headers: { location: "/outro?sig=2" } }) : respostaFalsa("%PDF-ok")) as typeof fetch;
  const seguiu = await baixarArquivoDoChat(LINK, relativo);
  assert.ok(seguiu.ok);
});

test("link vencido, arquivo grande demais e rede fora viram erro claro, sem derrubar a chamada", async () => {
  const vencido = await baixarArquivoDoChat(LINK, (async () => respostaFalsa("expirou", { status: 403 })) as unknown as typeof fetch);
  assert.ok(!vencido.ok);
  assert.match(vencido.erro, /403/);
  assert.match(vencido.erro, /5 minutos/);

  const declarado = await baixarArquivoDoChat(
    LINK,
    (async () => respostaFalsa("x", { headers: { "content-length": String(LIMITE_ARQUIVO_BYTES + 1) } })) as unknown as typeof fetch
  );
  assert.ok(!declarado.ok);
  assert.match(declarado.erro, /15 MB/);

  const grande = Buffer.alloc(LIMITE_ARQUIVO_BYTES + 10, 65);
  const semCabecalho = await baixarArquivoDoChat(LINK, (async () => respostaFalsa(grande)) as unknown as typeof fetch);
  assert.ok(!semCabecalho.ok);
  assert.match(semCabecalho.erro, /15 MB/);

  const quebrou = await baixarArquivoDoChat(LINK, (async () => {
    throw new Error("ECONNRESET com detalhe interno");
  }) as unknown as typeof fetch);
  assert.ok(!quebrou.ok);
  assert.ok(!/ECONNRESET|interno/.test(quebrou.erro), "o erro técnico não vai para o assistente");

  const invalido = await baixarArquivoDoChat("http://127.0.0.1/a", (async () => {
    throw new Error("não deveria buscar");
  }) as unknown as typeof fetch);
  assert.ok(!invalido.ok);
  assert.equal(invalido.host, null);
});

test("o tipo vem dos bytes, não do nome nem do que o cliente declarou", () => {
  const caso = (bytes: Buffer | number[] | string) => tipoPeloConteudo(Buffer.isBuffer(bytes) ? bytes : typeof bytes === "string" ? Buffer.from(bytes, "utf8") : Buffer.from(bytes));
  assert.equal(caso("%PDF-1.4\n..."), "pdf");
  assert.equal(caso([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), "png");
  assert.equal(caso([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]), "jpeg");
  assert.equal(caso("GIF89a......"), "gif");
  assert.equal(caso("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "), "webp");
  assert.equal(caso(Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic")])), "heic");
  assert.equal(caso([0x50, 0x4b, 0x03, 0x04, 0, 0]), "zip");
  assert.equal(caso('<?xml version="1.0" encoding="UTF-8"?><NFe/>'), "xml");
  assert.equal(caso("﻿<nfeProc versao=\"4.00\"></nfeProc>"), "xml");
  assert.equal(caso("data;valor;descricao\n01/01/2026;10,00;teste"), "texto");
  assert.equal(caso([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]), "desconhecido");
  // Um .pdf que não começa com %PDF- não é PDF.
  assert.notEqual(caso("<html>isto não é pdf</html>"), "pdf");
});

test("a impressão digital é o SHA-256 completo e igual para o mesmo conteúdo", () => {
  const a = impressaoDigital(Buffer.from("nota fiscal"));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, impressaoDigital("nota fiscal"));
  assert.notEqual(a, impressaoDigital("nota fiscal 2"));
});

test("o arquivo de teste do diagnóstico fica numa pasta própria da organização", () => {
  const org = "5c1b0f0e-0000-4000-8000-000000000001";
  const arquivo = "5c1b0f0e-0000-4000-8000-0000000000aa";
  assert.equal(pastaDoDiagnostico(org), `diagnostico-mcp/${org}`);
  assert.equal(caminhoDoDiagnostico(org, arquivo), `diagnostico-mcp/${org}/${arquivo}.bin`);
  assert.deepEqual(pastaENomeDoDiagnostico(org, arquivo), { pasta: `diagnostico-mcp/${org}`, nome: `${arquivo}.bin` });
  assert.ok(!caminhoDoDiagnostico(org, arquivo).includes("prestacoes/"), "nunca na pasta das prestações");
});

test("só o arquivo de teste com mais de um dia é apagado na faxina", () => {
  const agora = Date.parse("2026-10-19T12:00:00Z");
  const horas = (h: number) => new Date(agora - h * 3_600_000).toISOString();
  const vencidos = arquivosDeTesteVencidos(
    [
      { name: "novo.bin", created_at: horas(1) },
      { name: "quase.bin", created_at: new Date(agora - IDADE_MAXIMA_DO_TESTE_MS + 60_000).toISOString() },
      { name: "velho.bin", created_at: horas(30) },
      { name: "sem-data.bin", created_at: null },
      { name: "data-ruim.bin", created_at: "ontem" },
    ],
    agora
  );
  assert.deepEqual(vencidos, ["velho.bin"]);
});
