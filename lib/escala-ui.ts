// Fator da fonte base da página em relação a 16px: 1 até 1799px de largura e
// maior em telas grandes (ver as media queries no início de app/globals.css).
// Use para converter medidas que o JavaScript calcula em px (posições,
// alturas de menus, desenhos em SVG) e que precisam crescer junto com o rem.
export function escalaUi(): number {
  if (typeof window === "undefined") return 1;
  const tamanho = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return tamanho > 0 ? tamanho / 16 : 1;
}
