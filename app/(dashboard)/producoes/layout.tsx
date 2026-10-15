import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { tituloDaPagina } from "@/lib/navigation/rotas";
import { exigirModulo } from "@/lib/modulos-servidor";

// As páginas desta seção são client components; o título da aba vem daqui.
export const metadata: Metadata = { title: tituloDaPagina("/producoes") };

// Bloqueio no servidor: só entra quem usa a produção em alguma organização
// (ou é super admin); os outros vão para o módulo que usam. O aviso de
// assinatura chega com a cobrança do módulo (PDL.2).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirModulo(await createClient(), "producao");
  return children;
}
