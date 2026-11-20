"use client";

import { AlertTriangle, CheckCircle2, FileText, Info, XCircle } from "lucide-react";
import type { NivelVerificacao, Verificacao } from "@/lib/prestacao/alteracoes";

// Só os níveis que pedem atenção colorem o ícone; o rótulo fica sempre neutro.
const NIVEL: Record<NivelVerificacao, { rotulo: string; corIcone: string; Icone: typeof Info }> = {
  bloqueio: { rotulo: "Impede", corIcone: "text-[#D94A4A]", Icone: XCircle },
  formal: { rotulo: "Pedido ao órgão", corIcone: "text-black/40", Icone: FileText },
  alerta: { rotulo: "Atenção", corIcone: "text-[#B07A14]", Icone: AlertTriangle },
  ok: { rotulo: "Dispensa pedido", corIcone: "text-black/40", Icone: CheckCircle2 },
  info: { rotulo: "Para saber", corIcone: "text-black/40", Icone: Info },
};

const ORDEM: NivelVerificacao[] = ["bloqueio", "formal", "ok", "alerta", "info"];

/** Verificações do cálculo, cada uma com o nível em texto e ícone e a fonte. */
export function VerificacoesAlteracao({ verificacoes }: { verificacoes: Verificacao[] }) {
  const ordenadas = [...verificacoes].sort((a, b) => ORDEM.indexOf(a.nivel) - ORDEM.indexOf(b.nivel));
  return (
    <ul className="space-y-2.5">
      {ordenadas.map(v => {
        const { rotulo, corIcone, Icone } = NIVEL[v.nivel];
        return (
          <li key={v.codigo} className="flex gap-2">
            <Icone size={12} strokeWidth={1.75} className={`mt-0.5 shrink-0 ${corIcone}`} aria-hidden />
            <div className="min-w-0">
              <p className="text-[0.6875rem] leading-4 text-black/75">
                <span className="font-medium">{rotulo}. </span>{v.texto}
              </p>
              {v.fonte && <p className="mt-0.5 text-[0.625rem] leading-4 text-black/40">{v.fonte}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
