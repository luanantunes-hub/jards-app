"use client";
import type { PotencialFechamento } from "@/lib/supabase/types";

// Mesmas cores do kanban de potencial e da tabela de negociações: Alto é bom (verde), Baixo é alerta (vermelho).
const NIVEIS: { value: PotencialFechamento; label: string; cor: string; barras: 1 | 2 | 3 }[] = [
  { value: "baixo", label: "Baixo", cor: "#D94E4E", barras: 1 },
  { value: "medio", label: "Médio", cor: "#B07A14", barras: 2 },
  { value: "alto", label: "Alto", cor: "#2E8932", barras: 3 },
];

function Barras({ nivel }: { nivel: 1 | 2 | 3 }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
      <rect x="1" y="7" width="2.6" height="4" fill="currentColor" />
      <rect x="4.7" y="4" width="2.6" height="7" fill="currentColor" opacity={nivel >= 2 ? 1 : 0.3} />
      <rect x="8.4" y="1" width="2.6" height="10" fill="currentColor" opacity={nivel >= 3 ? 1 : 0.3} />
    </svg>
  );
}

/**
 * Potencial de fechamento: três segmentos retos por dentro, com o arredondamento só nos
 * cantos de fora do grupo. A cor aparece apenas no selecionado, que preenche o segmento todo.
 */
export function PotencialSegmentado({ value, onChange }: {
  value: PotencialFechamento;
  onChange: (value: PotencialFechamento) => void;
}) {
  return (
    <div className="flex w-fit" role="radiogroup" aria-label="Potencial de fechamento">
      {NIVEIS.map((nivel, index) => {
        const selecionado = value === nivel.value;
        return (
          <button
            key={nivel.value}
            type="button"
            role="radio"
            aria-checked={selecionado}
            onClick={() => onChange(nivel.value)}
            className={`relative flex min-h-9 items-center justify-center gap-1.5 border px-4 text-[0.6875rem] font-medium transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${index > 0 ? "-ml-px" : ""} ${index === 0 ? "rounded-l" : ""} ${index === NIVEIS.length - 1 ? "rounded-r" : ""} ${selecionado ? "z-10 text-white" : "bg-white text-black/55 hover:bg-black/[.04] hover:text-black/75"}`}
            style={selecionado ? { background: nivel.cor, borderColor: nivel.cor } : { borderColor: "rgba(13,13,13,.12)" }}
          >
            <Barras nivel={nivel.barras} />
            {nivel.label}
          </button>
        );
      })}
    </div>
  );
}
