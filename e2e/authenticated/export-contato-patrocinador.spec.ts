import { test, expect } from "@playwright/test";
import { supabaseAdmin } from "../helpers/supabaseAdmin";

const PETROBRAS_ID = "0a3599fb-29a4-46d7-9ac7-5983fd4f77c8";
const CONTATO_NOME = "Ellen Soares";

let accountId: string;
let organizationId: string;
let contatoId: string | null = null;
let empresaCrmId: string | null = null;

async function limparDadosDoTeste() {
  await supabaseAdmin.from("contatos").delete().eq("organization_id", organizationId).eq("nome", CONTATO_NOME);
  await supabaseAdmin.from("empresas_crm").delete().eq("organization_id", organizationId).eq("empresa_pub_id", PETROBRAS_ID);
  await supabaseAdmin.from("desbloqueios").delete().eq("organization_id", organizationId).eq("empresa_pub_id", PETROBRAS_ID);
}

test.beforeAll(async () => {
  const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("email", "luan.antunes@jards.com.br").single();
  accountId = profile!.id;
  const { data: orgMember } = await supabaseAdmin.from("organization_members").select("organization_id").eq("user_id", accountId).limit(1).single();
  organizationId = orgMember!.organization_id;

  await limparDadosDoTeste();

  const { error } = await supabaseAdmin
    .from("desbloqueios")
    .insert({ account_id: accountId, empresa_pub_id: PETROBRAS_ID, organization_id: organizationId });
  if (error) throw error;
});

test.afterAll(async () => {
  await limparDadosDoTeste();
});

test("exportar contato do patrocinador cria o contato direto e mostra popup de sucesso", async ({ page }) => {
  await page.goto(`/patrocinadores/${PETROBRAS_ID}`);
  await expect(page.getByRole("heading", { name: "Petrobras" })).toBeVisible();

  const linha = page.locator("tr", { hasText: CONTATO_NOME });
  await expect(linha).toBeVisible();
  await linha.getByTitle("Salvar nos contatos").click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Contato salvo" })).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByText(CONTATO_NOME, { exact: false })).toBeVisible();
  await expect(dialog.getByText("Petrobras", { exact: false })).toBeVisible();

  const { data: novoContato } = await supabaseAdmin
    .from("contatos")
    .select("id, nome, cargo, email, linkedin_url, empresa_crm_id, organization_id, origem")
    .eq("organization_id", organizationId)
    .eq("nome", CONTATO_NOME)
    .single();
  expect(novoContato).toBeTruthy();
  contatoId = novoContato!.id;
  empresaCrmId = novoContato!.empresa_crm_id;
  expect(novoContato!.email).toBe("ellensoares@petrobras.com.br");
  expect(novoContato!.cargo).toBe("Patrocínios e Eventos");
  expect(novoContato!.origem).toBe("jards");
  expect(novoContato!.empresa_crm_id).toBeTruthy();

  const { data: empresaCrm } = await supabaseAdmin.from("empresas_crm").select("nome, empresa_pub_id").eq("id", empresaCrmId!).single();
  expect(empresaCrm!.nome).toBe("Petrobras");
  expect(empresaCrm!.empresa_pub_id).toBe(PETROBRAS_ID);

  await page.getByRole("button", { name: "Ir até o contato" }).click();
  await page.waitForURL(new RegExp(`/contatos/${contatoId}`), { timeout: 10_000 });
  await expect(page.getByText(CONTATO_NOME, { exact: false }).first()).toBeVisible();
});
