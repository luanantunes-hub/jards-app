"use client";

import { useRef, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import type { Assistente } from "@/lib/mcp/conexoes";
import { ClaudeMark, OpenAIMark } from "@/components/icons/AiLogos";

const ABAS: { id: Assistente; rotulo: string }[] = [
  { id: "claude", rotulo: "Claude" },
  { id: "chatgpt", rotulo: "ChatGPT" },
];

export const idDaAba = (assistente: Assistente) => `aba-mcp-${assistente}`;
export const idDoPainel = (assistente: Assistente) => `painel-mcp-${assistente}`;

interface Props {
  ativa: Assistente;
  conectados: Record<Assistente, boolean>;
  onChange: (assistente: Assistente) => void;
}

/** Abas do Claude e do ChatGPT. O ✓ ao lado do nome diz qual já está conectado sem precisar abrir a aba. */
export function AbasAssistente({ ativa, conectados, onChange }: Props) {
  const botoes = useRef<Record<Assistente, HTMLButtonElement | null>>({ claude: null, chatgpt: null });

  function aoTeclar(e: KeyboardEvent<HTMLButtonElement>, indice: number) {
    const destinos: Record<string, number> = {
      ArrowRight: (indice + 1) % ABAS.length,
      ArrowLeft: (indice - 1 + ABAS.length) % ABAS.length,
      Home: 0,
      End: ABAS.length - 1,
    };
    const destino = destinos[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    const { id } = ABAS[destino];
    onChange(id);
    botoes.current[id]?.focus();
  }

  return (
    <div role="tablist" aria-label="Assistente de IA" className="flex gap-1.5">
      {ABAS.map(({ id, rotulo }, indice) => {
        const selecionada = ativa === id;
        return (
          <button
            key={id}
            ref={(el) => {
              botoes.current[id] = el;
            }}
            type="button"
            role="tab"
            id={idDaAba(id)}
            aria-selected={selecionada}
            aria-controls={idDoPainel(id)}
            tabIndex={selecionada ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => aoTeclar(e, indice)}
            className={`flex h-11 items-center gap-2 rounded border bg-white px-4 text-[0.75rem] font-medium transition active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${
              selecionada ? "border-[#7259B5]/40 text-[#7259B5]" : "border-transparent text-black/55 hover:bg-black/[.04] hover:text-black/70"
            }`}
          >
            {id === "claude" ? <ClaudeMark size={14} /> : <OpenAIMark size={14} />}
            {rotulo}
            {conectados[id] && (
              <>
                <Check size={13} strokeWidth={2} className="text-[#2E8932]" aria-hidden="true" />
                <span className="sr-only">conectado</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
