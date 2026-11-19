import { barrasAcesas } from "@/lib/barras-de-valor";

// Grão de giz: ruído fractal que vira máscara. Onde o ruído é forte a cor aparece, onde é fraco o papel
// aparece, e a barra ganha o acabamento de pastel. É o mesmo grão nas barras acesas e nas apagadas.
const GRAO = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 3.2 -0.6'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

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
            borderRadius: "2px 3px 2px 3px",
            WebkitMaskImage: GRAO,
            maskImage: GRAO,
          }}
        />
      ))}
    </div>
  );
}
