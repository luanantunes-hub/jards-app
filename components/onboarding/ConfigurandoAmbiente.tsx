"use client";

import { useEffect, useState } from "react";
import { progressoDaConfiguracao } from "@/lib/exemplos/elegibilidade";

const TEMPO_MINIMO_MS = 2200;
const PAUSA_NO_FIM_MS = 450;

/**
 * Tela cheia, escura e opaca enquanto o Jards prepara o ambiente da conta nova. A barra anda sozinha até perto do
 * fim e só completa quando `pronto` chega (e depois de um tempo mínimo, para não piscar); aí chama `onTerminar`.
 */
export function ConfigurandoAmbiente({ pronto, onTerminar }: { pronto: boolean; onTerminar: () => void }) {
  const [progresso, setProgresso] = useState(0);
  const [minimoCumprido, setMinimoCumprido] = useState(false);

  useEffect(() => {
    const inicio = performance.now();
    const intervalo = window.setInterval(() => setProgresso(atual => Math.max(atual, progressoDaConfiguracao(performance.now() - inicio))), 100);
    const minimo = window.setTimeout(() => setMinimoCumprido(true), TEMPO_MINIMO_MS);
    return () => { window.clearInterval(intervalo); window.clearTimeout(minimo); };
  }, []);

  const completo = pronto && minimoCumprido;

  useEffect(() => {
    if (!completo) return;
    const fim = window.setTimeout(onTerminar, PAUSA_NO_FIM_MS);
    return () => window.clearTimeout(fim);
  }, [completo, onTerminar]);

  const valor = completo ? 100 : Math.round(progresso);

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="configurando-titulo" className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-[#1C0E33] px-6">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valor}
        aria-label="Progresso da configuração"
        className="h-1 w-full max-w-[17.5rem] overflow-hidden rounded-full bg-white/[.14]"
      >
        <div
          className="h-full rounded-full bg-white/90 transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${valor}%` }}
        />
      </div>
      <p id="configurando-titulo" className="text-[0.8125rem] font-medium tracking-[.01em] text-white/60">Configurando o ambiente</p>
    </div>
  );
}
