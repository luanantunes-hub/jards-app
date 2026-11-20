"use client";

import { useRef } from "react";
import { formatarValorBRL, lerValorBRL, mascararValorBRL } from "@/lib/valor";

type PropsDoInputValor = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> & {
  value: string;
  onChange: (texto: string) => void;
};

/**
 * Entrada de valor em reais: os pontos de milhar e a vírgula dos centavos
 * aparecem enquanto a pessoa digita (1.234,56) e os centavos se completam ao
 * sair (1.234,00). O ponto do teclado numérico vira vírgula, e apagar em cima
 * de um ponto apaga o algarismo ao lado. O texto volta para quem usa; leia
 * com lerValorBRL.
 */
export function InputValor({ value, onChange, onBlur, ...resto }: PropsDoInputValor) {
  const campo = useRef<HTMLInputElement>(null);

  function mudar(evento: React.ChangeEvent<HTMLInputElement>) {
    const { inputType, data } = evento.nativeEvent as InputEvent;
    let texto = evento.target.value;
    let posicao = evento.target.selectionStart ?? texto.length;
    if (data === "." && !value.includes(",") && texto[posicao - 1] === ".") {
      texto = `${texto.slice(0, posicao - 1)},${texto.slice(posicao)}`;
    }
    if (texto.length === value.length - 1 && value[posicao] === ".") {
      if (inputType === "deleteContentBackward" && posicao > 0) {
        texto = texto.slice(0, posicao - 1) + texto.slice(posicao);
        posicao -= 1;
      } else if (inputType === "deleteContentForward") {
        texto = texto.slice(0, posicao) + texto.slice(posicao + 1);
      }
    }
    const mascarado = mascararValorBRL(texto, posicao);
    onChange(mascarado.texto);
    // Depois que o React escreve o texto novo, o cursor volta para onde a pessoa estava.
    const elemento = campo.current;
    requestAnimationFrame(() => {
      if (elemento && document.activeElement === elemento) elemento.setSelectionRange(mascarado.cursor, mascarado.cursor);
    });
  }

  return (
    <input
      ref={campo}
      autoComplete="off"
      {...resto}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={mudar}
      onBlur={evento => {
        const { valor, valido } = lerValorBRL(value);
        if (valido && valor != null) {
          const completo = formatarValorBRL(valor);
          if (completo !== value) onChange(completo);
        }
        onBlur?.(evento);
      }}
    />
  );
}

/** Campo de valor em reais, com o "R$" na frente e a máscara de InputValor. */
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
      <InputValor
        id={id}
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalido || undefined}
        className="min-w-0 flex-1 bg-transparent text-[0.8125rem] tabular-nums text-[#282525] outline-none placeholder:text-black/25 disabled:cursor-not-allowed disabled:text-black/60"
      />
    </div>
  );
}
