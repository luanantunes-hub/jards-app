import { test, expect } from "@playwright/test";
import { supabaseAdmin } from "../helpers/supabaseAdmin";

// O usuário em que o admin "entra como" vem do ambiente (E2E_IMPERSONAR_EMAIL), nunca escrito aqui: o repositório não guarda e-mail de pessoa real.
const EMAIL_PARA_IMPERSONAR = process.env.E2E_IMPERSONAR_EMAIL ?? "";

test("admin consegue entrar como outro usuário e o aviso confere a sessão real", async ({ page, context }) => {
  test.skip(!EMAIL_PARA_IMPERSONAR, "defina E2E_IMPERSONAR_EMAIL com o e-mail de um usuário de teste desta base");
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  const target = users.users.find(u => u.email === EMAIL_PARA_IMPERSONAR);
  test.skip(!target, "usuário de E2E_IMPERSONAR_EMAIL não encontrado nesta base");

  await page.goto("/admin/usuarios");
  await page.getByPlaceholder(/buscar/i).fill(EMAIL_PARA_IMPERSONAR.split("@")[0]);
  const row = page.locator("tr", { hasText: EMAIL_PARA_IMPERSONAR });
  await expect(row).toBeVisible();

  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    row.getByText("Entrar como").click(),
  ]);

  await popup.waitForURL(/\/dashboard/, { timeout: 15000 });
  await expect(popup.getByText("Navegando como")).toBeVisible({ timeout: 10000 });
  await expect(popup.getByText(EMAIL_PARA_IMPERSONAR)).toBeVisible();
  await expect(popup.getByText("Não foi possível confirmar a sessão")).not.toBeVisible();

  await popup.close();
});

test("marca antiga de impersonation no sessionStorage não reativa o banner numa sessão normal", async ({ page }) => {
  // Reproduz o bug relatado por um usuário: uma impersonação anterior que não
  // terminou pelo botão "Encerrar sessão" (ex.: usou o "Sair" normal, ou fechou a aba)
  // deixa o e-mail marcado no sessionStorage. Antes da correção, o banner comparava só
  // o e-mail e reaparecia pro próximo login normal com esse e-mail na mesma aba.
  const emailDeExemplo = "usuario.exemplo@exemplo.com";
  await page.goto("/dashboard");
  await page.evaluate((email) => {
    sessionStorage.setItem("_jards_imp", JSON.stringify({ email, accessToken: "token-de-sessao-ja-encerrada" }));
  }, emailDeExemplo);

  await page.reload();

  await expect(page.getByText("Navegando como")).not.toBeVisible();
  await expect(page.getByText(emailDeExemplo)).not.toBeVisible();
  await expect(page.getByText("Não foi possível confirmar a sessão")).not.toBeVisible();
});
