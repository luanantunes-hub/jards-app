"use client";
import { useRouter } from "next/navigation";
import { Plus, BriefcaseBusiness } from "lucide-react";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import StatusBadge from "@/components/ui/StatusBadge";

export type CaptacaoRow = {
  id: string;
  titulo: string | null;
  status: string;
  valor_solicitado: number | null;
  potencial_fechamento: string | null;
  proxima_prospeccao: string | null;
  data_previsao: string | null;
  created_at: string;
  updated_at: string;
  projeto: { id: string; nome: string; created_at: string } | null;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  prospeccao: { label: "Prospecção", color: "rgba(13,13,13,.40)" },
  primeiro_contato: { label: "1º contato", color: "#7259B5" },
  proposta_enviada: { label: "Proposta", color: "#2D72B0" },
  em_negociacao: { label: "Negociação", color: "#B07A14" },
  aprovado: { label: "Aprovada", color: "#2E8932" },
  ganha: { label: "Ganha", color: "#2E8932" },
  recusado: { label: "Recusada", color: "#D94E4E" },
  perdida: { label: "Perdida", color: "#D94E4E" },
  renovacao: { label: "Renovação", color: "#2D72B0" },
};

const POTENTIAL_META: Record<string, { label: string; color: string; iconName: string }> = {
  baixo: { label: "Baixo", color: "#777777", iconName: "ArrowDown" },
  medio: { label: "Médio", color: "#B07A14", iconName: "Minus" },
  alto: { label: "Alto", color: "#2E8932", iconName: "ArrowUp" },
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

export function NegotiationsTable({ rows, onNew, hideNegotiationColumn = false, eyebrow = "Pipeline desta empresa", title = "Negociações" }: { rows: CaptacaoRow[]; onNew?: () => void; hideNegotiationColumn?: boolean; eyebrow?: string; title?: string }) {
  const router = useRouter();
  const { etiquetas } = useEtiquetas();
  const etiquetaMeta: Record<string, { label: string; cor: string; icone: string }> = Object.fromEntries(etiquetas.map(e => [e.key, e]));
  const columns = hideNegotiationColumn ? ["Projeto","Etapa","Potencial","Valor","Próximo contato","Último avanço"] : ["Negociação","Projeto","Etapa","Potencial","Valor","Próximo contato","Último avanço"];
  return <section className="overflow-hidden rounded border bg-white" style={{borderColor:"rgba(13,13,13,.08)"}}><header className="flex flex-col gap-4 border-b px-5 py-5 md:flex-row md:items-end md:justify-between md:px-6" style={{borderColor:"rgba(13,13,13,.07)"}}><div><p className="text-[0.625rem] font-bold uppercase tracking-[.12em] text-black/35">{eyebrow}</p><h2 className="mt-1 text-[1.3125rem] font-semibold tracking-[-.02em] text-black">{title}</h2></div>{onNew && <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded border border-black/[.12] bg-white px-3.5 py-2 text-[0.75rem] font-medium text-black/55 hover:bg-black/[.04]"><Plus size={12}/>Nova negociação</button>}</header>{!rows.length ? <div className="px-5 py-20 text-center"><BriefcaseBusiness size={24} className="mx-auto text-black/15"/><p className="mt-4 text-[0.875rem] font-semibold text-black/45">Nenhuma negociação registrada</p></div> : <div className="overflow-x-auto"><table className={`w-full ${hideNegotiationColumn ? "min-w-[55rem]" : "min-w-[65rem]"} border-collapse text-left`}><thead><tr className="border-b" style={{borderColor:"rgba(13,13,13,.07)"}}>{columns.map(label => <th key={label} className="px-5 py-3 text-[0.625rem] font-medium text-black/30">{label}</th>)}</tr></thead><tbody className="divide-y divide-black/[.06]">{rows.map(row => { const etiqueta=etiquetaMeta[row.status]; const status: { label: string; color: string; iconName?: string }=etiqueta?{label:etiqueta.label,color:etiqueta.cor,iconName:etiqueta.icone}:STATUS_LABEL[row.status]??{label:row.status.replaceAll('_',' '),color:'#888888'}; const potential=POTENTIAL_META[row.potencial_fechamento??'']; const open=()=>router.push(`/captacoes/${row.id}`); return <tr key={row.id} role="link" tabIndex={0} aria-label={`Abrir negociação ${row.titulo||row.projeto?.nome||"Sem título"}`} onClick={open} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();open();}}} className="cursor-pointer transition hover:bg-black/[.018] focus-visible:bg-black/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/15">{!hideNegotiationColumn && <td className="px-5 py-4"><span className="text-[0.8125rem] font-semibold text-black/75">{row.titulo||"Negociação sem título"}</span></td>}<td className="px-5 py-4 text-[0.6875rem] text-black/45">{row.projeto?.nome||"—"}</td><td className="px-5 py-4"><StatusBadge status={row.status} label={status.label} bg={status.color} iconName={status.iconName} size="sm"/></td><td className="px-5 py-4">{potential ? <StatusBadge status={row.potencial_fechamento!} label={potential.label} bg={potential.color} iconName={potential.iconName} size="sm"/> : <span className="text-[0.6875rem] text-black/25">Não definido</span>}</td><td className="px-5 py-4 text-[0.75rem] font-semibold tabular-nums text-black/65">{fmtCurrency(row.valor_solicitado)}</td><td className="px-5 py-4 text-[0.6875rem] tabular-nums text-black/45">{fmtDate(row.proxima_prospeccao)}</td><td className="px-5 py-4 text-[0.6875rem] text-black/45">há {daysSince(row.updated_at)} dias</td></tr>; })}</tbody></table></div>}</section>;
}
