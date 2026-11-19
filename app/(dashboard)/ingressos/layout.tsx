import type { Metadata } from "next";
import { tituloDaPagina } from "@/lib/navigation/rotas";
import { exigirModulo } from "@/lib/modulos-servidor";

// As páginas desta seção são client components; o título da aba vem daqui.
export const metadata: Metadata = { title: tituloDaPagina("/ingressos") };

// Bloqueio no servidor, como o da produção: só entra quem usa a ticketeria em
// alguma organização (ou é super admin). O módulo está escondido dos clientes
// (MODULOS_EM_CONSTRUCAO em lib/modulos.ts) e nenhuma organização o tem: na
// prática só o super admin chega aqui. Quem não usa a ticketeria vai para a
// página inicial do módulo que usa. A rota é /ingressos, não /ticketeria:
// jards.com.br/ticketeria é a página pública do produto.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirModulo("ticketeria");
  return children;
}
