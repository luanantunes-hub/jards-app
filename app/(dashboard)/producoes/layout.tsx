import type { Metadata } from "next";
import { tituloDaPagina } from "@/lib/navigation/rotas";
import { exigirModulo } from "@/lib/modulos-servidor";

// As páginas desta seção são client components; o título da aba vem daqui.
export const metadata: Metadata = { title: tituloDaPagina("/producoes") };

// Bloqueio no servidor: só entra quem usa a produção em alguma organização (ou é
// super admin), com o módulo em vigor ou só para leitura (organizations.modulos_ativos
// e modulos_leitura). A organização aberta fica no navegador, então o isolamento
// entre organizações continua nas políticas do banco. Quem não usa a produção vai
// para a página inicial do módulo que usa. Sem aviso de assinatura por enquanto:
// ele chega com a cobrança por módulo (PDL.2).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirModulo("producao");
  return children;
}
