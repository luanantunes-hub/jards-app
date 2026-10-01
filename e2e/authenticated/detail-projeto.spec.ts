import { test, expect } from "@playwright/test";

const ID = "5829b956-cebd-4adf-9be0-183038002882";

test("página de detalhe do projeto: navega por todas as abas", async ({ page }) => {
  await page.goto(`/projetos/${ID}`);
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeVisible();

  for (const tab of ["Visão geral", "Captação", "Cotas", "Orçamento", "Documentos", "Pitch", "Textos"]) {
    await page.getByRole("button", { name: tab }).first().click();
  }
});
