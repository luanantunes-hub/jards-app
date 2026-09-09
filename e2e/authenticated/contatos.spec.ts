import { test, expect } from "@playwright/test";
import { supabaseAdmin, e2eName } from "../helpers/supabaseAdmin";

test("cria um novo contato", async ({ page }) => {
  const nome = e2eName("Contato");

  await page.goto("/contatos");
  await page.getByRole("button", { name: "Novo contato" }).click();
  await page.getByPlaceholder("Nome do contato").fill(nome);
  await page.getByRole("button", { name: "Salvar contato" }).click();

  await expect(page.getByText(nome)).toBeVisible({ timeout: 10_000 });

  await supabaseAdmin.from("contatos").delete().eq("nome", nome);
});
