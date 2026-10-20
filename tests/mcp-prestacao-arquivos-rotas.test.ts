import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { afterEach } from "node:test";
import { GET as arquivosGET, POST as arquivosPOST } from "../app/api/mcp/prestacoes/[id]/arquivos/route";
import { POST as conferirPOST } from "../app/api/mcp/prestacoes/[id]/arquivos/conferir/route";
import { POST as envioPOST } from "../app/api/mcp/prestacoes/[id]/arquivos/envio/route";
import { memoriaFalsa } from "./_helpers/memoria-falsa";
import { construirSpecPrestacao } from "../lib/mcp/openapi-prestacao";
import { DE_OUTRA_ORG, ORG, PRESTACAO, comId, daTabela, ler, pedido, prepararComStorage } from "./_helpers/prestacao-cenario";

const PDF = Buffer.from("%PDF-1.7 comprovante de teste");
const FOTO = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]), Buffer.from("JFIF foto de teste")]);
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

const tabelasVazias = () => memoriaFalsa({ assistente_arquivos: [], assistente_acoes: [], assistente_sessoes_envio: [] });
const nfeXml = () => readFile("tests/fixtures/fiscal/nfe-autorizada.xml", "utf8");

const enviar = (corpo: unknown, id: string = PRESTACAO) => arquivosPOST(pedido(`/prestacoes/${id}/arquivos`, { metodo: "POST", corpo }), comId(id));
const preparar = (corpo: unknown, id: string = PRESTACAO) => envioPOST(pedido(`/prestacoes/${id}/arquivos/envio`, { metodo: "POST", corpo }), comId(id));
const conferir = (corpo: unknown = {}, id: string = PRESTACAO) => conferirPOST(pedido(`/prestacoes/${id}/arquivos/conferir`, { metodo: "POST", corpo }), comId(id));
/** A mesma conferência, disparada sem esperar a outra terminar (a resposta chega em Promise para o Promise.all intercalar as duas). */
const conferirEmParalelo = (arquivoId: string) => conferirPOST(pedido(`/prestacoes/${PRESTACAO}/arquivos/conferir`, { metodo: "POST", corpo: { arquivo_ids: [arquivoId] } }), comId(PRESTACAO));

test("texto de XML colado no chat vira arquivo da caixa de entrada, com o resumo da nota e sem caminho do Storage", async () => {
  const memoria = tabelasVazias();
  const { chamadas } = prepararComStorage({ escopo: "write" }, memoria.resolver);
  const xml = await nfeXml();

  const { status, corpo } = await ler(await enviar({ conteudo_texto: xml, nome_do_arquivo: "nf-1234.xml" }));
  assert.equal(status, 200);
  assert.equal(corpo.recebidos, 1);
  const [arquivo] = corpo.arquivos;
  assert.equal(arquivo.ok, true);
  assert.equal(arquivo.repetido, false);
  assert.equal(arquivo.situacao, "recebido");
  assert.equal(arquivo.tipo, "xml");
  assert.equal(arquivo.destino, "despesa");
  assert.equal(arquivo.fiscal.legivel, true);
  assert.equal(arquivo.fiscal.valor_bruto, 2500);
  assert.equal(arquivo.fiscal.numero, "1234");
  assert.equal(arquivo.fiscal.emitente.documento, "11.222.333/0001-81");
  assert.match(corpo.proximo_passo, /registrar_despesas/);
  assert.ok(!JSON.stringify(corpo).includes("storage_path") && !JSON.stringify(corpo).includes(ORG), "o caminho do Storage não sai");

  const upload = chamadas.find((c) => c.acao === "upload");
  assert.match(String(upload?.argumentos[0]), new RegExp(`^${ORG}/prestacoes/${PRESTACAO}/comprovantes/[0-9a-f-]{36}\\.xml$`));
  assert.deepEqual(upload?.argumentos[2], { contentType: "application/xml", upsert: false });

  const [guardado] = memoria.linhas("assistente_arquivos");
  assert.equal(guardado.situacao, "recebido");
  assert.equal(guardado.sha256, sha(xml.trim()), "o texto é guardado sem espaços nas pontas: o mesmo XML, com ou sem quebra de linha no fim, é o mesmo arquivo");
  assert.equal(guardado.origem, "texto");
  assert.equal(guardado.plataforma, "claude");
  assert.equal(memoria.linhas("assistente_acoes").length, 1, "a trilha registra o recebimento");
});

test("anexo do ChatGPT é baixado do link temporário, conferido pelo conteúdo e guardado; o mesmo arquivo de novo não duplica", async () => {
  const memoria = tabelasVazias();
  const { chamadas } = prepararComStorage({ escopo: "write", plataforma: "chatgpt" }, memoria.resolver);
  globalThis.fetch = (async () => new Response(new Uint8Array(PDF), { status: 200 })) as typeof fetch;
  const corpoDoPedido = { openaiFileIdRefs: [{ name: "recibo.pdf", id: "file-1", mime_type: "application/pdf", download_link: "https://files.oaiusercontent.com/file-1?sig=abc" }] };

  const primeiro = await ler(await enviar(corpoDoPedido));
  assert.equal(primeiro.corpo.recebidos, 1);
  assert.equal(primeiro.corpo.arquivos[0].repetido, false);
  assert.equal(primeiro.corpo.arquivos[0].tipo, "pdf");
  assert.equal(primeiro.corpo.arquivos[0].origem, "chatgpt");
  assert.equal(memoria.linhas("assistente_arquivos")[0].plataforma, "chatgpt");
  assert.ok(!JSON.stringify(primeiro.corpo).includes("sig=abc"), "o link temporário não volta");

  const segundo = await ler(await enviar(corpoDoPedido));
  assert.equal(segundo.corpo.arquivos[0].repetido, true);
  assert.equal(segundo.corpo.arquivos[0].arquivo_id, primeiro.corpo.arquivos[0].arquivo_id);
  assert.equal(memoria.linhas("assistente_arquivos").length, 1);
  assert.equal(chamadas.filter((c) => c.acao === "upload").length, 1, "só uma cópia no Storage");
});

test("arquivo que não serve pelo conteúdo é recusado sem derrubar os outros, e nada do que foi recusado é guardado", async () => {
  const memoria = tabelasVazias();
  const { chamadas } = prepararComStorage({ escopo: "write" }, memoria.resolver);
  globalThis.fetch = (async (entrada: URL | string) => {
    const url = String(entrada);
    if (url.includes("html")) return new Response("<html>não sou um pdf</html>", { status: 200 });
    if (url.includes("vazio")) return new Response("", { status: 200 });
    return new Response(new Uint8Array(PDF), { status: 200 });
  }) as typeof fetch;

  const { corpo } = await ler(
    await enviar({
      openaiFileIdRefs: [
        { name: "bom.pdf", download_link: "https://files.oaiusercontent.com/bom" },
        { name: "falso.pdf", download_link: "https://files.oaiusercontent.com/html" },
        { name: "vazio.pdf", download_link: "https://files.oaiusercontent.com/vazio" },
        { name: "interno.pdf", download_link: "https://169.254.169.254/latest" },
      ],
    })
  );
  assert.equal(corpo.recebidos, 1);
  assert.equal(corpo.com_erro, 3);
  const erros = corpo.arquivos.filter((a: { ok: boolean }) => !a.ok).map((a: { erro: string }) => a.erro);
  assert.ok(erros.some((e: string) => /XML/.test(e)), "HTML que parece XML é recusado: não é uma nota");
  assert.ok(erros.some((e: string) => /vazio/.test(e)));
  assert.ok(erros.some((e: string) => /https público/.test(e)));
  assert.equal(chamadas.filter((c) => c.acao === "upload").length, 1);
  assert.equal(memoria.linhas("assistente_arquivos").length, 1);
});

test("texto que não é XML nem tem nada de arquivo é recusado com a explicação do que enviar", async () => {
  const memoria = tabelasVazias();
  prepararComStorage({ escopo: "write" }, memoria.resolver);
  const csv = await ler(await enviar({ conteudo_texto: "data;valor\n01/01/2026;10,00", nome_do_arquivo: "extrato.csv" }));
  assert.equal(csv.status, 200);
  assert.equal(csv.corpo.recebidos, 0);
  assert.match(csv.corpo.arquivos[0].erro, /PDF, XML ou foto/);

  const nada = await ler(await enviar({}));
  assert.equal(nada.status, 400);
  assert.match(nada.corpo.error, /preparar_envio_de_arquivos/);
});

test("evidência aceita foto mas não XML, e o caminho vai para a pasta de evidências", async () => {
  const memoria = tabelasVazias();
  const { chamadas } = prepararComStorage({ escopo: "write" }, memoria.resolver);
  globalThis.fetch = (async (entrada: URL | string) => (String(entrada).includes("xml") ? new Response("<NFe/>") : new Response(new Uint8Array(FOTO)))) as typeof fetch;
  const { corpo } = await ler(
    await enviar({
      destino: "evidencia",
      openaiFileIdRefs: [
        { name: "foto.jpg", download_link: "https://files.oaiusercontent.com/foto" },
        { name: "nota.xml", download_link: "https://files.oaiusercontent.com/xml" },
      ],
    })
  );
  assert.equal(corpo.recebidos, 1);
  assert.equal(corpo.arquivos[0].destino, "evidencia");
  assert.equal(corpo.arquivos[0].tipo, "jpeg");
  assert.match(String(chamadas.find((c) => c.acao === "upload")?.argumentos[0]), new RegExp(`/prestacoes/${PRESTACAO}/evidencias/[0-9a-f-]{36}\\.jpg$`));
  assert.match(corpo.arquivos[1].erro, /PDF ou foto/);
});

test("quem não pode editar não manda arquivo: chave só leitura, módulo só para consulta, papel leitor e recusa do banco", async () => {
  for (const [cenario, esperado] of [
    [{ escopo: "read" as const }, 403],
    [{ escopo: "write" as const, emVigor: false }, 402],
    [{ escopo: "write" as const, papel: "leitor" }, 403],
    [{ escopo: "write" as const, podeEditarNoBanco: false }, 403],
  ] as const) {
    const memoria = tabelasVazias();
    const { chamadas } = prepararComStorage(cenario, memoria.resolver);
    const { status } = await ler(await enviar({ conteudo_texto: await nfeXml() }));
    assert.equal(status, esperado, JSON.stringify(cenario));
    assert.equal(chamadas.length, 0, "nada chegou ao Storage");
    assert.equal(memoria.linhas("assistente_arquivos").length, 0);
  }
});

test("prestação de outra organização é 404 e a caixa dela não é tocada", async () => {
  const memoria = tabelasVazias();
  const { chamadas } = prepararComStorage({ escopo: "write" }, memoria.resolver);
  const { status } = await ler(await enviar({ conteudo_texto: await nfeXml() }, DE_OUTRA_ORG));
  assert.equal(status, 404);
  assert.equal(chamadas.length, 0);
});

test("preparar o envio por endereço dá uma URL assinada por arquivo, no caminho da pasta certa, e deixa a linha aguardando", async () => {
  const memoria = tabelasVazias();
  const { chamadas } = prepararComStorage({ escopo: "write" }, memoria.resolver);
  const { status, corpo } = await ler(await preparar({ destino: "despesa", nomes: ["nf-1.pdf", "nf-2.XML", "foto.jpeg"] }));
  assert.equal(status, 200);
  assert.equal(corpo.modo, "endereco");
  assert.equal(corpo.enderecos.length, 3);
  assert.equal(corpo.metodo, "PUT");
  assert.equal(corpo.dominio_a_liberar, "projeto.supabase.co");
  assert.equal(corpo.validade_horas, 2);
  assert.match(corpo.exemplo, /curl -X PUT/);
  for (const endereco of corpo.enderecos) assert.match(endereco.upload_url, /^https:\/\/projeto\.supabase\.co\//);

  const assinados = chamadas.filter((c) => c.acao === "createSignedUploadUrl").map((c) => String(c.argumentos[0]));
  assert.equal(assinados.length, 3);
  assert.ok(assinados.every((caminho) => new RegExp(`^${ORG}/prestacoes/${PRESTACAO}/comprovantes/[0-9a-f-]{36}\\.(pdf|xml|jpeg)$`).test(caminho)), assinados.join(", "));
  const linhas = memoria.linhas("assistente_arquivos");
  assert.equal(linhas.length, 3);
  assert.ok(linhas.every((l) => l.situacao === "aguardando" && l.origem === "url_assinada" && l.destino === "despesa"));
});

test("preparar o envio recusa extensão que a pasta não aceita, lista grande demais e pedido sem nomes", async () => {
  const memoria = tabelasVazias();
  const { chamadas } = prepararComStorage({ escopo: "write" }, memoria.resolver);
  assert.equal((await ler(await preparar({ nomes: ["programa.exe"] }))).status, 415);
  assert.equal((await ler(await preparar({ destino: "evidencia", nomes: ["nota.xml"] }))).status, 415, "evidência não aceita XML");
  assert.equal((await ler(await preparar({ nomes: Array.from({ length: 11 }, (_, i) => `n${i}.pdf`) }))).status, 400);
  assert.equal((await ler(await preparar({ modo: "endereco" }))).status, 400);
  assert.equal(chamadas.length, 0);
  assert.equal(memoria.linhas("assistente_arquivos").length, 0);
});

test("o link de envio pelo navegador guarda só o hash do código, vale poucos minutos e não cria linha na caixa", async () => {
  const memoria = tabelasVazias();
  prepararComStorage({ escopo: "write" }, memoria.resolver);
  const { status, corpo } = await ler(await preparar({ modo: "link", destino: "evidencia", maximo_de_arquivos: 4 }));
  assert.equal(status, 200);
  assert.equal(corpo.modo, "link");
  assert.equal(corpo.validade_minutos, 15);
  assert.equal(corpo.maximo_de_arquivos, 4);
  const codigo = String(corpo.link_de_envio).replace("https://app.jards.test/enviar/", "");
  assert.match(codigo, /^[A-Za-z0-9_-]{40,}$/);

  const [sessao] = memoria.linhas("assistente_sessoes_envio");
  assert.equal(sessao.token_hash, sha(codigo), "o banco guarda o hash, não o código");
  assert.ok(!Object.values(sessao).includes(codigo));
  assert.equal(sessao.destino, "evidencia");
  assert.equal(sessao.max_arquivos, 4);
  assert.ok(new Date(String(sessao.expira_em)).getTime() - Date.now() <= 15 * 60_000 + 1000);
  assert.equal(memoria.linhas("assistente_arquivos").length, 0);
});

test("conferir o envio: o que chegou entra na caixa com tipo e impressão digital, o que não chegou segue aguardando", async () => {
  const memoria = tabelasVazias();
  const { chamadas } = prepararComStorage(
    { escopo: "write" },
    memoria.resolver,
    {
      list: (pasta, opcoes) => {
        const nome = (opcoes as { search?: string }).search ?? "";
        return { data: nome.endsWith(".pdf") ? [{ name: nome, metadata: { size: PDF.length } }] : [], error: null };
      },
      download: () => ({ data: new Blob([new Uint8Array(PDF)]), error: null }),
    }
  );
  const { corpo: preparado } = await ler(await preparar({ nomes: ["a.pdf", "b.jpg"] }));
  const [chega, nao] = preparado.enderecos;

  const { status, corpo } = await ler(await conferir({}));
  assert.equal(status, 200);
  assert.equal(corpo.chegaram, 1);
  assert.equal(corpo.ainda_nao_chegaram, 1);
  const porId = new Map(corpo.arquivos.map((a: { arquivo_id: string }) => [a.arquivo_id, a]));
  assert.equal((porId.get(chega.arquivo_id) as { resultado: string }).resultado, "chegou");
  assert.equal((porId.get(nao.arquivo_id) as { resultado: string }).resultado, "ainda_nao_chegou");
  assert.match(corpo.proximo_passo, /registrar_despesas/);

  const guardada = memoria.linhas("assistente_arquivos").find((l) => l.id === chega.arquivo_id)!;
  assert.deepEqual([guardada.situacao, guardada.tipo_real, guardada.tamanho_bytes, guardada.sha256], ["recebido", "pdf", PDF.length, sha(PDF)]);
  assert.equal(memoria.linhas("assistente_arquivos").find((l) => l.id === nao.arquivo_id)!.situacao, "aguardando");
  assert.ok(!chamadas.some((c) => c.acao === "remove"), "nada foi apagado");
});

test("conferir apaga o arquivo que chegou mas não serve: disfarçado de PDF, grande demais ou repetido", async () => {
  const memoria = tabelasVazias();
  let conteudo: Buffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // cabeçalho de programa, não de PDF
  let tamanho = conteudo.length;
  const { chamadas } = prepararComStorage(
    { escopo: "write" },
    memoria.resolver,
    {
      list: (_pasta, opcoes) => ({ data: [{ name: (opcoes as { search?: string }).search, metadata: { size: tamanho } }], error: null }),
      download: () => ({ data: new Blob([new Uint8Array(conteudo)]), error: null }),
    }
  );

  const um = (await ler(await preparar({ nomes: ["falso.pdf"] }))).corpo.enderecos[0];
  const falso = await ler(await conferir({ arquivo_ids: [um.arquivo_id] }));
  assert.equal(falso.corpo.recusados, 1);
  assert.match(falso.corpo.arquivos[0].motivo, /não é PDF, XML ou foto/);
  assert.match(falso.corpo.arquivos[0].motivo, /formato desconhecido/);
  assert.equal(memoria.linhas("assistente_arquivos").find((l) => l.id === um.arquivo_id)!.situacao, "descartado");

  tamanho = 16 * 1024 * 1024;
  const dois = (await ler(await preparar({ nomes: ["grande.pdf"] }))).corpo.enderecos[0];
  const grande = await ler(await conferir({ arquivo_ids: [dois.arquivo_id] }));
  assert.match(grande.corpo.arquivos[0].motivo, /15 MB/);

  conteudo = PDF;
  tamanho = PDF.length;
  const tres = (await ler(await preparar({ nomes: ["a.pdf"] }))).corpo.enderecos[0];
  assert.equal((await ler(await conferir({ arquivo_ids: [tres.arquivo_id] }))).corpo.chegaram, 1);
  const quatro = (await ler(await preparar({ nomes: ["b.pdf"] }))).corpo.enderecos[0];
  const repetido = await ler(await conferir({ arquivo_ids: [quatro.arquivo_id] }));
  assert.equal(repetido.corpo.arquivos[0].resultado, "repetido");
  assert.equal(repetido.corpo.arquivos[0].arquivo_id, tres.arquivo_id, "vale o que entrou antes");
  assert.equal(memoria.linhas("assistente_arquivos").find((l) => l.id === quatro.arquivo_id)!.situacao, "descartado");

  // O endereço assinado vale 2 horas e não se revoga: o que não serviu não é apagado (o endereço ficaria livre para outro envio),
  // o conteúdo é trocado por um marcador de poucos bytes.
  const tumulos = chamadas.filter((c) => c.acao === "upload" && Buffer.from(c.argumentos[1] as Uint8Array).toString() === "descartado");
  assert.equal(tumulos.length, 3, "os três que não serviram viraram marcador");
  assert.ok(tumulos.every((c) => (c.argumentos[2] as { upsert?: boolean }).upsert === true));
  assert.equal(chamadas.filter((c) => c.acao === "remove").length, 0, "nada foi apagado: o endereço de envio não fica reutilizável");
});

test("o arquivo que serve é regravado com o tipo verdadeiro, não com o que quem enviou declarou", async () => {
  const memoria = tabelasVazias();
  const { chamadas } = prepararComStorage({ escopo: "write" }, memoria.resolver, {
    list: (_pasta, opcoes) => ({ data: [{ name: (opcoes as { search?: string }).search, metadata: { size: PDF.length } }], error: null }),
    download: () => ({ data: new Blob([new Uint8Array(PDF)], { type: "text/html" }), error: null }),
  });
  const { enderecos } = (await ler(await preparar({ nomes: ["a.pdf"] }))).corpo;
  assert.equal((await ler(await conferir({ arquivo_ids: [enderecos[0].arquivo_id] }))).corpo.chegaram, 1);
  const regravacao = chamadas.find((c) => c.acao === "upload");
  assert.ok(regravacao, "o objeto foi regravado");
  assert.deepEqual(regravacao.argumentos[2], { contentType: "application/pdf", upsert: true });
  assert.equal(Buffer.from(regravacao.argumentos[1] as Uint8Array).toString(), PDF.toString(), "com os mesmos bytes que foram conferidos");
});

test("duas conferências ao mesmo tempo do mesmo arquivo (página e assistente) não apagam o que acabou de chegar", async () => {
  const memoria = tabelasVazias();
  // A segunda conferência fica parada no download até a primeira terminar: é a intercalação que apagava o arquivo que acabou de chegar.
  let baixadas = 0;
  let liberarSegunda: (() => void) | null = null;
  const conteudo = () => ({ data: new Blob([new Uint8Array(PDF)]), error: null });
  const { chamadas } = prepararComStorage({ escopo: "write" }, memoria.resolver, {
    list: (_pasta, opcoes) => ({ data: [{ name: (opcoes as { search?: string }).search, metadata: { size: PDF.length } }], error: null }),
    download: () => {
      baixadas += 1;
      if (baixadas === 1) return conteudo();
      return new Promise((resolver) => {
        liberarSegunda = () => resolver(conteudo());
      });
    },
  });
  const { enderecos } = (await ler(await preparar({ nomes: ["a.pdf"] }))).corpo;
  const id = enderecos[0].arquivo_id;

  const primeira = conferirEmParalelo(id);
  const segunda = conferirEmParalelo(id);
  const respostaA = await primeira;
  while (!liberarSegunda) await new Promise((r) => setImmediate(r));
  (liberarSegunda as () => void)();
  const respostaB = await segunda;
  const [a, b] = [await ler(respostaA), await ler(respostaB)];

  assert.equal(a.corpo.chegaram, 1);
  for (const resposta of [a, b]) assert.ok(!resposta.corpo.arquivos.some((x: { resultado: string }) => x.resultado === "recusado" || x.resultado === "repetido"), JSON.stringify(resposta.corpo.arquivos));
  assert.equal(b.corpo.arquivos[0].arquivo_id, id);
  const linha = memoria.linhas("assistente_arquivos").find((l) => l.id === id)!;
  assert.equal(linha.situacao, "recebido", "o arquivo continua na caixa");
  const tumulos = chamadas.filter((c) => c.acao === "upload" && Buffer.from(c.argumentos[1] as Uint8Array).toString() === "descartado");
  assert.equal(tumulos.length, 0, "ninguém o trocou por marcador");
  assert.equal(chamadas.filter((c) => c.acao === "remove").length, 0);
});

test("o mesmo PDF volta a poder ser enviado depois que a equipe apaga a despesa no app; com a despesa de pé, segue repetido", async () => {
  const xml = await nfeXml();
  const sha256 = sha(xml.trim());
  const registrado = (registroId: string, id: string) => ({
    id, prestacao_id: PRESTACAO, origem: "texto", destino: "despesa", situacao: "registrado", nome_arquivo: "nf.xml", tipo_real: "xml", tamanho_bytes: 10, sha256,
    storage_path: `${ORG}/prestacoes/${PRESTACAO}/comprovantes/velho.xml`, registro_tabela: "prestacao_comprovantes", registro_id: registroId, detalhe: null, expira_em: "2099-01-01T00:00:00Z", created_at: "2026-10-19T10:00:00Z",
  });

  // Despesa apagada no app: o registro já não existe.
  const apagada = memoriaFalsa({ assistente_arquivos: [registrado("5c1b0f0e-0000-4000-8000-0000000000f1", "5c1b0f0e-0000-4000-8000-0000000000e1")], assistente_acoes: [], prestacao_comprovantes: [] });
  prepararComStorage({ escopo: "write" }, apagada.resolver);
  const nova = await ler(await enviar({ conteudo_texto: xml, nome_do_arquivo: "nf-1234.xml" }));
  assert.equal(nova.corpo.arquivos[0].repetido, false, "não é repetido de algo que sumiu");
  assert.equal(nova.corpo.arquivos[0].situacao, "recebido");
  const velho = apagada.linhas("assistente_arquivos").find((l) => l.id === "5c1b0f0e-0000-4000-8000-0000000000e1")!;
  assert.equal(velho.situacao, "descartado");
  assert.match(String(velho.detalhe), /apagado no app/);

  // Despesa de pé: continua repetido.
  const dePe = memoriaFalsa({ assistente_arquivos: [registrado("5c1b0f0e-0000-4000-8000-0000000000f2", "5c1b0f0e-0000-4000-8000-0000000000e2")], assistente_acoes: [], prestacao_comprovantes: [{ id: "5c1b0f0e-0000-4000-8000-0000000000f2", prestacao_id: PRESTACAO }] });
  prepararComStorage({ escopo: "write" }, dePe.resolver);
  const repetido = await ler(await enviar({ conteudo_texto: xml, nome_do_arquivo: "nf-1234.xml" }));
  assert.equal(repetido.corpo.arquivos[0].repetido, true);
  assert.equal(dePe.linhas("assistente_arquivos")[0].situacao, "registrado");
});

test("o nome do arquivo não disfarça a extensão: marcas de direção do texto e controles saem", async () => {
  const { nomeLimpo } = await import("../lib/mcp/prestacao/caixa");
  assert.equal(nomeLimpo("recibo\u202Efdp.exe"), "recibo fdp.exe");
  assert.equal(nomeLimpo("nota\u2066.pdf\u2069"), "nota .pdf");
  assert.equal(nomeLimpo("a\u0085b\u009fc\u200fd"), "a b c d");
  assert.equal(nomeLimpo("pasta/../a.pdf"), "pasta .. a.pdf");
});

test("conferir sem nada esperando avisa; ids que não são UUID são recusados", async () => {
  const memoria = tabelasVazias();
  prepararComStorage({ escopo: "write" }, memoria.resolver);
  const vazio = await ler(await conferir({}));
  assert.equal(vazio.status, 200);
  assert.match(vazio.corpo.aviso, /Nada esperando/);
  assert.equal((await ler(await conferir({ arquivo_ids: ["abc"] }))).status, 400);
});

test("preparar o envio não guarda a resposta na tabela de idempotência (tem o código do link e endereços assinados) e a spec nem oferece a chave", async () => {
  const memoria = tabelasVazias();
  const { consultas } = prepararComStorage({ escopo: "write" }, memoria.resolver);
  const a = await ler(await preparar({ modo: "link", chave_idempotencia: "k-1" }));
  const b = await ler(await preparar({ modo: "link", chave_idempotencia: "k-1" }));
  assert.equal(a.status, 200);
  assert.notEqual(a.corpo.link_de_envio, b.corpo.link_de_envio, "a mesma chave não devolve o link de antes: cada pedido é um link novo");
  assert.equal(memoria.linhas("assistente_sessoes_envio").length, 2);
  assert.equal(daTabela(consultas, "mcp_idempotencia").length, 0, "nada foi lido nem gravado na tabela de idempotência");

  const spec = construirSpecPrestacao("https://app.jards.test") as unknown as { paths: Record<string, Record<string, { requestBody?: { content: Record<string, { schema: { properties: Record<string, unknown> } }> } }>> };
  const propriedades = spec.paths["/prestacoes/{id}/arquivos/envio"].post.requestBody!.content["application/json"].schema.properties;
  assert.ok(!("chave_idempotencia" in propriedades));
  const outras = spec.paths["/prestacoes/{id}/arquivos"].post.requestBody!.content["application/json"].schema.properties;
  assert.ok("chave_idempotencia" in outras, "as outras gravações seguem com a chave");
});

test("conferir sem nada esperando mostra o que o envio pelo link já deixou na caixa, à espera do registro", async () => {
  const memoria = memoriaFalsa({
    assistente_arquivos: [
      { id: "5c1b0f0e-0000-4000-8000-0000000000e3", prestacao_id: PRESTACAO, origem: "pagina", destino: "despesa", situacao: "recebido", nome_arquivo: "recibo.pdf", tipo_real: "pdf", tamanho_bytes: 10, sha256: sha("z"), storage_path: `${ORG}/prestacoes/${PRESTACAO}/comprovantes/c.pdf`, registro_tabela: null, registro_id: null, detalhe: null, expira_em: "2099-01-01T00:00:00Z", created_at: "2026-10-19T12:00:00Z" },
    ],
  });
  prepararComStorage({ escopo: "write" }, memoria.resolver);
  const { status, corpo } = await ler(await conferir({}));
  assert.equal(status, 200);
  assert.match(corpo.aviso, /Nada esperando/);
  assert.equal(corpo.chegaram, 0);
  assert.deepEqual(corpo.recebidos_aguardando_registro.map((a: { nome: string; situacao: string }) => [a.nome, a.situacao]), [["recibo.pdf", "recebido"]]);
  assert.match(corpo.proximo_passo, /registrar_despesas/);
  assert.ok(!JSON.stringify(corpo).includes("storage_path") && !JSON.stringify(corpo).includes(ORG));
});

test("a lista da caixa mostra a situação de cada arquivo e nunca o caminho do Storage", async () => {
  const memoria = memoriaFalsa({
    assistente_arquivos: [
      { id: "5c1b0f0e-0000-4000-8000-0000000000e1", prestacao_id: PRESTACAO, origem: "texto", destino: "despesa", situacao: "recebido", nome_arquivo: "nf.xml", tipo_real: "xml", tamanho_bytes: 10, sha256: sha("x"), storage_path: `${ORG}/prestacoes/${PRESTACAO}/comprovantes/a.xml`, registro_tabela: null, registro_id: null, detalhe: null, expira_em: "2099-01-01T00:00:00Z", created_at: "2026-10-19T10:00:00Z" },
      { id: "5c1b0f0e-0000-4000-8000-0000000000e2", prestacao_id: PRESTACAO, origem: "texto", destino: "evidencia", situacao: "registrado", nome_arquivo: "foto.jpg", tipo_real: "jpeg", tamanho_bytes: 20, sha256: sha("y"), storage_path: `${ORG}/prestacoes/${PRESTACAO}/evidencias/b.jpg`, registro_tabela: "prestacao_evidencias", registro_id: "5c1b0f0e-0000-4000-8000-0000000000e9", detalhe: null, expira_em: "2099-01-01T00:00:00Z", created_at: "2026-10-19T11:00:00Z" },
    ],
  });
  prepararComStorage({ escopo: "read" }, memoria.resolver);
  const { status, corpo } = await ler(await arquivosGET(pedido(`/prestacoes/${PRESTACAO}/arquivos?situacao=registrado`), comId(PRESTACAO)));
  assert.equal(status, 200);
  assert.equal(corpo.total, 1);
  assert.equal(corpo.arquivos[0].nome, "foto.jpg");
  assert.deepEqual(corpo.arquivos[0].registrado_em, { tabela: "prestacao_evidencias", id: "5c1b0f0e-0000-4000-8000-0000000000e9" });
  assert.ok(!JSON.stringify(corpo).includes("storage_path") && !JSON.stringify(corpo).includes(ORG));
});
