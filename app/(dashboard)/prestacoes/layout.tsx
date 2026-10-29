import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tituloDaPagina } from "@/lib/navigation/rotas";
import { modulosDaOrganizacao, normalizarModulos, usaModuloEmAlgumaOrganizacao } from "@/lib/modulos";
import { AvisoAssinaturaPrestacao } from "@/components/prestacao/AvisoAssinaturaPrestacao";

// As páginas desta seção são client components; o título da aba vem daqui.
export const metadata: Metadata = { title: tituloDaPagina("/prestacoes") };

// Bloqueio no servidor: só entra quem usa a prestação em alguma organização
// (ou é super admin). A organização aberta fica no navegador, então o
// isolamento entre organizações continua nas políticas do banco. Sem
// assinatura, o módulo fica só para leitura (P5.6) e as telas continuam
// abertas para consulta e exportação.
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
      .select("modulos_acesso, organizations(modulos_ativos, modulos_leitura)")
      .eq("user_id", user.id),
  ]);

  const superAdmin = profile?.jards_super_admin === true;
  const liberado = usaModuloEmAlgumaOrganizacao(
    superAdmin,
    vinculosErro ? [] : ((vinculos ?? []) as { modulos_acesso: unknown; organizations: { modulos_ativos: unknown; modulos_leitura: unknown } | null }[])
      .map(v => ({
        modulosMembro: normalizarModulos(v.modulos_acesso),
        modulosOrganizacao: modulosDaOrganizacao(v.organizations?.modulos_ativos, v.organizations?.modulos_leitura),
      })),
    "prestacao",
  );
  if (!liberado) redirect("/dashboard");

  return (
    <>
      <AvisoAssinaturaPrestacao />
      {children}
    </>
  );
}
