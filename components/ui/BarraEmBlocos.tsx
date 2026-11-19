import { blocosPorSegmento } from "@/lib/barras-de-valor";
import { CANTOS_DE_GIZ, ESTILO_DE_GIZ } from "@/lib/giz";

export type SegmentoDeBarra = {
  /** Quanto da barra o segmento ocupa, de 0 a 100. */
  percentual: number;
  /** Classe de fundo do bloco (por exemplo, `MARCA_CAPTACAO.confirmado`). */
  className: string;
};

/**
 * Barra de progresso em blocos, no lugar da barra contínua: uma fileira de blocos com vão, em giz
 * pastel (grão de lib/giz.ts). Cada segmento pinta os seus blocos em sequência; os que sobram ficam num
 * cinza claro. A altura mínima de 8px deixa o grão e o vão aparecerem mesmo em barras finas.
 */
export function BarraEmBlocos({ segmentos, total = 20, className = "h-2.5", rotulo, valorAtual }: {
  segmentos: SegmentoDeBarra[];
  total?: number;
  className?: string;
  /** Com rótulo, a barra vira um `progressbar` para leitores de tela. */
  rotulo?: string;
  valorAtual?: number;
}) {
  const blocos = blocosPorSegmento(segmentos.map((segmento) => segmento.percentual), total);
  const classes: string[] = [];
  blocos.forEach((quantidade, indice) => { for (let i = 0; i < quantidade; i++) classes.push(segmentos[indice].className); });
  const acessivel = rotulo ? { role: "progressbar", "aria-label": rotulo, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(valorAtual ?? segmentos.reduce((soma, segmento) => soma + segmento.percentual, 0)) } : { "aria-hidden": true as const };
  return (
    <div className={`flex min-h-2 w-full items-stretch gap-[2px] ${className}`} {...acessivel}>
      {Array.from({ length: total }, (_, indice) => (
        <span
          key={indice}
          className={`min-w-0 flex-1 transition-colors duration-200 motion-reduce:transition-none ${classes[indice] ?? "bg-black/[.07]"}`}
          style={{ borderRadius: CANTOS_DE_GIZ, ...ESTILO_DE_GIZ }}
        />
      ))}
    </div>
  );
}
