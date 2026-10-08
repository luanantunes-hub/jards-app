import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";

/**
 * Cor só no gráfico: verde é o que entrou, verde claro o que ainda está em
 * conversa, cinza o que falta. Rótulos e valores ficam neutros.
 */
export const MARCA_CAPTACAO = {
  confirmado: "bg-[#2E8932]",
  negociacao: "bg-[#2E8932]/35",
  falta: "bg-black/[.06] ring-1 ring-inset ring-black/[.14]",
} as const;

/** Barra empilhada da meta: confirmado e, logo depois, o que está em negociação. */
export function BarraCaptacao({ confirmado, negociacao = 0, meta, className = "h-2" }: {
  confirmado: number;
  negociacao?: number;
  meta: number | null | undefined;
  className?: string;
}) {
  const pctConfirmado = meta && meta > 0 ? Math.min(100, (Math.max(0, confirmado) / meta) * 100) : 0;
  const pctNegociacao = meta && meta > 0 ? Math.min(100 - pctConfirmado, (Math.max(0, negociacao) / meta) * 100) : 0;
  const segmento = "h-full transition-[width] duration-200 motion-reduce:transition-none";
  return (
    <div className={`flex overflow-hidden rounded bg-black/[.06] ${className}`}>
      <div className={`${segmento} ${MARCA_CAPTACAO.confirmado}`} style={{ width: `${pctConfirmado}%` }} />
      <div className={`${segmento} ${MARCA_CAPTACAO.negociacao}`} style={{ width: `${pctNegociacao}%` }} />
    </div>
  );
}

/**
 * Um número de resumo dentro de um `<dl>`: rótulo neutro (com a marca da barra,
 * quando houver), valor em tinta e apagado quando zerado. `texto` troca o valor
 * por uma palavra ("Meta atingida"); `corTexto` só para esse estado.
 */
export function Indicador({ marca, rotulo, valor, texto, corTexto, tamanho = "md" }: {
  marca?: string;
  rotulo: string;
  valor: number | null | undefined;
  texto?: string;
  corTexto?: string;
  tamanho?: "sm" | "md" | "lg";
}) {
  const vazio = !texto && !valor;
  const fonte = tamanho === "lg" ? "text-[1.25rem] tracking-[-.02em] sm:text-[1.5rem]" : tamanho === "sm" ? "text-[0.9375rem]" : "text-[1rem] tracking-[-.01em] sm:text-[1.125rem]";
  return (
    <div className="flex h-full min-w-0 flex-col">
      <dt className="flex items-start gap-1.5 text-[0.625rem] font-medium uppercase leading-[0.875rem] tracking-[.08em] text-black/45">
        {marca && <span aria-hidden="true" className={`mt-[0.1875rem] h-2 w-2 shrink-0 rounded-[2px] ${marca}`} />}
        {rotulo}
      </dt>
      <dd
        title={texto ? undefined : formatarValorCompleto(valor)}
        className={`mt-auto pt-1.5 font-semibold tabular-nums ${texto ? "break-words" : "truncate"} ${fonte} ${vazio ? "text-black/30" : "text-[#0D0D0D]"}`}
        style={corTexto ? { color: corTexto } : undefined}
      >
        {texto ?? formatarValorCurto(valor)}
      </dd>
    </div>
  );
}
