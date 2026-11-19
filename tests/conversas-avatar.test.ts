import assert from "node:assert/strict";
import test from "node:test";
import { CORES_DO_AVATAR, caminhoDoDesenho, corDoAvatar, desenhoDoAvatar, iniciaisDe } from "../lib/conversas/avatar";

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

test("o desenho conta o estado da conversa, e sem estado é sempre o mesmo para a mesma pessoa", () => {
  assert.equal(desenhoDoAvatar("aguardando"), "aguardando");
  assert.equal(desenhoDoAvatar("so-eu-vejo", "qualquer@x.com"), "so-eu-vejo");
  const neutro = desenhoDoAvatar(null, "marina@aurora.com.br");
  assert.equal(neutro, desenhoDoAvatar(null, " Marina@Aurora.com.BR "));
  assert.ok(["aceno", "trabalhando", "celular", "coracao", "ideia"].includes(neutro), neutro);
  assert.equal(desenhoDoAvatar(null, null), "aceno");
  assert.equal(caminhoDoDesenho("aguardando"), "/avatares/aguardando.png");
});

test("todo desenho citado existe como arquivo", async () => {
  const { access } = await import("node:fs/promises");
  const estados = ["aguardando", "respondeu", "sem-contato", "so-eu-vejo", "agendado", "a-caminho", "falhou", "gravada"] as const;
  for (const nome of [...estados, "aceno", "trabalhando", "celular", "coracao", "ideia", "gravada"]) {
    await access(`public${caminhoDoDesenho(nome)}`);
  }
});
