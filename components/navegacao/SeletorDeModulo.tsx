"use client";

// Seletor de módulo no menu lateral. O módulo é o contexto da navegação, então
// fica no alto do menu, acima das seções que ele define: recolhido, só o ícone;
// aberto, a lista dos módulos com a descrição, e o que não está liberado para
// a pessoa aparece com cadeado e o motivo (situacaoNoSeletor, em
// lib/modulos.ts). Enquanto os módulos carregam, os itens só esperam. O módulo em promoção
// leva a etiqueta "Promo" (pequena, cinza, sem borda) e o texto do teste no
// próprio item da lista, nunca embaixo do módulo atual; escolhido, abre o
// convite (quem decide é a tela).

import { useEffect, useId, useRef } from "react";
import { Check, ChevronsUpDown, Lock, type LucideIcon } from "lucide-react";
import type { ModuloId } from "@/lib/modulos";

export type OpcaoDeModulo = {
  id: ModuloId;
  label: string;
  descricao: string;
  icone: LucideIcon;
  /** Por que a pessoa não usa o módulo; null quando usa. */
  bloqueio: string | null;
  /** Oferecido em teste gratuito a quem ainda não tem: a escolha abre o convite. */
  promo?: boolean;
  /** O que o item diz no lugar da descrição enquanto o módulo está em promoção. */
  chamada?: string;
  /** Os módulos da organização ainda não chegaram: o item espera, sem cadeado nem promoção. */
  carregando?: boolean;
};

export function SeletorDeModulo({ opcoes, ativo, expandido, aberto, onAbrir, onTrocar }: {
  opcoes: readonly OpcaoDeModulo[];
  ativo: ModuloId;
  /** O menu lateral está aberto, com os rótulos. */
  expandido: boolean;
  aberto: boolean;
  onAbrir: (aberto: boolean) => void;
  onTrocar: (id: ModuloId) => void;
}) {
  const lista = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const atual = opcoes.find(o => o.id === ativo) ?? opcoes[0];

  // Escape fecha e devolve o foco ao gatilho; clicar fora fecha.
  useEffect(() => {
    if (!aberto) return;
    function tecla(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      onAbrir(false);
      gatilho.current?.focus();
    }
    function clique(e: MouseEvent) {
      if (!raiz.current?.contains(e.target as Node)) onAbrir(false);
    }
    document.addEventListener("keydown", tecla);
    document.addEventListener("mousedown", clique);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("mousedown", clique);
    };
  }, [aberto, onAbrir]);

  if (!atual) return null;
  const Icone = atual.icone;

  return (
    <div ref={raiz} className="flex-shrink-0 border-b px-2 py-2.5" style={{ borderColor: "rgba(13,13,13,.07)" }}>
      <button
        ref={gatilho}
        type="button"
        onClick={() => onAbrir(!aberto)}
        aria-expanded={aberto}
        aria-controls={lista}
        aria-label={`Módulo: ${atual.label}. Trocar de módulo`}
        title={expandido ? undefined : `Módulo: ${atual.label}`}
        className="flex w-full items-center overflow-hidden rounded transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]"
        style={{
          gap: expandido ? 10 : 0,
          padding: expandido ? "6px 8px" : "6px 0",
          justifyContent: expandido ? "flex-start" : "center",
        }}
      >
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-[#282525] text-white">
          <Icone size={15} aria-hidden="true" />
        </span>
        {expandido && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate whitespace-nowrap text-xs font-semibold text-[#282525]">{atual.label}</span>
              <span className="block truncate whitespace-nowrap text-[0.625rem] text-black/35">
                Trocar de módulo
              </span>
            </span>
            <ChevronsUpDown size={14} aria-hidden="true" className="flex-shrink-0 text-black/35" />
          </>
        )}
      </button>

      {aberto && expandido && (
        <ul id={lista} aria-label="Módulos" className="mt-1.5 space-y-0.5">
          {opcoes.map(opcao => {
            const IconeDaOpcao = opcao.icone;
            const atualDaLista = opcao.id === atual.id;
            const esperando = Boolean(opcao.carregando) && !atualDaLista;
            return (
              <li key={opcao.id}>
                <button
                  type="button"
                  disabled={Boolean(opcao.bloqueio) || esperando}
                  aria-busy={esperando || undefined}
                  aria-current={atualDaLista ? "true" : undefined}
                  onClick={() => {
                    onAbrir(false);
                    if (!atualDaLista) onTrocar(opcao.id);
                  }}
                  className={`flex w-full items-start gap-2.5 rounded px-2 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5] active:scale-[.99] disabled:active:scale-100 ${
                    esperando ? "disabled:cursor-progress" : "disabled:cursor-not-allowed"
                  } ${
                    atualDaLista ? "bg-black/[.05]" : "hover:bg-black/[.04] disabled:hover:bg-transparent"
                  }`}
                >
                  <span
                    className={`mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded ${
                      atualDaLista ? "bg-[#282525] text-white" : "border border-black/[.12] bg-white text-black/45"
                    }`}
                  >
                    <IconeDaOpcao size={13} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`flex items-center gap-1 text-[0.75rem] font-medium ${opcao.bloqueio ? "text-black/45" : "text-[#282525]"}`}>
                      {opcao.label}
                      {opcao.bloqueio && <Lock size={10} aria-hidden="true" className="text-black/35" />}
                      {opcao.promo && (
                        <span className="ml-auto rounded-full bg-black/[.06] px-1.5 text-[0.5625rem] font-medium leading-[1rem] text-black/65">
                          Promo
                        </span>
                      )}
                    </span>
                    <span className="block text-[0.625rem] leading-snug text-black/45">{opcao.bloqueio ?? (opcao.promo && opcao.chamada ? opcao.chamada : opcao.descricao)}</span>
                  </span>
                  {atualDaLista && <Check size={13} aria-hidden="true" className="mt-1 flex-shrink-0 text-black/50" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
