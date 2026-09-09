"use client";

const SEGMENT_OPACITY = [0.26, 0.42, 0.58, 0.76, 1] as const;

export function SegmentedScoreArc({
  score,
  viewBoxSize = 112,
  radius = 46,
  strokeWidth = 8,
  color = "#7259B5",
  className = "h-full w-full -rotate-90",
  label,
}: {
  score: number | null;
  viewBoxSize?: number;
  radius?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
  label: string;
}) {
  const center = viewBoxSize / 2;
  const circumference = 2 * Math.PI * radius;
  const step = circumference / 5;
  const gap = circumference * (8 / 360);
  const segmentLength = step - gap;
  const activeSegments = score === null ? 0 : Math.max(0, Math.min(5, Math.round(score)));

  return (
    <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className={className} role="img" aria-label={label}>
      {SEGMENT_OPACITY.map((opacity, index) => {
        const active = index < activeSegments;
        return (
          <circle
            key={index}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={active ? color : "rgba(13,13,13,.065)"}
            strokeOpacity={active ? opacity : 1}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            strokeDashoffset={-index * step}
            className="transition-[stroke,stroke-opacity] duration-300 ease-out"
          />
        );
      })}
    </svg>
  );
}
