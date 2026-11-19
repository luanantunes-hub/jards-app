import { barrasAcesas } from "@/lib/barras-de-valor";

/**
 * Fileira de barras verticais com vão entre elas, no lugar da barra contínua. As acesas levam a cor
 * da empresa; as outras, um cinza bem claro. O `valor` é medido contra o maior da comparação (`max`).
 */
export function BarrasDeValor({ valor, max, cor, total = 24, altura = "h-4" }: { valor: number; max: number; cor: string; total?: number; altura?: string }) {
  const acesas = barrasAcesas(valor, max, total);
  const percentual = max > 0 ? Math.round((valor / max) * 100) : 0;
  return (
    <div role="img" aria-label={`${percentual}% do maior valor da comparação`} className={`flex w-full items-stretch gap-[3px] ${altura}`}>
      {Array.from({ length: total }, (_, indice) => (
        <span
          key={indice}
          className="min-w-0 flex-1 rounded-[1px] transition-colors duration-300"
          style={{ background: indice < acesas ? cor : "rgba(13,13,13,.06)" }}
        />
      ))}
    </div>
  );
}
