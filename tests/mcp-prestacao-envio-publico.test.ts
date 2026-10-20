import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import EnvioPeloLink from "../app/enviar/[token]/page";
import { POST as concluirPOST } from "../app/api/enviar/[token]/concluir/route";
import { POST as prepararPOST } from "../app/api/enviar/[token]/preparar/route";
import { criarLinkDeEnvio } from "../lib/mcp/prestacao/caixa";
import { conferirLink } from "../lib/mcp/prestacao/envio-publico";
import { nomeParaEnvio, problemaDoArquivo } from "../lib/mcp/prestacao/tipos-de-envio";
import { dependenciasDaRota } from "../lib/mcp/rota";
import type { Consulta } from "./_helpers/banco-falso";
import { memoriaFalsa, primeiroQueResponder } from "./_helpers/memoria-falsa";
import { DE_OUTRA_ORG, ORG, PRESTACAO, USUARIO, ler, prepararComStorage, type BucketFalso, type Cenario } from "./_helpers/prestacao-cenario";

const PDF = Buffer.from("%PDF-1.7 comprovante de teste");
const FALSO = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // cabeçalho de programa, não de PDF
const sha = (conteudo: Buffer | string) => createHash("sha256").update(conteudo).digest("hex");

const organizacao = (c: Consulta) => (c.tabela === "organizations" ? { data: { nome: "Instituto A" } } : undefined);

/** Um link de envio recém-criado (do jeito real, por criarLinkDeEnvio), com a prestação, o banco e o Storage de mentira. */
async function comLink(opcoes: { destino?: "despesa" | "evidencia"; maximo?: number; cenario?: Cenario; bucket?: BucketFalso } = {}) {
  const memoria = memoriaFalsa({ assistente_arquivos: [], assistente_acoes: [], assistente_sessoes_envio: [] });
  const preparado = prepararComStorage({ escopo: "write", ...opcoes.cenario }, primeiroQueResponder(memoria.resolver, organizacao), opcoes.bucket);
  const admin = dependenciasDaRota.criarAdmin();
  const { codigo } = await criarLinkDeEnvio(
    { admin, organizationId: ORG, prestacaoId: PRESTACAO, quem: { usuarioId: USUARIO, chaveId: null, plataforma: "claude" } },
    { destino: opcoes.destino ?? "despesa", maxArquivos: opcoes.maximo ?? 3 }
  );
  return { memoria, codigo, admin, ...preparado };
}

const sessaoDe = (memoria: ReturnType<typeof memoriaFalsa>) => memoria.linhas("assistente_sessoes_envio")[0];

const chamar = (rota: typeof prepararPOST, codigo: string, corpo: unknown, ip = "203.0.113.7") =>
  rota(
    new NextRequest(`https://app.jards.test/api/enviar/${codigo}/x`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(corpo),
    }),
    { params: Promise.resolve({ token: codigo }) }
  );
const preparar = (codigo: string, corpo: unknown, ip?: string) => chamar(prepararPOST, codigo, corpo, ip);
const concluir = (codigo: string, corpo: unknown, ip?: string) => chamar(concluirPOST, codigo, corpo, ip);

/** O Storage de mentira onde todo arquivo "chegou" com este conteúdo. */
const comConteudo = (conteudo: () => Buffer): BucketFalso => ({
  list: (_pasta, opcoes) => ({ data: [{ name: (opcoes as { search?: string }).search, metadata: { size: conteudo().length } }], error: null }),
  download: () => ({ data: new Blob([new Uint8Array(conteudo())]), error: null }),
});

// ─── A regra de arquivo que a página e o servidor dividem ───────────────────

test("a página recusa cedo o que a prestação não aceita: tipo pelo nome, vazio e acima de 15 MB", () => {
  assert.equal(problemaDoArquivo("despesa", "nf.pdf", 1000), null);
  assert.equal(problemaDoArquivo("despesa", "NF.XML", 1000), null);
  assert.equal(problemaDoArquivo("despesa", "foto.HEIC", 1000), null);
  assert.match(problemaDoArquivo("despesa", "programa.exe", 1000) ?? "", /PDF, XML ou foto/);
  assert.match(problemaDoArquivo("evidencia", "nota.xml", 1000) ?? "", /PDF ou foto/, "evidência não aceita XML");
  assert.equal(problemaDoArquivo("despesa", "nf.pdf", 0), "O arquivo está vazio.");
  assert.equal(problemaDoArquivo("despesa", "nf.pdf", 15 * 1024 * 1024), null);
  assert.equal(problemaDoArquivo("despesa", "nf.pdf", 15 * 1024 * 1024 + 1), "O arquivo passa de 15 MB.");
});

test("foto de celular sem extensão ganha a do tipo que o navegador informou; o que já tem extensão não muda", () => {
  assert.equal(nomeParaEnvio("1697390123", "image/jpeg"), "1697390123.jpg");
  assert.equal(nomeParaEnvio("IMG 1", "image/heic"), "IMG 1.heic");
  assert.equal(nomeParaEnvio("nf.pdf", "application/pdf"), "nf.pdf");
  assert.equal(nomeParaEnvio("  ", "image/png"), "arquivo.png");
  assert.equal(nomeParaEnvio("sem-tipo", ""), "sem-tipo");
});

// ─── O link ─────────────────────────────────────────────────────────────────

test("um link vale mostra só o projeto e a organização, nunca o hash nem o caminho do Storage", async () => {
  const { codigo, admin } = await comLink();
  const link = await conferirLink(admin, codigo);
  assert.equal(link.situacao, "valido");
  assert.equal(link.prestacao?.titulo, "Festival de Inverno");
  assert.equal(link.prestacao?.organizacao, "Instituto A");
  assert.ok(!JSON.stringify(link.prestacao).includes("token"));
});

test("código fora do formato nem chega ao banco; código que não existe é 'inexistente'", async () => {
  const { admin, consultas } = await comLink();
  const antes = consultas.length;
  for (const lixo of ["", "abc", "x".repeat(42), "x".repeat(44), `${"x".repeat(42)}!`, "../../etc/passwd"]) {
    assert.equal((await conferirLink(admin, lixo)).situacao, "inexistente", lixo);
  }
  assert.equal(consultas.length, antes, "nenhuma consulta com código que não tem o formato");
  assert.equal((await conferirLink(admin, "A".repeat(43))).situacao, "inexistente");
});

test("o link deixa de valer quando vence, é desativado, esgota as vagas ou quem o criou perde a edição", async () => {
  const situacao = async (mudar: (linha: Record<string, unknown>) => void, cenario: Cenario = {}) => {
    const { memoria, codigo, admin } = await comLink({ cenario });
    mudar(sessaoDe(memoria));
    return (await conferirLink(admin, codigo)).situacao;
  };
  assert.equal(await situacao(() => undefined), "valido");
  assert.equal(await situacao((l) => (l.expira_em = new Date(Date.now() - 1000).toISOString())), "expirado");
  assert.equal(await situacao((l) => (l.revogada_em = new Date().toISOString())), "revogado");
  assert.equal(await situacao((l) => (l.enviados = l.max_arquivos)), "esgotado");
  assert.equal(await situacao((l) => (l.usuario_id = null)), "sem_permissao", "a pessoa foi apagada");
  assert.equal(await situacao(() => undefined, { podeEditarNoBanco: false }), "sem_permissao", "perdeu a edição ou o módulo saiu de vigor");
});

test("a página abre o envio quando o link vale e mostra um aviso neutro quando não", async () => {
  const { memoria, codigo } = await comLink({ destino: "evidencia" });
  const abrir = async (token: string) => renderToStaticMarkup(await EnvioPeloLink({ params: Promise.resolve({ token }) }));

  const html = await abrir(codigo);
  assert.match(html, /Enviar evidências/);
  assert.match(html, /Festival de Inverno/);
  assert.match(html, /Instituto A/);
  assert.match(html, /accept="\.pdf,image\/\*"/);
  assert.match(html, /até 15 MB cada/);
  assert.ok(!html.includes(codigo), "o código não é escrito na página");

  const desconhecido = await abrir("B".repeat(43));
  assert.match(desconhecido, /Link não encontrado/);
  assert.doesNotMatch(desconhecido, /Festival de Inverno|Instituto A/);

  sessaoDe(memoria).expira_em = new Date(Date.now() - 1000).toISOString();
  const vencido = await abrir(codigo);
  assert.match(vencido, /Este link expirou/);
  assert.doesNotMatch(vencido, /Festival de Inverno|Instituto A/, "link vencido não diz de que prestação era");

  sessaoDe(memoria).expira_em = new Date(Date.now() + 60_000).toISOString();
  sessaoDe(memoria).revogada_em = new Date().toISOString();
  assert.match(await abrir(codigo), /Este link foi desativado/);
});

// ─── Passo 1: preparar ──────────────────────────────────────────────────────

test("preparar dá um endereço de envio por arquivo, na ordem pedida, na pasta do destino e consome as vagas", async () => {
  const { memoria, codigo, chamadas } = await comLink({ maximo: 3 });
  const { status, corpo } = await ler(await preparar(codigo, { nomes: ["nf-1.pdf", "nf-1.pdf", "foto.JPG"] }));
  assert.equal(status, 200);
  assert.equal(corpo.arquivos.length, 3, "dois arquivos com o mesmo nome continuam sendo dois");
  assert.equal(corpo.restantes, 0);
  assert.deepEqual(corpo.arquivos.map((a: { nome: string }) => a.nome), ["nf-1.pdf", "nf-1.pdf", "foto.JPG"]);
  for (const a of corpo.arquivos) assert.match(a.upload_url, /^https:\/\/projeto\.supabase\.co\/storage\/v1\/object\/upload\/sign\/documentos\//);

  const assinados = chamadas.filter((c) => c.acao === "createSignedUploadUrl").map((c) => String(c.argumentos[0]));
  assert.ok(assinados.every((caminho) => new RegExp(`^${ORG}/prestacoes/${PRESTACAO}/comprovantes/[0-9a-f-]{36}\\.(pdf|JPG|jpg)$`).test(caminho)), assinados.join(", "));

  const linhas = memoria.linhas("assistente_arquivos");
  assert.equal(linhas.length, 3);
  assert.ok(linhas.every((l) => l.situacao === "aguardando" && l.origem === "pagina" && l.destino === "despesa" && l.usuario_id === USUARIO && l.plataforma === "claude"));
  assert.equal(sessaoDe(memoria).enviados, 3);
  // O endereço de envio carrega o caminho do arquivo (é assim que o Storage assina); fora dele nada do caminho sai.
  assert.deepEqual(Object.keys(corpo.arquivos[0]).sort(), ["arquivo_id", "nome", "upload_url"]);
  assert.ok(!JSON.stringify(corpo).includes("storage_path"));
});

test("o link de evidência manda para a pasta de evidências e recusa XML", async () => {
  const { memoria, codigo, chamadas } = await comLink({ destino: "evidencia" });
  const xml = await ler(await preparar(codigo, { nomes: ["nota.xml"] }));
  assert.equal(xml.status, 415);
  assert.equal(sessaoDe(memoria).enviados, 0, "a vaga volta quando o preparo falha");

  const foto = await ler(await preparar(codigo, { nomes: ["foto.jpg"] }));
  assert.equal(foto.status, 200);
  assert.match(String(chamadas.find((c) => c.acao === "createSignedUploadUrl")?.argumentos[0]), new RegExp(`/prestacoes/${PRESTACAO}/evidencias/[0-9a-f-]{36}\\.jpg$`));
});

test("preparar não passa das vagas do link, e o pedido não escolhe a prestação nem o destino", async () => {
  const { memoria, codigo } = await comLink({ maximo: 2 });
  const demais = await ler(await preparar(codigo, { nomes: ["a.pdf", "b.pdf", "c.pdf"] }));
  assert.equal(demais.status, 409);
  assert.match(demais.corpo.error, /aceita mais 2 arquivos/);
  assert.equal(memoria.linhas("assistente_arquivos").length, 0);
  assert.equal(sessaoDe(memoria).enviados, 0);

  const ok = await ler(await preparar(codigo, { nomes: ["a.pdf"], prestacao_id: DE_OUTRA_ORG, destino: "evidencia", organization_id: "outra" }));
  assert.equal(ok.status, 200);
  const [linha] = memoria.linhas("assistente_arquivos");
  assert.equal(linha.prestacao_id, PRESTACAO, "vale a prestação do link");
  assert.equal(linha.destino, "despesa", "vale o destino do link");

  const mais = await ler(await preparar(codigo, { nomes: ["b.pdf", "c.pdf"] }));
  assert.equal(mais.status, 409);
  assert.match(mais.corpo.error, /aceita mais 1 arquivo\./);
  assert.equal((await ler(await preparar(codigo, { nomes: ["b.pdf"] }))).status, 200);
  const esgotado = await ler(await preparar(codigo, { nomes: ["c.pdf"] }));
  assert.equal(esgotado.status, 409);
  assert.equal(esgotado.corpo.situacao, "esgotado");
});

test("preparar recusa pedido sem nomes, com nome inválido, com mais de dez e com corpo que não é objeto", async () => {
  const { memoria, codigo, chamadas } = await comLink({ maximo: 10 });
  for (const corpo of [{}, { nomes: [] }, { nomes: "a.pdf" }, { nomes: [1] }, { nomes: [""] }, { nomes: ["a".repeat(301) + ".pdf"] }, { nomes: Array.from({ length: 11 }, (_, i) => `n${i}.pdf`) }]) {
    assert.equal((await ler(await preparar(codigo, corpo))).status, 400, JSON.stringify(corpo).slice(0, 60));
  }
  assert.equal((await ler(await preparar(codigo, ["a.pdf"]))).status, 400);
  assert.equal(chamadas.length, 0);
  assert.equal(memoria.linhas("assistente_arquivos").length, 0);
});

test("link que não vale devolve o status certo com a situação, e nada é preparado", async () => {
  const { memoria, codigo, chamadas } = await comLink();
  const quando = async (mudar: (linha: Record<string, unknown>) => void) => {
    mudar(sessaoDe(memoria));
    return ler(await preparar(codigo, { nomes: ["a.pdf"] }));
  };
  const vencido = await quando((l) => (l.expira_em = new Date(Date.now() - 1000).toISOString()));
  assert.deepEqual([vencido.status, vencido.corpo.situacao], [410, "expirado"]);
  assert.match(vencido.corpo.error, /expirou/);
  const revogado = await quando((l) => {
    l.expira_em = new Date(Date.now() + 60_000).toISOString();
    l.revogada_em = new Date().toISOString();
  });
  assert.deepEqual([revogado.status, revogado.corpo.situacao], [410, "revogado"]);
  const desconhecido = await ler(await preparar("C".repeat(43), { nomes: ["a.pdf"] }));
  assert.deepEqual([desconhecido.status, desconhecido.corpo.situacao], [404, "inexistente"]);
  assert.equal(chamadas.length, 0);
  assert.equal(memoria.linhas("assistente_arquivos").length, 0);
});

test("quem criou o link e perdeu a edição da prestação derruba o link na hora", async () => {
  const { codigo, memoria } = await comLink({ cenario: { podeEditarNoBanco: false } });
  const { status, corpo } = await ler(await preparar(codigo, { nomes: ["a.pdf"] }));
  assert.deepEqual([status, corpo.situacao], [403, "sem_permissao"]);
  assert.equal(memoria.linhas("assistente_arquivos").length, 0);
});

test("a vigésima primeira tentativa com código que não existe, no mesmo minuto e pelo mesmo IP, leva 429", async () => {
  const { codigo } = await comLink();
  const ip = "198.51.100.77";
  for (let i = 0; i < 20; i++) assert.equal((await preparar("D".repeat(43), { nomes: ["a.pdf"] }, ip)).status, 404);
  assert.equal((await preparar("D".repeat(43), { nomes: ["a.pdf"] }, ip)).status, 429);
  assert.equal((await preparar(codigo, { nomes: ["a.pdf"] }, ip)).status, 429, "o IP fica barrado também para um link bom");
  assert.equal((await preparar(codigo, { nomes: ["a.pdf"] }, "198.51.100.78")).status, 200, "outro IP segue normal");
});

// ─── Passo 2: concluir ──────────────────────────────────────────────────────

test("concluir confere o que chegou: entra na caixa com tipo e impressão digital, e a trilha registra o recebimento", async () => {
  const { memoria, codigo } = await comLink({ bucket: comConteudo(() => PDF) });
  const { corpo: preparado } = await ler(await preparar(codigo, { nomes: ["recibo.pdf"] }));
  const [arquivo] = preparado.arquivos;

  const { status, corpo } = await ler(await concluir(codigo, { arquivo_ids: [arquivo.arquivo_id] }));
  assert.equal(status, 200);
  assert.equal(corpo.chegaram, 1);
  assert.equal(corpo.restantes, 2);
  assert.deepEqual(corpo.arquivos, [{ arquivo_id: arquivo.arquivo_id, nome: "recibo.pdf", resultado: "chegou" }]);

  const guardada = memoria.linhas("assistente_arquivos")[0];
  assert.deepEqual([guardada.situacao, guardada.tipo_real, guardada.tamanho_bytes, guardada.sha256], ["recebido", "pdf", PDF.length, sha(PDF)]);
  const [acao] = memoria.linhas("assistente_acoes");
  assert.equal(acao.ferramenta, "pagina_de_envio");
  assert.equal(acao.usuario_id, USUARIO);
  assert.match(String(acao.resumo), /Recebeu 1 arquivo pela página de envio \(despesas\)/);
  assert.ok(!JSON.stringify(corpo).includes("storage_path") && !JSON.stringify(corpo).includes(ORG));
});

test("concluir tira de circulação o arquivo disfarçado e o repetido (marcador no lugar) e não devolve vagas: o link prepara só o que aceita", async () => {
  let conteudo: Buffer = FALSO;
  const { memoria, codigo, chamadas } = await comLink({ maximo: 3, bucket: comConteudo(() => conteudo) });
  const marcadores = () => chamadas.filter((c) => c.acao === "upload" && Buffer.from(c.argumentos[1] as Uint8Array).toString() === "descartado");

  const falso = (await ler(await preparar(codigo, { nomes: ["falso.pdf"] }))).corpo.arquivos[0];
  assert.equal(sessaoDe(memoria).enviados, 1);
  const recusado = await ler(await concluir(codigo, { arquivo_ids: [falso.arquivo_id] }));
  assert.equal(recusado.corpo.arquivos[0].resultado, "recusado");
  assert.match(recusado.corpo.arquivos[0].motivo, /não é PDF, XML ou foto/);
  assert.equal(recusado.corpo.chegaram, 0);
  assert.equal(recusado.corpo.restantes, 2);
  assert.equal(sessaoDe(memoria).enviados, 1, "a vaga não volta: recusar e mandar de novo não prepara arquivo à vontade");
  assert.equal(memoria.linhas("assistente_arquivos").find((l) => l.id === falso.arquivo_id)?.situacao, "descartado");
  assert.equal(marcadores().length, 1, "o conteúdo foi trocado por um marcador, e o endereço assinado não serve mais para outro arquivo");
  assert.equal(chamadas.filter((c) => c.acao === "remove").length, 0, "apagar deixaria o endereço de envio livre por até 2 horas");
  assert.equal(memoria.linhas("assistente_acoes").length, 0, "nada chegou: nada a registrar");

  conteudo = PDF;
  const primeiro = (await ler(await preparar(codigo, { nomes: ["a.pdf"] }))).corpo.arquivos[0];
  assert.equal((await ler(await concluir(codigo, { arquivo_ids: [primeiro.arquivo_id] }))).corpo.chegaram, 1);
  const segundo = (await ler(await preparar(codigo, { nomes: ["b.pdf"] }))).corpo.arquivos[0];
  const repetido = await ler(await concluir(codigo, { arquivo_ids: [segundo.arquivo_id] }));
  assert.equal(repetido.corpo.arquivos[0].resultado, "repetido");
  assert.equal(repetido.corpo.chegaram, 0);
  assert.equal(marcadores().length, 2);
  assert.equal(sessaoDe(memoria).enviados, 3, "o repetido também gastou a vaga");

  const esgotado = await ler(await preparar(codigo, { nomes: ["c.pdf"] }));
  assert.deepEqual([esgotado.status, esgotado.corpo.situacao], [409, "esgotado"]);
});

test("concluir sem ids, com id que não é UUID ou de arquivo que este link não preparou não confere nada além do que é dele", async () => {
  const { memoria, codigo } = await comLink({ bucket: comConteudo(() => PDF) });
  assert.equal((await ler(await concluir(codigo, {}))).status, 400, "sem ids a conferência olharia a prestação inteira");
  assert.equal((await ler(await concluir(codigo, { arquivo_ids: [] }))).status, 400);
  assert.equal((await ler(await concluir(codigo, { arquivo_ids: ["abc"] }))).status, 400);
  assert.equal((await ler(await concluir(codigo, { arquivo_ids: Array.from({ length: 11 }, () => "5c1b0f0e-0000-4000-8000-0000000000e1") }))).status, 400);

  // Um arquivo que espera conferência, mas de outro destino (o assistente o preparou por endereço): este link não o toca.
  memoria.tabela("assistente_arquivos").push({
    id: "5c1b0f0e-0000-4000-8000-0000000000e1",
    prestacao_id: PRESTACAO,
    destino: "evidencia",
    situacao: "aguardando",
    nome_arquivo: "foto.jpg",
    storage_path: `${ORG}/prestacoes/${PRESTACAO}/evidencias/x.jpg`,
    created_at: new Date().toISOString(),
  });
  const { status, corpo } = await ler(await concluir(codigo, { arquivo_ids: ["5c1b0f0e-0000-4000-8000-0000000000e1"] }));
  assert.equal(status, 200);
  assert.deepEqual(corpo.arquivos, []);
  assert.equal(memoria.linhas("assistente_arquivos")[0].situacao, "aguardando");
});

test("o último arquivo ainda pode ser conferido depois do prazo, mas um link desativado não confere mais nada", async () => {
  const { memoria, codigo } = await comLink({ bucket: comConteudo(() => PDF) });
  const [arquivo] = (await ler(await preparar(codigo, { nomes: ["a.pdf"] }))).corpo.arquivos;

  sessaoDe(memoria).expira_em = new Date(Date.now() - 1000).toISOString();
  assert.equal((await ler(await preparar(codigo, { nomes: ["b.pdf"] }))).status, 410, "arquivo novo não entra depois do prazo");

  sessaoDe(memoria).revogada_em = new Date().toISOString();
  assert.equal((await ler(await concluir(codigo, { arquivo_ids: [arquivo.arquivo_id] }))).status, 410);
  assert.equal(memoria.linhas("assistente_arquivos")[0].situacao, "aguardando");

  sessaoDe(memoria).revogada_em = null;
  const { status, corpo } = await ler(await concluir(codigo, { arquivo_ids: [arquivo.arquivo_id] }));
  assert.equal(status, 200, "vencido, mas não desativado: termina o que já subiu");
  assert.equal(corpo.chegaram, 1);
});

test("depois do prazo só dá meia hora para conferir o que já subiu; passada a janela, o link não serve mais para nada", async () => {
  const { memoria, codigo } = await comLink({ bucket: comConteudo(() => PDF) });
  const [arquivo] = (await ler(await preparar(codigo, { nomes: ["a.pdf"] }))).corpo.arquivos;

  sessaoDe(memoria).expira_em = new Date(Date.now() - 29 * 60_000).toISOString();
  const dentro = await ler(await concluir(codigo, { arquivo_ids: [arquivo.arquivo_id] }));
  assert.equal(dentro.status, 200, "vencido há 29 minutos: ainda confere o que já tinha subido");
  assert.equal(dentro.corpo.chegaram, 1);

  sessaoDe(memoria).expira_em = new Date(Date.now() - 31 * 60_000).toISOString();
  const fora = await ler(await concluir(codigo, { arquivo_ids: [arquivo.arquivo_id] }));
  assert.deepEqual([fora.status, fora.corpo.situacao], [410, "expirado"]);
});

test("o link só confere o que a página dele enviou: arquivo do envio por endereço, mesmo do mesmo destino, fica de fora", async () => {
  const { memoria, codigo } = await comLink({ bucket: comConteudo(() => PDF) });
  memoria.tabela("assistente_arquivos").push({
    id: "5c1b0f0e-0000-4000-8000-0000000000e5",
    prestacao_id: PRESTACAO,
    origem: "url_assinada",
    destino: "despesa",
    situacao: "aguardando",
    nome_arquivo: "do-assistente.pdf",
    storage_path: `${ORG}/prestacoes/${PRESTACAO}/comprovantes/x.pdf`,
    created_at: new Date().toISOString(),
  });
  const { status, corpo } = await ler(await concluir(codigo, { arquivo_ids: ["5c1b0f0e-0000-4000-8000-0000000000e5"] }));
  assert.equal(status, 200);
  assert.deepEqual(corpo.arquivos, []);
  assert.equal(memoria.linhas("assistente_arquivos")[0].situacao, "aguardando");
});

test("as respostas das rotas públicas nunca ficam em cache", async () => {
  const { codigo } = await comLink();
  assert.equal((await preparar(codigo, { nomes: ["a.pdf"] })).headers.get("cache-control"), "no-store");
  assert.equal((await preparar("E".repeat(43), { nomes: ["a.pdf"] })).headers.get("cache-control"), "no-store");
  assert.equal((await concluir(codigo, {})).headers.get("cache-control"), "no-store");
});
