"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Texto livre (descrição) mostrado em poucas linhas. "Ver mais" só aparece
 * quando o texto passa do limite; quebras de parágrafo digitadas são mantidas.
 */
export function TextoRecolhivel({ texto, linhas = 3, className = "" }: {
  texto: string;
  linhas?: number;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [aberto, setAberto] = useState(false);
  const [transborda, setTransborda] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || aberto) return;
    const medir = () => setTransborda(el.scrollHeight - el.clientHeight > 1);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [aberto, texto, linhas]);

  return (
    <div className={className}>
      <p
        ref={ref}
        className="whitespace-pre-line break-words"
        style={aberto ? undefined : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: linhas, overflow: "hidden" }}
      >
        {texto}
      </p>
      {(transborda || aberto) && (
        <button
          type="button"
          onClick={() => setAberto(valor => !valor)}
          aria-expanded={aberto}
          className="mt-1.5 inline-flex min-h-8 items-center gap-1 rounded text-[0.75rem] font-medium text-black/50 transition-colors duration-200 hover:text-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] motion-reduce:transition-none"
        >
          {aberto ? "Ver menos" : "Ver mais"}
          <ChevronDown size={13} className={`transition-transform duration-200 motion-reduce:transition-none ${aberto ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
