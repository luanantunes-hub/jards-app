"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { abasDaRota } from "@/lib/ticketeria/menu";

/** A barra de abas das páginas agrupadas (Vendas, Divulgação, Configurações). Nas demais não aparece. */
export function SubmenuDaTicketeria() {
  const path = usePathname();
  const achado = abasDaRota(path);
  if (!achado) return null;
  return (
    <nav aria-label="Seções" className="flex gap-1 overflow-x-auto px-5 pt-4 md:px-10">
      {achado.grupo.abas.map(aba => {
        const ativa = aba === achado.ativa;
        return (
          <Link key={aba.href} href={aba.href} prefetch={false} aria-current={ativa ? "page" : undefined}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-[0.8125rem] font-normal transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${ativa ? "bg-black/[.06] text-[#282525]" : "text-black/45 hover:bg-black/[.04] hover:text-black/70"}`}>
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
