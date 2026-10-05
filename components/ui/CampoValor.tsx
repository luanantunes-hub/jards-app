"use client";

import { formatarValorBRL, lerValorBRL } from "@/lib/valor";

/** Campo de valor em reais: digita livre e formata ao sair (150.000,00). */
export function CampoValor({ id, value, onChange, placeholder = "0,00", invalido = false, autoFocus = false, ariaLabel, disabled = false }: {
  id?: string;
  value: string;
  onChange: (texto: string) => void;
  placeholder?: string;
  invalido?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex h-10 items-center gap-2 rounded border px-3 transition focus-within:ring-2 ${disabled ? "bg-black/[.02]" : "bg-white"} ${invalido ? "border-[#D94E4E] focus-within:ring-[#D94E4E]/15" : "border-black/15 focus-within:border-[#7259B5]/45 focus-within:ring-[#7259B5]/15"}`}
    >
      <span className="text-[0.75rem] text-black/35" aria-hidden="true">R$</span>
      <input
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        onBlur={() => {
          const { valor, valido } = lerValorBRL(value);
          if (valido && valor != null) onChange(formatarValorBRL(valor));
        }}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalido || undefined}
        className="min-w-0 flex-1 bg-transparent text-[0.8125rem] tabular-nums text-black outline-none placeholder:text-black/25 disabled:cursor-not-allowed disabled:text-black/60"
      />
    </div>
  );
}
