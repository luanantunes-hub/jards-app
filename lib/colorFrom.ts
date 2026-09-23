const PALETTE = [
  "#22763F", "#8B5CF6", "#F59E0B", "#0EA5E9", "#1D4ED8",
  "#F97316", "#92400E", "#3B82F6", "#047857", "#E11D48", "#6B7280",
];

export function colorFrom(nome: string) {
  let h = 0;
  for (const c of nome) h = c.charCodeAt(0) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}
