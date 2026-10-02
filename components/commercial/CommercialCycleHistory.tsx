"use client";

import { CalendarClock, Check, RotateCw, X } from "lucide-react";

export type CommercialCycle = {
  id: string;
  ciclo_ano: number;
  proximo_ciclo_ano: number;
  status_final: string;
  resultado: string | null;
  nota: string | null;
  valor_solicitado: number | null;
  valor_aprovado: number | null;
  potencial_fechamento: string | null;
  encerrado_em: string;
  retomada_programada_em: string;
  reaberto_em: string | null;
  cancelado_em: string | null;
  estado: "programado" | "reaberto" | "cancelado";
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatMoney(value: number | null) {
  if (value == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

const STATUS_LABEL: Record<string, string> = {
  recusado: "Recusado",
  reprovado: "Reprovado",
  cancelado: "Cancelado",
};

export function CommercialCycleHistory({ cycles }: { cycles: CommercialCycle[] }) {
  if (!cycles.length) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[0.6875rem] font-bold uppercase tracking-[.12em] text-black/35">Histórico de ciclos</h2>
        <span className="text-[0.625rem] text-black/25">{cycles.length}</span>
      </div>
      <div className="overflow-hidden rounded border border-black/[.08] bg-white">
        {cycles.map(cycle => {
          const Icon = cycle.estado === "programado" ? CalendarClock : cycle.estado === "reaberto" ? RotateCw : X;
          const amount = formatMoney(cycle.valor_aprovado ?? cycle.valor_solicitado);
          return (
            <div key={cycle.id} className="flex items-start gap-3 border-b border-black/[.06] px-4 py-3.5 last:border-b-0">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-black/35">
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[0.8125rem] font-semibold text-black/70">Ciclo {cycle.ciclo_ano}</p>
                  <span className="text-[0.625rem] font-medium text-black/35">
                    {cycle.estado === "programado" ? `Retomar em ${formatDate(cycle.retomada_programada_em)}` : cycle.estado === "reaberto" ? `Retomado em ${formatDate(cycle.reaberto_em)}` : "Retomada cancelada"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.625rem] text-black/35">
                  <span className="inline-flex items-center gap-1"><Check size={10} />{STATUS_LABEL[cycle.status_final] ?? cycle.status_final}</span>
                  <span>Encerrado em {formatDate(cycle.encerrado_em)}</span>
                  {amount && <span>{amount}</span>}
                  <span>Próximo ciclo {cycle.proximo_ciclo_ano}</span>
                </div>
                {cycle.nota && <p className="mt-2 text-[0.6875rem] leading-5 text-black/45">{cycle.nota}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

