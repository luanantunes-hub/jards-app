"use client";

import { AlertTriangle, CheckCircle2, FileText, Info, XCircle } from "lucide-react";
import type { NivelVerificacao, Verificacao } from "@/lib/prestacao/alteracoes";

const NIVEL: Record<NivelVerificacao, { rotulo: string; cor: string; Icone: typeof Info }> = {
  bloqueio: { rotulo: "Impede", cor: "#B23B3B", Icone: XCircle },
  formal: { rotulo: "Pedido ao órgão", cor: "#9A6A10", Icone: FileText },
  alerta: { rotulo: "Atenção", cor: "#9A6A10", Icone: AlertTriangle },
  ok: { rotulo: "Dispensa pedido", cor: "#2E8932", Icone: CheckCircle2 },
  info: { rotulo: "Para saber", cor: "#2D72B0", Icone: Info },
};

const ORDEM: NivelVerificacao[] = ["bloqueio", "formal", "ok", "alerta", "info"];

/** Verificações do cálculo, cada uma com o nível em texto e ícone e a fonte. */
export function VerificacoesAlteracao({ verificacoes }: { verificacoes: Verificacao[] }) {
  const ordenadas = [...verificacoes].sort((a, b) => ORDEM.indexOf(a.nivel) - ORDEM.indexOf(b.nivel));
  return (
    <ul className="space-y-2.5">
      {ordenadas.map(v => {
        const { rotulo, cor, Icone } = NIVEL[v.nivel];
        return (
          <li key={v.codigo} className="flex gap-2">
            <Icone size={13} className="mt-0.5 shrink-0" style={{ color: cor }} aria-hidden />
            <div className="min-w-0">
              <p className="text-[0.6875rem] leading-4 text-black/75">
                <span className="font-medium" style={{ color: cor }}>{rotulo}. </span>{v.texto}
              </p>
              {v.fonte && <p className="mt-0.5 text-[0.625rem] leading-4 text-black/40">{v.fonte}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
