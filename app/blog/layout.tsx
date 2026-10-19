import Script from "next/script";
import { Geist_Mono } from "next/font/google";
import CabecalhoSite from "@/components/site/CabecalhoSite";
import RodapeSite from "@/components/site/RodapeSite";

// Rótulos pequenos (temas, datas, tempo de leitura) na mesma mono da landing.
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

// Menu e rodapé do site, iguais aos da landing; aviso de cookies e Google
// Analytics (só após consentimento) — ver public/consentimento.js.
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    // overflow-x-clip: o painel fechado do menu "Produto" (duas colunas) passa
    // da borda direita e criaria rolagem lateral; clip, ao contrário de hidden,
    // não quebra os elementos fixos (menu e "Neste texto").
    <div className={`${mono.variable} overflow-x-clip bg-white`}>
      <link rel="stylesheet" href="/menu-site.css" precedence="default" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css" precedence="default" />
      <CabecalhoSite atual="blog" />
      {children}
      <RodapeSite />
      <Script src="/consentimento.js" strategy="afterInteractive" />
      <Script src="/menu-site.js" strategy="afterInteractive" />
    </div>
  );
}
