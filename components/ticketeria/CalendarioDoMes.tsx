"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { INICIAIS_DOS_DIAS, NOMES_DOS_MESES, dataPorExtenso, mesDaData, semanasDoMes, somarMeses } from "@/lib/ticketeria/calendario";

const SETA = "flex h-10 w-10 items-center justify-center rounded-xl text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:pointer-events-none disabled:opacity-25";

/**
 * O calendário do mês, sempre aberto na tela (nada de abrir um seletor): setas para mudar de mês e um toque no dia. Os dias que já passaram ficam
 * apagados; o escolhido fica roxo (seleção) e o de hoje ganha um traço. `hoje` é a data de Brasília (AAAA-MM-DD).
 */
export function CalendarioDoMes({ valor, hoje, onChange }: { valor: string; hoje: string; onChange: (data: string) => void }) {
  const [visto, setVisto] = useState(() => mesDaData(valor || hoje));
  const doMesDeHoje = mesDaData(hoje);
  const noMesAtual = visto.ano === doMesDeHoje.ano && visto.mes === doMesDeHoje.mes;
  const semanas = semanasDoMes(visto.ano, visto.mes, hoje);
  return (
    <div className="mx-auto w-full max-w-[26rem]">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className={SETA} aria-label="Mês anterior" disabled={noMesAtual} onClick={() => setVisto(somarMeses(visto.ano, visto.mes, -1))}><ChevronLeft size={18} aria-hidden="true" /></button>
        <p className="text-[1.0625rem] text-[#1C0E33] first-letter:uppercase" aria-live="polite">{NOMES_DOS_MESES[visto.mes]} de {visto.ano}</p>
        <button type="button" className={SETA} aria-label="Próximo mês" onClick={() => setVisto(somarMeses(visto.ano, visto.mes, 1))}><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
      <div className="grid grid-cols-7 gap-y-1" role="grid" aria-label={`${NOMES_DOS_MESES[visto.mes]} de ${visto.ano}`}>
        {INICIAIS_DOS_DIAS.map((inicial, i) => <span key={i} className="pb-1 text-center text-[0.6875rem] uppercase tracking-[.08em] text-black/35" aria-hidden="true">{inicial}</span>)}
        {semanas.flat().map((dia, i) => {
          if (!dia) return <span key={`vazio-${i}`} />;
          const escolhido = dia.data === valor;
          return (
            <button key={dia.data} type="button" disabled={dia.passou} aria-pressed={escolhido} aria-label={dataPorExtenso(dia.data)} aria-current={dia.hoje ? "date" : undefined}
              onClick={() => onChange(dia.data)}
              className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full text-[0.9375rem] tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-95 disabled:pointer-events-none disabled:text-black/20 ${
                escolhido ? "bg-[#7259B5] text-white" : dia.hoje ? "text-[#1C0E33] ring-1 ring-inset ring-black/25 hover:bg-black/[.05]" : "text-[#282525] hover:bg-black/[.05]"}`}>
              {dia.dia}
            </button>
          );
        })}
      </div>
      <p className="mt-3 h-5 text-center text-[0.8125rem] text-black/55">{valor ? dataPorExtenso(valor) : "Toque no dia"}</p>
    </div>
  );
}
