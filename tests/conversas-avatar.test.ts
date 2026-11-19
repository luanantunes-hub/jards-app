import assert from "node:assert/strict";
import test from "node:test";
import { CORES_DO_AVATAR, corDoAvatar, iniciaisDe } from "../lib/conversas/avatar";

test("iniciais: primeira e última palavra do nome, sem as partículas", () => {
  assert.equal(iniciaisDe("Marina Duarte"), "MD");
  assert.equal(iniciaisDe("Ana de Souza Lima"), "AL");
  assert.equal(iniciaisDe("paulo"), "PA");
  assert.equal(iniciaisDe("  Rita  Prado  "), "RP");
});

test("sem nome, as iniciais saem do endereço", () => {
  assert.equal(iniciaisDe(null, "ana.souza@x.com"), "AS");
  assert.equal(iniciaisDe("", "paulo@cianorte.com.br"), "PA");
  assert.equal(iniciaisDe("marina@aurora.com.br"), "MA", "um nome que é só o e-mail não vira 'M@'");
  assert.equal(iniciaisDe(null, null), "?");
});

test("a cor é sempre a mesma para a mesma pessoa e sai da paleta da identidade", () => {
  const cor = corDoAvatar("marina@aurora.com.br");
  assert.equal(cor, corDoAvatar("Marina@Aurora.com.BR "), "maiúsculas e espaços não mudam a cor");
  assert.ok(CORES_DO_AVATAR.includes(cor as (typeof CORES_DO_AVATAR)[number]));
  assert.equal(corDoAvatar(null), CORES_DO_AVATAR[0]);
  // pessoas diferentes não caem todas na mesma cor
  const cores = new Set(["a@x.com", "b@x.com", "c@x.com", "d@x.com", "e@x.com", "f@x.com", "g@x.com"].map(corDoAvatar));
  assert.ok(cores.size >= 3, `espalhou pouco: ${[...cores].join(", ")}`);
});
