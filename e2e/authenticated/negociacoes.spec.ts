import { test, expect } from "@playwright/test";
import { supabaseAdmin, e2eName } from "../helpers/supabaseAdmin";

test("cria uma nova negociação com um patrocinador novo", async ({ page }) => {
  const nomeEmpresa = e2eName("Empresa Negociacao");

  await page.goto("/captacoes");
  await page.getByRole("button", { name: "Nova negociação" }).first().click();
  const empresaInput = page.getByPlaceholder("Buscar ou criar…").first();
  await empresaInput.fill(nomeEmpresa);
  await page.getByText(`+ Criar "${nomeEmpresa}"`).click();
  // O insert da empresa é assíncrono ("Criando…" no dropdown) — esperar sumir
  // garante que empresaId já foi resolvido antes de salvar a negociação.
  await expect(page.getByText("Criando…")).toBeHidden({ timeout: 10_000 });
  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(page.getByText(nomeEmpresa).first()).toBeVisible({ timeout: 10_000 });

  const { data: empresa } = await supabaseAdmin
    .from("empresas_crm")
    .select("id")
    .eq("nome", nomeEmpresa)
    .maybeSingle();
  if (empresa) {
    await supabaseAdmin.from("captacoes").delete().eq("empresa_crm_id", empresa.id);
    await supabaseAdmin.from("empresas_crm").delete().eq("id", empresa.id);
  }
});
