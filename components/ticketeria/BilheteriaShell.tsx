import type { ReactNode } from "react";
import { Ticket } from "lucide-react";
import { SairDaBilheteria } from "@/components/ticketeria/SairDaBilheteria";

// A moldura da bilheteria: menu fixo à esquerda (sem logo nem seletor de organização), só com o que a conta pode fazer. Cada fatia acrescenta o seu item.

export function BilheteriaShell({ nome, loja, children }: { nome: string; loja: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#FAF9FB] text-[#282525]">
      <aside className="sticky top-0 flex h-screen w-[13.75rem] shrink-0 flex-col border-r bg-white px-3 py-6" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <p className="px-3 pb-3 text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45">Bilheteria</p>
        <nav aria-label="Bilheteria" className="flex flex-col gap-0.5">
          <span aria-current="page" className="flex items-center gap-2.5 rounded-xl bg-[#F1EEF8] px-3 py-2.5 text-[0.8125rem] font-medium text-[#1C0E33]"><Ticket size={16} aria-hidden="true" />Vender</span>
        </nav>
        <div className="mt-auto border-t px-3 pt-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <p className="text-[0.8125rem]">{nome}</p>
          <p className="text-[0.6875rem] text-black/45">Bilheteria · {loja}</p>
          <SairDaBilheteria />
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
