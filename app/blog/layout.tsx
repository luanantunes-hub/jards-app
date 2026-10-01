import Link from "next/link";
import Script from "next/script";

// Aviso de cookies e Google Analytics (só após consentimento) — ver public/consentimento.js.
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <footer className="border-t border-black/8" style={{ background: "#FAFAFA" }}>
        <div className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-2 px-6 py-6 text-xs text-black/40">
          <Link href="/privacidade" className="hover:text-black/60">Política de Privacidade</Link>
          <Link href="/termos" className="hover:text-black/60">Termos de Uso</Link>
          <button type="button" data-preferencias-cookies className="hover:text-black/60">
            Preferências de cookies
          </button>
        </div>
      </footer>
      <Script src="/consentimento.js" strategy="afterInteractive" />
    </>
  );
}
