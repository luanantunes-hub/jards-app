import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Criar conta — Jards",
  robots: { index: false, follow: false },
};

// O aviso de cookies também roda no cadastro: com o aceite, a tag do Google
// Ads conta a conta criada (lib/conversao-google-ads.ts).
export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script src="/consentimento.js" strategy="afterInteractive" />
    </>
  );
}
