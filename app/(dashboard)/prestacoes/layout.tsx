import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { tituloDaPagina } from "@/lib/navigation/rotas";
import { exigirModulo } from "@/lib/modulos-servidor";
import { AvisoAssinaturaPrestacao } from "@/components/prestacao/AvisoAssinaturaPrestacao";

// As páginas desta seção são client components; o título da aba vem daqui.
export const metadata: Metadata = { title: tituloDaPagina("/prestacoes") };

// Bloqueio no servidor: só entra quem usa a prestação em alguma organização
// (ou é super admin); os outros vão para o módulo que usam. Sem assinatura, o
// módulo fica só para leitura (P5.6) e as telas continuam abertas para
// consulta e exportação.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirModulo(await createClient(), "prestacao");

  return (
    <>
      <AvisoAssinaturaPrestacao />
      {children}
    </>
  );
}
