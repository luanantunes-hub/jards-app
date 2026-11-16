"use client";

import { Printer } from "lucide-react";

/** Abre a janela de impressão do navegador. Na impressão o botão some (print:hidden), junto dos filtros. */
export function BotaoImprimir({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer size={13} aria-hidden="true" /> Imprimir
    </button>
  );
}
