import { test, expect } from "@playwright/test";

const ID = "3e5907f3-3285-482d-ab3b-572fb58c8301";

test("página de detalhe do proponente: navega por todas as abas", async ({ page }) => {
  await page.goto(`/proponentes/${ID}`);

  for (const tab of ["Visão geral", "Projetos", "Documentos", "Relacionamento", "Clientes"]) {
    await page.getByRole("button", { name: tab }).first().click();
  }
});
