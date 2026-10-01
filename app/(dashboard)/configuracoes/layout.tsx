import type { Metadata } from "next";
import { tituloDaPagina } from "@/lib/navigation/rotas";

// As páginas desta seção são client components; o título da aba vem daqui.
export const metadata: Metadata = { title: tituloDaPagina("/configuracoes") };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
