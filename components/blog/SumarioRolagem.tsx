"use client";

// "Neste texto": sumário que acompanha a leitura. No computador largo fica
// fixo ao lado da coluna; nas telas menores vira uma barra fina sob o menu do
// site, com a seção atual e o progresso, que abre a lista ao toque.

import { useEffect, useRef, useState } from "react";

export type ItemSumario = { id: string; titulo: string };

// Abaixo do menu do site (64px) e da barra do celular: o título que passou
// desta linha é a seção que está sendo lida.
const LINHA_DE_LEITURA = 140;

function useLeitura(itens: ItemSumario[], alvo: string) {
  const [atual, setAtual] = useState(0);
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const artigo = document.getElementById(alvo);
      if (!artigo) return;
      const caixa = artigo.getBoundingClientRect();
      const percurso = caixa.height - window.innerHeight;
      setProgresso(percurso > 0 ? Math.min(1, Math.max(0, -caixa.top / percurso)) : 1);
      // No fim da página uma seção final curta nunca chega à linha de leitura:
      // ali vale o último título que já está na tela.
      const noFim = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      const limite = noFim ? window.innerHeight : LINHA_DE_LEITURA;
      let indice = 0;
      itens.forEach((item, i) => {
        const titulo = document.getElementById(item.id);
        if (titulo && titulo.getBoundingClientRect().top <= limite) indice = i;
      });
      setAtual(indice);
    };
    const agendar = () => { if (!quadro) quadro = requestAnimationFrame(medir); };
    medir();
    window.addEventListener("scroll", agendar, { passive: true });
    window.addEventListener("resize", agendar);
    return () => {
      window.removeEventListener("scroll", agendar);
      window.removeEventListener("resize", agendar);
      cancelAnimationFrame(quadro);
    };
  }, [itens, alvo]);

  return { atual, progresso };
}

const ROTULO = "font-(family-name:--font-mono) text-[0.6875rem] font-medium uppercase tracking-[.08em]";

export function SumarioLateral({ itens, alvo }: { itens: ItemSumario[]; alvo: string }) {
  const { atual, progresso } = useLeitura(itens, alvo);
  return (
    <nav aria-label="Neste texto" className="sticky top-28 ml-auto mr-12 max-h-[calc(100vh-8rem)] w-56 overflow-y-auto pt-16">
      <p className={`${ROTULO} text-black/45`}>Neste texto</p>
      <div className="relative mt-4 pl-4">
        <span className="absolute top-0 bottom-0 left-0 w-px bg-black/10" aria-hidden="true" />
        <span
          className="absolute top-0 left-0 w-px bg-[#684DB0] transition-[height] duration-150 motion-reduce:transition-none"
          style={{ height: `${progresso * 100}%` }}
          aria-hidden="true"
        />
        <ol className="flex flex-col gap-3">
          {itens.map((item, i) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={i === atual ? "location" : undefined}
                className={`block text-[0.8125rem] leading-snug transition-colors hover:text-[#282525] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${
                  i === atual ? "font-medium text-[#684DB0]" : "text-black/50"
                }`}
              >
                {item.titulo}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

export function SumarioBarra({ itens, alvo }: { itens: ItemSumario[]; alvo: string }) {
  const { atual, progresso } = useLeitura(itens, alvo);
  const [aberto, setAberto] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    // Esc fecha a lista e devolve o foco ao botão, sem jogá-lo para o topo da página.
    const fechar = (e: KeyboardEvent) => { if (e.key === "Escape") { setAberto(false); botao.current?.focus(); } };
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  return (
    <div className="sticky top-16 z-40 border-b border-black/[.06] bg-white/90 backdrop-blur-xl xl:hidden">
      <button
        ref={botao}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls="sumario-lista"
        className="mx-auto flex h-11 w-full max-w-2xl items-center gap-2 px-6 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#7259B5]"
      >
        <span className={`${ROTULO} shrink-0 text-black/45`}>Neste texto</span>
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-[#282525]">{itens[atual]?.titulo}</span>
        <i className={`ph ph-caret-down shrink-0 text-black/45 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <span className="absolute bottom-0 left-0 h-0.5 bg-[#684DB0]" style={{ width: `${progresso * 100}%` }} aria-hidden="true" />
      {aberto && (
        <ol id="sumario-lista" className="mx-auto max-h-[calc(100dvh-7rem)] max-w-2xl overflow-y-auto px-6 pb-4">
          {itens.map((item, i) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={() => setAberto(false)}
                aria-current={i === atual ? "location" : undefined}
                className={`flex min-h-11 items-center text-sm ${i === atual ? "font-medium text-[#684DB0]" : "text-black/60"}`}
              >
                {item.titulo}
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
