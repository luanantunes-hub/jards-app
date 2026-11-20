import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Bloco recolhido para o que a maioria das pessoas não precisa: abre ao clicar no título. */
export function Detalhes({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <details className="group rounded border border-black/10 bg-white">
      <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-2 rounded px-4 text-[0.75rem] font-medium text-black/70 transition hover:bg-black/[.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] [&::-webkit-details-marker]:hidden">
        {titulo}
        <ChevronDown size={14} aria-hidden="true" className="flex-shrink-0 text-black/40 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-black/10 px-4 py-4 text-sm text-black/70">{children}</div>
    </details>
  );
}
