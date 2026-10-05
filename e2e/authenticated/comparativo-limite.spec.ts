import { test, expect, type Page, type Route } from "@playwright/test";

const PETROBRAS = "0a3599fb-29a4-46d7-9ac7-5983fd4f77c8";
const FOX = "7558bed0-62a3-48ea-95b5-d87f17146134";

const RPC = "**/rest/v1/rpc/fn_registrar_comparacoes";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-api-version, accept-profile, content-profile, prefer",
};

const AVISO_LIMITE = "Você chegou ao limite de comparações.";

// Responde como o banco responderia a um usuário gratuito que já usou as 15 vagas:
// só deixam de ser barradas as empresas listadas em `liberadas`.
async function simularLimite(page: Page, liberadas: string[] = []) {
  await page.route(RPC, async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const ids: string[] = route.request().postDataJSON().p_empresa_ids;
    await route.fulfill({
      headers: CORS,
      json: {
        permitidas: ids.filter((id) => liberadas.includes(id)),
        bloqueadas: ids.filter((id) => !liberadas.includes(id)),
        total: 15,
        limite: 15,
      },
    });
  });
}

async function escolherPetrobras(page: Page) {
  await page.getByPlaceholder("Buscar empresa para comparar…").fill("Petrobras");
  await page.getByRole("button", { name: "Petrobras" }).first().click();
}

test("comparativo: no limite do plano gratuito, mostra o popup e não adiciona a empresa", async ({ page }) => {
  await simularLimite(page);
  await page.goto("/comparativo");
  await escolherPetrobras(page);

  const popup = page.getByRole("dialog", { name: AVISO_LIMITE });
  await expect(popup).toBeVisible();
  await expect(page).not.toHaveURL(/empresas=/);

  await popup.getByRole("button", { name: "Agora não" }).click();
  await expect(popup).toBeHidden();
});

test("comparativo: o botão do popup leva para a escolha do plano", async ({ page }) => {
  await simularLimite(page);
  await page.goto("/comparativo");
  await escolherPetrobras(page);

  await page.getByRole("dialog", { name: AVISO_LIMITE }).getByRole("button", { name: "Assinar um plano" }).click();
  await expect(page).toHaveURL(/\/meu-plano\?acao=assinar/);
});

test("comparativo: link com empresa barrada pelo limite abre o popup e mantém só as liberadas", async ({ page }) => {
  await simularLimite(page, [PETROBRAS]);
  await page.goto(`/comparativo?empresas=${PETROBRAS},${FOX}`);

  await expect(page.getByRole("dialog", { name: AVISO_LIMITE })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`empresas=${PETROBRAS}$`));
});

test("comparativo: com a função real do banco, adicionar empresa funciona e não mostra o popup", async ({ page }) => {
  const resposta = page.waitForResponse((r) => r.url().includes("/rpc/fn_registrar_comparacoes"));
  await page.goto("/comparativo");
  await escolherPetrobras(page);

  expect((await resposta).ok()).toBeTruthy();
  await expect(page).toHaveURL(/empresas=/);
  await expect(page.getByRole("dialog", { name: AVISO_LIMITE })).toBeHidden();
});
