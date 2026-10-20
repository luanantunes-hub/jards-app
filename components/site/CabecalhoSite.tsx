// Menu do site nas páginas públicas feitas em Next (blog). Mesma marcação da
// landing (public/landing.html): o estilo vem de public/menu-site.css e o
// comportamento de public/menu-site.js, carregados pelo layout de quem usa.
// As regras de menu-site.css ficam fora das camadas do Tailwind e vencem as
// classes utilitárias; por isso o item da página atual muda a cor por style.

import Link from "next/link";

type Props = { atual?: "publicacoes" };

const corAtual = { color: "#282525" };

export default function CabecalhoSite({ atual }: Props) {
  return (
    <header className="sticky top-0 z-50 border-b border-black/[.06] bg-white/85 backdrop-blur-xl backdrop-saturate-150">
      <div className="flex h-16 items-center justify-between px-5 md:px-8">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a raiz é a landing em HTML (app/route.ts), não uma página do Next */}
        <a href="/" aria-label="Página inicial da Jards">
          <img src="/assets/jards-logo.svg" alt="Jards" className="h-7" />
        </a>

        <nav className="menu-site" aria-label="Principal">
          <div className="menu-site__grupo" data-menu-grupo>
            <button type="button" className="menu-site__gatilho" data-menu-gatilho aria-expanded="false" aria-controls="menuProduto">
              Produto <i className="ph ph-caret-down menu-site__seta" aria-hidden="true" />
            </button>
            <div className="menu-site__painel" id="menuProduto" style={{ "--colunas": 2 } as React.CSSProperties}>
              <div className="menu-site__coluna">
                <p className="menu-site__secao">Captação de recursos</p>
                <a className="menu-site__item" href="/incentivadores">
                  <span className="menu-site__titulo">Inteligência</span>
                  <span className="menu-site__desc">Quem incentiva cada lei, empresa por empresa, e os editais abertos.</span>
                </a>
                <a className="menu-site__item" href="/crm">
                  <span className="menu-site__titulo">CRM</span>
                  <span className="menu-site__desc">Empresas, negociações, propostas e prazos, até a renovação.</span>
                </a>
              </div>
              <div className="menu-site__coluna">
                <p className="menu-site__secao">Prestação de contas</p>
                <a className="menu-site__item" href="/prestacao-de-contas">
                  <span className="menu-site__titulo">Prestação de contas</span>
                  <span className="menu-site__desc">Orçamento, extrato, comprovantes e envio, conferidos pelas regras de cada lei.</span>
                </a>
              </div>
            </div>
          </div>
          <a className="menu-site__link" href="/precos">Preços</a>
          <Link
            className="menu-site__link"
            href="/publicacoes"
            aria-current={atual === "publicacoes" ? "page" : undefined}
            style={atual === "publicacoes" ? corAtual : undefined}
          >
            Publicações
          </Link>
        </nav>

        <div className="flex items-center gap-1 md:gap-3">
          <a
            href="/login"
            className="menu-site__login inline-flex min-h-10 items-center rounded px-3 text-sm font-medium whitespace-nowrap text-black/55 transition-colors hover:text-[#282525] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
          >
            Fazer login
          </a>
          <a
            href="/cadastro"
            className="inline-flex h-10 items-center gap-2 rounded bg-[#282525] px-4 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
          >
            Começar grátis
            <i className="ph ph-arrow-right" aria-hidden="true" />
          </a>
          <button
            type="button"
            className="menu-site__botao-celular"
            data-menu-celular
            aria-expanded="false"
            aria-controls="menuCelular"
            aria-label="Abrir menu"
          >
            <i className="ph ph-list" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="menu-celular" id="menuCelular" hidden>
        <div className="menu-celular__secao">
          <span className="menu-celular__rotulo">Captação de recursos</span>
          <a className="menu-celular__link" href="/incentivadores">Inteligência</a>
          <a className="menu-celular__link" href="/crm">CRM</a>
        </div>
        <div className="menu-celular__secao">
          <span className="menu-celular__rotulo">Prestação de contas</span>
          <a className="menu-celular__link" href="/prestacao-de-contas">Prestação de contas</a>
        </div>
        <div className="menu-celular__secao">
          <a className="menu-celular__link" href="/precos">Preços</a>
          <Link className="menu-celular__link" href="/publicacoes" aria-current={atual === "publicacoes" ? "page" : undefined}>Publicações</Link>
          <a className="menu-celular__link" href="/login">Fazer login</a>
        </div>
      </div>
    </header>
  );
}
