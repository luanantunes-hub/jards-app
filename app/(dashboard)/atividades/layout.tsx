import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { tituloDaPagina } from "@/lib/navigation/rotas";

// As páginas desta seção são client components; o título da aba vem daqui.
export const metadata: Metadata = { title: tituloDaPagina("/atividades") };

// Geist Mono, a mesma da landing, nos rótulos técnicos do calendário (datas, contagens).
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className={`${mono.variable} contents`}>{children}</div>;
}
