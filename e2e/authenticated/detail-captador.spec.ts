import { test, expect } from "@playwright/test";

const ID = "e4de3f68-4884-4201-b629-ea39d45ade42";

test("página de detalhe do captador: navega por todas as abas", async ({ page }) => {
  await page.goto(`/captadores/${ID}`);

  for (const tab of ["Visão geral", "Negociações", "Inscrições", "Atribuições"]) {
    await page.getByRole("button", { name: tab }).first().click();
  }
});
