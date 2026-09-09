import { test, expect } from "@playwright/test";

const ID = "729c1cfa-b930-4a1c-bf3d-f10c5abd75b5";

test("página de detalhe da negociação: navega pelas abas", async ({ page }) => {
  await page.goto(`/captacoes/${ID}`);
  await expect(page.getByRole("button", { name: "Visão geral" })).toBeVisible();

  await page.getByRole("button", { name: "Relacionamento" }).click();
  await expect(page.getByRole("button", { name: "Relacionamento" })).toBeVisible();

  await page.getByRole("button", { name: "Visão geral" }).click();
});
