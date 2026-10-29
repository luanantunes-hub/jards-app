"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VideoCamera, Plus } from "@phosphor-icons/react";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { NovaReuniaoModal } from "@/components/modals/NovaReuniaoModal";

type Reuniao = {
  id: string;
  titulo: string;
  plataforma: "google_meet" | "teams";
  status: "agendada" | "bot_entrando" | "gravando" | "processando" | "concluida" | "falhou";
  created_at: string;
};

const STATUS_LABEL: Record<Reuniao["status"], { label: string; color: string }> = {
  agendada:     { label: "Agendada",   color: "#2D72B0" },
  bot_entrando: { label: "Entrando",   color: "#B07A14" },
  gravando:     { label: "Gravando",   color: "#D94A4A" },
  processando:  { label: "Processando", color: "#B07A14" },
  concluida:    { label: "Concluída",  color: "#2E8932" },
  falhou:       { label: "Falhou",     color: "#D94A4A" },
};

const PLATAFORMA_LABEL: Record<Reuniao["plataforma"], string> = {
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
};

export default function ReunioesPage() {
  const router = useRouter();
  const organizationId = useOrganizationId();
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  const carregar = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const res = await fetch(`/api/reunioes?organization_id=${organizationId}`);
    const data = await res.json().catch(() => ({ reunioes: [] }));
    setReunioes(data.reunioes ?? []);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { void carregar(); }, [carregar]);

  return (
    <div className="px-8 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-bold text-[#0D0D0D] text-[28px]">Reuniões</h1>
          <p className="mt-1 text-[13px] text-black/45">O assistente entra na reunião, grava e transcreve — consulte depois.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          disabled={!organizationId}
          className="flex items-center gap-2 rounded bg-[#0D0D0D] px-4 py-2.5 text-sm text-white transition hover:opacity-90 disabled:opacity-40"
        >
          <Plus size={14} weight="bold" />
          Enviar assistente
        </button>
      </div>

      <div className="bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#F9F9F8" }}>
                {["Título", "Plataforma", "Status", "Data"].map((label) => (
                  <th key={label} className="px-4 py-3 text-left">
                    <span className="text-[10px] font-bold text-black/35 uppercase tracking-wider">{label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3" colSpan={4}><div className="h-6 bg-black/8 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : reunioes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-20 text-center text-sm text-black/35">
                    <VideoCamera size={28} className="mx-auto mb-2 text-black/15" />
                    Nenhuma reunião ainda. Envie o assistente pra uma reunião de Meet ou Teams.
                  </td>
                </tr>
              ) : (
                reunioes.map((r) => {
                  const st = STATUS_LABEL[r.status];
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-black/[0.025] transition-colors cursor-pointer"
                      onClick={() => router.push(`/reunioes/${r.id}`)}
                    >
                      <td className="px-4 py-3 font-semibold text-[#0D0D0D] text-[13px]">{r.titulo}</td>
                      <td className="px-4 py-3 text-black/50 text-[12.5px]">{PLATAFORMA_LABEL[r.plataforma]}</td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded border bg-white px-2 py-1 text-[10px] font-medium"
                          style={{ borderColor: st.color + "47", color: st.color }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-black/50 text-[12.5px]">
                        {new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && organizationId && (
        <NovaReuniaoModal
          organizationId={organizationId}
          onClose={() => setModalAberto(false)}
          onCreated={(id) => { setModalAberto(false); router.push(`/reunioes/${id}`); }}
        />
      )}
    </div>
  );
}
