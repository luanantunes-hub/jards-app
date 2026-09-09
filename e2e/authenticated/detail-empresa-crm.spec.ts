import { test, expect } from "@playwright/test";

const ID = "0afdf402-3b4b-4a10-a442-f558083a3089";

test("página de detalhe da empresa: navega por todas as abas", async ({ page }) => {
  await page.goto(`/empresas-crm/${ID}`);

  for (const tab of ["Resumo", "Negociações", "Inscrições", "Relacionamento"]) {
    await page.getByRole("button", { name: tab }).first().click();
  }
});
