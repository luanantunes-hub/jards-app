"use client";

import { CalendarClock, Circle, CircleCheck, Clock } from "lucide-react";
import type { PrestacaoContas } from "@/lib/supabase/types";
import { quandoVence, type PrazoDaPrestacao } from "@/lib/prestacao/prontidao";

const dataCurta = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

const MARCOS: { campo: keyof PrestacaoContas; rotulo: string }[] = [
  { campo: "data_aprovacao", rotulo: "Aprovação" },
  { campo: "data_liberacao", rotulo: "Liberação para execução" },
  { campo: "data_termo", rotulo: "Termo ou contrato" },
  { campo: "data_inicio_execucao", rotulo: "Início da execução" },
  { campo: "data_fim_execucao", rotulo: "Fim da execução" },
  { campo: "data_conclusao_objeto", rotulo: "Conclusão do objeto" },
  { campo: "data_envio", rotulo: "Envio da prestação" },
];

/** Só o prazo do proponente vencido ou perto de vencer é alerta: pinta o ícone, não o texto. */
function alertaDoPrazo(prazo: PrazoDaPrestacao): string | null {
  if (prazo.quem === "proponente" && prazo.dias < 0) return "#D94A4A";
  if (prazo.quem === "proponente" && prazo.dias <= 15) return "#B07A14";
  return null;
}

/** Prazos em aberto (do proponente e do órgão), com a contagem regressiva. */
export function ProximosPrazos({ prazos }: { prazos: PrazoDaPrestacao[] }) {
  return (
    <section aria-labelledby="prazos-titulo" className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <h2 id="prazos-titulo" className="flex items-center gap-1.5 border-b px-4 py-3 text-[0.6875rem] font-semibold text-black/55" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <CalendarClock size={13} aria-hidden /> Próximos prazos
      </h2>
      {prazos.length === 0 ? (
        <p className="px-4 py-4 text-[0.6875rem] text-black/40">Nenhum prazo em aberto.</p>
      ) : (
        <ul className="divide-y divide-black/[.05] px-4">
          {prazos.map(prazo => {
            const alerta = alertaDoPrazo(prazo);
            return (
              <li key={`${prazo.rotulo}-${prazo.data}`} className="py-2.5">
                <p className="text-[0.6875rem] font-medium text-black/70">{prazo.rotulo}</p>
                <p className="flex items-center gap-1 text-[0.6875rem] tabular-nums text-black/70">
                  {alerta && <Clock size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0" style={{ color: alerta }} />}
                  {dataCurta(prazo.data)} · {quandoVence(prazo.dias)}
                </p>
                <p className="text-[0.625rem] text-black/35">{prazo.quem === "orgao" ? "Cabe ao órgão" : "Cabe ao proponente"}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Linha do tempo dos marcos da prestação, com o prazo de envio no lugar. */
export function MarcosDaPrestacao({ prestacao, hoje }: { prestacao: PrestacaoContas; hoje: string }) {
  const marcos = [
    ...MARCOS.map(m => ({ rotulo: m.rotulo, data: (prestacao[m.campo] as string | null | undefined) ?? null, prazo: false })),
    { rotulo: "Prazo de envio", data: prestacao.prazo, prazo: true },
  ];
  const preenchidos = marcos.filter(m => m.data).sort((a, b) => (a.data as string).localeCompare(b.data as string));
  const vazios = marcos.filter(m => !m.data);
  return (
    <section aria-labelledby="marcos-titulo" className="rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <h2 id="marcos-titulo" className="border-b px-4 py-3 text-[0.6875rem] font-semibold text-black/55" style={{ borderColor: "rgba(13,13,13,.07)" }}>Marcos</h2>
      <ol className="px-4 py-3">
        {preenchidos.map((marco, i) => {
          const passou = (marco.data as string) <= hoje;
          const Icone = marco.prazo ? CalendarClock : passou ? CircleCheck : Circle;
          return (
            <li key={marco.rotulo} className="relative flex gap-3 pb-3 last:pb-0">
              {i < preenchidos.length - 1 && <span className="absolute bottom-0 left-1.5 top-4 w-px -translate-x-1/2 bg-black/[.08]" aria-hidden />}
              <Icone size={12} strokeWidth={1.75} aria-hidden="true" className={`mt-0.5 shrink-0 ${passou || marco.prazo ? "text-black/40" : "text-black/25"}`} />
              <div className="min-w-0">
                <p className={`text-[0.6875rem] text-black/70 ${marco.prazo ? "font-medium" : ""}`}>{marco.rotulo}</p>
                <p className="text-[0.625rem] tabular-nums text-black/45">{dataCurta(marco.data as string)}{passou ? "" : " · a vir"}</p>
              </div>
            </li>
          );
        })}
        {preenchidos.length === 0 && <li className="text-[0.6875rem] text-black/40">Nenhum marco preenchido.</li>}
      </ol>
      {vazios.length > 0 && (
        <p className="border-t px-4 py-2.5 text-[0.625rem] leading-4 text-black/40" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          Sem data: {vazios.map(m => m.rotulo.toLowerCase()).join(", ")}.
        </p>
      )}
    </section>
  );
}
