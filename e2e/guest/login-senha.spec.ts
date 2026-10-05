import { test, expect, type Page } from "@playwright/test";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};

// O Supabase recusa a senha e a checagem diz se a conta ainda não tem senha; nada é enviado de verdade.
async function simularSenhaRecusada(page: Page, semSenha: boolean) {
  await page.route("**/auth/v1/token*", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    await route.fulfill({
      status: 400,
      headers: CORS,
      json: { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" },
    });
  });
  await page.route("**/api/auth/conta-sem-senha", (route) => route.fulfill({ json: { semSenha } }));
}

async function tentarEntrar(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("voce@empresa.com").fill("alguem@empresa.com");
  await page.getByPlaceholder("••••••••").fill("senha-errada");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("login: senha errada mostra o erro e não o aviso de que o Jards foi renovado", async ({ page }) => {
  await simularSenhaRecusada(page, false);
  await tentarEntrar(page);

  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /totalmente renovado/ })).toBeHidden();
});

test("login: conta ainda sem senha mostra o aviso para criar uma nova senha", async ({ page }) => {
  await simularSenhaRecusada(page, true);
  await tentarEntrar(page);

  await expect(page.getByRole("heading", { name: /totalmente renovado/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar via e-mail" })).toBeVisible();
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeHidden();
});
