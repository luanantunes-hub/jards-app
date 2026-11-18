import type { Metadata } from "next";
import { Fraunces, Geist_Mono } from "next/font/google";
import { tituloDaPagina } from "@/lib/navigation/rotas";

// As páginas desta seção são client components; o título da aba vem daqui.
export const metadata: Metadata = { title: tituloDaPagina("/atividades") };

// Geist Mono, a mesma da landing, nos rótulos técnicos do calendário (datas, contagens);
// Fraunces itálico na palavra que resume a situação do mês.
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });
const fraunces = Fraunces({ subsets: ["latin"], style: ["italic"], weight: ["400", "500"], variable: "--font-fraunces" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className={`${mono.variable} ${fraunces.variable} contents`}>{children}</div>;
}
