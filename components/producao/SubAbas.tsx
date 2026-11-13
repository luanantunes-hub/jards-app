"use client";

/** Um segundo nível de abas, menor, dentro de uma aba da página (por exemplo, os assuntos do dinheiro da temporada). */
export function SubAbas({ ariaLabel, itens, ativo, onChange }: { ariaLabel: string; itens: readonly { id: string; rotulo: string }[]; ativo: string; onChange: (id: string) => void }) {
  return (
    <nav aria-label={ariaLabel} className="-mx-1 mb-2 flex items-center gap-1 overflow-x-auto px-1 pb-1">
      {itens.map(item => {
        const marcado = item.id === ativo;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={marcado ? "page" : undefined}
            onClick={() => onChange(item.id)}
            className={`h-9 shrink-0 rounded border px-3.5 text-[0.75rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] ${
              marcado ? "border-[#282525] bg-[#282525] text-white" : "border-black/12 bg-white text-black/60 hover:bg-black/[.04]"
            }`}
          >
            {item.rotulo}
          </button>
        );
      })}
    </nav>
  );
}
