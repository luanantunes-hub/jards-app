"use client";

import { useState } from "react";
import { ESTADOS_DO_MAPA, TAMANHO_DO_MAPA_DE_ESTADOS } from "@/lib/ticketeria/mapa-estados";

/**
 * O mapa do Brasil para escolher o estado (onboarding da Ticketeria). Cada estado é um botão: clica ou usa Tab e Enter.
 * O escolhido fica em roxo (seleção); o que está sob o mouse ou o foco fica em cinza, e o nome aparece embaixo.
 */
export function MapaDoBrasil({ uf, onChange }: { uf: string; onChange: (uf: string) => void }) {
  const [sobre, setSobre] = useState<string | null>(null);
  const nome = ESTADOS_DO_MAPA.find(e => e.uf === (sobre ?? uf))?.nome ?? "";
  return (
    <div>
      <svg viewBox={`0 0 ${TAMANHO_DO_MAPA_DE_ESTADOS.largura} ${TAMANHO_DO_MAPA_DE_ESTADOS.altura}`} role="group" aria-label="Mapa do Brasil: escolha o estado" className="mx-auto block max-h-[22rem] w-full">
        {ESTADOS_DO_MAPA.map(estado => {
          const escolhido = estado.uf === uf;
          const em = estado.uf === sobre;
          return (
            <path key={estado.uf} d={estado.d} role="button" tabIndex={0} aria-label={estado.nome} aria-pressed={escolhido}
              fill={escolhido ? "#7259B5" : em ? "#E3E1E1" : "#FFFFFF"} stroke={escolhido ? "#FFFFFF" : "#282525"} strokeOpacity={escolhido ? 1 : 0.35}
              strokeWidth={escolhido ? 1.2 : 0.8} strokeLinejoin="round" className="cursor-pointer outline-none transition-colors duration-150 focus-visible:stroke-[#7259B5] focus-visible:[stroke-opacity:1] focus-visible:[stroke-width:2]"
              onClick={() => onChange(estado.uf)} onMouseEnter={() => setSobre(estado.uf)} onMouseLeave={() => setSobre(null)} onFocus={() => setSobre(estado.uf)} onBlur={() => setSobre(null)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onChange(estado.uf); } }} />
          );
        })}
      </svg>
      <p className="mt-2 h-5 text-center text-[0.8125rem] text-black/55" aria-live="polite">{nome || "Toque em um estado"}</p>
    </div>
  );
}
