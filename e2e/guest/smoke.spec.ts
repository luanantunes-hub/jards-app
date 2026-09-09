import { test, expect } from "@playwright/test";

test.describe("Login", () => {
  test("carrega a página de login com o formulário esperado", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Continue de onde parou." })).toBeVisible();
    await expect(page.getByPlaceholder("voce@empresa.com")).toBeVisible();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
  });

  test("mostra erro ao tentar entrar com credenciais inválidas", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("voce@empresa.com").fill("teste-invalido@exemplo.com");
    await page.getByPlaceholder("••••••••").fill("senha-incorreta-123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByText(/credenciais|inválid|incorret|invalid/i)).toBeVisible({ timeout: 10_000 });
  });
});
