import { barrasAcesas } from "@/lib/barras-de-valor";
import { CANTOS_DE_GIZ, ESTILO_DE_GIZ } from "@/lib/giz";

/**
 * Fileira de barras verticais com vão entre elas, no lugar da barra contínua, em giz pastel: as acesas
 * levam a cor da empresa com grão de giz e cantos levemente irregulares; as apagadas, um cinza claro
 * com o mesmo grão. O `valor` é medido contra o maior da comparação (`max`).
 */
export function BarrasDeValor({ valor, max, cor, total = 24, altura = "h-4" }: { valor: number; max: number; cor: string; total?: number; altura?: string }) {
  const acesas = barrasAcesas(valor, max, total);
  const percentual = max > 0 ? Math.round((valor / max) * 100) : 0;
  return (
    <div role="img" aria-label={`${percentual}% do maior valor da comparação`} className={`flex w-full items-stretch gap-[3px] ${altura}`}>
      {Array.from({ length: total }, (_, indice) => (
        <span
          key={indice}
          className="min-w-0 flex-1 transition-colors duration-300"
          style={{
            background: indice < acesas ? cor : "rgba(13,13,13,.07)",
            borderRadius: CANTOS_DE_GIZ,
            ...ESTILO_DE_GIZ,
          }}
        />
      ))}
    </div>
  );
}
