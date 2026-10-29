import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { MODULOS, podeUsarModulo, vinculoDaLinha, type LinhaVinculo, type ModuloId } from "../../lib/modulos";

// Perfis do e2e por módulo (PD0.3): um usuário semeado por combinação de
// módulos, numa organização só, sem super admin e com o onboarding feito.
// As credenciais vêm do .env.local; perfil sem as duas variáveis é pulado.

export type PerfilId = "so-captacao" | "so-prestacao" | "so-producao" | "captacao-producao";

export type Perfil = {
  id: PerfilId;
  /** Prefixo das variáveis <prefixo>_EMAIL e <prefixo>_PASSWORD. */
  variavel: string;
  /** Módulos que a conta usa, na ordem de MODULOS. */
  modulos: readonly ModuloId[];
  /** Onde a pessoa chega ao entrar: a página inicial do primeiro módulo dela. */
  inicio: string;
  /** storageState gravado por e2e/perfis.setup.ts (playwright/.auth/ está no .gitignore). */
  arquivo: string;
};

export const PERFIS: readonly Perfil[] = [
  { id: "so-captacao",       variavel: "E2E_PERFIL_SO_CAPTACAO",       modulos: ["captacao"],             inicio: "/dashboard",  arquivo: "playwright/.auth/perfil-so-captacao.json" },
  { id: "so-prestacao",      variavel: "E2E_PERFIL_SO_PRESTACAO",      modulos: ["prestacao"],            inicio: "/prestacoes", arquivo: "playwright/.auth/perfil-so-prestacao.json" },
  { id: "so-producao",       variavel: "E2E_PERFIL_SO_PRODUCAO",       modulos: ["producao"],             inicio: "/producoes",  arquivo: "playwright/.auth/perfil-so-producao.json" },
  { id: "captacao-producao", variavel: "E2E_PERFIL_CAPTACAO_PRODUCAO", modulos: ["captacao", "producao"], inicio: "/dashboard",  arquivo: "playwright/.auth/perfil-captacao-producao.json" },
];

export type Credenciais = { email: string; password: string };

export function credenciais(perfil: Perfil): Credenciais | null {
  const email = process.env[`${perfil.variavel}_EMAIL`];
  const password = process.env[`${perfil.variavel}_PASSWORD`];
  return email && password ? { email, password } : null;
}

/** Entra pelo formulário, como a pessoa. Cada perfil chega a uma página diferente: basta sair do /login. */
export async function entrar(page: Page, { email, password }: Credenciais) {
  await page.goto("/login");
  await page.getByPlaceholder("voce@empresa.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page, `o login de ${email} não saiu de /login (senha errada?)`)
    .not.toHaveURL(/\/login(?:[?#]|$)/, { timeout: 15_000 });
}

/**
 * Confere que a conta é o que o perfil diz, para um erro de cadastro não
 * aparecer como falha de navegação. Usa a chave anônima e as regras do banco,
 * como o navegador. Sem signOut: o padrão ("global") derrubaria também a
 * sessão gravada no storageState.
 */
export async function problemasDaConta(perfil: Perfil, cred: Credenciais): Promise<string[]> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: login, error } = await supabase.auth.signInWithPassword(cred);
  if (error || !login.user) return [`login recusado: ${error?.message ?? "sem usuário"}`];

  const [{ data: profile }, { data: vinculos }] = await Promise.all([
    supabase.from("profiles").select("jards_super_admin, onboarding_completed").eq("id", login.user.id).maybeSingle(),
    supabase.from("organization_members")
      .select("papel, modulos_acesso, organizations(modulos_ativos, modulos_leitura)")
      .eq("user_id", login.user.id),
  ]);

  const problemas: string[] = [];
  if (profile?.jards_super_admin === true) problemas.push("é super admin (usa todos os módulos)");
  if (profile?.onboarding_completed === false) problemas.push("onboarding pendente (o modal cobre a tela)");
  if (vinculos?.length !== 1) return [...problemas, `precisa de 1 organização; tem ${vinculos?.length ?? 0}`];

  const vinculo = vinculos[0] as LinhaVinculo;
  if (vinculo.papel === "captador") problemas.push("papel captador (vai para /workspace-captador)");
  const acesso = { superAdmin: false, ...vinculoDaLinha(vinculo) };
  for (const modulo of MODULOS) {
    const esperado = perfil.modulos.includes(modulo);
    if (podeUsarModulo(acesso, modulo) !== esperado) problemas.push(`${esperado ? "não usa" : "usa"} ${modulo}`);
  }
  return problemas;
}
