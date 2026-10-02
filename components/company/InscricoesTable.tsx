"use client";
import { useRouter } from "next/navigation";
import { Plus, FileStack } from "lucide-react";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import StatusBadge from "@/components/ui/StatusBadge";

export type EditalRow = {
  id: string;
  titulo: string | null;
  status: string;
  created_at: string;
  valor: number | null;
  data_fechamento: string | null;
  updated_at: string;
  projeto: { id: string; nome: string; created_at: string } | null;
};

const EDITAL_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  interesse:  { label: "Interesse",  color: "rgba(13,13,13,.45)" },
  inscrito:   { label: "Inscrito",   color: "#2D72B0" },
  em_analise: { label: "Em análise", color: "#B07A14" },
  aprovado:   { label: "Aprovado",   color: "#2E8932" },
  reprovado:  { label: "Reprovado",  color: "#D94E4E" },
  cancelado:  { label: "Cancelado",  color: "rgba(13,13,13,.40)" },
};

function fmtCurrency(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(`${value.split("T")[0]}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function daysSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

export function InscricoesTable({ rows, onNew }: { rows: EditalRow[]; onNew?: () => void }) {
  const router = useRouter();
  const { etiquetasInscricao } = useEtiquetas();
  const etiquetaMeta = Object.fromEntries(etiquetasInscricao.map(etiqueta => [etiqueta.key, etiqueta]));
  return (
    <section className="overflow-hidden rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <header className="flex flex-col gap-4 border-b px-5 py-5 md:flex-row md:items-end md:justify-between md:px-6" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <div>
          <p className="text-[0.625rem] font-bold uppercase tracking-[.12em] text-black/35">Editais</p>
          <h2 className="mt-1 text-[1.3125rem] font-semibold tracking-[-.02em] text-black">Inscrições</h2>
        </div>
        {onNew && (
          <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded border border-black/[.12] bg-white px-3.5 py-2 text-[0.75rem] font-medium text-black/55 hover:bg-black/[.04]">
            <Plus size={12} />Nova inscrição
          </button>
        )}
      </header>
      {!rows.length ? (
        <div className="px-5 py-20 text-center">
          <FileStack size={24} className="mx-auto text-black/15" />
          <p className="mt-4 text-[0.875rem] font-semibold text-black/45">Nenhuma inscrição registrada</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[58.75rem] border-collapse text-left">
            <thead>
              <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                {["Edital", "Projeto", "Status", "Valor", "Fechamento", "Último avanço"].map(label => (
                  <th key={label} className="px-5 py-3 text-[0.625rem] font-medium text-black/30">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[.06]">
              {rows.map(row => {
                const etiqueta = etiquetaMeta[row.status];
                const s = etiqueta
                  ? { label: etiqueta.label, color: etiqueta.cor, iconName: etiqueta.icone }
                  : { ...(EDITAL_STATUS_LABEL[row.status] ?? { label: row.status.replaceAll("_", " "), color: "#888888" }), iconName: undefined };
                return (
                  <tr
                    key={row.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Abrir inscrição ${row.titulo || "Edital sem título"}`}
                    onClick={() => router.push(`/editais-inscritos/${row.id}`)}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/editais-inscritos/${row.id}`);
                      }
                    }}
                    className="cursor-pointer transition hover:bg-black/[.018] focus-visible:bg-black/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/15"
                  >
                    <td className="px-5 py-4">
                      <span className="text-[0.8125rem] font-semibold text-black/75">
                        {row.titulo || "Edital sem título"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[0.6875rem] text-black/45">{row.projeto?.nome || "—"}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={row.status} label={s.label} bg={s.color} iconName={s.iconName} size="sm" />
                    </td>
                    <td className="px-5 py-4 text-[0.75rem] font-semibold tabular-nums text-black/65">{fmtCurrency(row.valor)}</td>
                    <td className="px-5 py-4 text-[0.6875rem] tabular-nums text-black/45">{fmtDate(row.data_fechamento)}</td>
                    <td className="px-5 py-4 text-[0.6875rem] text-black/45">há {daysSince(row.updated_at)} dias</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
