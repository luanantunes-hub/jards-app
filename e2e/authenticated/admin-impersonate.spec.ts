import { test, expect } from "@playwright/test";
import { supabaseAdmin } from "../helpers/supabaseAdmin";

test("admin consegue entrar como outro usuário e o aviso confere a sessão real", async ({ page, context }) => {
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  const target = users.users.find(u => u.email === "larisa.hemkemeier@gmail.com");
  test.skip(!target, "usuário larisa.hemkemeier@gmail.com não encontrado nesta base");

  await page.goto("/admin/usuarios");
  await page.getByPlaceholder(/buscar/i).fill("larisa");
  const row = page.locator("tr", { hasText: "larisa.hemkemeier@gmail.com" });
  await expect(row).toBeVisible();

  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    row.getByText("Entrar como").click(),
  ]);

  await popup.waitForURL(/\/dashboard/, { timeout: 15000 });
  await expect(popup.getByText("Navegando como")).toBeVisible({ timeout: 10000 });
  await expect(popup.getByText("larisa.hemkemeier@gmail.com")).toBeVisible();
  await expect(popup.getByText("Não foi possível confirmar a sessão")).not.toBeVisible();

  await popup.close();
});
