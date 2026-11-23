import { calcularLayout, type Layout } from "@/lib/ticketeria/mapa-layout";
import type { EstadoDoAssento } from "@/lib/ticketeria/mapa";

// O mapa de assentos desenhado pelo motor de layout (lib/ticketeria/mapa-layout.ts): um SVG que se ajusta à largura, com cada lugar na posição que o motor calculou.
// Só desenho: o estado de cada lugar e o que acontece ao tocar chegam por props. Ainda não está ligado às telas de compra e do editor (M1, primeira fatia).

/** A chave de um lugar no mapa de estados: setor (ou vazio), fileira e número. */
export const chaveDoLugar = (setor: string | null, fileira: string, numero: number) => `${setor ?? ""}|${fileira}|${numero}`;

const PASSO = 28; // pixels de um passo (distância entre dois lugares) no tamanho natural
const LADO = 0.84; // o lado do lugar, em passos
const COM_NUMERO_ATE = 400; // acima disso o número do lugar não cabe e sai do desenho

export function MapaPorLayout({ layout, estados, modo, onAlternar, rotuloDoMapa = "Mapa de lugares" }: {
  layout: Layout;
  /** O estado de cada lugar, pela `chaveDoLugar`; o que não está aqui é livre. */
  estados?: ReadonlyMap<string, EstadoDoAssento>;
  modo: "comprador" | "produtor";
  onAlternar?: (lugar: { setor: string | null; fileira: string; numero: number }) => void;
  rotuloDoMapa?: string;
}) {
  const { lugares, caixa } = calcularLayout(layout);
  const folga = 0.8;
  const x0 = caixa.x0 - folga, y0 = caixa.y0 - folga, largura = caixa.x1 - caixa.x0 + 2 * folga, altura = caixa.y1 - caixa.y0 + 2 * folga;
  const comNumero = lugares.length <= COM_NUMERO_ATE;
  const p = layout.palco;
  return (
    <svg viewBox={`${x0} ${y0} ${largura} ${altura}`} width="100%" style={{ maxWidth: largura * PASSO, height: "auto" }} role="group" aria-label={rotuloDoMapa} className="mx-auto block">
      {p && (
        <g aria-hidden="true">
          <rect x={p.x - p.largura / 2} y={p.y - p.altura / 2} width={p.largura} height={p.altura} rx={0.5} fill="rgba(0,0,0,.04)" stroke="rgba(0,0,0,.15)" strokeWidth={0.06} />
          <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={0.62} letterSpacing={0.18} fill="rgba(0,0,0,.45)">{p.rotulo.toUpperCase()}</text>
        </g>
      )}
      {lugares.map(l => {
        const estado = estados?.get(chaveDoLugar(l.setor, l.fileira, l.numero)) ?? "livre";
        const nome = `Fileira ${l.fileira}, lugar ${l.numero}`;
        const desligado = estado === "ocupado" || (modo === "comprador" && estado === "bloqueado");
        const preenchimento = estado === "selecionado" ? "#282525" : estado === "ocupado" ? "rgba(0,0,0,.09)" : estado === "bloqueado" ? "rgba(0,0,0,.05)" : "#fff";
        const borda = estado === "selecionado" || estado === "ocupado" ? "none" : "rgba(0,0,0,.3)";
        const texto = estado === "selecionado" ? "#fff" : estado === "ocupado" ? "rgba(0,0,0,.25)" : "#282525";
        return (
          <g
            key={`${l.bloco}|${l.fileira}|${l.numero}`}
            role="button"
            tabIndex={desligado ? -1 : 0}
            aria-label={`${nome}, ${estado === "selecionado" ? "escolhido" : estado === "ocupado" ? "ocupado" : estado === "bloqueado" ? "bloqueado" : "livre"}`}
            aria-pressed={estado === "selecionado" || estado === "bloqueado"}
            aria-disabled={desligado || undefined}
            onClick={desligado ? undefined : () => onAlternar?.({ setor: l.setor, fileira: l.fileira, numero: l.numero })}
            onKeyDown={desligado ? undefined : e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAlternar?.({ setor: l.setor, fileira: l.fileira, numero: l.numero }); } }}
            style={{ cursor: desligado ? "not-allowed" : "pointer" }}
          >
            <rect x={l.x - LADO / 2} y={l.y - LADO / 2} width={LADO} height={LADO} rx={0.2} fill={preenchimento} stroke={borda} strokeWidth={0.05} strokeDasharray={estado === "bloqueado" ? "0.18 0.12" : undefined} />
            {comNumero && <text x={l.x} y={l.y} textAnchor="middle" dominantBaseline="central" fontSize={0.4} fill={texto} pointerEvents="none">{l.numero}</text>}
          </g>
        );
      })}
    </svg>
  );
}
