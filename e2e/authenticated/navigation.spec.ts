import { test, expect } from "@playwright/test";

const PAGES: { path: string; heading: string }[] = [
  { path: "/dashboard", heading: "Visão geral" },
  { path: "/atividades", heading: "Atividades" },
  { path: "/projetos", heading: "Projetos" },
  { path: "/patrocinadores", heading: "Patrocinadores" },
  { path: "/editais-abertos", heading: "Editais" },
  { path: "/empresas-crm", heading: "Empresas" },
  { path: "/captacoes", heading: "Negociações" },
  { path: "/editais-inscritos", heading: "Inscrições" },
  { path: "/proponentes", heading: "Proponentes" },
  { path: "/captadores", heading: "Captadores" },
  { path: "/contatos", heading: "Contatos" },
  { path: "/contas-patrocinio", heading: "Clientes" },
  { path: "/configuracoes", heading: "Configurações" },
];

for (const { path, heading } of PAGES) {
  test(`${path} carrega sem erro`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const response = await page.goto(path);
    expect(response?.status(), `status HTTP de ${path}`).toBeLessThan(400);
    await expect(page.getByRole("link", { name: "Contatos" }).first()).toBeVisible();
    await expect(page.getByText(heading, { exact: false }).first()).toBeVisible();
  });
}
