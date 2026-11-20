import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";

// O plugin do WordPress (integracoes/wordpress/jards-ingressos): sem WordPress nem PHP aqui, o teste confere o que dá para conferir no texto: versões iguais, cuidado com o que se imprime,
// nenhuma chamada de rede do lado do servidor, e que o que o plugin pede ao Jards (rota, aviso de altura, chave) é o que o Jards serve.

const PASTA = "integracoes/wordpress/jards-ingressos";
const PHP = readFileSync(`${PASTA}/jards-ingressos.php`, "utf8");
const README = readFileSync(`${PASTA}/readme.txt`, "utf8");
const JS = readFileSync(`${PASTA}/assets/jards-ingressos.js`, "utf8");
const semComentarios = (php: string) => php.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a versão é a mesma no cabeçalho, na constante, no readme e no script do editor", () => {
  const cabecalho = /^ \* Version:\s*(\S+)/m.exec(PHP)?.[1];
  assert.match(cabecalho ?? "", /^\d+\.\d+\.\d+$/);
  assert.equal(/define\( 'JARDS_INGRESSOS_VERSION', '([^']+)' \)/.exec(PHP)?.[1], cabecalho);
  assert.equal(/^Stable tag:\s*(\S+)/m.exec(README)?.[1], cabecalho);
  assert.ok(README.includes(`= ${cabecalho} =`), "o changelog fala da versão");
  assert.ok(readFileSync(`${PASTA}/blocks/ingressos/editor.asset.php`, "utf8").includes(`'${cabecalho}'`));
});

test("o cabeçalho e o readme cumprem o que o diretório do WordPress.org pede", () => {
  for (const campo of ["Plugin Name:", "Description:", "Version:", "Requires at least:", "Requires PHP:", "Author:", "License:       ", "Text Domain:       jards-ingressos"]) assert.ok(PHP.includes(campo), campo);
  assert.match(PHP, /License:\s+GPL-2\.0-or-later/);
  for (const campo of ["=== Jards Ingressos ===", "Tested up to:", "License: GPLv2 or later", "== Description ==", "== Installation ==", "== Changelog ==", "= Serviço externo ="]) assert.ok(README.includes(campo), campo);
  for (const url of ["https://jards.com.br/termos", "https://jards.com.br/privacidade"]) assert.ok(README.includes(url), `o serviço externo cita ${url}`);
  assert.ok(README.split("\n").find(l => l.startsWith("Tags:"))!.split(",").length <= 5, "no máximo 5 tags");
});

test("todo arquivo PHP começa barrando o acesso direto", () => {
  for (const arquivo of ["jards-ingressos.php", "uninstall.php", "blocks/ingressos/editor.asset.php"]) {
    const php = readFileSync(`${PASTA}/${arquivo}`, "utf8");
    if (arquivo === "uninstall.php") assert.match(php, /if \( ! defined\( 'WP_UNINSTALL_PLUGIN' \) \) \{\s*exit;/);
    else if (arquivo === "jards-ingressos.php") assert.match(php, /if \( ! defined\( 'ABSPATH' \) \) \{\s*exit;/);
  }
  assert.match(readFileSync(`${PASTA}/uninstall.php`, "utf8"), /delete_option\( 'jards_ingressos_chave' \);\s*delete_option\( 'jards_ingressos_origem' \);/, "apagar o plugin apaga as duas opções");
});

test("tudo o que é impresso passa por escape, e nada executa código nem chama a rede por conta própria", () => {
  const codigo = semComentarios(PHP);
  const echos = [...codigo.matchAll(/\becho\s+([^;]*);/g)].map(m => m[1].trim());
  assert.ok(echos.length >= 8);
  for (const e of echos) assert.match(e, /^esc_(html|attr|url)(__)?\(/, `echo sem escape: ${e}`);
  assert.doesNotMatch(codigo, /\b(eval|exec|shell_exec|system|passthru|proc_open|popen|assert|create_function|unserialize|base64_decode|file_get_contents|curl_init|wp_remote_get|wp_remote_post|fopen|include|require)\b/, "nada perigoso nem chamada de rede do servidor");
  assert.doesNotMatch(codigo, /\$_(GET|POST|REQUEST|COOKIE|SERVER|FILES)\b/, "o plugin não lê dados do pedido: só as opções, que passam pela API de configurações");
  assert.match(codigo, /current_user_can\( 'manage_options' \)/);
  assert.match(codigo, /add_options_page\([\s\S]*'manage_options'/, "a página de configuração exige manage_options");
  assert.match(codigo, /settings_fields\( 'jards_ingressos' \)/, "o formulário usa a API de configurações (que traz o nonce)");
});

test("as duas opções têm função de limpeza, e a chave e o endereço são conferidos", () => {
  const codigo = semComentarios(PHP);
  assert.match(codigo, /'jards_ingressos_chave',\s*array\([\s\S]*?'sanitize_callback'\s*=>\s*'jards_ingressos_sanitizar_chave'/);
  assert.match(codigo, /'jards_ingressos_origem',\s*array\([\s\S]*?'sanitize_callback'\s*=>\s*'jards_ingressos_sanitizar_origem'/);
  assert.match(codigo, /'\/\^tkp_\[a-f0-9\]\{32\}\$\/'/, "a chave: tkp_ e 32 letras e números minúsculos");
  assert.match(codigo, /'https' !== \$partes\['scheme'\]/, "só https");
  assert.match(codigo, /isset\( \$partes\['user'\] \) \|\| isset\( \$partes\['pass'\] \)/, "sem usuário e senha");
  assert.match(codigo, /JARDS_INGRESSOS_ORIGEM_PADRAO', 'https:\/\/jards\.com\.br'/, "o endereço padrão é o de produção");
});

test("o que o plugin pede ao Jards é o que o Jards serve", () => {
  const chaveDoJards = /export const CHAVE_PUBLICA = (\/\^tkp_\[a-f0-9\]\{32\}\$\/);/.exec(readFileSync("lib/ticketeria/integracao.ts", "utf8"))?.[1];
  assert.ok(chaveDoJards, "achou a regra da chave no Jards");
  assert.ok(PHP.includes(`'${chaveDoJards}'`), "a regra da chave é a mesma nos dois lados");
  assert.ok(existsSync("app/embed/ingressos/[chave]/page.tsx"), "a página do iframe existe");
  assert.ok(PHP.includes("'/embed/ingressos/' . $chave"), "o plugin pede a página que o Jards serve");
  assert.ok(PHP.includes("add_query_arg( 'evento'"), "e o filtro por evento que ela entende");
  assert.ok(readFileSync("app/embed/ingressos/[chave]/page.tsx", "utf8").includes("evento"));
  const aviso = /tipo:\s*"([^"]+)"/.exec(readFileSync("components/ticketeria/AjustarAltura.tsx", "utf8"))?.[1];
  assert.equal(aviso, "jards-ticketeria-altura");
  assert.ok(JS.includes(`'${aviso}'`), "o aviso de altura é o que o Jards manda");
  const sandbox = /setAttribute\("sandbox", "([^"]+)"\)/.exec(readFileSync("public/widget/ingressos.js", "utf8"))?.[1];
  assert.ok(sandbox && PHP.includes(`sandbox="${sandbox}"`), "o sandbox é o mesmo do widget de script");
  assert.doesNotMatch(PHP, /allow-top-navigation/, "o iframe nunca leva a página de fora a outro lugar");
});

test("o script da altura só aceita o aviso do próprio iframe, do endereço do Jards, e limita a altura", () => {
  const frame = (origem: string) => ({ contentWindow: { id: origem }, style: {} as { height?: string }, getAttribute: (n: string) => (n === "data-origem" ? origem : null) });
  const frames = [frame("https://jards.com.br"), frame("https://outro.exemplo.com")];
  let ouvinte: ((e: unknown) => void) | null = null;
  vm.runInNewContext(JS, { window: { addEventListener: (_: string, f: (e: unknown) => void) => { ouvinte = f; } }, document: { querySelectorAll: () => frames }, isFinite, Math });
  assert.ok(ouvinte);
  const mandar = (origin: string, source: unknown, data: unknown) => (ouvinte as unknown as (e: unknown) => void)({ origin, source, data });
  mandar("https://jards.com.br", frames[0].contentWindow, { tipo: "jards-ticketeria-altura", altura: 512.6 });
  assert.equal(frames[0].style.height, "513px");
  assert.equal(frames[1].style.height, undefined, "o outro iframe não mexe");
  mandar("https://jards.com.br", frames[0].contentWindow, { tipo: "jards-ticketeria-altura", altura: 99999 });
  assert.equal(frames[0].style.height, "4000px");
  mandar("https://jards.com.br", frames[0].contentWindow, { tipo: "jards-ticketeria-altura", altura: 1 });
  assert.equal(frames[0].style.height, "120px");
  frames[0].style.height = "300px";
  mandar("https://mau.exemplo.com", frames[0].contentWindow, { tipo: "jards-ticketeria-altura", altura: 900 });
  mandar("https://jards.com.br", { id: "outra janela" }, { tipo: "jards-ticketeria-altura", altura: 900 });
  mandar("https://jards.com.br", frames[0].contentWindow, { tipo: "x", altura: 900 });
  mandar("https://jards.com.br", frames[0].contentWindow, { tipo: "jards-ticketeria-altura", altura: "900" });
  mandar("https://jards.com.br", frames[0].contentWindow, null);
  assert.equal(frames[0].style.height, "300px", "aviso de fora, de outra janela ou malformado não mexeu");
  assert.doesNotMatch(JS, /\beval\(|innerHTML|document\.write|new Function/);
});

test("o bloco: block.json certo, tela do editor, e renderização no servidor (sem salvar HTML)", () => {
  const bloco = JSON.parse(readFileSync(`${PASTA}/blocks/ingressos/block.json`, "utf8"));
  assert.equal(bloco.name, "jards/ingressos");
  assert.equal(bloco.attributes.evento.type, "string");
  assert.equal(bloco.editorScript, "file:./editor.js");
  assert.equal(bloco.textdomain, "jards-ingressos");
  const editor = readFileSync(`${PASTA}/blocks/ingressos/editor.js`, "utf8");
  assert.match(editor, /registerBlockType\( 'jards\/ingressos'/);
  assert.match(editor, /save: function \(\) \{\s*return null;/, "o bloco é dinâmico: o HTML sai do servidor");
  assert.doesNotMatch(editor, /\beval\(|innerHTML|dangerouslySetInnerHTML/);
  assert.match(PHP, /register_block_type\(\s*__DIR__ \. '\/blocks\/ingressos'/);
  assert.ok(PHP.includes("'render_callback' => 'jards_ingressos_bloco'"));
});

test("o empacotador gera o zip com a pasta do plugin e sem arquivo escondido", () => {
  const saida = mkdtempSync(join(tmpdir(), "jards-plugin-"));
  try {
    const zip = execFileSync("bash", ["scripts/empacotar-plugin-wordpress.sh", saida], { encoding: "utf8" }).trim();
    assert.match(zip, /jards-ingressos-\d+\.\d+\.\d+\.zip$/);
    const lista = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).split("\n").filter(Boolean);
    for (const f of ["jards-ingressos/jards-ingressos.php", "jards-ingressos/readme.txt", "jards-ingressos/uninstall.php", "jards-ingressos/assets/jards-ingressos.js", "jards-ingressos/blocks/ingressos/block.json", "jards-ingressos/blocks/ingressos/editor.js", "jards-ingressos/blocks/ingressos/editor.asset.php"]) assert.ok(lista.includes(f), f);
    assert.equal(lista.every(f => f.startsWith("jards-ingressos/")), true, "tudo dentro de uma pasta só");
    assert.equal(lista.some(f => /(^|\/)\./.test(f)), false, "nenhum arquivo escondido");
  } finally {
    rmSync(saida, { recursive: true, force: true });
  }
});
