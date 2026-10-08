import assert from "node:assert/strict";
import test from "node:test";
import { escaparHtml, paginaDeRetorno } from "../lib/mcp/retorno-oauth";

const base = { titulo: "Acesso autorizado", mensagem: "Pronto. Voltando ao Claude…" };

test("a página leva ao callback por refresh e também por um link de reserva", () => {
  const destino = "https://claude.ai/api/mcp/auth_callback?state=abc&code=jards_oauth_code_xyz";
  const html = paginaDeRetorno({ ...base, destino });

  assert.match(html, /<meta http-equiv="refresh" content="0;url=https:\/\/claude\.ai\/api\/mcp\/auth_callback\?state=abc&amp;code=jards_oauth_code_xyz">/);
  assert.match(html, /<a href="https:\/\/claude\.ai\/api\/mcp\/auth_callback\?state=abc&amp;code=jards_oauth_code_xyz">continue por aqui<\/a>/);
});

test("o endereço de volta é escapado: nada sai do atributo nem vira tag", () => {
  const html = paginaDeRetorno({ ...base, destino: 'https://x.test/cb?a=1&b="><script>alert(1)</script>' });

  assert.doesNotMatch(html, /<script/i);
  assert.ok(html.includes("&quot;&gt;&lt;script&gt;"));
  assert.equal((html.match(/content="0;url=[^"]*"/g) ?? []).length, 1);
});

test("título e mensagem também são escapados (o nome do assistente vem de quem se registrou)", () => {
  const html = paginaDeRetorno({ destino: "https://claude.ai/cb", titulo: "<b>x</b>", mensagem: "Voltando ao <img src=x onerror=alert(1)>…" });

  assert.doesNotMatch(html, /<img/i);
  assert.doesNotMatch(html, /<b>/i);
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
});

test("a página declara UTF-8, não tem script e serve também para callback em loopback", () => {
  const html = paginaDeRetorno({ ...base, destino: "http://localhost:54321/callback?code=abc&state=s" });

  assert.match(html, /<meta charset="utf-8">/);
  assert.doesNotMatch(html, /<script/i);
  assert.ok(html.includes('content="0;url=http://localhost:54321/callback?code=abc&amp;state=s"'));
});

test("escaparHtml troca os cinco caracteres que importam", () => {
  assert.equal(escaparHtml(`<a href="x" title='y'>&</a>`), "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
});
