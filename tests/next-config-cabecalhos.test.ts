import assert from "node:assert/strict";
import test from "node:test";
import config from "../next.config";

// Só a página para embutir (/embed/...) pode ser aberta dentro de outro site, e a prévia do site (/previa-site/...) só dentro do próprio painel (mesma origem): todo o resto nega o iframe, no
// cabeçalho antigo (X-Frame-Options) e no novo (frame-ancestors). Se alguém mexer na lista de cabeçalhos, este teste lembra a regra.

type Regra = { source: string; headers: { key: string; value: string }[] };
const valor = (regra: Regra, chave: string) => regra.headers.find(cabecalho => cabecalho.key === chave)?.value;

test("tudo, menos /embed/ e /previa-site/, nega o iframe; /embed/ deixa qualquer site embutir; a prévia só o próprio painel", async () => {
  const regras = (await config.headers!()) as Regra[];
  assert.equal(regras.length, 3);
  const [geral, previa, embutir] = regras;
  assert.match(geral.source, /embed/, "a regra geral exclui /embed/");
  assert.match(geral.source, /previa-site/, "e a prévia do site");
  assert.equal(valor(geral, "X-Frame-Options"), "DENY");
  assert.match(valor(geral, "Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
  assert.match(valor(geral, "Permissions-Policy") ?? "", /camera=\(\)/, "nenhuma página usa a câmera");
  assert.equal(previa.source, "/previa-site/:path*");
  assert.equal(valor(previa, "X-Frame-Options"), "SAMEORIGIN", "a prévia abre só na mesma origem");
  assert.match(valor(previa, "Content-Security-Policy") ?? "", /frame-ancestors 'self'/);
  assert.doesNotMatch(valor(previa, "Content-Security-Policy") ?? "", /frame-ancestors \*/, "nunca em outro site");
  assert.equal(embutir.source, "/embed/:path*");
  assert.equal(valor(embutir, "X-Frame-Options"), undefined);
  assert.match(valor(embutir, "Content-Security-Policy") ?? "", /frame-ancestors \*/);
  for (const regra of regras) {
    assert.equal(valor(regra, "X-Content-Type-Options"), "nosniff");
    assert.match(valor(regra, "Content-Security-Policy") ?? "", /default-src 'self'/);
  }
});

test("a regra geral não casa com /embed/ nem com /previa-site/ e casa com o resto, inclusive a raiz", async () => {
  const expressao = new RegExp("^" + ((await config.headers!()) as Regra[])[0].source + "$");
  assert.equal(expressao.test("/previa-site/abc/inicio"), false);
  assert.equal(expressao.test("/previa-sitezinho"), true, "só a pasta /previa-site/ é exceção");
  assert.equal(expressao.test("/embed/programacao/abc"), false);
  assert.equal(expressao.test("/producoes/espacos"), true);
  assert.equal(expressao.test("/"), true);
  assert.equal(expressao.test("/programacao/abc"), true);
  assert.equal(expressao.test("/embedded-coisa"), true, "só o prefixo /embed/ é exceção");
});
