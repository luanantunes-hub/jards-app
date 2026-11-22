import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BlocosEmBreve } from "@/components/ticketeria/BlocosNovosSheet";
import { BLOCOS_EM_BREVE, TIPOS_DE_BLOCO } from "@/lib/ticketeria/site";

// Os blocos "Em breve" do seletor "Acrescentar bloco": o passe do ingresso na carteira do celular. Ainda não existem, então não são tipos de bloco.

test("os dois blocos previstos são a Google Wallet e a Apple Wallet", () => {
  assert.deepEqual(BLOCOS_EM_BREVE.map(b => b.rotulo), ["Google Wallet", "Apple Wallet"]);
});

test("não são tipos de bloco: não dá para guardá-los na página nem validá-los", () => {
  for (const b of BLOCOS_EM_BREVE) assert.ok(!(TIPOS_DE_BLOCO as readonly string[]).includes(b.id), b.id);
});

test("o grupo aparece como \"Em breve\" e os dois botões estão desabilitados", () => {
  const html = renderToStaticMarkup(createElement(BlocosEmBreve));
  assert.match(html, /Em breve/);
  assert.match(html, /Google Wallet/);
  assert.match(html, /Apple Wallet/);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 2, "os dois botões desabilitados");
});
