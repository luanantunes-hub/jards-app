import { test, expect } from "@playwright/test";

const ID = "0a3599fb-29a4-46d7-9ac7-5983fd4f77c8";

test("página de detalhe do patrocinador: carrega com as seções principais", async ({ page }) => {
  await page.goto(`/patrocinadores/${ID}`);
  await expect(page.getByRole("heading", { name: "Petrobras" })).toBeVisible();
  await expect(page.getByText("Investimento Anual")).toBeVisible();
  await expect(page.getByText("Editais e chamamentos")).toBeVisible();
});
