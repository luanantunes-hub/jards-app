/**
 * O grão de giz como filtro SVG, para desenhos em `<svg>` (medidores de arco). Ponha dentro de `<defs>`
 * e aplique com `filter="url(#id)"` no grupo. O `id` precisa ser único na página.
 */
export function FiltroDeGiz({ id }: { id: string }) {
  return (
    <filter id={id} x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="3" result="ruido" />
      <feColorMatrix in="ruido" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 3.2 -0.6" result="mascara" />
      <feComposite in="SourceGraphic" in2="mascara" operator="in" />
    </filter>
  );
}
