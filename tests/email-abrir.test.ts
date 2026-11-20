import assert from "node:assert/strict";
import test from "node:test";
import { enderecoDoOutlookValido, enderecoNoGmail } from "../lib/email/abrir";
import { emLotes, emPartes } from "../lib/email/lotes";

test("o endereço da conversa no Gmail abre a conta certa e a conversa em Todos os e-mails", () => {
  assert.equal(
    enderecoNoGmail("luan@exemplo.com.br", "18c2f3a4b5d6e7f8"),
    "https://mail.google.com/mail/u/luan@exemplo.com.br/#all/18c2f3a4b5d6e7f8",
  );
});

test("sem a conta conhecida o Gmail abre a primeira conta logada", () => {
  assert.equal(enderecoNoGmail(null, "18c2f3a4b5d6e7f8"), "https://mail.google.com/mail/u/0/#all/18c2f3a4b5d6e7f8");
});

test("o Graph só leva a endereços https da Microsoft", () => {
  assert.equal(
    enderecoDoOutlookValido("https://outlook.office365.com/owa/?ItemID=AAMk%3D&exvsurl=1&viewmodel=ReadMessageItem"),
    "https://outlook.office365.com/owa/?ItemID=AAMk%3D&exvsurl=1&viewmodel=ReadMessageItem",
  );
  assert.ok(enderecoDoOutlookValido("https://outlook.live.com/owa/?ItemID=x"));
  assert.ok(enderecoDoOutlookValido("https://outlook.office.com/mail/deeplink/read/x"));
});

test("endereço de outro site, sem https ou que só imita a Microsoft é descartado", () => {
  assert.equal(enderecoDoOutlookValido("https://exemplo.com/owa"), null);
  assert.equal(enderecoDoOutlookValido("http://outlook.office365.com/owa"), null);
  assert.equal(enderecoDoOutlookValido("https://outlook.office365.com.golpe.com/owa"), null);
  assert.equal(enderecoDoOutlookValido("https://golpeoutlook.com/owa"), null);
  assert.equal(enderecoDoOutlookValido("javascript:alert(1)"), null);
  assert.equal(enderecoDoOutlookValido("não é endereço"), null);
  assert.equal(enderecoDoOutlookValido(undefined), null);
  assert.equal(enderecoDoOutlookValido(42), null);
});

test("a lista é partida em pedaços do tamanho pedido, sem perder ninguém", () => {
  assert.deepEqual(emPartes([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(emPartes([], 3), []);
  assert.deepEqual(emPartes(["a"], 30), [["a"]]);
});

test("em lotes, o resultado segue a ordem da lista e nunca passa do tamanho do lote ao mesmo tempo", async () => {
  let ativas = 0;
  let maximo = 0;
  const resultado = await emLotes([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    ativas += 1;
    maximo = Math.max(maximo, ativas);
    await new Promise((resolver) => setTimeout(resolver, 5));
    ativas -= 1;
    return n * 10;
  });
  assert.deepEqual(resultado, [10, 20, 30, 40, 50, 60, 70]);
  assert.ok(maximo <= 3, `chegou a ${maximo} ao mesmo tempo`);
});
