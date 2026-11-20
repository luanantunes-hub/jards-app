import { test as setup, expect } from "@playwright/test";
import { PERFIS, inicioDo, perfilConfigurado } from "./perfis";

// Uma sessão salva por perfil (e2e/perfis.ts). O login é pela tela, como o de
// auth.setup.ts, e termina na página inicial do módulo da pessoa. Perfil sem
// variáveis de ambiente é pulado.
for (const perfil of PERFIS) {
  setup(`autenticar ${perfil.rotulo}`, async ({ page }) => {
    setup.skip(!perfilConfigurado(perfil), `Defina ${perfil.emailVar} e ${perfil.senhaVar} no .env.local para rodar o perfil "${perfil.rotulo}".`);

    await page.goto("/login");
    await page.getByPlaceholder("voce@empresa.com").fill(process.env[perfil.emailVar]!);
    await page.getByPlaceholder("••••••••").fill(process.env[perfil.senhaVar]!);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();

    const inicio = inicioDo(perfil);
    await page.waitForURL(url => url.pathname === inicio, { timeout: 15_000 });
    await expect(page).toHaveURL(new RegExp(`${inicio}$`));

    await page.context().storageState({ path: perfil.arquivo });
  });
}
