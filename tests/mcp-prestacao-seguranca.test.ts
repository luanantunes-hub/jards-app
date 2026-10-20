import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

// O conector da prestação lê com a chave de serviço, que ignora o RLS do app. Estas conferências olham o código-fonte
// (sem banco) para que uma rota nova não escape das regras: módulo da chave, prestação sempre da organização,
// nunca todas as colunas e nunca as colunas protegidas.

const PASTAS = ["app/api/mcp/prestacoes", "lib/mcp/prestacao"];

/** Colunas que nunca saem do conector: segredo da captura por e-mail, descarte de dados pessoais, conta bancária e o retrato do envio. */
const PROTEGIDAS = ["email_captura_token", "email_captura_remetentes", "dados_pessoais_descarte", "dados_pessoais_descartados_em", "agencia", "numero_conta", "retrato_anonimizado_em"];

/**
 * O caminho do arquivo no Storage só existe onde o conector guarda e apaga arquivos (a caixa de entrada, o registro de
 * despesa e evidência e o desfazer). Em qualquer outro arquivo, citar a coluna é erro; e nas respostas ao assistente nunca sai
 * (cada rota de gravação tem teste que procura o caminho na resposta).
 */
const PODEM_CITAR_O_CAMINHO_DO_ARQUIVO = new Set([
  "lib/mcp/prestacao/caixa.ts",
  "lib/mcp/prestacao/despesas-gravacao.ts",
  "lib/mcp/prestacao/evidencias-gravacao.ts",
  "lib/mcp/prestacao/desfazer.ts",
]);

const readTextoSync = (caminho: string) => readFileSync(caminho, "utf8");

async function arquivos(pasta: string): Promise<string[]> {
  const entradas = await readdir(pasta, { withFileTypes: true }).catch(() => []);
  const lista: string[] = [];
  for (const entrada of entradas) {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) lista.push(...(await arquivos(caminho)));
    else if (/\.ts$/.test(entrada.name)) lista.push(caminho);
  }
  return lista;
}

/** O código sem comentários e sem as linhas de import (o nome de uma função importada não é uma chamada). */
const semComentarios = (texto: string) =>
  texto
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?$/gm, "");

async function fontes() {
  const todos = (await Promise.all(PASTAS.map(arquivos))).flat();
  return Promise.all(todos.map(async (caminho) => ({ caminho, texto: semComentarios(await readFile(caminho, "utf8")) })));
}

test("nenhuma consulta do conector da prestação pede todas as colunas", async () => {
  for (const { caminho, texto } of await fontes()) {
    assert.doesNotMatch(texto, /\.select\(\s*["'`]\s*\*/, `${caminho}: select("*")`);
    assert.doesNotMatch(texto, /\.select\(\s*["'`][^"'`]*(^|,)\s*\*\s*(,|["'`])/m, `${caminho}: coluna * no meio do select`);
    assert.doesNotMatch(texto, /\.select\(\s*\)/, `${caminho}: select() sem colunas`);
  }
});

test("as colunas protegidas não aparecem em nenhuma consulta do conector da prestação", async () => {
  for (const { caminho, texto } of await fontes()) {
    for (const coluna of PROTEGIDAS) assert.ok(!texto.includes(coluna), `${caminho} cita ${coluna}`);
    if (!PODEM_CITAR_O_CAMINHO_DO_ARQUIVO.has(caminho)) assert.ok(!texto.includes("storage_path"), `${caminho} cita storage_path`);
    assert.doesNotMatch(texto, /["'`,\s]retrato["'`,\s]/, `${caminho}: o retrato do envio não sai do app`);
  }
});

test("toda rota do conector da prestação passa pela casca com o módulo da prestação", async () => {
  const rotas = (await fontes()).filter(({ caminho }) => caminho.startsWith("app/api/mcp/prestacoes") && caminho.endsWith("route.ts"));
  assert.ok(rotas.length >= 10, `rotas encontradas: ${rotas.length}`);
  for (const { caminho, texto } of rotas) {
    assert.match(texto, /rotaMcp\(\s*\{[^}]*modulo:\s*"prestacao"/, `${caminho}: falta rotaMcp com modulo "prestacao"`);
    assert.doesNotMatch(texto, /authenticateMcpRequest|createAdminClient\(/, `${caminho}: autenticação e banco passam pela casca`);
  }
});

test("rota que lê por id da prestação confere a organização antes de qualquer outra consulta", async () => {
  const porId = (await fontes()).filter(({ caminho }) => caminho.startsWith("app/api/mcp/prestacoes/[id]") && caminho.endsWith("route.ts"));
  assert.ok(porId.length >= 4);
  for (const { caminho, texto } of porId) {
    const conferencia = texto.indexOf("prestacaoDaOrganizacao(");
    assert.ok(conferencia >= 0, `${caminho}: não confere a organização da prestação`);
    const primeiraConsulta = texto.search(/admin\s*\.\s*from\(|lerTodas|orcamentoAtivo\(|leituraDoResumo\(|regimeDaPrestacao\(/);
    assert.ok(primeiraConsulta === -1 || conferencia < primeiraConsulta, `${caminho}: consulta antes de conferir a organização`);
  }
});

test("quem recebe um id de prestação sem conferir a organização é só o motor de checagens, e só depois da conferência", async () => {
  const leitura = (await fontes()).find(({ caminho }) => caminho === "lib/mcp/prestacao/leitura.ts");
  assert.ok(leitura);
  // estadoDaPrestacao e carregarDadosDoEnvio leem por id com a chave de serviço: só entram por leituraDoResumo, que recebe a prestação já conferida.
  assert.match(leitura.texto, /export async function leituraDoResumo\(admin: Admin, prestacao: PrestacaoDoResumo/);
  for (const { caminho, texto } of await fontes()) {
    if (caminho === "lib/mcp/prestacao/leitura.ts") continue;
    assert.doesNotMatch(texto, /estadoDaPrestacao\(|carregarDadosDoEnvio\(/, `${caminho}: lê por id sem passar por leituraDoResumo`);
  }
});

test("rota que grava usa a casca com escrita: true; rota que só lê, escrita: false", async () => {
  const rotas = (await fontes()).filter(({ caminho }) => caminho.startsWith("app/api/mcp/prestacoes") && caminho.endsWith("route.ts"));
  for (const { caminho, texto } of rotas) {
    for (const [, metodo, opcoes] of texto.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) = rotaMcp\(\{([^}]*)\}/g)) {
      const grava = metodo !== "GET";
      assert.match(opcoes, grava ? /escrita:\s*true/ : /escrita:\s*false/, `${caminho}: ${metodo} com a escrita errada`);
    }
  }
});

test("rota que grava na prestação confere no banco quem edita e o que cria sempre é do canal assistente", async () => {
  const gravam = (await fontes()).filter(({ caminho }) => caminho.startsWith("app/api/mcp/prestacoes/[id]") && /export const POST = /.test(readTextoSync(caminho)));
  assert.ok(gravam.length >= 6, `rotas que gravam: ${gravam.length}`);
  for (const { caminho, texto } of gravam) {
    assert.match(texto, /exigirEdicao\(/, `${caminho}: grava sem conferir quem edita`);
  }
  const registros = (await fontes()).filter(({ caminho }) => ["despesas-gravacao.ts", "evidencias-gravacao.ts"].some((nome) => caminho.endsWith(nome)));
  for (const { caminho, texto } of registros) assert.match(texto, /canal: "assistente"/, `${caminho}: o registro não leva o canal assistente`);
  const despesas = registros.find(({ caminho }) => caminho.endsWith("despesas-gravacao.ts"))!.texto;
  assert.match(despesas, /status: "pendente"/);
  assert.match(despesas, /avaliado_por: null/);
  assert.match(despesas, /avaliado_em: null/);
});

// ─── A página de envio (sem login) ──────────────────────────────────────────

test("a página de envio: rotas passam pela casca pública, o pedido não escolhe prestação nem destino e o hash nunca é lido", async () => {
  const rotas = (await arquivos("app/api/enviar")).filter((caminho) => caminho.endsWith("route.ts"));
  assert.equal(rotas.length, 2, rotas.join(", "));
  for (const caminho of rotas) {
    const texto = semComentarios(await readFile(caminho, "utf8"));
    assert.match(texto, /export const POST = rotaDeEnvio\(/, `${caminho}: fora da casca pública`);
    assert.doesNotMatch(texto, /createAdminClient|\.from\(/, `${caminho}: acessa o banco sem passar pela lógica do link`);
    assert.doesNotMatch(texto, /corpo\.(prestacao_id|destino|organization_id)|corpo\["(prestacao_id|destino|organization_id)"\]/, `${caminho}: lê do pedido o que vem do link`);
  }

  const logica = semComentarios(await readFile("lib/mcp/prestacao/envio-publico.ts", "utf8"));
  const colunas = /COLUNAS_DA_SESSAO = "([^"]+)"/.exec(logica)?.[1] ?? "";
  assert.ok(colunas.length > 0, "COLUNAS_DA_SESSAO não encontrada");
  assert.doesNotMatch(colunas, /token_hash/, "o hash do código não é lido de volta");
  assert.doesNotMatch(logica, /corpo\.(prestacao_id|destino|organization_id)/);
  assert.doesNotMatch(logica, /\.select\(\s*["'`]\s*\*/);
  // Toda conferência do link vem antes de qualquer gravação: as duas operações públicas começam por exigirLink.
  for (const operacao of ["prepararEnvioDaPagina", "concluirEnvioDaPagina"]) {
    const corpo = new RegExp(`export async function ${operacao}\\([^)]*\\)[^{]*\\{\\s*const link = await exigirLink\\(`);
    assert.match(logica, corpo, `${operacao}: não começa conferindo o link`);
  }
});

test("a página de envio e as duas rotas estão abertas no proxy (sem login), com limite próprio por IP", () => {
  const proxy = readTextoSync("proxy.ts");
  assert.equal((proxy.match(/pathname\.startsWith\("\/enviar\/"\)/g) ?? []).length, 2, "/enviar/ precisa estar nas duas listas de páginas públicas");
  assert.match(proxy, /\["\/api\/enviar", \d+\]/, "as rotas /api/enviar têm limite próprio");
  const limites = [...proxy.matchAll(/\["(\/api\/[^"]*)", (\d+)\]/g)].map(([, prefixo]) => prefixo);
  assert.ok(limites.indexOf("/api/enviar") < limites.indexOf("/api/"), "o limite próprio vem antes do geral, senão nunca vale");
});

test("a equipe retira pelo app com a sessão de quem pediu: a rota confere login, visibilidade e edição antes de qualquer apagamento", async () => {
  const rota = semComentarios(await readFile("app/api/prestacoes/[id]/assistente/retirar/route.ts", "utf8"));
  assert.match(rota, /auth\.getUser\(\)/, "sem conferir o login");
  assert.match(rota, /auth_prestacao_pode/, "sem perguntar ao banco se a pessoa edita");
  assert.match(rota, /retirarPelaEquipe\(/, "não passa pela retirada com as conferências");
  assert.doesNotMatch(rota, /\.delete\(\)|storage/, "a rota não apaga nada por conta própria");

  const logica = semComentarios(await readFile("lib/mcp/prestacao/retirada-da-equipe.ts", "utf8"));
  const posicoes = ["enxerga(", "podeEditar(", "retirarRegistro("].map((trecho) => logica.indexOf(trecho));
  assert.ok(posicoes.every((p) => p > 0) && posicoes[0] < posicoes[1] && posicoes[1] < posicoes[2], "a ordem é ver, depois editar, depois retirar");
});
