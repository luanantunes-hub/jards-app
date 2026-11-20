"use client";

// Seleção múltipla com busca, para filtrar por várias opções de uma lista longa (as mesorregiões, por exemplo).
// O menu sai por portal, para não ser cortado, e abre acima quando não há espaço embaixo. Marcar não fecha o
// menu: ele fecha com Esc, com clique fora ou quando o foco sai dele.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react";
import { PortalMenu, usePortalPosition } from "@/components/ui/ComboboxPortalMenu";
import { escalaUi } from "@/lib/escala-ui";
import { agruparOpcoes, alternar, filtrarOpcoes, rotuloDoBotao, type OpcaoMultipla } from "@/lib/multi-select";

export type { OpcaoMultipla } from "@/lib/multi-select";

const LARGURA_MINIMA_DO_MENU_REM = 20;

export function MultiSelectDropdown({
  values,
  onChange,
  options,
  placeholder,
  rotuloVarias,
  ariaLabel,
  icon,
  searchPlaceholder = "Buscar…",
  emptyMessage = "Nada encontrado.",
  disabled = false,
  className = "",
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: OpcaoMultipla[];
  /** Texto do botão sem nada escolhido. */
  placeholder: string;
  /** Texto do botão com várias escolhidas ("3 mesorregiões"). */
  rotuloVarias: (quantidade: number) => string;
  /** Nome da lista para o leitor de tela. */
  ariaLabel: string;
  icon?: React.ReactNode;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [destaque, setDestaque] = useState(0);
  const ancoraRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const listaId = useId();
  const posicao = usePortalPosition(ancoraRef, aberto);

  const grupos = useMemo(() => agruparOpcoes(filtrarOpcoes(options, busca)), [options, busca]);
  // A ordem do teclado é a da tela: grupo após grupo.
  const ordenadas = useMemo(() => grupos.flatMap((g) => g.itens), [grupos]);
  const indicePorValor = useMemo(() => new Map(ordenadas.map((o, i) => [o.value, i])), [ordenadas]);
  const idDaOpcao = (valor: string) => `${listaId}-opcao-${valor}`;
  const destacada = ordenadas[destaque];

  function fechar() {
    setAberto(false);
    setBusca("");
  }

  function abrir() {
    setDestaque(0);
    setAberto(true);
  }

  useEffect(() => {
    if (!aberto) return;
    // O menu é identificado por uma marca no elemento, não por ref: o foco automático na busca acontece antes de o
    // React ligar o ref do menu, e esse primeiro foco não pode contar como "saiu do menu".
    const dentro = (alvo: EventTarget | null) =>
      alvo instanceof Element && (!!alvo.closest(`[data-menu-multipla="${listaId}"]`) || !!ancoraRef.current?.contains(alvo));
    const aoPressionarTecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      fechar();
      botaoRef.current?.focus();
    };
    const aoClicar = (e: MouseEvent) => { if (!dentro(e.target)) fechar(); };
    const aoMudarFoco = (e: FocusEvent) => { if (!dentro(e.target)) fechar(); };
    document.addEventListener("keydown", aoPressionarTecla);
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("focusin", aoMudarFoco);
    return () => {
      document.removeEventListener("keydown", aoPressionarTecla);
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("focusin", aoMudarFoco);
    };
  }, [aberto, listaId]);

  // Com as setas, a opção destacada acompanha a rolagem do menu.
  useEffect(() => {
    if (aberto && destacada) document.getElementById(idDaOpcao(destacada.value))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, destacada]);

  function marcar(opcao: OpcaoMultipla) {
    if (opcao.disabled && !values.includes(opcao.value)) return;
    onChange(alternar(values, opcao.value));
  }

  function aoTeclarNaBusca(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDestaque((d) => Math.min(d + 1, ordenadas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (destacada) marcar(destacada);
    }
  }

  // O menu é mais largo que o botão (nomes longos + número) e nunca passa da tela.
  let posicaoDoMenu = posicao;
  let larguraDoMenu: number | undefined;
  if (posicao) {
    const margem = 8 * escalaUi();
    larguraDoMenu = Math.min(Math.max(posicao.width, LARGURA_MINIMA_DO_MENU_REM * 16 * escalaUi()), window.innerWidth - 2 * margem);
    posicaoDoMenu = { ...posicao, left: Math.max(margem, Math.min(posicao.left, window.innerWidth - larguraDoMenu - margem)) };
  }

  const rotulo = rotuloDoBotao(options, values, placeholder, rotuloVarias);
  // No celular o teclado cobriria metade do menu: a busca só ganha o foco sozinha onde há mouse.
  const focarNaBusca = typeof window !== "undefined" && !window.matchMedia("(pointer: coarse)").matches;

  return (
    <div ref={ancoraRef} className={`relative ${className}`}>
      <button
        ref={botaoRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? listaId : undefined}
        onClick={() => (aberto ? fechar() : abrir())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !aberto) {
            e.preventDefault();
            abrir();
          }
        }}
        className={`flex w-full cursor-pointer items-center gap-2 rounded border border-black/12 bg-white px-3 py-2.5 text-xs font-normal transition hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-black/10 disabled:cursor-not-allowed disabled:bg-black/[.02] disabled:text-black/25 disabled:hover:border-black/12 ${
          values.length > 0 ? "text-[#282525]" : "text-black/40"
        }`}
      >
        {icon && <span className="flex-shrink-0 text-black/35">{icon}</span>}
        <span className="min-w-0 flex-1 truncate text-left">{rotulo}</span>
        <CaretDown size={12} className={`flex-shrink-0 text-black/35 transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {aberto && (
        <PortalMenu position={posicaoDoMenu} width={larguraDoMenu}>
          <div data-menu-multipla={listaId}>
            <div className="sticky top-0 z-10 border-b border-black/[.08] bg-white p-2">
              <div className="relative">
                <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/30" aria-hidden="true" />
                <input
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listaId}
                  aria-autocomplete="list"
                  aria-activedescendant={destacada ? idDaOpcao(destacada.value) : undefined}
                  aria-label={searchPlaceholder}
                  autoFocus={focarNaBusca}
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setDestaque(0);
                  }}
                  onKeyDown={aoTeclarNaBusca}
                  placeholder={searchPlaceholder}
                  className="w-full rounded border bg-white py-2 pl-8 pr-3 text-[0.8125rem] text-[#282525] placeholder-black/30 transition focus:border-[#7259B5]/45 focus:outline-none focus:ring-2 focus:ring-[#7259B5]/10"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                />
              </div>
            </div>

            <div id={listaId} role="listbox" aria-label={ariaLabel} aria-multiselectable="true">
              {ordenadas.length === 0 && <p className="px-3 py-6 text-center text-[0.75rem] text-black/45">{emptyMessage}</p>}
              {grupos.map(({ grupo, itens }, g) => (
                <div key={grupo ?? `semgrupo-${g}`} role="group" aria-labelledby={grupo ? `${listaId}-grupo-${g}` : undefined}>
                  {grupo && (
                    <div id={`${listaId}-grupo-${g}`} className="px-3 pb-1 pt-3 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">
                      {grupo}
                    </div>
                  )}
                  {itens.map((opcao) => {
                    const marcada = values.includes(opcao.value);
                    const bloqueada = !!opcao.disabled && !marcada;
                    return (
                      <div
                        key={opcao.value}
                        id={idDaOpcao(opcao.value)}
                        role="option"
                        aria-selected={marcada}
                        aria-disabled={bloqueada || undefined}
                        // Manter o foco na busca: o clique não pode tirá-lo de lá.
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => marcar(opcao)}
                        onMouseMove={() => {
                          const i = indicePorValor.get(opcao.value);
                          if (i !== undefined && i !== destaque) setDestaque(i);
                        }}
                        className={`flex scroll-mb-[2.5rem] scroll-mt-[3.25rem] items-center gap-2.5 px-3 py-2 text-[0.8125rem] transition-colors ${
                          bloqueada ? "cursor-not-allowed opacity-35" : "cursor-pointer"
                        } ${destacada?.value === opcao.value && !bloqueada ? "bg-black/[.04]" : ""}`}
                      >
                        <span
                          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                            marcada ? "border-[#7259B5] bg-[#7259B5] text-white" : "border-black/25 bg-white"
                          }`}
                          aria-hidden="true"
                        >
                          {marcada && <Check size={11} weight="bold" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[#282525]">{opcao.label}</span>
                        {opcao.contagem !== undefined && (
                          <span className="flex-shrink-0 text-[0.6875rem] tabular-nums text-black/40">{opcao.contagem}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {values.length > 0 && (
              <div className="sticky bottom-0 z-10 flex justify-end border-t border-black/[.08] bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="rounded text-[0.75rem] font-medium text-black/45 transition hover:text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/25"
                >
                  Limpar seleção
                </button>
              </div>
            )}
          </div>
        </PortalMenu>
      )}
    </div>
  );
}
