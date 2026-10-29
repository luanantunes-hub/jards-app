"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { gradeDaSemana, gradeDoMes, inicioDaSemana, rotuloDoMes, somarDias, somarMes, ROTULO_DO_TIPO_DE_DATA, type DataDaAgenda, type DiaDoCalendario } from "@/lib/producao/agenda";

const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const BOTAO_NAVEGAR = "flex h-9 w-9 items-center justify-center rounded border border-black/[.12] bg-white text-black/55 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";

/** Cor do traço de cada situação (texto e borda fina, nunca fundo colorido). */
function estiloDaData(item: DataDaAgenda): React.CSSProperties {
  if (item.situacao === "cancelada") return { borderColor: "rgba(13,13,13,.12)", color: "rgba(13,13,13,.45)", textDecoration: "line-through" };
  if (item.situacao === "opcao") return { borderColor: "#B07A1447", color: "#B07A14" };
  return { borderColor: "#2E893247", color: "#2E8932" };
}

function Pastilha({ item }: { item: DataDaAgenda }) {
  return (
    <p className="truncate rounded border bg-white px-1.5 py-0.5 text-[0.625rem] font-medium" style={estiloDaData(item)} title={[ROTULO_DO_TIPO_DE_DATA[item.tipo], item.temporada_titulo].filter(Boolean).join(" · ")}>
      {ROTULO_DO_TIPO_DE_DATA[item.tipo]}
    </p>
  );
}

function Dia({ dia, hoje, comoSemana }: { dia: DiaDoCalendario; hoje: string; comoSemana: boolean }) {
  const ehHoje = dia.data === hoje;
  return (
    <div className={`min-w-0 border-t border-l border-black/[.07] p-1.5 ${comoSemana ? "min-h-[9rem]" : "min-h-[5.5rem]"} ${ehHoje ? "bg-black/[.04]" : dia.doMes ? "bg-white" : "bg-black/[.015]"}`}>
      <p className={`mb-1 text-[0.6875rem] tabular-nums ${ehHoje ? "font-semibold text-[#282525]" : dia.doMes ? "text-black/55" : "text-black/30"}`} aria-label={ehHoje ? "Hoje" : undefined}>{Number(dia.data.slice(8))}</p>
      <div className="space-y-1">{dia.datas.map(item => <Pastilha key={item.id} item={item} />)}</div>
    </div>
  );
}

/** Calendário de mês ou de semana das datas da agenda. O dia de hoje fica em cinza neutro. */
export function CalendarioDaAgenda({ datas, modo, hoje }: { datas: readonly DataDaAgenda[]; modo: "mes" | "semana"; hoje: string }) {
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [semana, setSemana] = useState(inicioDaSemana(hoje));

  const titulo = modo === "mes"
    ? rotuloDoMes(mes)
    : `${Number(semana.slice(8))} a ${Number(somarDias(semana, 6).slice(8))} de ${rotuloDoMes(somarDias(semana, 6).slice(0, 7))}`;
  const voltar = () => (modo === "mes" ? setMes(atual => somarMes(atual, -1)) : setSemana(atual => somarDias(atual, -7)));
  const avancar = () => (modo === "mes" ? setMes(atual => somarMes(atual, 1)) : setSemana(atual => somarDias(atual, 7)));
  const irParaHoje = () => { setMes(hoje.slice(0, 7)); setSemana(inicioDaSemana(hoje)); };

  const semanas = modo === "mes" ? gradeDoMes(mes, datas) : [gradeDaSemana(semana, datas)];

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={voltar} aria-label={modo === "mes" ? "Mês anterior" : "Semana anterior"} className={BOTAO_NAVEGAR}><ChevronLeft size={14} aria-hidden="true" /></button>
        <button type="button" onClick={avancar} aria-label={modo === "mes" ? "Próximo mês" : "Próxima semana"} className={BOTAO_NAVEGAR}><ChevronRight size={14} aria-hidden="true" /></button>
        <h2 className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold first-letter:uppercase text-[#282525]">{titulo}</h2>
        <button type="button" onClick={irParaHoje} className="h-9 rounded border border-black/[.12] bg-white px-3 text-[0.75rem] font-medium text-black/60 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Hoje</button>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[40rem] overflow-hidden rounded border border-black/[.08] border-t-0 border-l-0 bg-white">
          <div className="grid grid-cols-7">
            {DIAS_DA_SEMANA.map(nome => (
              <p key={nome} className="border-t border-l border-black/[.07] px-2 py-1.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{nome}</p>
            ))}
          </div>
          {semanas.map((linha, i) => (
            <div key={i} className="grid grid-cols-7">
              {linha.map(dia => <Dia key={dia.data} dia={dia} hoje={hoje} comoSemana={modo === "semana"} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
