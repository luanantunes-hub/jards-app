import { rmSync } from "fs";
import { test as setup, expect } from "@playwright/test";
import { PERFIS, credenciais, entrar, problemasDaConta } from "./helpers/perfis";

// Um storageState por perfil de módulo (PD0.3), usado por e2e/modulos/.
// Perfil sem as duas variáveis é pulado: teste pulado não conta como falha,
// então o projeto "modulos" roda com os perfis que existirem.
for (const perfil of PERFIS) {
  setup(`entrar como ${perfil.id}`, async ({ page }) => {
    // Sessão de uma rodada anterior não vale: o perfil pode ter sido desligado ou trocado.
    rmSync(perfil.arquivo, { force: true });

    const cred = credenciais(perfil);
    if (!cred) {
      setup.skip(true, `defina ${perfil.variavel}_EMAIL e ${perfil.variavel}_PASSWORD no .env.local`);
      return;
    }

    expect(await problemasDaConta(perfil, cred), `a conta de ${perfil.id} não corresponde ao perfil`).toEqual([]);

    await entrar(page, cred);
    // A página de chegada é do app: a sessão vale e o menu montou.
    await expect(page.locator("#menu-principal")).toBeAttached({ timeout: 15_000 });

    await page.context().storageState({ path: perfil.arquivo });
  });
}
