import { test as setup, expect } from "@playwright/test";

const authFile = "playwright/.auth/user.json";

setup("autenticar", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Defina E2E_TEST_EMAIL e E2E_TEST_PASSWORD no .env.local para rodar testes autenticados."
    );
  }

  await page.goto("/login");
  await page.getByPlaceholder("voce@empresa.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: authFile });
});
