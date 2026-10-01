import { test, expect } from "@playwright/test";
import { supabaseAdmin, e2eName } from "../helpers/supabaseAdmin";

test("cria uma nova inscrição com um patrocinador novo", async ({ page }) => {
  const nomeEmpresa = e2eName("Empresa Inscricao");

  await page.goto("/editais-inscritos");
  await page.getByRole("button", { name: "Nova inscrição" }).first().click();
  await page.getByPlaceholder("Buscar ou criar empresa…").fill(nomeEmpresa);
  await page.getByText(`+ Criar "${nomeEmpresa}"`).click();
  await expect(page.getByText("Criando…")).toBeHidden({ timeout: 10_000 });
  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(page.getByText(nomeEmpresa).first()).toBeVisible({ timeout: 10_000 });

  const { data: empresa } = await supabaseAdmin
    .from("empresas_crm")
    .select("id")
    .eq("nome", nomeEmpresa)
    .maybeSingle();
  if (empresa) {
    await supabaseAdmin.from("editais_user").delete().eq("empresa_crm_id", empresa.id);
    await supabaseAdmin.from("empresas_crm").delete().eq("id", empresa.id);
  }
});
