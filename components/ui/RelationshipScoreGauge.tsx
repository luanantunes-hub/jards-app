"use client";

type Props = {
  score: number | null;
  label?: string;
  compact?: boolean;
  variant?: "relationship" | "commercial" | "conversion" | "health" | "supply" | "captador";
  titleOverride?: string;
};

const SEGMENTS = [
  { from: 180, to: 148, color: "rgba(114,89,181,.35)" },
  { from: 144, to: 112, color: "rgba(114,89,181,.50)" },
  { from: 108, to: 76,  color: "rgba(114,89,181,.65)" },
  { from: 72,  to: 40,  color: "rgba(114,89,181,.80)" },
  { from: 36,  to: 4,   color: "#7259B5" },
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

function scoreMeta(score: number | null, variant: NonNullable<Props["variant"]>) {
  if (score === null) return { title: "Sem leitura", color: "rgba(13,13,13,.32)" };

  if (variant === "commercial") {
    if (score < 25) return { title: "Baixo potencial", color: "#D94E4E" };
    if (score < 45) return { title: "Potencial incerto", color: "#B07A14" };
    if (score < 65) return { title: "Oportunidade possível", color: "#2D72B0" };
    if (score < 82) return { title: "Forte oportunidade", color: "#7259B5" };
    return { title: "Alta prioridade", color: "#2E8932" };
  }

  if (variant === "conversion") {
    if (score < 20) return { title: "Improvável converter", color: "#D94E4E" };
    if (score < 40) return { title: "Pouco provável", color: "#B07A14" };
    if (score < 60) return { title: "Possível", color: "#2D72B0" };
    if (score < 80) return { title: "Provável", color: "#7259B5" };
    return { title: "Alta chance", color: "#2E8932" };
  }

  if (variant === "supply") {
    if (score < 25) return { title: "Sem viabilidade",   color: "#D94E4E" };
    if (score < 45) return { title: "Em estruturação",   color: "#B07A14" };
    if (score < 65) return { title: "Promissor",         color: "#2D72B0" };
    if (score < 82) return { title: "Forte potencial",   color: "#7259B5" };
    return              { title: "Prioritário",          color: "#2E8932" };
  }

  if (variant === "health") {
    if (score < 25) return { title: "Risco crítico", color: "#D94E4E" };
    if (score < 45) return { title: "Precisa de atenção", color: "#B07A14" };
    if (score < 65) return { title: "Parceria estável", color: "#2D72B0" };
    if (score < 82) return { title: "Parceria saudável", color: "#7259B5" };
    return { title: "Parceria forte", color: "#2E8932" };
  }

  if (variant === "captador") {
    if (score < 25) return { title: "Sem tração",        color: "#D94E4E" };
    if (score < 45) return { title: "Em desenvolvimento", color: "#B07A14" };
    if (score < 65) return { title: "Operacional",        color: "#2D72B0" };
    if (score < 82) return { title: "Alto desempenho",    color: "#7259B5" };
    return              { title: "Referência",            color: "#2E8932" };
  }

  if (score < 25) return { title: "Relação frágil", color: "#D94E4E" };
  if (score < 45) return { title: "Em atenção", color: "#B07A14" };
  if (score < 65) return { title: "Estável", color: "#2D72B0" };
  if (score < 82) return { title: "Em evolução", color: "#7259B5" };
  return { title: "Relação forte", color: "#2E8932" };
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
      <p className="mb-1 text-center text-[0.5625rem] font-medium tracking-[.04em] text-black/30">{label}</p>
      <svg viewBox="0 0 160 78" className={compact ? "h-[4rem] w-full" : "h-[4.875rem] w-full"} role="img" aria-label={`${label}: ${score ?? "sem dados"}`}>
        {SEGMENTS.map((segment, index) => (
          <path key={index} d={arc(segment.from, segment.to)} fill="none" stroke={score !== null && value > index * 20 ? segment.color : "rgba(13,13,13,.075)"} strokeWidth="17" />
        ))}
        <path
          d={`M ${needleLeft.x} ${needleLeft.y} L ${needleTip.x} ${needleTip.y} L ${needleRight.x} ${needleRight.y} Z`}
          fill="white"
          stroke="#0D0D0D"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="80" cy="68" r="7" fill="white" stroke="#0D0D0D" strokeWidth="2.25" />
        <circle cx="80" cy="68" r="2.25" fill="#0D0D0D" />
      </svg>
      <div className={compact ? "-mt-1 text-center" : "text-center"}>
        <p className="text-[0.6875rem] font-semibold" style={{ color: meta.color }}>{titleOverride ?? meta.title}</p>
      </div>
    </div>
  );
}
