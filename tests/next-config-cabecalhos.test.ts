import assert from "node:assert/strict";
import test from "node:test";
import config from "../next.config";

// Só a página para embutir (/embed/...) pode ser aberta dentro de outro site: todo o resto nega o iframe, no cabeçalho antigo
// (X-Frame-Options) e no novo (frame-ancestors). Se alguém mexer na lista de cabeçalhos, este teste lembra a regra.

type Regra = { source: string; headers: { key: string; value: string }[] };
const valor = (regra: Regra, chave: string) => regra.headers.find(cabecalho => cabecalho.key === chave)?.value;

test("tudo, menos /embed/, nega o iframe; /embed/ deixa qualquer site embutir e não manda X-Frame-Options", async () => {
  const regras = (await config.headers!()) as Regra[];
  assert.equal(regras.length, 3);
  const [geral, porta, embutir] = regras;
  assert.match(geral.source, /embed/, "a regra geral exclui /embed/");
  assert.equal(valor(geral, "X-Frame-Options"), "DENY");
  assert.match(valor(geral, "Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
  // A porta (PD7.3) é a única que libera a câmera (para ler o QR) e também nega o iframe.
  assert.equal(porta.source, "/producoes/porta");
  assert.match(valor(porta, "Permissions-Policy") ?? "", /camera=\(self\)/);
  assert.equal(valor(porta, "X-Frame-Options"), "DENY");
  assert.match(valor(geral, "Permissions-Policy") ?? "", /camera=\(\)/, "no resto do site a câmera segue bloqueada");
  assert.equal(embutir.source, "/embed/:path*");
  assert.equal(valor(embutir, "X-Frame-Options"), undefined);
  assert.match(valor(embutir, "Content-Security-Policy") ?? "", /frame-ancestors \*/);
  for (const regra of regras) {
    assert.equal(valor(regra, "X-Content-Type-Options"), "nosniff");
    assert.match(valor(regra, "Content-Security-Policy") ?? "", /default-src 'self'/);
  }
});

test("a regra geral não casa com /embed/ e casa com o resto, inclusive a raiz", () => {
  const expressao = new RegExp("^" + "/((?!embed/|producoes/porta$).*)" + "$");
  assert.equal(expressao.test("/embed/programacao/abc"), false);
  assert.equal(expressao.test("/producoes/espacos"), true);
  assert.equal(expressao.test("/"), true);
  assert.equal(expressao.test("/programacao/abc"), true);
  assert.equal(expressao.test("/embedded-coisa"), true, "só o prefixo /embed/ é exceção");
  assert.equal(expressao.test("/producoes/porta"), false, "a porta tem regra própria");
  assert.equal(expressao.test("/producoes/porta-dos-fundos"), true, "só a página da porta é exceção");
});
