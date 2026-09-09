import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const PRIO: Record<string, { icon: LucideIcon; color: string }> = {
  alta:  { icon: ArrowUp,   color: "#D94E4E" },
  media: { icon: Minus,     color: "#B07A14" },
  baixa: { icon: ArrowDown, color: "#888888" },
};

export default function PrioBadge({ prio }: { prio: string | null; size?: "sm" | "md" }) {
  if (!prio) return <span className="text-black/15 text-xs">—</span>;
  const p = PRIO[prio];
  if (!p) return null;
  return <p.icon size={16} strokeWidth={3} style={{ color: p.color }} />;
}
