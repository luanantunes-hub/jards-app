// Rodapé do site nas páginas públicas feitas em Next (blog): os mesmos links
// do rodapé da landing, numa versão compacta.

import Link from "next/link";

const titulo = "mb-4 text-[0.625rem] font-bold tracking-[.14em] uppercase text-[#282525]/45";
const link = "text-[0.9375rem] font-semibold text-[#282525] transition-colors hover:text-[#684DB0]";
const legal = "text-[0.6875rem] font-semibold text-[#282525]/45 transition-colors hover:text-[#684DB0]";

export default function RodapeSite() {
  return (
    <footer className="bg-[#F7F7F5] pt-14 pb-7 md:pt-20">
      <div className="mx-auto max-w-pagina px-5 md:px-8">
        <div className="grid grid-cols-2 gap-x-7 gap-y-10 md:grid-cols-[minmax(0,1.45fr)_minmax(9rem,.55fr)_minmax(11rem,.55fr)] md:gap-16">
          <div className="col-span-2 md:col-span-1">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a raiz é a landing em HTML (app/route.ts), não uma página do Next */}
            <a href="/" aria-label="Página inicial da Jards" className="inline-block">
              <img src="/assets/jards-logo.svg" alt="Jards" className="h-7" />
            </a>
            <p className="mt-4 max-w-[30ch] text-sm leading-relaxed text-[#282525]/55">
              Inteligência e operação para patrocínios.
            </p>
          </div>

          <nav aria-label="Navegação do rodapé">
            <p className={titulo}>Navegue</p>
            <div className="flex flex-col items-start gap-3">
              <a className={link} href="/incentivadores">Inteligência</a>
              <a className={link} href="/crm">CRM</a>
              <a className={link} href="/prestacao-de-contas">Prestação de contas</a>
              <a className={link} href="/precos">Preços</a>
              <Link className={link} href="/publicacoes">Publicações</Link>
            </div>
          </nav>

          <div>
            <p className={titulo}>Acompanhe a Jards</p>
            <div className="flex flex-col items-start gap-3">
              <a className={`${link} inline-flex items-center gap-2`} href="https://www.linkedin.com/company/jardsapp/" target="_blank" rel="noopener noreferrer">
                <i className="ph ph-linkedin-logo text-xl leading-none" aria-hidden="true" />LinkedIn
              </a>
              <a className={`${link} inline-flex items-center gap-2`} href="https://www.instagram.com/jardsapp/" target="_blank" rel="noopener noreferrer">
                <i className="ph ph-instagram-logo text-xl leading-none" aria-hidden="true" />Instagram
              </a>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-[#282525]/12 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a className={legal} href="/privacidade">Política de Privacidade</a>
            <a className={legal} href="/termos">Termos de Uso</a>
            <button type="button" className={`${legal} cursor-pointer`} data-preferencias-cookies>
              Preferências de cookies
            </button>
          </div>
          <p className="text-[0.6875rem] font-semibold text-[#282525]/45">© 2026 Jards. Feito no Brasil.</p>
        </div>
      </div>
    </footer>
  );
}
