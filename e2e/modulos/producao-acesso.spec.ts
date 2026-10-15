import { existsSync } from "fs";
import { test, expect, type Page } from "@playwright/test";
import { MODULOS, moduloDaRota, type ModuloId } from "../../lib/modulos";
import { PERFIS, credenciais, entrar, type Perfil } from "../helpers/perfis";

// PD0.3: menu, redirecionamentos e acesso direto pela URL nos quatro perfis
// de módulo. Cada perfil usa a sessão gravada por e2e/perfis.setup.ts e é
// pulado quando as variáveis dele não estão no .env.local.

// Itens do menu de cada módulo (NAV_POR_MODULO, app/(dashboard)/layout.tsx).
const MENU: Record<ModuloId, readonly string[]> = {
  captacao: ["Visão geral", "Atividades", "Projetos", "Negociações", "Contatos"],
  prestacao: ["Prestações", "Fornecedores"],
  producao: ["Agenda"],
};

// Rótulo do módulo no seletor (MODULOS, app/(dashboard)/layout.tsx).
const ROTULO: Record<ModuloId, string> = { captacao: "Captação", prestacao: "Prestação", producao: "Produção" };

// h1 da página inicial de cada módulo.
const TITULO: Record<string, string> = { "/dashboard": "Visão geral", "/prestacoes": "Prestações", "/producoes": "Agenda" };

const ROTAS = [
  "/dashboard", // captação: o proxy desvia na entrada
  "/contatos", "/captacoes", "/projetos", "/atividades", // captação: o layout do navegador desvia
  "/prestacoes", "/prestacoes/fornecedores", // bloqueio no servidor
  "/producoes", // bloqueio no servidor
  "/configuracoes", // rota comum: abre para todos
];

function destinoEsperado(perfil: Perfil, rota: string): string {
  if (rota === "/configuracoes") return rota;
  return perfil.modulos.includes(moduloDaRota(rota)) ? rota : perfil.inicio;
}

function caminho(page: Page): string {
  return new URL(page.url()).pathname;
}

/**
 * Caminhos por onde a aba passou. Um redirecionamento HTTP (307) não aparece;
 * um feito no navegador, sim. O Next também regrava o endereço ao montar a
 * página (replaceState), então o mesmo caminho pode vir repetido em seguida.
 */
function registrarCaminhos(page: Page): string[] {
  const caminhos: string[] = [];
  page.on("framenavigated", frame => {
    if (frame === page.mainFrame()) caminhos.push(new URL(frame.url()).pathname);
  });
  return caminhos;
}

// O next dev compila cada rota na primeira visita.
test.describe.configure({ timeout: 60_000 });

for (const perfil of PERFIS) {
  test.describe(perfil.id, () => {
    test.skip(!credenciais(perfil), `defina ${perfil.variavel}_EMAIL e ${perfil.variavel}_PASSWORD no .env.local`);
    // Avaliado no worker, depois do projeto "perfis" (cobre --no-deps sem sessão gravada).
    test.skip(() => !existsSync(perfil.arquivo), `sem ${perfil.arquivo}: rode o projeto "perfis"`);
    test.use({ storageState: perfil.arquivo });

    test.describe("sem sessão", () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      test(`entra pelo login em ${perfil.inicio}`, async ({ page }) => {
        const caminhos = registrarCaminhos(page);
        await entrar(page, credenciais(perfil)!);
        await expect.poll(() => caminho(page), { timeout: 15_000 }).toBe(perfil.inicio);
        await expect(page.getByRole("heading", { level: 1, name: TITULO[perfil.inicio], exact: true })).toBeVisible();
        if (!perfil.modulos.includes("captacao")) {
          expect(caminhos, `passou por /dashboard: ${caminhos.join(" → ")}`).not.toContain("/dashboard");
        }
      });
    });

    test("o menu mostra só o módulo que a pessoa usa", async ({ page }) => {
      // Em rota comum o menu mostra o primeiro módulo que a pessoa usa; antes de
      // os módulos chegarem ele mostra a captação, então a espera é pelo item certo.
      await page.goto("/configuracoes");
      const menu = page.getByRole("complementary", { name: "Menu principal" });
      const [principal] = perfil.modulos;
      await expect(menu.getByRole("link", { name: MENU[principal][0], exact: true })).toBeVisible({ timeout: 15_000 });
      for (const modulo of MODULOS.filter(m => m !== principal)) {
        for (const rotulo of MENU[modulo]) await expect(menu.getByRole("link", { name: rotulo, exact: true })).toHaveCount(0);
      }
      if (!perfil.modulos.includes("captacao")) {
        await expect(menu.getByRole("link", { name: "Fazer upgrade" })).toHaveCount(0);
      }

      // Seletor: "Produção" só aparece para quem tem a produção na organização.
      await menu.getByRole("button", { name: `Módulo: ${ROTULO[principal]}. Trocar de módulo` }).click();
      const lista = menu.getByRole("list", { name: "Módulos" });
      await expect(lista.locator("[aria-busy=true]")).toHaveCount(0); // módulos da organização carregados
      const producao = lista.getByRole("button", { name: /^Produção/ });
      if (!perfil.modulos.includes("producao")) {
        await expect(producao).toHaveCount(0);
        return;
      }
      await expect(producao).toBeEnabled();
      if (principal !== "producao") {
        await producao.click();
        await expect.poll(() => caminho(page)).toBe("/producoes");
        await expect(menu.getByRole("link", { name: "Agenda", exact: true })).toBeVisible();
        for (const rotulo of MENU.captacao) await expect(menu.getByRole("link", { name: rotulo, exact: true })).toHaveCount(0);
      }
    });

    for (const rota of ROTAS) {
      const destino = destinoEsperado(perfil, rota);
      test(`${rota} → ${destino}`, async ({ page }) => {
        const caminhos = registrarCaminhos(page);
        await page.goto(rota);
        await expect.poll(() => caminho(page), { timeout: 15_000 }).toBe(destino);
        if (TITULO[destino]) {
          await expect(page.getByRole("heading", { level: 1, name: TITULO[destino], exact: true })).toBeVisible();
        }
        // Sem laço: a aba fica na chegada e chegou em poucos passos.
        const naChegada = caminhos.length;
        await page.waitForTimeout(1_500);
        expect(caminho(page)).toBe(destino);
        expect(caminhos.slice(naChegada).filter(c => c !== destino), `voltou a navegar: ${caminhos.join(" → ")}`).toEqual([]);
        const passos = caminhos.filter((c, i) => c !== caminhos[i - 1]);
        expect(passos.length, `passos: ${passos.join(" → ")}`).toBeLessThanOrEqual(3);
        // Quem não usa a captação não passa pela /dashboard no caminho.
        if (!perfil.modulos.includes("captacao")) {
          expect(caminhos, `passou por /dashboard: ${caminhos.join(" → ")}`).not.toContain("/dashboard");
        }
      });
    }
  });
}
