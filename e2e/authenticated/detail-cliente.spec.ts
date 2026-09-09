import { test, expect } from "@playwright/test";

const ID = "af97d6a1-c3ca-4c01-95f2-6340ecf6b672";

test("página de detalhe do cliente: navega por todas as abas", async ({ page }) => {
  await page.goto(`/contas-patrocinio/${ID}`);

  for (const tab of ["Visão geral", "Entregas", "Contratos", "Renovação", "Relacionamento"]) {
    await page.getByRole("button", { name: tab }).first().click();
  }
});
