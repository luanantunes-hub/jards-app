"use client";

import { useEffect, useState } from "react";
import { partesDaContagem } from "@/lib/ticketeria/contagem";

/** A contagem regressiva do site: dias, horas e minutos até `ate` (ISO); passado o instante, a frase `depois`. `inicial` é a hora do servidor (a primeira pintura é a mesma no servidor e no navegador); depois, o relógio do visitante, a cada 30 segundos. */
export function ContagemRegressiva({ titulo, ate, depois, inicial }: { titulo: string; ate: string; depois: string; inicial: number }) {
  const [agora, setAgora] = useState(inicial);
  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(relogio);
  }, []);
  const p = partesDaContagem(Date.parse(ate), agora);
  return (
    <section aria-label={titulo || "Contagem regressiva"} className="rounded-xl border border-black/10 px-4 py-5 text-center">
      {titulo && <h2 className="mb-1 text-[0.8125rem] font-normal opacity-60">{titulo}</h2>}
      {p === null
        ? <p className="text-[1.125rem] font-medium tracking-[-.01em]">{depois || "Já começou"}</p>
        : <p className="text-[1.5rem] font-medium tabular-nums tracking-[-.02em]" role="timer" aria-live="off">{p.dias > 0 ? `${p.dias} ${p.dias === 1 ? "dia" : "dias"} · ` : ""}{String(p.horas).padStart(2, "0")} h · {String(p.minutos).padStart(2, "0")} min</p>}
    </section>
  );
}
