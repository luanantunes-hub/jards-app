import { test, expect } from "@playwright/test";
import { supabaseAdmin } from "../helpers/supabaseAdmin";

const ID = "84cfd0eb-efb2-48a4-8d2f-7646d46660b7";

test("página de detalhe do contato: navega pelas abas e edita a empresa vinculada", async ({ page }) => {
  const { data: antes } = await supabaseAdmin.from("contatos").select("empresa_crm_id").eq("id", ID).single();

  await page.goto(`/contatos/${ID}`);
  await page.getByRole("button", { name: "Negociações" }).click();
  await page.getByRole("button", { name: "Histórico" }).click();
  await expect(page.getByText("Dados de contato")).toBeVisible();

  // troca a empresa vinculada para a primeira opção real da lista (não "Sem empresa").
  await page.getByText("Empresa", { exact: true }).locator("..").getByRole("button").click();
  const opcoes = page.locator("div.fixed button", { hasNotText: "Sem empresa" });
  const nomeEscolhido = await opcoes.first().innerText();
  await opcoes.first().click();
  await expect(page.getByText(nomeEscolhido, { exact: true }).first()).toBeVisible();

  // restaura o vínculo original para não alterar o dado real do usuário.
  await supabaseAdmin.from("contatos").update({ empresa_crm_id: antes?.empresa_crm_id ?? null }).eq("id", ID);
});
