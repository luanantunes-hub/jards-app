import type { CSSProperties } from "react";

/**
 * Grão de giz: ruído fractal que vira máscara. Onde o ruído é forte a cor aparece, onde é fraco o papel
 * aparece, e o elemento ganha o acabamento de pastel. Vale para qualquer bloco HTML (barras, segmentos).
 */
export const GRAO_DE_GIZ = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 3.2 -0.6'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

/** Estilo pronto para pôr o grão de giz num bloco: `style={{ ...ESTILO_DE_GIZ }}`. */
export const ESTILO_DE_GIZ: CSSProperties = { WebkitMaskImage: GRAO_DE_GIZ, maskImage: GRAO_DE_GIZ };

/** Cantos levemente irregulares, como giz passado à mão. */
export const CANTOS_DE_GIZ = "2px 3px 2px 3px";
