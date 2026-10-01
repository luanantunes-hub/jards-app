import { test, expect } from "@playwright/test";
import { supabaseAdmin, e2eName } from "../helpers/supabaseAdmin";

test("cria um novo cliente com uma empresa nova", async ({ page }) => {
  const nomeEmpresa = e2eName("Empresa Cliente");

  await page.goto("/contas-patrocinio");
  await page.getByRole("button", { name: "Novo cliente" }).first().click();
  await page.getByPlaceholder("Buscar ou criar empresa…").fill(nomeEmpresa);
  await page.getByText(`Criar "${nomeEmpresa}"`).click();
  await page.getByRole("button", { name: "Criar cliente" }).click();

  await expect(page.getByText(nomeEmpresa)).toBeVisible({ timeout: 10_000 });

  const { data: empresa } = await supabaseAdmin
    .from("empresas_crm")
    .select("id")
    .eq("nome", nomeEmpresa)
    .maybeSingle();
  if (empresa) {
    await supabaseAdmin.from("contas_patrocinio").delete().eq("empresa_crm_id", empresa.id);
    await supabaseAdmin.from("empresas_crm").delete().eq("id", empresa.id);
  }
});
