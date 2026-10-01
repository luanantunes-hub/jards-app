"use client";
import { useId, useState } from "react";
import { X, RotateCw, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useModalDismiss } from "@/hooks/useModalDismiss";

type Props = {
  tipo: "captacao" | "inscricao";
  id: string;
  anoNovo: number;
  resultadoNegativo?: boolean;
  dataRetomadaInicial?: string | null;
  notaInicial?: string | null;
  resultadoLabel?: string;
  onClose: () => void;
  onRenovado: (novoId: string) => void;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 flex items-center text-[12px] font-semibold text-black">{children}</label>;
}

function sugestaoData(): string {
  const d = new Date(Date.now() + 60 * 86_400_000);
  return d.toISOString().split("T")[0];
}

export function RenovarCicloModal({ tipo, id, anoNovo, resultadoNegativo = false, dataRetomadaInicial, notaInicial, resultadoLabel, onClose, onRenovado }: Props) {
  const supabase = createClient();
  const [dataRetomada, setDataRetomada] = useState(dataRetomadaInicial?.slice(0, 10) ?? sugestaoData());
  const [cicloEscolhido, setCicloEscolhido] = useState(anoNovo);
  const [nota, setNota] = useState(notaInicial ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const titleId = useId();
  useModalDismiss(onClose);

  const label = tipo === "captacao" ? "negociação" : "inscrição";
  const acao = resultadoNegativo ? "Abrir novo ciclo" : "Renovar";

  async function handleConfirmar() {
    setSalvando(true);
    setErro(null);
    const fn = tipo === "captacao" ? "fn_renovar_captacao" : "fn_renovar_inscricao";
    const paramId = tipo === "captacao" ? "p_captacao_id" : "p_inscricao_id";
    const { data, error } = await (supabase as any).rpc(fn, {
      [paramId]: id,
      p_data_retomada: dataRetomada ? new Date(`${dataRetomada}T09:00:00`).toISOString() : null,
      p_ciclo_ano: cicloEscolhido,
      p_nota: nota.trim() || null,
    });
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onRenovado(data.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center" style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[96dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-b bg-white"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,.12)", borderBottom: "1px solid rgba(13,13,13,.08)", borderLeft: "1px solid rgba(13,13,13,.06)", borderRight: "1px solid rgba(13,13,13,.06)" }}
        onClick={e => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-black/5">
              <RotateCw size={16} className="text-black/50" />
            </div>
            <h2 id={titleId} className="text-[15px] font-bold text-black">{acao} — Ciclo {cicloEscolhido}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-black/[.06]">
            <X size={15} className="text-black/40" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-4">
            <FieldLabel>Ciclo</FieldLabel>
            <input
              type="number"
              value={cicloEscolhido}
              onChange={e => setCicloEscolhido(e.target.value ? Number(e.target.value) : anoNovo)}
              className="w-full rounded border bg-white px-3 py-2.5 text-[13px] text-black outline-none transition focus:border-black/30"
              style={{ borderColor: "rgba(13,13,13,.15)" }}
            />
            <p className="mt-1.5 text-[10px] text-black/35">Anual é a sugestão padrão — ajuste livremente se o ciclo for semestral, bianual ou outra cadência.</p>
          </div>
          <div>
            <FieldLabel>Retomar contato em</FieldLabel>
            <input
              type="date"
              value={dataRetomada}
              onChange={e => setDataRetomada(e.target.value)}
              className="w-full rounded border bg-white px-3 py-2.5 text-[13px] text-black outline-none transition focus:border-black/30"
              style={{ borderColor: "rgba(13,13,13,.15)" }}
            />
          </div>
          <div className="mt-4">
            <FieldLabel>Resultado do ciclo</FieldLabel>
            <div className="rounded border bg-black/[.025] px-3 py-2.5 text-[13px] font-medium text-black/55" style={{ borderColor: "rgba(13,13,13,.10)" }}>
              {resultadoLabel ?? (tipo === "captacao" ? "Recusado" : "Reprovado")}
            </div>
          </div>
          <div className="mt-4">
            <FieldLabel>Nota para a retomada</FieldLabel>
            <textarea
              value={nota}
              onChange={event => setNota(event.target.value)}
              rows={3}
              placeholder="Contexto, aprendizados e próximo passo"
              className="w-full resize-none rounded border bg-white px-3 py-2.5 text-[13px] text-black outline-none transition focus:border-black/30"
              style={{ borderColor: "rgba(13,13,13,.15)" }}
            />
          </div>
        </main>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t px-5 py-3.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          {erro ? <p role="alert" className="min-w-0 text-[11px] font-medium text-[#D94E4E]">{erro}</p> : <div />}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[12px] font-semibold text-black/35 transition hover:text-black/55">
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={salvando}
              className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#26752A] active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save size={12} /> {salvando ? `${acao === "Renovar" ? "Renovando" : "Abrindo novo ciclo"}…` : acao}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
