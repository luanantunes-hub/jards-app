import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Assinatura confirmada — Jards",
  robots: { index: false, follow: false },
};

// O aviso de cookies roda na volta do pagamento: com o aceite, a tag do
// Google Ads conta a assinatura (lib/conversao-google-ads.ts).
export default function AssinaturaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script src="/consentimento.js" strategy="afterInteractive" />
    </>
  );
}
