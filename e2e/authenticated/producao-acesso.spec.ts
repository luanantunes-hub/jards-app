import { test, expect, type Page } from "@playwright/test";
import { MODULOS } from "../../lib/modulos";
import { ITENS_DO_MENU, PERFIS, destinoAoAbrir, inicioDo, moduloDoMenu, perfilConfigurado, usa, type Perfil } from "../perfis";

// Acesso por módulo (PD0.3): cada perfil de e2e/perfis.ts entra na página inicial
// do módulo que usa, vê só o menu dele e, ao abrir pela URL uma rota de módulo
// que não usa, cai na página inicial do que usa, sem laço de redirecionamento.
// Rodar com as variáveis E2E_PERFIL_* (e2e/perfis.ts); sem elas o perfil é pulado.

const ROTAS_PELA_URL = ["/captacoes", "/contatos", "/projetos", "/prestacoes", "/prestacoes/fornecedores", "/producoes", "/configuracoes"];

const menu = (page: Page) => page.getByLabel("Menu principal");

function semConfiguracao(perfil: Perfil) {
  return `Defina ${perfil.emailVar} e ${perfil.senhaVar} no .env.local para rodar o perfil "${perfil.rotulo}".`;
}

/** Os caminhos que o quadro principal abriu, em ordem, para provar que a pessoa não passou por onde não devia. */
function acompanharNavegacao(page: Page): string[] {
  const caminhos: string[] = [];
  page.on("framenavigated", frame => {
    if (frame !== page.mainFrame()) return;
    const caminho = new URL(frame.url()).pathname;
    // O mesmo caminho em seguida (hidratação, troca de endereço na própria página) não é uma página nova.
    if (caminhos[caminhos.length - 1] !== caminho) caminhos.push(caminho);
  });
  return caminhos;
}

for (const perfil of PERFIS) {
  test.describe(`perfil ${perfil.rotulo}`, () => {
    test.skip(!perfilConfigurado(perfil), semConfiguracao(perfil));
    test.use({ storageState: perfil.arquivo });

    const inicio = inicioDo(perfil);

    test(`a raiz, o login e /dashboard levam a ${inicio}`, async ({ page }) => {
      for (const porta of ["/", "/login", "/dashboard"]) {
        await page.goto(porta);
        await expect(page, porta).toHaveURL(new RegExp(`${inicio}$`));
      }
    });

    test("o menu mostra só os itens do módulo da página aberta", async ({ page }) => {
      for (const rota of ["/dashboard", "/prestacoes", "/producoes", "/configuracoes"]) {
        await page.goto(rota);
        const aberto = destinoAoAbrir(perfil, rota);
        await expect(page, rota).toHaveURL(new RegExp(`${aberto}$`));

        const doMenu = moduloDoMenu(perfil, aberto);
        for (const modulo of MODULOS) {
          for (const item of ITENS_DO_MENU[modulo]) {
            const link = menu(page).getByRole("link", { name: item, exact: true });
            if (modulo === doMenu) await expect(link, `${rota}: ${item}`).toBeVisible();
            else await expect(link, `${rota}: ${item}`).toHaveCount(0);
          }
        }
      }
    });

    for (const rota of ROTAS_PELA_URL) {
      const destino = destinoAoAbrir(perfil, rota);
      test(`${rota} pela URL ${destino === rota ? "abre" : `vai para ${destino}`}`, async ({ page }) => {
        const caminhos = acompanharNavegacao(page);
        const resposta = await page.goto(rota);
        expect(resposta?.status(), `status HTTP de ${rota}`).toBeLessThan(400);
        await expect(page).toHaveURL(new RegExp(`${destino}$`));

        // Sem laço: depois de assentar, a página não anda mais, e o caminho até aqui foi curto.
        await page.waitForTimeout(1_000);
        await expect(page).toHaveURL(new RegExp(`${destino}$`));
        expect(caminhos.length, `caminhos abertos: ${caminhos.join(" → ")}`).toBeLessThanOrEqual(3);
      });
    }

    if (usa(perfil, "producao")) {
      test("a página inicial da produção mostra o estado vazio", async ({ page }) => {
        await page.goto("/producoes");
        await expect(page.getByRole("heading", { name: "Agenda", level: 1 })).toBeVisible();
        await expect(page.getByText("A agenda ainda está sendo montada")).toBeVisible();
      });
    }
  });
}

test.describe("entrada pelo login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const perfil of PERFIS) {
    const inicio = inicioDo(perfil);

    test(`${perfil.rotulo}: entra direto em ${inicio}`, async ({ page }) => {
      test.skip(!perfilConfigurado(perfil), semConfiguracao(perfil));
      const caminhos = acompanharNavegacao(page);

      await page.goto("/login");
      await page.getByPlaceholder("voce@empresa.com").fill(process.env[perfil.emailVar]!);
      await page.getByPlaceholder("••••••••").fill(process.env[perfil.senhaVar]!);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();

      await page.waitForURL(url => url.pathname === inicio, { timeout: 15_000 });
      // Quem não usa a captação não chega a abrir /dashboard: o servidor o leva direto ao módulo dele.
      if (!usa(perfil, "captacao")) expect(caminhos).not.toContain("/dashboard");
    });
  }
});
