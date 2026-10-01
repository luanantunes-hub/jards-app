import { test, expect } from "@playwright/test";
import { supabaseAdmin, e2eName } from "../helpers/supabaseAdmin";

test("cria um novo projeto", async ({ page }) => {
  const nome = e2eName("Projeto");

  // Contas no plano gratuito têm limite de 1 projeto ativo (trigger real do
  // produto). Para não desativar essa trava, arquiva temporariamente qualquer
  // projeto já ativo desta conta e restaura o status original ao final.
  const { data: ativosAntes } = await supabaseAdmin
    .from("projetos_crm")
    .select("id, status_operacional")
    .neq("status_operacional", "arquivado");
  const idsArquivados = ativosAntes ?? [];
  if (idsArquivados.length > 0) {
    await supabaseAdmin.from("projetos_crm").update({ status_operacional: "arquivado" })
      .in("id", idsArquivados.map((p) => p.id));
  }

  await page.goto("/projetos");
  await page.getByRole("button", { name: "Novo projeto" }).first().click();
  await page.getByPlaceholder("Nome do projeto").fill(nome);
  await page.getByRole("button", { name: "Salvar projeto" }).click();

  await expect(page.getByText(nome)).toBeVisible({ timeout: 10_000 });

  await supabaseAdmin.from("projetos_crm").delete().eq("nome", nome);
  for (const p of idsArquivados) {
    await supabaseAdmin.from("projetos_crm").update({ status_operacional: p.status_operacional }).eq("id", p.id);
  }
});
