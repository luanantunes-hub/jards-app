"use client";

import { Check, Copy } from "lucide-react";

/** Botão "Copiar" com texto (o ícone sozinho não diz o que acontece) que vira "Copiado" por 2 s. */
export function BotaoCopiar({ copiado, onCopiar, rotulo, disabled }: { copiado: boolean; onCopiar: () => void; rotulo: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onCopiar}
      disabled={disabled}
      aria-label={rotulo}
      className="inline-flex h-10 w-full flex-shrink-0 items-center justify-center gap-2 rounded border border-black/15 bg-white px-3 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-40 sm:w-auto"
    >
      {copiado ? <Check size={14} className="text-[#2E8932]" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copiado ? "Copiado" : "Copiar"}
    </button>
  );
}

/** Texto técnico (endereço, comando) numa caixa rolável, com o botão Copiar ao lado. */
export function CaixaCopiavel({ texto, copiado, onCopiar, rotulo, carregando }: { texto: string; copiado: boolean; onCopiar: () => void; rotulo: string; carregando?: boolean }) {
  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap rounded border border-black/10 bg-black/[0.02] px-3 py-2.5 text-[0.75rem]">
        {carregando ? "…" : texto}
      </code>
      <BotaoCopiar copiado={copiado} onCopiar={onCopiar} rotulo={rotulo} disabled={carregando} />
    </div>
  );
}
