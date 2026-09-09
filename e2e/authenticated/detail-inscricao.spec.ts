import { test, expect } from "@playwright/test";

const ID = "c9af5575-9479-4e75-93c9-6dadf5e34df2";

test("página de detalhe da inscrição: navega pelas abas", async ({ page }) => {
  await page.goto(`/editais-inscritos/${ID}`);
  await expect(page.getByRole("button", { name: "Visão geral" })).toBeVisible();

  await page.getByRole("button", { name: "Conteúdo preenchido" }).click();
  await expect(page.getByRole("button", { name: "Conteúdo preenchido" })).toBeVisible();

  await page.getByRole("button", { name: "Visão geral" }).click();
});
