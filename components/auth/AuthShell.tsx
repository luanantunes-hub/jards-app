import Image from "next/image";

type AuthShellProps = {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  description?: string;
  /** Substitui o bloco padrão (eyebrow/título/descrição/mascote) por um conteúdo próprio. */
  asideContent?: React.ReactNode;
  /** Oculta a logo Jards no topo do painel esquerdo (default: visível). */
  showAsideLogo?: boolean;
};

export function AuthShell({ children, eyebrow, title, description, asideContent, showAsideLogo = true }: AuthShellProps) {
  return (
    <main className="grid h-[100dvh] overflow-hidden bg-[#F7F7F5] lg:grid-cols-[minmax(0,1.06fr)_minmax(31rem,.94fr)]">
      <aside className={`auth-stage ${asideContent ? "auth-stage--oblique" : "auth-stage--editorial"} relative hidden h-full overflow-hidden p-8 lg:flex lg:flex-col xl:p-10`}>
        <div className="relative z-10 flex min-h-0 flex-1 flex-col max-w-[42rem]">
          {showAsideLogo && (
            <a href="/" aria-label="Ir para a página inicial do Jards" className="inline-block shrink-0">
              <Image src="/jards-logo.svg" alt="Jards" width={94} height={30} priority className="h-7 w-auto" />
            </a>
          )}

          {asideContent ? (
            <div className={`flex min-h-0 flex-1 flex-col ${showAsideLogo ? "mt-6" : ""}`}>{asideContent}</div>
          ) : (
            <>
              <p className="mb-5 mt-6 shrink-0 text-[0.6875rem] font-semibold uppercase tracking-[.14em] text-black/40">{eyebrow}</p>
              <h2 className="max-w-[13ch] shrink-0 text-[clamp(2.8rem,4.6vw,5.2rem)] font-bold leading-[.96] tracking-[-.05em] text-[#0D0D0D]">
                {title}
              </h2>
              <p className="mt-4 max-w-md shrink-0 text-[0.9375rem] leading-7 text-black/48">{description}</p>
              <div className="auth-editorial-mascot-wrap" role="img" aria-label="Tamanduá ao telefone" />
            </>
          )}
        </div>
      </aside>

      <section className="relative flex h-full items-center justify-center overflow-hidden bg-white px-6 py-5 sm:px-12 lg:px-14 xl:px-16">
        <div className="relative z-10 w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
