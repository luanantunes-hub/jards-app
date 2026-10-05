import type { Metadata } from "next";
import { tituloDaPagina } from "@/lib/navigation/rotas";

// A página é client component; o título da aba vem daqui.
export const metadata: Metadata = { title: tituloDaPagina("/prestacoes/fornecedores") };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
