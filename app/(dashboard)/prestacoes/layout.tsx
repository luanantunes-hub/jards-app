import type { Metadata } from "next";
import { tituloDaPagina } from "@/lib/navigation/rotas";
import { exigirModulo } from "@/lib/modulos-servidor";
import { AvisoAssinaturaPrestacao } from "@/components/prestacao/AvisoAssinaturaPrestacao";

// As páginas desta seção são client components; o título da aba vem daqui.
export const metadata: Metadata = { title: tituloDaPagina("/prestacoes") };

// Bloqueio no servidor: só entra quem usa a prestação em alguma organização
// (ou é super admin). A organização aberta fica no navegador, então o
// isolamento entre organizações continua nas políticas do banco. Sem
// assinatura, o módulo fica só para leitura (P5.6) e as telas continuam
// abertas para consulta e exportação. Quem não usa a prestação vai para a
// página de entrada dela (a da captação, ou a do módulo que usa).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirModulo("prestacao");

  return (
    <>
      <AvisoAssinaturaPrestacao />
      {children}
    </>
  );
}
