import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lerAcessoAosModulos } from "@/lib/modulos-acesso";
import { tituloDaPagina } from "@/lib/navigation/rotas";

export const metadata: Metadata = { title: tituloDaPagina("/producoes/prototipo") };

// Os protótipos (telas que ainda não existem, com dados de exemplo e nada salvo) são só do suporte:
// nem quem usa a produção numa organização os vê. O layout da seção já exige a produção; este
// acrescenta o super admin, e uma leitura que falha manda de volta para a agenda.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/producoes/prototipo");
  const acesso = await lerAcessoAosModulos(supabase, user.id);
  if (!acesso.superAdmin) redirect("/producoes");
  return children;
}
