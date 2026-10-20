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

// ─── Dado pessoal nas mensagens das verificações ────────────────────────────

test("verificação que cita o extrato ou um beneficiado só chega ao assistente pelo título: a lista cobre todas as checagens que citam", async () => {
  const { CODIGOS_COM_DADO_PESSOAL, mensagemParaOAssistente } = await import("../lib/mcp/prestacao/mensagens");

  // Cada checagem cujo texto interpola o histórico do extrato ou o nome de um beneficiado precisa estar na lista.
  const pasta = "lib/prestacao/checagens";
  const arquivosDasChecagens = (await readdir(pasta)).filter((nome) => /^checar-.*\.ts$/.test(nome));
  const citam: { arquivo: string; codigo: string }[] = [];
  for (const nome of arquivosDasChecagens) {
    const linhas = (await readFile(join(pasta, nome), "utf8")).split("\n");
    linhas.forEach((linha, i) => {
      if (!/mensagem:/.test(linha) || !/historico|\$\{debito\}|debito\(|\$\{r\.nome\}/.test(linha)) return;
      for (let j = i; j >= Math.max(0, i - 12); j--) {
        const codigo = /codigo:\s*"([A-Z0-9_]+)"/.exec(linhas[j])?.[1];
        if (codigo) {
          citam.push({ arquivo: nome, codigo });
          return;
        }
      }
      citam.push({ arquivo: nome, codigo: "?" });
    });
  }
  assert.ok(citam.length >= 5, `checagens que citam extrato ou beneficiado: ${citam.length}`);
  for (const { arquivo, codigo } of citam) assert.ok(CODIGOS_COM_DADO_PESSOAL.has(codigo), `${arquivo}: ${codigo} cita extrato ou beneficiado e não está em CODIGOS_COM_DADO_PESSOAL`);

  // O que sai para o assistente: só o título, sem o histórico nem o nome.
  const original = "Débito de R$ 800,00 em 12/06/2026 (PIX ENVIADO MARIA DA SILVA 123.456.789-00): o regime veda.";
  const saida = mensagemParaOAssistente({ check_codigo: "SAQUE_NO_EXTRATO", mensagem: original, entidade_tipo: "lancamento" });
  assert.doesNotMatch(saida, /MARIA|PIX|123\.456/);
  assert.match(saida, /fica no app/);
  assert.equal(mensagemParaOAssistente({ check_codigo: "BENEFICIADO_REPETIDO", mensagem: "João (12 anos) aparece 2 vezes", entidade_tipo: "prestacao" }).includes("João"), false);
  // Uma verificação comum segue como está.
  assert.equal(mensagemParaOAssistente({ check_codigo: "DOC_RETENCOES", mensagem: "Falta o ISS.", entidade_tipo: "despesa" }), "Falta o ISS.");
  // Qualquer código sobre uma linha do extrato, mesmo um que ainda não exista, também vai só pelo título.
  assert.match(mensagemParaOAssistente({ check_codigo: "CODIGO_NOVO", mensagem: "Débito (JOAO) ...", entidade_tipo: "lancamento" }), /fica no app/);

  // Os três pontos em que o conector entrega mensagem de verificação passam pelo filtro.
  for (const arquivo of ["lib/mcp/prestacao/pendencias.ts", "lib/mcp/prestacao/despesas.ts"]) {
    const texto = semComentarios(await readFile(arquivo, "utf8"));
    assert.doesNotMatch(texto, /mensagem:\s*v\.mensagem/, `${arquivo}: entrega a mensagem da verificação sem passar por mensagemParaOAssistente`);
    assert.match(texto, /mensagemParaOAssistente\(/, arquivo);
  }
});

// ─── Toda rota de dados do conector sabe de que módulo é ────────────────────

test("rota do conector que autentica por conta própria (fora da casca) confere o módulo da chave", async () => {
  const todas = (await arquivos("app/api/mcp")).filter((caminho) => caminho.endsWith("route.ts"));
  const proprias: string[] = [];
  for (const caminho of todas) {
    const texto = semComentarios(await readFile(caminho, "utf8"));
    // Rotas da casca (rotaMcp) declaram o módulo nas opções; as demais autenticam direto.
    if (!/authenticateMcpRequest\(|dependenciasDaRota\.autenticar\(/.test(texto)) continue;
    proprias.push(caminho);
    assert.match(texto, /requireModulo\(\s*ctx\s*,\s*"captacao"\s*\)/, `${caminho}: autentica a chave mas não confere o módulo da captação (uma chave só da prestação passaria)`);
  }
  assert.ok(proprias.length >= 7, `rotas que autenticam por conta própria: ${proprias.length}`);
});

test("revogar a conexão derruba também os links de envio que ela criou", async () => {
  const rota = semComentarios(await readFile("app/api/mcp/keys/route.ts", "utf8"));
  const exclusao = rota.slice(rota.indexOf("export async function DELETE"));
  assert.match(exclusao, /assistente_sessoes_envio/);
  assert.match(exclusao, /revogada_em:\s*agora/);
  assert.match(exclusao, /\.eq\("chave_id",\s*id\)/);
});
