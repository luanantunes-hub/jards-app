"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Globe, Mail,
  Phone, ExternalLink, Plus, Coins,
  ChevronUp, ChevronDown, UserPlus, X, Pencil, ThumbsUp, ThumbsDown, Copy, Check,
  Upload, FileText, Trash2, Newspaper, RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCreditos } from "@/contexts/CreditosContext";
import type { Empresa, Responsavel, Edital, Tipologia, InvestimentoAnual, InvestimentoTrimestre, StatusCaptacao, ContatoSugestao } from "@/lib/supabase/types";
import { CompanyLogo } from "@/components/CompanyLogo";
import { NovaCaptacaoModal } from "@/components/modals/NovaCaptacaoModal";
import { NovaInscricaoModal } from "@/components/modals/NovaInscricaoModal";
import { NovoProspectModal } from "@/components/modals/NovoProspectModal";
import { ContatoExportadoModal } from "@/components/modals/ContatoExportadoModal";
import { SugerirContribuicaoModal } from "@/components/modals/SugerirContribuicaoModal";
import { ComentarioFeed } from "@/components/community/ComentarioFeed";
import { EditalVotoCard } from "@/components/community/EditalVotoCard";
import { AcessoContatosModal, type AcessoContatosModalVariant } from "@/components/modals/AcessoContatosModal";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import StatusBadge from "@/components/ui/StatusBadge";

type RelatorioSustentabilidade = {
  id: string;
  empresa_id: string;
  nome: string;
  storage_path: string;
  url: string;
  tamanho_bytes: number | null;
  tipo_arquivo: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at?: string;
};

type CaptacaoItem = {
  id: string;
  titulo: string | null;
  status: StatusCaptacao;
  valor_solicitado: number | null;
  lei: "rouanet" | "esporte" | "audiovisual" | "outros" | null;
  empresa_crm_id: string | null;
  projeto: { nome: string } | null;
};

type EditaiUserItem = {
  id: string;
  titulo: string | null;
  status: string;
  projeto: { nome: string } | null;
};

type NewsItem = {
  id: string;
  titulo: string;
  resumo: string | null;
  url_original: string;
  nome_veiculo: string | null;
  imagem_url: string | null;
  publicado_em: string | null;
  capturado_em: string;
  relevancia: number;
};

const LEI_LABEL: Record<string, string> = {
  rouanet: "Rouanet", esporte: "Esporte", audiovisual: "Audiovisual", outros: "Patrocínio direto",
};

function normalizeSector(value: string) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function sectorPlaceholder(setor: string | null | undefined) {
  const value = normalizeSector(setor ?? "");
  if (value.includes("agro")) return "/placeholders/setores/agro.png";
  if (value.includes("aliment") || value.includes("bebida")) return "/placeholders/setores/alimenticio.png";
  if (value.includes("automot")) return "/placeholders/setores/automotivo.jpeg";
  if (value.includes("aviacao") || value.includes("aereo") || value.includes("aeronaut")) return "/placeholders/setores/aviacao.jpeg";
  if (value.includes("educ")) return "/placeholders/setores/educacao.jpeg";
  if (value.includes("eletron") || value.includes("tecnologia")) return "/placeholders/setores/eletronicos.jpeg";
  if (value.includes("embalag")) return "/placeholders/setores/embalagens.png";
  return null;
}

const STATUS_CAP: Record<StatusCaptacao, { label: string; bg: string; text: string }> = {
  prospeccao:       { label: "Prospecção",  bg: "rgba(13,13,13,.07)", text: "rgba(13,13,13,.40)" },
  primeiro_contato: { label: "1º Contato",  bg: "#7259B514",          text: "#7259B5" },
  proposta_enviada: { label: "Proposta",    bg: "#2D72B014",          text: "#2D72B0" },
  em_negociacao:    { label: "Negociação",  bg: "#B07A1414",          text: "#B07A14" },
  aprovado:         { label: "Aprovado",    bg: "#2E893214",          text: "#2E8932" },
  recusado:         { label: "Recusado",    bg: "#D94E4E14",          text: "#D94E4E" },
  renovacao:        { label: "Renovação",   bg: "#2D72B014",          text: "#2D72B0" },
};

const STATUS_EDITAL: Record<string, { label: string; bg: string; text: string }> = {
  interesse:  { label: "Interesse",   bg: "rgba(13,13,13,.07)", text: "rgba(13,13,13,.40)" },
  inscrito:   { label: "Inscrito",    bg: "#2D72B014",          text: "#2D72B0" },
  em_analise: { label: "Em análise",  bg: "#B07A1414",          text: "#B07A14" },
  aprovado:   { label: "Aprovado",    bg: "#2E893214",          text: "#2E8932" },
  reprovado:  { label: "Reprovado",   bg: "#D94E4E14",          text: "#D94E4E" },
};

const TIPO_LABELS: (keyof Tipologia)[] = [
  "musica", "audiovisual", "artes_cenicas", "artes_visuais",
  "artes_integradas", "humanidades", "patrimonio_cultural",
  "impacto", "visibilidade", "institucional",
];
const TIPO_PT: Record<string, string> = {
  musica: "Música", audiovisual: "Audiovisual", artes_cenicas: "Artes Cênicas",
  artes_visuais: "Artes Visuais", artes_integradas: "Artes Integradas",
  humanidades: "Humanidades", patrimonio_cultural: "Patrimônio Cultural",
  impacto: "Impacto", visibilidade: "Visibilidade", institucional: "Institucional",
};

const INV_ANOS: (keyof InvestimentoAnual)[] = ["ano_2020","ano_2021","ano_2022","ano_2023","ano_2024","ano_2025"];
const INV_LABELS = ["2020","2021","2022","2023","2024","2025"];

function colorFrom(nome: string) {
  const p = ["#2E8932","#7259B5","#D94E4E","#B07A14","#2D72B0","#1A8B7A","#2E8932","#7259B5","#D94E4E","#B07A14"];
  let h = 0;
  for (const c of nome) h = c.charCodeAt(0) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

function fmtValor(v: number | null) {
  if (!v) return "—";
  if (v >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(1).replace(".", ",")}B`;
  if (v >= 1_000_000)     return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000)         return `R$ ${v.toLocaleString("pt-BR")}`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function fmtValorAxis(v: number) {
  if (v === 0) return "0";
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)     return `R$${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000)         return v.toLocaleString("pt-BR");
  return String(v);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

function maskName(nome: string) {
  return nome.split(" ").map((w, i) => {
    if (w.length <= 1) return w;
    const keep = i === 0 ? 2 : 1;
    return w.slice(0, keep) + "*".repeat(Math.min(w.length - keep, 5));
  }).join(" ");
}

function diasRestantes(d: string | null) {
  if (!d) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const dt   = new Date(d + "T00:00:00");
  return Math.ceil((dt.getTime() - hoje.getTime()) / 86_400_000);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

const MESES = [
  { key: "janeiro",   label: "Jan", q: 1 },
  { key: "fevereiro", label: "Fev", q: 1 },
  { key: "marco",     label: "Mar", q: 1 },
  { key: "abril",     label: "Abr", q: 2 },
  { key: "maio",      label: "Mai", q: 2 },
  { key: "junho",     label: "Jun", q: 2 },
  { key: "julho",     label: "Jul", q: 3 },
  { key: "agosto",    label: "Ago", q: 3 },
  { key: "setembro",  label: "Set", q: 3 },
  { key: "outubro",   label: "Out", q: 4 },
  { key: "novembro",  label: "Nov", q: 4 },
  { key: "dezembro",  label: "Dez", q: 4 },
] as const;

const TRIM_TABS = ["trimestral", "sustentabilidade"] as const;
const TRIM_LABELS: Record<string, string> = {
  trimestral: "Investimento Trimestral",
  sustentabilidade: "Relatório de Sustentabilidade",
};

const TRIM_NAMES = ["Primeiro Trimestre", "Segundo Trimestre", "Terceiro Trimestre", "Quarto Trimestre"];

function TrimestralChart({ data }: { data: InvestimentoTrimestre }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const quarters  = [data.t1, data.t2, data.t3, data.t4];
  const total     = quarters.reduce((s, v) => s + (v || 0), 0);
  const avg       = total / 4;
  const monthVals = MESES.map((m) => (data[m.key] as number) || 0);
  const maxM      = Math.max(...monthVals, 1);
  const qData = quarters.map((v, i) => ({
    name: TRIM_NAMES[i],
    value: v || 0,
    pct: total > 0 ? Math.round(((v || 0) / total) * 100) : 0,
    positive: (v || 0) >= avg,
  }));

  const cells = [0, 1, 2].flatMap((row) =>
    [0, 1, 2, 3].map((col) => {
      const idx   = col * 3 + row;
      const m     = MESES[idx];
      const v     = monthVals[idx];
      const alpha = maxM > 0 ? v / maxM : 0;
      const bg    = alpha > 0
        ? "rgba(13,13,13," + (0.06 + alpha * 0.22).toFixed(2) + ")"
        : "rgba(13,13,13,.04)";
      return { key: String(row) + "-" + String(col), label: m.label, v, bg };
    })
  );

  return (
    <div className="space-y-6">
      {/* Quarter summary — name + big number + trend arrow */}
      <div className="grid grid-cols-4 gap-6">
        {qData.map((q, i) => (
          <div key={i}>
            <p className="text-[10px] font-medium text-black/30 mb-2">{q.name}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[20px] font-light text-black/75 leading-none tracking-tight">
                {q.value > 0 ? `${q.pct}%` : "—"}
              </span>
              {q.value > 0 && (
                <span className="text-[14px] leading-none font-light" style={{ color: q.positive ? "#2E8932" : "#D94E4E" }}>
                  {q.positive ? "↑" : "↓"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pure heatmap — no labels inside; hover reveals month + value */}
      <div className="grid grid-cols-4 gap-1">
        {cells.map((cell) => {
          const isHovered = hoveredKey === cell.key;
          const isDimmed  = hoveredKey !== null && !isHovered;
          return (
            <div
              key={cell.key}
              className="aspect-[4/3] rounded flex flex-col items-center justify-center cursor-default"
              style={{
                background: cell.bg,
                opacity: isDimmed ? 0.15 : 1,
                transition: "opacity 0.12s ease",
              }}
              onMouseEnter={() => setHoveredKey(cell.key)}
              onMouseLeave={() => setHoveredKey(null)}
            >
              {isHovered ? (
                <div className="text-center px-1">
                  <p className="text-[11px] font-medium text-black/40 leading-none mb-1">{cell.label}</p>
                  <p className="text-[14px] font-semibold text-black/70 leading-none">
                    {cell.v > 0 ? fmtValor(cell.v) : "—"}
                  </p>
                </div>
              ) : (
                <span className="text-[12px] font-medium text-black/30 leading-none">{cell.label}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineChart({ rows }: { rows: InvestimentoAnual[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const totals    = INV_ANOS.map((k) => rows.reduce((s, r) => s + ((r[k] as number) || 0), 0));
  const max       = Math.max(...totals, 1);
  const nonZero   = totals.filter(v => v > 0);
  const minVal    = nonZero.length > 0 ? Math.min(...nonZero) : 0;
  const total     = totals.reduce((s, v) => s + v, 0);
  const val2024   = totals[4];
  const val2025   = totals[5];
  const diffPct   = val2024 > 0 ? ((val2025 - val2024) / val2024) * 100 : 0;

  const W = 600, H = 200;
  const PAD = { top: 20, right: 25, bottom: 26, left: 25 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const yMin   = minVal > 0 ? minVal * 0.78 : 0;
  const yMax   = max * 1.08;
  const yRange = yMax - yMin || 1;

  const pts = totals.map((v, i) => ({
    x: PAD.left + (i / (totals.length - 1)) * plotW,
    y: PAD.top + plotH - ((Math.max(v, yMin) - yMin) / yRange) * plotH,
    v,
    lbl: INV_LABELS[i],
  }));

  const pathD = pts.reduce((d, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cx   = ((prev.x + pt.x) / 2).toFixed(1);
    return d + ` C ${cx} ${prev.y.toFixed(1)} ${cx} ${pt.y.toFixed(1)} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, "");

  const bottom = (PAD.top + plotH).toFixed(1);
  const areaD  = pathD + ` L ${pts[pts.length - 1].x.toFixed(1)} ${bottom} L ${pts[0].x.toFixed(1)} ${bottom} Z`;

  const TICKS  = 4;
  const yTicks = Array.from({ length: TICKS + 1 }, (_, i) => yMin + (i / TICKS) * yRange);

  const TW = 72, TH = 28, TR = 3;

  return (
    <div>
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <p className="text-[10px] font-bold text-black/30 uppercase tracking-wide">Investimento Anual</p>
        {total > 0 && diffPct !== 0 && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ background: diffPct >= 0 ? "#2E893214" : "#D94E4E14", color: diffPct >= 0 ? "#2E8932" : "#D94E4E" }}
          >
            {diffPct >= 0 ? "+" : ""}{diffPct.toFixed(2).replace(".", ",")}%
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" onMouseLeave={() => setHoveredIdx(null)}>
        <defs>
          <linearGradient id="lgAreaInv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#0D0D0D" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0D0D0D" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {yTicks.map((val, i) => {
          if (i === 0) return null;
          const y = PAD.top + plotH - ((val - yMin) / yRange) * plotH;
          return (
            <text
              key={i}
              x="10" y={(y - 3).toFixed(1)}
              textAnchor="start" fontSize="5" fill="rgba(13,13,13,0.25)"
              fontFamily="system-ui, sans-serif"
            >
              {fmtValorAxis(val)}
            </text>
          );
        })}
        <path d={areaD} fill="url(#lgAreaInv)" />
        <path d={pathD} fill="none" stroke="#0D0D0D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((pt, i) => pt.v > 0 && (
          <circle
            key={i}
            cx={pt.x.toFixed(1)} cy={pt.y.toFixed(1)}
            r={hoveredIdx === i ? "4.5" : "3"}
            fill={hoveredIdx === i ? "#0D0D0D" : "white"}
            stroke="#0D0D0D" strokeWidth="1.8"
            style={{ cursor: "pointer", transition: "r 0.1s, fill 0.1s" }}
          />
        ))}
        {pts.map((pt, i) => (
          <rect
            key={`hit-${i}`}
            x={(pt.x - 14).toFixed(1)} y={(pt.y - 14).toFixed(1)}
            width="28" height="28"
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}
        {pts.map((pt, i) => (
          <text
            key={i} x={pt.x.toFixed(1)} y={(H - 4).toFixed(1)}
            textAnchor="middle" fontSize="5.5" fill="rgba(13,13,13,0.3)"
            fontFamily="system-ui, sans-serif" fontWeight="600"
          >
            {pt.lbl}
          </text>
        ))}
        {hoveredIdx !== null && (() => {
          const pt = pts[hoveredIdx];
          const tx = Math.min(Math.max(pt.x - TW / 2, 2), W - TW - 2);
          const ty = Math.max(pt.y - TH - 10, 2);
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={TW} height={TH} rx={TR} fill="white" stroke="rgba(13,13,13,0.1)" strokeWidth="0.6" />
              <text
                x={(tx + TW / 2).toFixed(1)} y={(ty + 10).toFixed(1)}
                textAnchor="middle" fontSize="6" fill="rgba(13,13,13,0.35)"
                fontFamily="system-ui, sans-serif" letterSpacing="0.3"
              >
                {pt.lbl}
              </text>
              <text
                x={(tx + TW / 2).toFixed(1)} y={(ty + 21).toFixed(1)}
                textAnchor="middle" fontSize="8.5" fill="#0D0D0D"
                fontFamily="system-ui, sans-serif" fontWeight="600"
              >
                {fmtValorAxis(pt.v)}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

function LineChartLei({ rows }: { rows: { ano: number; valor: number }[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const sorted  = [...rows].sort((a, b) => a.ano - b.ano);
  const totals  = sorted.map((r) => r.valor || 0);
  const labels  = sorted.map((r) => String(r.ano));
  const max     = Math.max(...totals, 1);
  const nonZero = totals.filter((v) => v > 0);
  const minVal  = nonZero.length > 0 ? Math.min(...nonZero) : 0;
  const total   = totals.reduce((s, v) => s + v, 0);
  const lastIdx = totals.length - 1;
  const valLast = totals[lastIdx] ?? 0;
  const valPrev = lastIdx > 0 ? totals[lastIdx - 1] : 0;
  const diffPct = lastIdx > 0 && valPrev > 0 ? ((valLast - valPrev) / valPrev) * 100 : 0;

  const W = 600, H = 200;
  const PAD = { top: 20, right: 25, bottom: 26, left: 25 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const yMin   = minVal > 0 ? minVal * 0.78 : 0;
  const yMax   = max * 1.08;
  const yRange = yMax - yMin || 1;
  const denom  = Math.max(totals.length - 1, 1);

  const pts = totals.map((v, i) => ({
    x: PAD.left + (i / denom) * plotW,
    y: PAD.top + plotH - ((Math.max(v, yMin) - yMin) / yRange) * plotH,
    v,
    lbl: labels[i],
  }));

  const pathD = pts.reduce((d, pt, i) => {
    if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    const prev = pts[i - 1];
    const cx   = ((prev.x + pt.x) / 2).toFixed(1);
    return d + ` C ${cx} ${prev.y.toFixed(1)} ${cx} ${pt.y.toFixed(1)} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, "");

  const bottom = (PAD.top + plotH).toFixed(1);
  const areaD  = pts.length > 1 ? pathD + ` L ${pts[pts.length - 1].x.toFixed(1)} ${bottom} L ${pts[0].x.toFixed(1)} ${bottom} Z` : "";

  const TICKS  = 4;
  const yTicks = Array.from({ length: TICKS + 1 }, (_, i) => yMin + (i / TICKS) * yRange);

  const TW = 72, TH = 28, TR = 3;

  return (
    <div>
      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <p className="text-[10px] font-bold text-black/30 uppercase tracking-wide">Investimento Anual</p>
        {total > 0 && diffPct !== 0 && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded"
            style={{ background: diffPct >= 0 ? "#2E893214" : "#D94E4E14", color: diffPct >= 0 ? "#2E8932" : "#D94E4E" }}
          >
            {diffPct >= 0 ? "+" : ""}{diffPct.toFixed(2).replace(".", ",")}%
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" onMouseLeave={() => setHoveredIdx(null)}>
        <defs>
          <linearGradient id="lgAreaInvLei" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#0D0D0D" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#0D0D0D" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {yTicks.map((val, i) => {
          if (i === 0) return null;
          const y = PAD.top + plotH - ((val - yMin) / yRange) * plotH;
          return (
            <text
              key={i}
              x="10" y={(y - 3).toFixed(1)}
              textAnchor="start" fontSize="5" fill="rgba(13,13,13,0.25)"
              fontFamily="system-ui, sans-serif"
            >
              {fmtValorAxis(val)}
            </text>
          );
        })}
        <path d={areaD} fill="url(#lgAreaInvLei)" />
        <path d={pathD} fill="none" stroke="#0D0D0D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((pt, i) => pt.v > 0 && (
          <circle
            key={i}
            cx={pt.x.toFixed(1)} cy={pt.y.toFixed(1)}
            r={hoveredIdx === i ? "4.5" : "3"}
            fill={hoveredIdx === i ? "#0D0D0D" : "white"}
            stroke="#0D0D0D" strokeWidth="1.8"
            style={{ cursor: "pointer", transition: "r 0.1s, fill 0.1s" }}
          />
        ))}
        {pts.map((pt, i) => (
          <rect
            key={`hit-${i}`}
            x={(pt.x - 14).toFixed(1)} y={(pt.y - 14).toFixed(1)}
            width="28" height="28"
            fill="transparent"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}
        {pts.map((pt, i) => (
          <text
            key={i} x={pt.x.toFixed(1)} y={(H - 4).toFixed(1)}
            textAnchor="middle" fontSize="5.5" fill="rgba(13,13,13,0.3)"
            fontFamily="system-ui, sans-serif" fontWeight="600"
          >
            {pt.lbl}
          </text>
        ))}
        {hoveredIdx !== null && (() => {
          const pt = pts[hoveredIdx];
          const tx = Math.min(Math.max(pt.x - TW / 2, 2), W - TW - 2);
          const ty = Math.max(pt.y - TH - 10, 2);
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={TW} height={TH} rx={TR} fill="white" stroke="rgba(13,13,13,0.1)" strokeWidth="0.6" />
              <text
                x={(tx + TW / 2).toFixed(1)} y={(ty + 10).toFixed(1)}
                textAnchor="middle" fontSize="6" fill="rgba(13,13,13,0.35)"
                fontFamily="system-ui, sans-serif" letterSpacing="0.3"
              >
                {pt.lbl}
              </text>
              <text
                x={(tx + TW / 2).toFixed(1)} y={(ty + 21).toFixed(1)}
                textAnchor="middle" fontSize="8.5" fill="#0D0D0D"
                fontFamily="system-ui, sans-serif" fontWeight="600"
              >
                {fmtValorAxis(pt.v)}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

function TipologiaChart({ t }: { t: Tipologia }) {
  const values = TIPO_LABELS.map((k) => ({ key: k, v: (t[k] as number) || 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 7);
  const max = Math.max(...values.map((x) => x.v), 1);
  return (
    <div className="space-y-2">
      {values.map(({ key, v }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-[11px] text-black/50 font-medium w-32 flex-shrink-0">{TIPO_PT[key]}</span>
          <div className="flex-1 h-2 rounded-full bg-black/6 overflow-hidden">
            <div className="h-full rounded-full bg-[#7259B5] transition-all" style={{ width: `${(v / max) * 100}%` }} />
          </div>
          <span className="text-[10px] font-bold text-black/40 w-5 text-right">{v}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PatrocinadorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const leiParam = searchParams.get("lei");
  const isLeiView = leiParam === "esporte" || leiParam === "ancine";
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const { creditos, assinatura, loading: creditosLoading, desbloquearEmpresa } = useCreditos();
  const { confirmDelete } = useDeleteConfirm();
  const { etiquetas, etiquetasInscricao } = useEtiquetas();
  const etiquetasCaptacao = Object.fromEntries(etiquetas.map(etiqueta => [etiqueta.key, etiqueta]));
  const etiquetasEdital = Object.fromEntries(etiquetasInscricao.map(etiqueta => [etiqueta.key, etiqueta]));

  const [empresa, setEmpresa]             = useState<Empresa | null>(null);
  const [responsaveis, setResponsaveis]   = useState<Responsavel[]>([]);
  const [sugestoes, setSugestoes]         = useState<ContatoSugestao[]>([]);
  const [meusVotos, setMeusVotos]         = useState<Record<string, number>>({});
  const [meusVotosAdm, setMeusVotosAdm]   = useState<Record<string, number>>({});
  const [editais, setEditais]             = useState<Edital[]>([]);
  const [captacoes, setCaptacoes]         = useState<CaptacaoItem[]>([]);
  const [editaisUser, setEditaisUser]     = useState<EditaiUserItem[]>([]);
  const [empresaCrmId, setEmpresaCrmId]   = useState<string | null>(null);
  const [tipologia, setTipologia]         = useState<Tipologia | null>(null);
  const [investimentos, setInvestimentos] = useState<InvestimentoAnual[]>([]);
  const [trimestral, setTrimestral]       = useState<InvestimentoTrimestre | null>(null);
  const [investimentosLei, setInvestimentosLei] = useState<{ ano: number; valor: number }[]>([]);
  const [carteiraLei, setCarteiraLei]     = useState<{ descricao: string | null } | null>(null);
  const anoRecenteLei = investimentosLei.length > 0 ? Math.max(...investimentosLei.map((r) => r.ano)) : null;
  const valorRecenteLei = anoRecenteLei != null ? investimentosLei.find((r) => r.ano === anoRecenteLei)?.valor ?? null : null;
  const investimentosLeiRecentes = investimentosLei.filter((r) => r.ano >= 2020);
  const [trimTab, setTrimTab]             = useState<"trimestral" | "sustentabilidade">("trimestral");
  const effectiveTrimTab = isLeiView ? "sustentabilidade" : trimTab;
  const [desbloqueado, setDesbloqueado]   = useState(false);
  const [loading, setLoading]             = useState(true);
  const [unlocking, setUnlocking]         = useState(false);
  const [showCaptacaoModal, setShowCaptacaoModal] = useState(false);
  const [showInscricaoModal, setShowInscricaoModal] = useState(false);
  const [showProspectModal, setShowProspectModal] = useState(false);
  const [inscricaoEdital, setInscricaoEdital] = useState<Edital | null>(null);
  const [showReportarErro, setShowReportarErro] = useState(false);
  const [showSugerirForm, setShowSugerirForm] = useState(false);
  const [exportandoContatoId, setExportandoContatoId] = useState<string | null>(null);
  const [contatoExportado, setContatoExportado] = useState<{ id: string; nome: string; empresaNome?: string } | null>(null);
  const [erroExportar, setErroExportar] = useState<string | null>(null);
  const [sugerirForm, setSugerirForm] = useState({ nome: "", cargo: "", email: "", linkedin: "" });
  const [sugerirSaving, setSugerirSaving] = useState(false);
  const [responsaveisTab, setResponsaveisTab] = useState<"responsaveis" | "experiencias">("responsaveis");
  const [showExperienciaModal, setShowExperienciaModal] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [relatorios, setRelatorios]   = useState<RelatorioSustentabilidade[]>([]);
  const [uploadingRel, setUploadingRel] = useState(false);
  const [replacingRelId, setReplacingRelId] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [acessoContatosModal, setAcessoContatosModal] = useState<AcessoContatosModalVariant | null>(null);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const [newsStatus, setNewsStatus] = useState<string>("never");
  const [newsLastSearch, setNewsLastSearch] = useState<string | null>(null);

  const loadNoticias = useCallback(async (refresh = false) => {
    if (refresh) setNewsRefreshing(true);
    else setNewsLoading(true);
    try {
      const response = await fetch(`/api/patrocinadores/${id}/noticias`, { cache: "no-store" });
      const data = await response.json();
      if (Array.isArray(data.items)) setNewsItems(data.items as NewsItem[]);
      setNewsStatus(data.status ?? "never");
      setNewsLastSearch(data.lastSearchAt ?? null);
      if (data.needsRefresh || refresh) {
        const refreshResponse = await fetch(`/api/patrocinadores/${id}/noticias`, { method: "POST" });
        const refreshed = await refreshResponse.json();
        if (Array.isArray(refreshed.items)) setNewsItems(refreshed.items as NewsItem[]);
        setNewsStatus(refreshed.status ?? data.status ?? "never");
        setNewsLastSearch(refreshed.lastSearchAt ?? data.lastSearchAt ?? null);
      }
    } finally {
      setNewsLoading(false);
      setNewsRefreshing(false);
    }
  }, [id]);

  async function handleUploadRelatorio(file: File, replacing?: RelatorioSustentabilidade) {
    if (file.size > 50 * 1024 * 1024) { setReportError("O arquivo deve ter no máximo 50 MB."); return; }
    setReportError(null);
    if (replacing) setReplacingRelId(replacing.id);
    else setUploadingRel(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (replacing) form.append("reportId", replacing.id);
      const response = await fetch(`/api/patrocinadores/${id}/relatorios`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível salvar o relatório");
      setRelatorios((data.items ?? []) as RelatorioSustentabilidade[]);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Não foi possível salvar o relatório");
    } finally {
      setUploadingRel(false);
      setReplacingRelId(null);
    }
  }

  function handleDeleteRelatorio(rel: RelatorioSustentabilidade) {
    confirmDelete({
      title: "Excluir relatório de sustentabilidade?",
      description: "O documento será removido permanentemente. Para manter o relatório, use Abrir ou Trocar.",
      onConfirm: async () => {
        setReportError(null);
        const response = await fetch(`/api/patrocinadores/${id}/relatorios?reportId=${encodeURIComponent(rel.id)}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) { setReportError(data.error ?? "Não foi possível remover o relatório"); return; }
        setRelatorios((data.items ?? []) as RelatorioSustentabilidade[]);
      },
    });
  }

  async function handleCopyEmail(email: string) {
    await navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    window.setTimeout(() => setCopiedEmail(current => current === email ? null : current), 1400);
  }

  const reloadActivity = useCallback(async () => {
    const { data: capData } = await (supabase as any)
      .from("captacoes")
      .select("id, titulo, status, valor_solicitado, lei, empresa_crm_id, projeto:projetos_crm!projeto_id(nome)")
      .eq("empresa_id", id)
      .order("created_at", { ascending: false });
    const caps = (capData ?? []) as unknown as CaptacaoItem[];
    setCaptacoes(caps);
    const newCrmId = caps.find((c: CaptacaoItem) => c.empresa_crm_id)?.empresa_crm_id ?? null;
    if (newCrmId) setEmpresaCrmId(newCrmId);
    const { data: euData } = await (supabase as any)
      .from("editais_user")
      .select("id, titulo, status")
      .eq("empresa_id", id)
      .order("created_at", { ascending: false });
    setEditaisUser(euData ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchSugestoes = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("contatos_sugestoes")
      .select("*")
      .eq("empresa_id", id)
      .in("status", ["pendente", "aprovado"])
      .order("votos_positivos", { ascending: false });
    setSugestoes((data as ContatoSugestao[]) ?? []);
    const ids = ((data as ContatoSugestao[]) ?? []).map(s => s.id);
    if (ids.length > 0) {
      const { data: votos } = await (supabase as any)
        .from("contato_sugestao_votos")
        .select("sugestao_id, valor")
        .in("sugestao_id", ids);
      const map: Record<string, number> = {};
      (votos ?? []).forEach((v: any) => { map[v.sugestao_id] = v.valor; });
      setMeusVotos(map);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const [empRes, respRes, editRes, capRes, tipoRes, invRes, trimRes, desbRes, invLeiRes, carteiraLeiRes] = await Promise.all([
        supabase.from("empresas").select("*").eq("id", id).single(),
        supabase.from("responsaveis").select("*").eq("empresa_id", id).order("ordem"),
        supabase.from("editais").select("*").eq("empresa_id", id).order("data_fechamento", { ascending: false }),
        supabase.from("captacoes").select("id, titulo, status, valor_solicitado, lei, empresa_crm_id, projeto:projetos_crm!projeto_id(nome)").eq("empresa_id", id).order("created_at", { ascending: false }),
        supabase.from("tipologias").select("*").eq("empresa_pub_id", id).maybeSingle(),
        supabase.from("investimentos_anuais").select("*").eq("empresa_pub_id", id),
        supabase.from("investimentos_trimestres").select("*").eq("empresa_pub_id", id).maybeSingle(),
        supabase.from("desbloqueios").select("id").eq("empresa_pub_id", id).maybeSingle(),
        supabase.from("investimentos_por_lei").select("ano, valor").eq("empresa_id", id).eq("lei", leiParam ?? "__none__"),
        supabase.from("carteiras_por_lei").select("descricao").eq("empresa_id", id).eq("lei", leiParam ?? "__none__").maybeSingle(),
      ]);
      setEmpresa(empRes.data);
      const resp = respRes.data ?? [];
      setResponsaveis(resp);
      fetchVotosAdm(resp.map((r: Responsavel) => r.id));
      setEditais(editRes.data ?? []);
      const caps = (capRes.data ?? []) as unknown as CaptacaoItem[];
      setCaptacoes(caps);
      const crmId = caps.find(c => c.empresa_crm_id)?.empresa_crm_id ?? null;
      setEmpresaCrmId(crmId);
      const { data: euData } = await (supabase as any)
        .from("editais_user")
        .select("id, titulo, status, projeto:projetos_crm!projeto_id(nome)")
        .eq("empresa_id", id)
        .order("created_at", { ascending: false });
      setEditaisUser(euData ?? []);
      setTipologia(tipoRes.data);
      setInvestimentos(invRes.data ?? []);
      setTrimestral(trimRes.data);
      setInvestimentosLei((invLeiRes.data ?? []) as { ano: number; valor: number }[]);
      setCarteiraLei(carteiraLeiRes.data as { descricao: string | null } | null);
      setDesbloqueado(!!desbRes.data);
      setLoading(false);
    }
    async function fetchRelatorios() {
      const response = await fetch(`/api/patrocinadores/${id}/relatorios`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setRelatorios((data.items ?? []) as RelatorioSustentabilidade[]);
    }
    fetchAll();
    fetchRelatorios();
    fetchSugestoes();
    void loadNoticias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, leiParam, loadNoticias]);

  async function handleVoto(sugestaoId: string, valor: 1 | -1) {
    await (supabase as any).rpc("fn_votar_sugestao_contato", {
      p_sugestao_id: sugestaoId,
      p_valor: valor,
    });
    fetchSugestoes();
  }

  async function fetchVotosAdm(ids: string[]) {
    if (ids.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await (supabase as any)
      .from("responsavel_votos")
      .select("responsavel_id, valor")
      .in("responsavel_id", ids)
      .eq("user_id", user.id);
    const map: Record<string, number> = {};
    (data ?? []).forEach((v: any) => { map[v.responsavel_id] = v.valor; });
    setMeusVotosAdm(map);
  }

  async function handleVotoAdm(responsavelId: string, valor: 1 | -1) {
    await (supabase as any).rpc("fn_votar_responsavel", {
      p_responsavel_id: responsavelId,
      p_valor: valor,
    });
    // Atualiza contagem local otimisticamente
    setResponsaveis(prev => prev.map(r => {
      if (r.id !== responsavelId) return r;
      const meu = meusVotosAdm[responsavelId] ?? 0;
      if (meu === valor) {
        return { ...r, votos_positivos: valor === 1 ? Math.max(0, r.votos_positivos - 1) : r.votos_positivos, votos_negativos: valor === -1 ? Math.max(0, r.votos_negativos - 1) : r.votos_negativos };
      } else if (meu !== 0) {
        return { ...r, votos_positivos: valor === 1 ? r.votos_positivos + 1 : Math.max(0, r.votos_positivos - 1), votos_negativos: valor === -1 ? r.votos_negativos + 1 : Math.max(0, r.votos_negativos - 1) };
      } else {
        return { ...r, votos_positivos: valor === 1 ? r.votos_positivos + 1 : r.votos_positivos, votos_negativos: valor === -1 ? r.votos_negativos + 1 : r.votos_negativos };
      }
    }));
    setMeusVotosAdm(prev => {
      const atual = prev[responsavelId] ?? 0;
      if (atual === valor) { const next = { ...prev }; delete next[responsavelId]; return next; }
      return { ...prev, [responsavelId]: valor };
    });
  }

  async function handleExportarContato(row: { id: string; nome: string; email: string | null; linkedin_url: string | null; cargo: string | null }) {
    setErroExportar(null);
    setExportandoContatoId(row.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErroExportar("Usuário não autenticado."); setExportandoContatoId(null); return; }

    const nomeEmpresa = empresa?.nome?.trim();
    let empresaCrmIdFinal = empresaCrmId;
    if (!empresaCrmIdFinal && nomeEmpresa) {
      const { data: existente } = await (supabase as any)
        .from("empresas_crm")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("empresa_pub_id", id)
        .limit(1)
        .maybeSingle();
      if (existente?.id) {
        empresaCrmIdFinal = existente.id;
      } else {
        const { data: novaEmpresa, error: erroEmpresa } = await (supabase as any)
          .from("empresas_crm")
          .insert({ nome: nomeEmpresa, account_id: user.id, organization_id: organizationId, empresa_pub_id: id })
          .select("id")
          .single();
        if (erroEmpresa) { setErroExportar(erroEmpresa.message); setExportandoContatoId(null); return; }
        empresaCrmIdFinal = novaEmpresa?.id ?? null;
      }
    }

    const { data: novoContato, error } = await (supabase as any)
      .from("contatos")
      .insert({
        account_id: user.id,
        organization_id: organizationId,
        nome: row.nome,
        cargo: row.cargo || null,
        email: row.email || null,
        linkedin_url: row.linkedin_url || null,
        empresa_crm_id: empresaCrmIdFinal,
        origem: "jards",
      })
      .select("id")
      .single();

    setExportandoContatoId(null);
    if (error || !novoContato) { setErroExportar(error?.message ?? "Não foi possível salvar o contato."); return; }
    if (empresaCrmIdFinal && !empresaCrmId) setEmpresaCrmId(empresaCrmIdFinal);
    setContatoExportado({ id: novoContato.id, nome: row.nome, empresaNome: nomeEmpresa });
  }

  async function handleSugerir() {
    if (!sugerirForm.nome.trim()) return;
    setSugerirSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSugerirSaving(false); return; }
    await (supabase as any).from("contatos_sugestoes").insert({
      empresa_id: id,
      autor_id: user.id,
      nome: sugerirForm.nome.trim(),
      cargo: sugerirForm.cargo.trim() || null,
      email: sugerirForm.email.trim() || null,
      linkedin_url: sugerirForm.linkedin.trim() || null,
    });
    setSugerirSaving(false);
    setSugerirForm({ nome: "", cargo: "", email: "", linkedin: "" });
    setShowSugerirForm(false);
    fetchSugestoes();
  }

  async function handleVerContatos() {
    if (!assinatura?.ativa) {
      setAcessoContatosModal("sem_plano");
      return;
    }

    if ((creditos?.creditos_disponiveis ?? 0) <= 0) {
      setAcessoContatosModal("sem_creditos");
      return;
    }

    setUnlocking(true);

    // O banco cria o desbloqueio persistente e só cobra se ele ainda não existir.
    const sucesso = await desbloquearEmpresa(id);

    if (sucesso) {
      setDesbloqueado(true);
    }

    setUnlocking(false);
  }

  if (loading) return <PageSkeleton />;
  if (!empresa) return (
    <div className="px-8 py-8">
      <Link href="/patrocinadores" className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/35 hover:text-black transition mb-6">
        <ArrowLeft size={13} /> Patrocinadores
      </Link>
      <p className="text-black/40 text-sm">Empresa não encontrada.</p>
    </div>
  );

  const trimestres = [
    { label: "T1", active: empresa.trimestre_1 },
    { label: "T2", active: empresa.trimestre_2 },
    { label: "T3", active: empresa.trimestre_3 },
    { label: "T4", active: empresa.trimestre_4 },
  ];

  // Only contacts are locked — charts and tables are always visible
  const mostraContatos = desbloqueado || !empresa.tem_detalhe;
  const capsAtivas     = captacoes.filter((c) => c.status !== "recusado");
  const reportCover = sectorPlaceholder(empresa.setor);

  return (
    <div className="w-full">
      {showProspectModal && (
        <NovoProspectModal
          onClose={() => setShowProspectModal(false)}
          onSaved={() => { setShowProspectModal(false); reloadActivity(); }}
          nomePreEmpresa={empresa?.nome}
          setorPreEmpresa={empresa?.setor ?? undefined}
          dominioPreEmpresa={empresa?.site ?? undefined}
          cidadePreEmpresa={empresa?.cidade ?? undefined}
          ufPreEmpresa={empresa?.estado ?? undefined}
          empresaPubId={id}
          empresaCrmId={empresaCrmId ?? undefined}
        />
      )}
      {showCaptacaoModal && (
        <NovaCaptacaoModal
          nomePreEmpresa={empresa?.nome}
          empresaPreId={empresaCrmId ?? undefined}
          empresaPubId={id}
          onClose={() => setShowCaptacaoModal(false)}
          onSaved={() => { setShowCaptacaoModal(false); reloadActivity(); }}
        />
      )}
      {showInscricaoModal && (
        <NovaInscricaoModal
          nomePreEmpresa={empresa?.nome}
          empresaPreId={empresaCrmId ?? undefined}
          empresaPubId={id}
          tituloPre={inscricaoEdital?.titulo ?? ""}
          dataAberturaPre={inscricaoEdital?.data_abertura ?? ""}
          dataFechamentoPre={inscricaoEdital?.data_fechamento ?? ""}
          onClose={() => { setShowInscricaoModal(false); setInscricaoEdital(null); }}
          onSaved={() => { setShowInscricaoModal(false); setInscricaoEdital(null); reloadActivity(); }}
        />
      )}
      {contatoExportado && (
        <ContatoExportadoModal
          contatoId={contatoExportado.id}
          nome={contatoExportado.nome}
          empresaNome={contatoExportado.empresaNome}
          onClose={() => setContatoExportado(null)}
        />
      )}
      {erroExportar && (
        <div className="fixed bottom-5 right-5 z-50 flex max-w-[320px] items-start gap-2 rounded border border-[#D94E4E]/20 bg-white px-4 py-3 text-[12px] font-medium text-[#D94E4E] shadow-[0_12px_32px_rgba(13,13,13,.12)]">
          <span className="min-w-0 flex-1">{erroExportar}</span>
          <button type="button" onClick={() => setErroExportar(null)} aria-label="Fechar aviso" className="text-[#D94E4E]/60 hover:text-[#D94E4E]"><X size={13} /></button>
        </div>
      )}
      {showReportarErro && empresa && (
        <SugerirContribuicaoModal
          tabelaAlvo="responsaveis"
          registroAlvoId={responsaveis[0]?.id ?? ""}
          registroNome={empresa.nome}
          onClose={() => setShowReportarErro(false)}
        />
      )}
      {acessoContatosModal && (
        <AcessoContatosModal
          variant={acessoContatosModal}
          onClose={() => setAcessoContatosModal(null)}
          onPrimary={() => {
            const action = acessoContatosModal === "sem_creditos" ? "creditos" : "assinar";
            setAcessoContatosModal(null);
            router.push(`/meu-plano?acao=${action}`);
          }}
        />
      )}

      {/* ── Painel flutuante: Sugerir contato ── */}
      <>
        {showSugerirForm && (
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(13,13,13,.18)" }}
            onClick={() => setShowSugerirForm(false)}
          />
        )}
        <div
          className="fixed top-0 right-0 h-full w-80 z-50 flex flex-col bg-white shadow-2xl"
          style={{
            transform: showSugerirForm ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
            borderLeft: "1px solid rgba(13,13,13,.08)",
          }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <div>
              <p className="text-[13px] font-semibold text-black">Sugerir contato</p>
              <p className="text-[11px] text-black/35 mt-0.5">Responsável pelo patrocínio</p>
            </div>
            <button
              onClick={() => setShowSugerirForm(false)}
              className="w-7 h-7 flex items-center justify-center rounded text-black/30 hover:text-black/60 hover:bg-black/[.05] transition"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-black/35 uppercase tracking-wide mb-1.5">Nome completo *</label>
              <input
                value={sugerirForm.nome}
                onChange={e => setSugerirForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo"
                className="w-full px-3 py-2 text-[13px] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/25 placeholder:text-black/25"
                style={{ borderColor: "rgba(13,13,13,.10)" }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-black/35 uppercase tracking-wide mb-1.5">Cargo</label>
              <input
                value={sugerirForm.cargo}
                onChange={e => setSugerirForm(f => ({ ...f, cargo: e.target.value }))}
                placeholder="Cargo"
                className="w-full px-3 py-2 text-[13px] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/25 placeholder:text-black/25"
                style={{ borderColor: "rgba(13,13,13,.10)" }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-black/35 uppercase tracking-wide mb-1.5">E-mail</label>
              <input
                value={sugerirForm.email}
                onChange={e => setSugerirForm(f => ({ ...f, email: e.target.value }))}
                placeholder="E-mail"
                className="w-full px-3 py-2 text-[13px] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/25 placeholder:text-black/25"
                style={{ borderColor: "rgba(13,13,13,.10)" }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-black/35 uppercase tracking-wide mb-1.5">LinkedIn</label>
              <input
                value={sugerirForm.linkedin}
                onChange={e => setSugerirForm(f => ({ ...f, linkedin: e.target.value }))}
                placeholder="LinkedIn"
                className="w-full px-3 py-2 text-[13px] border rounded focus:outline-none focus:ring-1 focus:ring-[#7259B5]/25 placeholder:text-black/25"
                style={{ borderColor: "rgba(13,13,13,.10)" }}
              />
            </div>
          </div>
          <div className="px-5 py-4 border-t flex items-center justify-end gap-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
            <button
              onClick={() => setShowSugerirForm(false)}
              className="text-[12px] font-medium text-black/35 hover:text-black/55 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSugerir}
              disabled={sugerirSaving || !sugerirForm.nome.trim()}
              className="flex items-center gap-1.5 px-5 py-2 text-[12px] font-semibold rounded transition disabled:opacity-40 hover:bg-black/[.04]"
              style={{ color: "#7259B5", border: "1px solid rgba(114,89,181,.25)", background: "white" }}
            >
              {sugerirSaving && <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Sugerir
            </button>
          </div>
        </div>
      </>

      {/* ── Hero header ── */}
      <div className="px-8 pt-6 pb-0 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <Link href="/patrocinadores" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-black/30 hover:text-black transition mb-5">
          <ArrowLeft size={12} /> Patrocinadores
        </Link>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <CompanyLogo
              nome={empresa.nome}
              site={empresa.site}
              logo_url={empresa.logo_url}
              size={60}
              className="rounded border border-black/8 p-1 flex-shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="font-bold text-[#0D0D0D] text-[28px] leading-tight">{empresa.nome}</h1>
                {empresa.site && (
                  <a
                    href={empresa.site.startsWith("http") ? empresa.site : `https://${empresa.site}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-black/25 hover:text-[#7259B5] transition"
                    title={empresa.site}
                  >
                    <Globe size={14} />
                  </a>
                )}
              </div>
              {(isLeiView ? valorRecenteLei : empresa.aporte_estimado) && (
                <p className="text-xs text-black/40">
                  {isLeiView ? `Investimento em ${anoRecenteLei}` : "Total investido"}: <span className="font-bold text-black/70">{fmtValor(isLeiView ? valorRecenteLei : empresa.aporte_estimado)}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowProspectModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-black bg-white border rounded hover:bg-black/[.04] transition"
              style={{ borderColor: "rgba(13,13,13,.12)" }}
            >
              <Plus size={12} /> Novo prospect
            </button>
            <button
              onClick={() => { setInscricaoEdital(null); setShowInscricaoModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-white border rounded hover:bg-black/5 transition"
              style={{ borderColor: "rgba(13,13,13,.12)" }}
            >
              <Plus size={12} /> Nova inscrição
            </button>
            <button
              onClick={() => setShowCaptacaoModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-white border rounded hover:bg-black/5 transition"
              style={{ borderColor: "rgba(13,13,13,.12)" }}
            >
              <Plus size={12} /> Nova captação
            </button>
          </div>
        </div>
        {/* Tags row */}
        <div className="flex items-center gap-2 pb-4 flex-wrap">
          {empresa.setor && (
            <div className="flex items-center gap-1.5 text-[11px] bg-black/[0.04] px-3 py-1 rounded">
              <span className="text-[9px] font-bold uppercase tracking-wide text-black/30">Setor</span>
              <span className="font-semibold text-black/60">{empresa.setor}</span>
            </div>
          )}
          {empresa.cidade && empresa.estado && (
            <div className="flex items-center gap-1.5 text-[11px] bg-black/[0.04] px-3 py-1 rounded">
              <span className="text-[9px] font-bold uppercase tracking-wide text-black/30">Sede</span>
              <span className="font-semibold text-black/60">{empresa.cidade}, {empresa.estado}</span>
            </div>
          )}
          {!isLeiView && (
            <div className="flex items-center gap-1 ml-1">
              {trimestres.map(({ label, active }) => (
                <span
                  key={label}
                  className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={active
                    ? { background: "#2E893214", color: "#2E8932" }
                    : { background: "rgba(13,13,13,.06)", color: "rgba(13,13,13,.35)" }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-8 py-6">

        {/* 2-col grid: info+CRM | charts+contacts+editais */}
        <div className="grid xl:grid-cols-[280px_1fr] gap-6 items-start">

          {/* ── Col 1: Sobre · Contato geral · Negociações ativas ── */}
          <div className="space-y-4">
            {(isLeiView ? carteiraLei?.descricao : empresa.descricao) && (
              <div className="bg-white rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <p className="text-[10px] font-bold text-black/35 uppercase tracking-wide mb-2">Sobre</p>
                <p className="text-xs text-black/55 leading-relaxed">{isLeiView ? carteiraLei?.descricao : empresa.descricao}</p>
              </div>
            )}

            {(empresa.email_geral || empresa.telefone || empresa.site) && (
              <div className="bg-white rounded border p-5 space-y-2.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <p className="text-[10px] font-bold text-black/35 uppercase tracking-wide mb-3">Contato geral</p>
                {empresa.email_geral && (
                  <a href={`mailto:${empresa.email_geral}`} className="flex items-start gap-2 text-xs text-black/50 hover:text-black transition">
                    <Mail size={12} className="shrink-0 mt-0.5" /> <span className="break-all">{empresa.email_geral}</span>
                  </a>
                )}
                {empresa.telefone && (
                  <a href={`tel:${empresa.telefone}`} className="flex items-center gap-2 text-xs text-black/50 hover:text-black transition">
                    <Phone size={12} /> {empresa.telefone}
                  </a>
                )}
                {empresa.site && (
                  <a
                    href={empresa.site.startsWith("http") ? empresa.site : `https://${empresa.site}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-black/50 hover:text-black transition"
                  >
                    <Globe size={12} /> {empresa.site.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            )}

            {/* Notícias: cache semanal por patrocinador */}
            <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <div className="flex items-center gap-2">
                  <Newspaper size={13} className="text-black/40" />
                  <div>
                    <p className="text-[10px] font-bold text-black/35 uppercase tracking-wide">Notícias</p>
                    <p className="text-[10px] text-black/30 mt-0.5">Sobre {empresa.nome}</p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                {newsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-10 rounded bg-black/[.04] animate-pulse" />)}
                  </div>
                ) : newsItems.length === 0 ? (
                  <div className="py-4 text-center">
                    <p className="text-[11px] text-black/35">Nenhuma notícia encontrada.</p>
                    <p className="text-[10px] text-black/25 mt-1">
                      {newsStatus === "quota_exceeded"
                        ? "A cota mensal de buscas foi atingida."
                        : newsStatus === "configuration_error"
                          ? "A integração ainda precisa ser configurada no banco de dados."
                          : "A busca será atualizada semanalmente."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {newsItems.slice(0, 5).map(item => (
                      <a key={item.id} href={item.url_original} target="_blank" rel="noopener noreferrer" className="block group">
                        <p className="text-[11px] leading-snug font-semibold text-black/70 group-hover:text-[#7259B5] transition line-clamp-2">{item.titulo}</p>
                        <p className="text-[9px] text-black/30 mt-1">
                          {item.nome_veiculo ?? "Fonte não informada"}{item.publicado_em ? ` · ${fmtDate(item.publicado_em)}` : ""}
                        </p>
                      </a>
                    ))}
                    <div className="pt-1 flex items-center justify-between border-t" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                      <span className="text-[9px] text-black/25">{newsLastSearch ? `Atualizado em ${fmtDate(newsLastSearch)}` : "Atualização semanal"}</span>
                      {newsStatus === "quota_exceeded" && <span className="text-[9px] text-[#B07A14]">Cota atingida</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Negociações e inscrições */}
            {(() => {
              const totalItems = captacoes.length + editaisUser.length;
              return (
                <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                    <p className="text-[10px] font-bold text-black/35 uppercase tracking-wide">Negociações ativas</p>
                    {totalItems > 0 && (
                      <span className="text-[10px] font-bold text-black/30">{totalItems}</span>
                    )}
                  </div>
                  {totalItems === 0 ? (
                    <div className="flex justify-center py-8 px-4">
                      <img src="/illustrations/negociacoes-empty.jpeg" alt="" className="w-full max-w-[180px] opacity-90" />
                    </div>
                  ) : (
                    <div>
                      {captacoes.map((c, i) => {
                        const etiqueta = etiquetasCaptacao[c.status];
                        const sc = etiqueta ? { label: etiqueta.label, bg: etiqueta.cor, text: etiqueta.cor, iconName: etiqueta.icone } : { ...(STATUS_CAP[c.status] ?? STATUS_CAP.prospeccao), iconName: undefined };
                        const isLast = i === captacoes.length - 1 && editaisUser.length === 0;
                        return (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => router.push(`/captacoes/${c.id}`)}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition hover:bg-black/[.025] focus-visible:bg-black/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/15"
                            style={{ borderBottom: !isLast ? "1px solid rgba(13,13,13,.05)" : "none" }}
                          >
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "white", border: "1px solid #7259B540", color: "#7259B5" }}>Neg.</span>
                            <p className="text-[11px] font-medium text-black/70 truncate flex-1 min-w-0">
                              {c.projeto?.nome ?? c.titulo ?? "Sem título"}
                            </p>
                            <StatusBadge status={c.status} label={sc.label} bg={sc.text} iconName={sc.iconName} size="sm" />
                          </button>
                        );
                      })}
                      {editaisUser.map((e, i) => {
                        const etiqueta = etiquetasEdital[e.status];
                        const se = etiqueta ? { label: etiqueta.label, bg: etiqueta.cor, text: etiqueta.cor, iconName: etiqueta.icone } : { ...(STATUS_EDITAL[e.status] ?? STATUS_EDITAL.interesse), iconName: undefined };
                        const isLast = i === editaisUser.length - 1;
                        return (
                          <button
                            type="button"
                            key={e.id}
                            onClick={() => router.push(`/editais-inscritos/${e.id}`)}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition hover:bg-black/[.025] focus-visible:bg-black/[.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/15"
                            style={{ borderBottom: !isLast ? "1px solid rgba(13,13,13,.05)" : "none" }}
                          >
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "white", border: "1px solid #2D72B040", color: "#2D72B0" }}>Edital</span>
                            <p className="text-[11px] font-medium text-black/70 truncate flex-1 min-w-0">
                              {e.projeto?.nome ?? e.titulo ?? "Sem título"}
                            </p>
                            <StatusBadge status={e.status} label={se.label} bg={se.text} iconName={se.iconName} size="sm" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ── Col 2: Investimento anual · Contatos · Editais · Trimestral ── */}
          <div className="space-y-4">

            {/* 1. Investimento anual */}
            {isLeiView ? (
              investimentosLeiRecentes.length > 0 && (
                <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <LineChartLei rows={investimentosLeiRecentes} />
                </div>
              )
            ) : (
              investimentos.length > 0 && (
                <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                  <LineChart rows={investimentos} />
                </div>
              )
            )}

            {/* 2. Responsáveis pelo Patrocínio */}
            <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="px-5 border-b flex items-center justify-between" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <div className="flex items-center gap-6">
                  {[
                    { id: "responsaveis" as const, label: "Responsáveis pelo patrocínio" },
                    { id: "experiencias" as const, label: "Experiências" },
                  ].map(tab => {
                    const selected = responsaveisTab === tab.id;
                    return <button key={tab.id} onClick={() => setResponsaveisTab(tab.id)} className="relative h-14 text-[13px] font-semibold transition" style={{ color: selected ? "#7259B5" : "rgba(13,13,13,.4)" }}>{tab.label}{selected && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#7259B5]"/>}</button>;
                  })}
                </div>
                {responsaveisTab === "responsaveis" ? <div className="flex items-center gap-2">
                  {empresa.tem_detalhe && !desbloqueado && (
                    <button
                      onClick={handleVerContatos}
                      disabled={unlocking || creditosLoading}
                      className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 bg-white border rounded hover:bg-black/5 transition disabled:opacity-50"
                      style={{ borderColor: "rgba(13,13,13,.12)" }}
                      title="Ver contatos verificados"
                    >
                      <Coins size={11} />
                      {unlocking ? "Desbloqueando…" : "Ver contatos"}
                    </button>
                  )}
                  <button
                    onClick={() => setShowReportarErro(true)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 border rounded transition hover:bg-black/[0.02]"
                    style={{ borderColor: "rgba(217,78,78,.25)", color: "#D94E4E" }}
                  >
                    Reportar Erro
                  </button>
                  <button
                    onClick={() => setShowSugerirForm(v => !v)}
                    className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 bg-white border rounded hover:bg-black/[0.04] transition"
                    style={{ borderColor: "rgba(13,13,13,.15)", color: "rgba(13,13,13,.65)" }}
                  >
                    <UserPlus size={11} /> Sugerir
                  </button>
                </div> : (
                  <button
                    onClick={() => setShowExperienciaModal(true)}
                    className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 bg-white border rounded hover:bg-black/5 transition"
                    style={{ borderColor: "rgba(13,13,13,.12)", color: "rgba(13,13,13,.65)" }}
                  >
                    <Pencil size={11} /> Experiência
                  </button>
                )}
              </div>

              {responsaveisTab === "responsaveis" ? <>
              {responsaveis.length === 0 && sugestoes.length === 0 ? (
                <p className="px-5 py-10 text-xs text-black/25 text-center">Nenhum contato cadastrado</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#F9F9F8", borderBottom: "1px solid rgba(13,13,13,.06)" }}>
                      {["Nome", "Cargo", "Fonte", "Rede", "Exportar", "Votos", "Email"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-black/30 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {responsaveis.map((r, i) => {
                      const isAdm = r.fonte === "proprietaria";
                      const nome  = mostraContatos ? r.nome : maskName(r.nome);
                      const email = mostraContatos ? r.email : r.email ? `***@${r.email.split("@")[1] ?? "***"}` : null;
                      const totalRows = responsaveis.length + sugestoes.length;
                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-black/[0.015] transition"
                          style={{ borderBottom: i < totalRows - 1 ? "1px solid rgba(13,13,13,.05)" : "none" }}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-7 h-7 rounded flex-shrink-0 flex items-center justify-center text-[11px] font-semibold"
                                style={{ background: "linear-gradient(145deg, #f8f8fb 0%, #d4d4dc 100%)", color: "#9e9ea8", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.06)" }}
                              >
                                {r.nome.charAt(0).toUpperCase()}
                              </div>
                              <span
                                className={`font-medium text-black text-[13px] ${!mostraContatos ? "select-none" : ""}`}
                                style={{ filter: !mostraContatos ? "blur(3px)" : "none" }}
                              >
                                {nome}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-black/40 text-xs">{r.cargo ?? "—"}</td>
                          <td className="px-5 py-3.5">
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide"
                              style={isAdm
                                ? { background: "rgba(13,13,13,.07)", color: "rgba(13,13,13,.50)" }
                                : { background: "rgba(45,114,176,.10)", color: "#2D72B0" }}
                            >
                              {isAdm ? "ADM" : "COMUNIDADE"}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {r.linkedin_url && mostraContatos ? (
                              <a
                                href={r.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-7 h-7 flex items-center justify-center rounded border border-black/10 text-black/25 hover:text-black/60 hover:border-black/20 transition"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/>
                                </svg>
                              </a>
                            ) : (
                              <span className="text-black/15 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => mostraContatos && void handleExportarContato(r)}
                              disabled={!mostraContatos || exportandoContatoId === r.id}
                              className="w-7 h-7 flex items-center justify-center rounded border border-black/10 text-black/25 hover:text-[#7259B5] hover:border-[#7259B5]/30 hover:bg-[#7259B5]/5 transition disabled:opacity-30 disabled:pointer-events-none"
                              title={mostraContatos ? "Salvar nos contatos" : "Desbloqueie os contatos para exportar"}
                            >
                              {exportandoContatoId === r.id
                                ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/15 border-t-black/50" />
                                : <UserPlus size={11} />}
                            </button>
                          </td>
                          <td className="px-5 py-3.5">
                            {(() => {
                              const meuVoto = meusVotosAdm[r.id] ?? 0;
                              const saldo   = r.votos_positivos - r.votos_negativos;
                              return (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleVotoAdm(r.id, 1)}
                                    className="p-1 rounded transition hover:bg-black/5"
                                    title="Confirmar contato — esse contato é válido e relevante"
                                  >
                                    <ThumbsUp size={12} className={meuVoto === 1 ? "text-[#2E8932]" : "text-black/20"} />
                                  </button>
                                  <span className={`text-[11px] font-bold tabular-nums w-4 text-center ${saldo > 0 ? "text-[#2E8932]" : saldo < 0 ? "text-[#D94E4E]" : "text-black/25"}`}>
                                    {saldo}
                                  </span>
                                  <button
                                    onClick={() => handleVotoAdm(r.id, -1)}
                                    className="p-1 rounded transition hover:bg-black/5"
                                    title="Contestar contato — esse contato está desatualizado ou incorreto"
                                  >
                                    <ThumbsDown size={12} className={meuVoto === -1 ? "text-[#D94E4E]" : "text-black/20"} />
                                  </button>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-5 py-3.5">
                            {email ? (
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-[12px] font-medium ${mostraContatos ? "text-black/70" : "text-black/20 select-none"}`}
                                  style={{ filter: !mostraContatos ? "blur(4px)" : "none" }}
                                >
                                  {email}
                                </span>
                                {mostraContatos && r.email && (
                                  <button onClick={() => void handleCopyEmail(r.email!)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-black/10 bg-white text-black/30 transition hover:bg-black/[.04] hover:text-black/60" title="Copiar e-mail" aria-label={`Copiar e-mail de ${r.nome}`}>
                                    {copiedEmail === r.email ? <Check size={11} className="text-[#2E8932]" /> : <Copy size={11} />}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-black/20 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {sugestoes.map((s, i) => {
                      const meuVoto  = meusVotos[s.id] ?? 0;
                      const saldo    = s.votos_positivos - s.votos_negativos;
                      const sNome    = mostraContatos ? s.nome  : maskName(s.nome);
                      const sEmail   = mostraContatos ? s.email : s.email ? `***@${s.email.split("@")[1] ?? "***"}` : null;
                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-black/[0.015] transition"
                          style={{ borderBottom: i < sugestoes.length - 1 ? "1px solid rgba(13,13,13,.05)" : "none" }}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-7 h-7 rounded flex-shrink-0 flex items-center justify-center text-[11px] font-semibold"
                                style={{ background: "linear-gradient(145deg,#f8f8fb 0%,#d4d4dc 100%)", color: "#9e9ea8", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.06)" }}
                              >
                                {s.nome.charAt(0).toUpperCase()}
                              </div>
                              <span
                                className={`font-medium text-black text-[13px] ${!mostraContatos ? "select-none" : ""}`}
                                style={{ filter: !mostraContatos ? "blur(3px)" : "none" }}
                              >
                                {sNome}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-black/40 text-xs">{s.cargo ?? "—"}</td>
                          <td className="px-5 py-3.5">
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide"
                              style={{ background: "rgba(45,114,176,.10)", color: "#2D72B0" }}
                            >
                              COMUNIDADE
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {s.linkedin_url && mostraContatos ? (
                              <a
                                href={s.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-7 h-7 flex items-center justify-center rounded border border-black/10 text-black/25 hover:text-black/60 hover:border-black/20 transition"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z"/>
                                </svg>
                              </a>
                            ) : (
                              <span className="text-black/15 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => mostraContatos && void handleExportarContato(s)}
                              disabled={!mostraContatos || exportandoContatoId === s.id}
                              className="w-7 h-7 flex items-center justify-center rounded border border-black/10 text-black/25 hover:text-[#7259B5] hover:border-[#7259B5]/30 hover:bg-[#7259B5]/5 transition disabled:opacity-30 disabled:pointer-events-none"
                              title="Salvar nos contatos"
                            >
                              {exportandoContatoId === s.id
                                ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/15 border-t-black/50" />
                                : <UserPlus size={11} />}
                            </button>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleVoto(s.id, 1)}
                                className="p-1 rounded transition hover:bg-black/5"
                                title="Confirmar contato — esse contato é válido e relevante"
                              >
                                <ThumbsUp size={12} className={meuVoto === 1 ? "text-[#2E8932]" : "text-black/20"} />
                              </button>
                              <span className={`text-[11px] font-bold tabular-nums w-4 text-center ${saldo > 0 ? "text-[#2E8932]" : saldo < 0 ? "text-[#D94E4E]" : "text-black/25"}`}>
                                {saldo}
                              </span>
                              <button
                                onClick={() => handleVoto(s.id, -1)}
                                className="p-1 rounded transition hover:bg-black/5"
                                title="Contestar contato — esse contato está desatualizado ou incorreto"
                              >
                                <ThumbsDown size={12} className={meuVoto === -1 ? "text-[#D94E4E]" : "text-black/20"} />
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            {sEmail ? (
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-[12px] font-medium ${mostraContatos ? "text-black/70" : "text-black/20 select-none"}`}
                                  style={{ filter: !mostraContatos ? "blur(4px)" : "none" }}
                                >
                                  {sEmail}
                                </span>
                                {mostraContatos && s.email && (
                                  <button onClick={() => void handleCopyEmail(s.email!)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-black/10 bg-white text-black/30 transition hover:bg-black/[.04] hover:text-black/60" title="Copiar e-mail" aria-label={`Copiar e-mail de ${s.nome}`}>
                                    {copiedEmail === s.email ? <Check size={11} className="text-[#2E8932]" /> : <Copy size={11} />}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-black/20 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              </> : <ComentarioFeed empresaId={id} embedded composerOpen={showExperienciaModal} onComposerOpenChange={setShowExperienciaModal} />}
            </div>

            {/* 3. Editais + Votos */}
            <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <p className="text-sm font-semibold text-black">Editais e chamamentos</p>
                <button
                  onClick={() => { setInscricaoEdital(null); setShowInscricaoModal(true); }}
                  className="text-[11px] font-medium text-black/35 hover:text-black transition"
                >
                  Exportar
                </button>
              </div>
              {editais.length === 0 ? (
                <p className="px-5 py-8 text-xs text-black/30 text-center">Nenhum edital cadastrado</p>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#F9F9F8", borderBottom: "1px solid rgba(13,13,13,.06)" }}>
                        {["Edital", "Abertura", "Fechamento", "Prazo", "Exportar", ""].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-[10px] font-bold text-black/30 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {editais.map((e, i) => {
                        const dias   = diasRestantes(e.data_fechamento);
                        const aberto = e.ativo && (dias === null || dias >= 0);
                        return (
                          <tr
                            key={e.id}
                            className="hover:bg-black/[0.015] transition"
                            style={{ borderBottom: i < editais.length - 1 ? "1px solid rgba(13,13,13,.05)" : "none" }}
                          >
                            <td className="px-5 py-3.5 font-medium text-black text-[13px] max-w-[200px]">
                              <span className="line-clamp-2">{e.titulo ?? "Sem título"}</span>
                            </td>
                            <td className="px-5 py-3.5 text-black/40 text-xs whitespace-nowrap">{fmtDate(e.data_abertura)}</td>
                            <td className="px-5 py-3.5 text-black/40 text-xs whitespace-nowrap">{fmtDate(e.data_fechamento)}</td>
                            <td className="px-5 py-3.5">
                              {dias !== null ? (
                                <span
                                  className="text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap"
                                  style={
                                    dias < 0   ? { background: "rgba(13,13,13,.07)", color: "rgba(13,13,13,.35)" } :
                                    dias <= 14 ? { background: "#D94E4E14", color: "#D94E4E" } :
                                    dias <= 30 ? { background: "#B07A1414", color: "#B07A14" } :
                                                 { background: "#2E893214", color: "#2E8932" }
                                  }
                                >
                                  {dias < 0 ? "Encerrado" : `${dias}d`}
                                </span>
                              ) : (
                                <span
                                  className="text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap"
                                  style={{ background: aberto ? "#2E893214" : "rgba(13,13,13,.07)", color: aberto ? "#2E8932" : "rgba(13,13,13,.35)" }}
                                >
                                  {aberto ? "Aberto" : "Encerrado"}
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <button
                                onClick={() => { setInscricaoEdital(e); setShowInscricaoModal(true); }}
                                className="text-[11px] font-medium text-black/35 hover:text-black transition"
                              >
                                Exportar
                              </button>
                            </td>
                            <td className="px-5 py-3.5">
                              {e.url_acesso && (
                                <a href={e.url_acesso} target="_blank" rel="noopener noreferrer" className="text-black/25 hover:text-black transition">
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="border-t px-5 py-4" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                    <div className="space-y-4">
                      {editais.map(e => (
                        <EditalVotoCard
                          key={e.id}
                          editalId={e.id}
                          votosFunciona={(e as any).votos_funciona ?? 0}
                          votosNaoFunciona={(e as any).votos_nao_funciona ?? 0}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* 5. Investimento trimestral (não se aplica à visão Esporte/Audiovisual) */}
            {(isLeiView || trimestral) && (
              <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <div className="flex border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                  {TRIM_TABS.filter((tab) => !isLeiView || tab !== "trimestral").map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setTrimTab(tab)}
                      className="px-5 py-3.5 text-[12px] font-semibold transition border-b-2"
                      style={{
                        borderColor: effectiveTrimTab === tab ? "#7259B5" : "transparent",
                        color:       effectiveTrimTab === tab ? "#7259B5" : "rgba(13,13,13,.35)",
                      }}
                    >
                      {TRIM_LABELS[tab]}
                    </button>
                  ))}
                </div>
                <div className="p-5">
                  {effectiveTrimTab === "trimestral" && trimestral ? (
                    <TrimestralChart data={trimestral} />
                  ) : (
                    <div>
                      {/* Upload area */}
                      {relatorios.length === 0 && <label
                        className={`flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed rounded cursor-pointer transition mb-4 py-6 ${uploadingRel ? "opacity-50 pointer-events-none" : "hover:border-[#7259B5]/40 hover:bg-[#7259B5]/[.03]"}`}
                        style={{ borderColor: "rgba(13,13,13,.12)" }}
                      >
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          className="hidden"
                          disabled={uploadingRel}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadRelatorio(f); e.target.value = ""; }}
                        />
                        {uploadingRel ? (
                          <span className="w-5 h-5 border-2 border-[#7259B5]/30 border-t-[#7259B5] rounded-full animate-spin" />
                        ) : (
                          <Upload size={18} className="text-black/25" />
                        )}
                        <span className="text-[12px] font-medium text-black/40">
                          {uploadingRel ? "Enviando…" : "Enviar relatório de sustentabilidade"}
                        </span>
                        <span className="text-[10px] text-black/25">PDF, DOC ou DOCX · máx. 50 MB</span>
                      </label>}

                      {reportError && <div role="alert" className="mb-4 rounded border border-[#D94E4E]/20 bg-[#D94E4E]/[.025] px-3 py-2.5 text-[11px] text-[#D94E4E]">{reportError}</div>}

                      {/* Lista de relatórios */}
                      {relatorios.length > 0 ? (
                        <div className="space-y-4">
                          {relatorios.map(rel => {
                            const kb = rel.tamanho_bytes ? Math.round(rel.tamanho_bytes / 1024) : null;
                            const mb = kb && kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : kb ? `${kb} KB` : null;
                            const data = new Date(rel.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
                            const replacing = replacingRelId === rel.id;
                            return (
                              <article
                                key={rel.id}
                                className="group relative aspect-[4/3] min-h-[300px] overflow-hidden rounded-md border bg-[#EDEDE9] sm:aspect-video sm:min-h-[360px]"
                                style={{ borderColor: "rgba(13,13,13,.08)" }}
                              >
                                <a
                                  href={rel.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Abrir relatório ${rel.nome}`}
                                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 ease-out group-hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                                  style={reportCover ? { backgroundImage: `url(${reportCover})` } : undefined}
                                />
                                {!reportCover && (
                                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-black/10">
                                    <FileText size={84} strokeWidth={1} />
                                  </div>
                                )}
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/5" />

                                <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded bg-white/95 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-black/65 shadow-sm backdrop-blur-sm">
                                  <FileText size={11} /> Relatório de sustentabilidade
                                </div>

                                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5">
                                  <p className="max-w-[70%] truncate text-[18px] font-semibold leading-tight tracking-[-.01em] text-white sm:text-[20px]">{rel.nome}</p>
                                  <p className="mt-1 text-[10px] font-medium text-white/65">{data}{mb ? ` · ${mb}` : ""}</p>
                                </div>

                                <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded bg-white/95 p-1 shadow-sm backdrop-blur-sm sm:bottom-5 sm:right-5">
                                <a
                                  href={rel.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 rounded px-2 py-1.5 text-[10px] font-semibold text-black/55 transition hover:bg-black/[.05] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                                >
                                  <ExternalLink size={11} /> Abrir
                                </a>
                                <label className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1.5 text-[10px] font-semibold text-black/55 transition hover:bg-black/[.05] hover:text-black ${replacing ? "pointer-events-none opacity-50" : ""}`} title="Trocar arquivo deste relatório">
                                  <input type="file" accept=".pdf,.doc,.docx" className="hidden" disabled={replacing} onChange={event => { const file = event.target.files?.[0]; if (file) void handleUploadRelatorio(file, rel); event.target.value = ""; }}/>
                                  {replacing ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/15 border-t-black/50"/> : <RefreshCw size={11}/>} {replacing ? "Trocando…" : "Trocar"}
                                </label>
                                <button
                                  onClick={() => handleDeleteRelatorio(rel)}
                                  className="rounded p-1.5 text-black/30 transition hover:bg-red-50 hover:text-[#D94E4E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D94E4E]/25"
                                  title="Remover relatório"
                                >
                                  <Trash2 size={12} />
                                </button>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-center text-[11px] text-black/25 py-2">Nenhum relatório enviado ainda.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tipologia */}
            {tipologia && (
              <div className="bg-white rounded border p-5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <p className="text-[10px] font-bold text-black/35 uppercase tracking-wide mb-1">Perfil</p>
                <p className="text-sm font-semibold text-black mb-4">Tipologia de projetos apoiados</p>
                <TipologiaChart t={tipologia} />
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="px-8 py-8 w-full animate-pulse">
      <div className="h-3.5 w-28 bg-black/8 rounded mb-6" />
      <div className="flex gap-4 mb-6">
        <div className="w-14 h-14 rounded bg-black/8" />
        <div className="space-y-2">
          <div className="h-6 w-52 bg-black/8 rounded" />
          <div className="h-3 w-36 bg-black/8 rounded" />
          <div className="flex gap-1.5">
            {[0,1,2,3].map(i => <div key={i} className="h-4 w-8 rounded bg-black/8" />)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[0,1,2].map(i => <div key={i} className="h-20 rounded bg-black/8" />)}
      </div>
      <div className="grid xl:grid-cols-[220px_1fr_300px] gap-6">
        <div className="h-48 rounded bg-black/8" />
        <div className="space-y-4">
          <div className="h-48 rounded bg-black/8" />
          <div className="h-48 rounded bg-black/8" />
        </div>
        <div className="h-64 rounded bg-black/8" />
      </div>
    </div>
  );
}
