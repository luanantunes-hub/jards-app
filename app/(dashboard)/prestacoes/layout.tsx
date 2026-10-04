import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tituloDaPagina } from "@/lib/navigation/rotas";
import { normalizarModulos, usaModuloEmAlgumaOrganizacao } from "@/lib/modulos";

// As páginas desta seção são client components; o título da aba vem daqui.
export const metadata: Metadata = { title: tituloDaPagina("/prestacoes") };

// Bloqueio no servidor: só entra quem usa a prestação em alguma organização
// (ou é super admin). A organização aberta fica no navegador, então o
// isolamento entre organizações continua nas políticas do banco.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/prestacoes");

  const [{ data: profile }, { data: vinculos, error: vinculosErro }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colunas fora do tipo Database até a P0.5
    (supabase as any).from("profiles").select("jards_super_admin").eq("id", user.id).maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colunas fora do tipo Database até a P0.5
    (supabase as any)
      .from("organization_members")
      .select("modulos_acesso, organizations(modulos_ativos)")
      .eq("user_id", user.id),
  ]);

  const superAdmin = profile?.jards_super_admin === true;
  const liberado = usaModuloEmAlgumaOrganizacao(
    superAdmin,
    vinculosErro ? [] : ((vinculos ?? []) as { modulos_acesso: unknown; organizations: { modulos_ativos: unknown } | null }[])
      .map(v => ({
        modulosMembro: normalizarModulos(v.modulos_acesso),
        modulosOrganizacao: normalizarModulos(v.organizations?.modulos_ativos),
      })),
    "prestacao",
  );
  if (!liberado) redirect("/dashboard");

  return children;
}
