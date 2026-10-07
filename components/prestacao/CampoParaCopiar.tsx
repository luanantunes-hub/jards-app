"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Um campo com o botão de copiar, para colar no sistema oficial (Salic, PagTesouro). */
export function CampoParaCopiar({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { /* sem permissão de área de transferência: o texto continua selecionável */ }
  }
  return (
    <div className="flex items-center gap-3 px-6 py-2">
      <span className="w-[10rem] shrink-0 text-[0.6875rem] text-black/45">{rotulo}</span>
      <span className="min-w-0 flex-1 select-all break-words text-[0.75rem] tabular-nums text-black/85">{valor ?? <span className="text-black/25">—</span>}</span>
      {valor && (
        <button
          type="button"
          onClick={copiar}
          aria-label={copiado ? `${rotulo} copiado` : `Copiar ${rotulo}`}
          className="shrink-0 rounded p-2 text-black/35 transition hover:bg-black/[.05] hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]"
        >
          {copiado ? <Check size={13} className="text-[#2E8932]" aria-hidden /> : <Copy size={13} aria-hidden />}
        </button>
      )}
    </div>
  );
}
