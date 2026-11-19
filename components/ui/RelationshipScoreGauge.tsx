"use client";

import { AlertTriangle } from "lucide-react";

type Props = {
  score: number | null;
  label?: string;
  compact?: boolean;
  variant?: "relationship" | "commercial" | "conversion" | "health" | "supply" | "captador";
  titleOverride?: string;
};

/** Escala em folha, o verde alegre da identidade (#3DA86A); roxo fica para navegação e seleção. */
export const SEGMENTS = [
  { from: 180, to: 148, color: "rgba(61,168,106,.35)" },
  { from: 144, to: 112, color: "rgba(61,168,106,.50)" },
  { from: 108, to: 76,  color: "rgba(61,168,106,.65)" },
  { from: 72,  to: 40,  color: "rgba(61,168,106,.80)" },
  { from: 36,  to: 4,   color: "#3DA86A" },
];

function point(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return { x: 80 + radius * Math.cos(radians), y: 68 - radius * Math.sin(radians) };
}

function arc(from: number, to: number) {
  const start = point(from, 48);
  const end = point(to, 48);
  return `M ${start.x} ${start.y} A 48 48 0 0 1 ${end.x} ${end.y}`;
}

/** Leitura neutra; a cor fica só no arco. Só as faixas baixas de saúde e relação levam ícone de alerta. */
function scoreMeta(score: number | null, variant: NonNullable<Props["variant"]>): { title: string; alerta?: string } {
  if (score === null) return { title: "Sem leitura" };

  if (variant === "commercial") {
    if (score < 25) return { title: "Baixo potencial" };
    if (score < 45) return { title: "Potencial incerto" };
    if (score < 65) return { title: "Oportunidade possível" };
    if (score < 82) return { title: "Forte oportunidade" };
    return { title: "Alta prioridade" };
  }

  if (variant === "conversion") {
    if (score < 20) return { title: "Improvável converter" };
    if (score < 40) return { title: "Pouco provável" };
    if (score < 60) return { title: "Possível" };
    if (score < 80) return { title: "Provável" };
    return { title: "Alta chance" };
  }

  if (variant === "supply") {
    if (score < 25) return { title: "Sem viabilidade" };
    if (score < 45) return { title: "Em estruturação" };
    if (score < 65) return { title: "Promissor" };
    if (score < 82) return { title: "Forte potencial" };
    return              { title: "Prioritário" };
  }

  if (variant === "health") {
    if (score < 25) return { title: "Risco crítico", alerta: "#D94A4A" };
    if (score < 45) return { title: "Precisa de atenção", alerta: "#B07A14" };
    if (score < 65) return { title: "Parceria estável" };
    if (score < 82) return { title: "Parceria saudável" };
    return { title: "Parceria forte" };
  }

  if (variant === "captador") {
    if (score < 25) return { title: "Sem tração" };
    if (score < 45) return { title: "Em desenvolvimento" };
    if (score < 65) return { title: "Operacional" };
    if (score < 82) return { title: "Alto desempenho" };
    return              { title: "Referência" };
  }

  if (score < 25) return { title: "Relação frágil", alerta: "#D94A4A" };
  if (score < 45) return { title: "Em atenção", alerta: "#B07A14" };
  if (score < 65) return { title: "Estável" };
  if (score < 82) return { title: "Em evolução" };
  return { title: "Relação forte" };
}

export function RelationshipScoreGauge({ score, label = "Potencial de relacionamento", compact = false, variant = "relationship", titleOverride }: Props) {
  const value = Math.max(0, Math.min(100, score ?? 0));
  const angle = 180 - value * 1.76 - 2;
  const needleTip = point(angle, 29);
  const radians = (angle * Math.PI) / 180;
  const baseCenter = point(angle, 6);
  const perpendicularX = -Math.sin(radians) * 5;
  const perpendicularY = -Math.cos(radians) * 5;
  const needleLeft = { x: baseCenter.x + perpendicularX, y: baseCenter.y + perpendicularY };
  const needleRight = { x: baseCenter.x - perpendicularX, y: baseCenter.y - perpendicularY };
  const meta = scoreMeta(score, variant);

  return (
    <div className={compact ? "w-[10.5rem]" : "w-full max-w-[13.75rem]"}>
      <p className="mb-1 text-center text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{label}</p>
      <svg viewBox="0 0 160 78" className={compact ? "h-[4rem] w-full" : "h-[4.875rem] w-full"} role="img" aria-label={`${label}: ${score ?? "sem dados"}`}>
        {SEGMENTS.map((segment, index) => (
          <path key={index} d={arc(segment.from, segment.to)} fill="none" stroke={score !== null && value > index * 20 ? segment.color : "rgba(13,13,13,.075)"} strokeWidth="17" />
        ))}
        <path
          d={`M ${needleLeft.x} ${needleLeft.y} L ${needleTip.x} ${needleTip.y} L ${needleRight.x} ${needleRight.y} Z`}
          fill="white"
          stroke="#282525"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="80" cy="68" r="7" fill="white" stroke="#282525" strokeWidth="2.25" />
        <circle cx="80" cy="68" r="2.25" fill="#282525" />
      </svg>
      <div className={compact ? "-mt-1 text-center" : "text-center"}>
        <p className={`inline-flex items-center gap-1 text-[0.6875rem] font-medium ${score === null ? "text-black/30" : "text-black/60"}`}>
          {!titleOverride && meta.alerta && <AlertTriangle size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0" style={{ color: meta.alerta }} />}
          {titleOverride ?? meta.title}
        </p>
      </div>
    </div>
  );
}
