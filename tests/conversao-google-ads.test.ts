import assert from "node:assert/strict";
import test from "node:test";
import { CONVERSAO_CADASTRO_ADS, VALOR_CADASTRO, registrarCadastroNoGoogleAds } from "../lib/conversao-google-ads";

const global = globalThis as { gtag?: unknown };

test("sem o aceite a tag não existe, e nada é enviado", async () => {
  delete global.gtag;
  await registrarCadastroNoGoogleAds("alguem@exemplo.com");
});

test("com a tag, o cadastro vai com o e-mail normalizado, o valor e o rótulo da conversão", async () => {
  const chamadas: unknown[][] = [];
  global.gtag = (...args: unknown[]) => {
    chamadas.push(args);
    const opcoes = args[2] as { event_callback?: () => void } | undefined;
    if (args[0] === "event") opcoes?.event_callback?.();
  };
  try {
    await registrarCadastroNoGoogleAds("  Alguem@Exemplo.com ");
    assert.deepEqual(chamadas[0], ["set", "user_data", { email: "alguem@exemplo.com" }]);
    assert.equal(chamadas[1][0], "event");
    assert.equal(chamadas[1][1], "conversion");
    const evento = chamadas[1][2] as Record<string, unknown>;
    assert.equal(evento.send_to, CONVERSAO_CADASTRO_ADS);
    assert.equal(evento.value, VALOR_CADASTRO);
    assert.equal(evento.currency, "BRL");
  } finally {
    delete global.gtag;
  }
});

test("se o Google não responde, o cadastro segue mesmo assim", async () => {
  global.gtag = () => {};
  try {
    const inicio = Date.now();
    await registrarCadastroNoGoogleAds("alguem@exemplo.com");
    assert.ok(Date.now() - inicio < 3000);
  } finally {
    delete global.gtag;
  }
});
