"use client";

// A etapa do envio (final ou parcial) e, na prestação anual da saúde (P9.2),
// o exercício. Usado na aba Envio e no pacote.

import { Dropdown } from "@/components/ui/Dropdown";
import { rotuloDaEtapa, type ExercicioDaPrestacao } from "@/lib/prestacao/exercicios";
import type { EtapaEnvio } from "@/lib/prestacao/envio";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export function EtapaDoEnvio({ etapas, etapa, onEtapa, regime, exercicios, exercicio, onExercicio, enviados }: {
  etapas: readonly EtapaEnvio[];
  etapa: EtapaEnvio;
  onEtapa: (etapa: EtapaEnvio) => void;
  regime: RegimeNormativo | null;
  /** Exercícios com prestação anual própria; vazio fora da saúde. */
  exercicios: readonly ExercicioDaPrestacao[];
  exercicio: number;
  onExercicio: (ano: number) => void;
  /** Exercícios com a prestação anual valendo. */
  enviados: readonly number[];
}) {
  const comExercicio = etapa === "parcial" && exercicios.length > 0;
  if (etapas.length < 2 && !comExercicio) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {etapas.length > 1 && (
        <div role="radiogroup" aria-label="Etapa do envio" className="flex rounded border bg-white p-0.5" style={BORDA}>
          {etapas.map(e => {
            const ativa = etapa === e;
            return (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={ativa}
                onClick={() => onEtapa(e)}
                className="h-8 rounded px-3 text-[0.6875rem] transition focus-visible:outline-2 focus-visible:outline-[#7259B5]"
                style={ativa ? { background: "#684DB0", color: "#fff" } : { color: "rgba(13,13,13,.6)" }}
              >
                {rotuloDaEtapa(e, regime)}
              </button>
            );
          })}
        </div>
      )}
      {comExercicio && (
        <div className="w-[16.5rem] max-w-full">
          <Dropdown
            value={String(exercicio)}
            onChange={v => onExercicio(Number(v))}
            ariaLabel="Exercício da prestação anual"
            options={exercicios.map(e => ({
              value: String(e.ano),
              label: `Exercício ${e.ano} · ${enviados.includes(e.ano) ? "enviada" : `até ${dataBr(e.prazo)}`}`,
            }))}
          />
        </div>
      )}
    </div>
  );
}
