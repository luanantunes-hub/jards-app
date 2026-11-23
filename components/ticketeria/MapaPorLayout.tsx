"use client";

import { useRef, useState } from "react";
import { calcularLayout, type Layout } from "@/lib/ticketeria/mapa-layout";
import type { EstadoDoAssento } from "@/lib/ticketeria/mapa";
import { SELO_DO_TIPO, TIPO_CURTO, TIPO_EM_TEXTO, type TipoDeLugar } from "@/lib/ticketeria/mapa-acessibilidade";

// O mapa de assentos desenhado pelo motor de layout (lib/ticketeria/mapa-layout.ts): um SVG que se ajusta à largura, com cada lugar na posição que o motor calculou.
// Só desenho: o estado de cada lugar e o que acontece ao tocar chegam por props. Na compra mostra o mapa do setor que tem layout; no editor (modo `desenho`), escolhe e arrasta blocos.

/** A chave de um lugar no mapa de estados: setor (ou vazio), fileira e número. */
export const chaveDoLugar = (setor: string | null, fileira: string, numero: number) => `${setor ?? ""}|${fileira}|${numero}`;

const PASSO = 28; // pixels de um passo (distância entre dois lugares) no tamanho natural
const LADO = 0.84; // o lado do lugar, em passos
const COM_NUMERO_ATE = 400; // acima disso o número do lugar não cabe e sai do desenho

/** O enquadramento do desenho (o que o SVG mostra), em passos. */
type Quadro = { x0: number; y0: number; largura: number; altura: number };

/** Para quem monta o mapa: tocar num lugar escolhe o bloco dele e arrastar move o bloco todo. */
export type DesenhoDoMapa = { blocoEscolhido: string | null; onEscolher: (id: string | null) => void; onMover: (id: string, x: number, y: number) => void };

export function MapaPorLayout({ layout, estados, tipos, modo, onAlternar, rotuloDoMapa = "Mapa de lugares", ampliado = false, desenho }: {
  layout: Layout;
  /** O estado de cada lugar, pela `chaveDoLugar`; o que não está aqui é livre. */
  estados?: ReadonlyMap<string, EstadoDoAssento>;
  /** O tipo de cada lugar, pela `chaveDoLugar`; o que não está aqui é comum. Os lugares de acessibilidade levam um selo com letra e são ditos pelo leitor de tela (Decreto 9.404/2018, art. 23-B). */
  tipos?: ReadonlyMap<string, TipoDeLugar>;
  modo: "comprador" | "produtor";
  onAlternar?: (lugar: { setor: string | null; fileira: string; numero: number }) => void;
  rotuloDoMapa?: string;
  /** Lugares maiores, com rolagem para o lado; sem isso o mapa se ajusta à largura da tela. */
  ampliado?: boolean;
  /** O modo desenho do editor: escolher e arrastar blocos (os lugares deixam de alternar). */
  desenho?: DesenhoDoMapa;
}) {
  const { lugares, caixa } = calcularLayout(layout);
  // No modo desenho sobra espaço em volta, para o bloco poder ser arrastado para fora do que já está desenhado.
  const folga = desenho ? 4 : 0.8;
  const natural: Quadro = { x0: caixa.x0 - folga, y0: caixa.y0 - folga, largura: caixa.x1 - caixa.x0 + 2 * folga, altura: caixa.y1 - caixa.y0 + 2 * folga };
  // Enquanto se arrasta, o enquadramento fica parado (senão ele cresce junto com o bloco e o desenho foge do dedo).
  const [congelado, setCongelado] = useState<Quadro | null>(null);
  const q = congelado ?? natural;
  const svgRef = useRef<SVGSVGElement>(null);
  const arraste = useRef<{ id: string; px: number; py: number; x: number; y: number; escala: number } | null>(null);
  const comNumero = lugares.length <= COM_NUMERO_ATE;
  const p = layout.palco;
  const escolhido = desenho?.blocoEscolhido ?? null;
  const contorno = (() => {
    if (!escolhido) return null;
    const dele = lugares.filter(l => l.bloco === escolhido);
    if (dele.length === 0) return null;
    const xs = dele.map(l => l.x), ys = dele.map(l => l.y);
    return { x: Math.min(...xs) - 0.8, y: Math.min(...ys) - 0.8, largura: Math.max(...xs) - Math.min(...xs) + 1.6, altura: Math.max(...ys) - Math.min(...ys) + 1.6, nome: `Bloco ${layout.blocos.findIndex(b => b.id === escolhido) + 1}` };
  })();

  function comecarArraste(e: React.PointerEvent<SVGSVGElement>) {
    if (!desenho) return;
    const id = (e.target as Element).closest("[data-bloco]")?.getAttribute("data-bloco") ?? null;
    desenho.onEscolher(id);
    const svg = svgRef.current;
    const bloco = id ? layout.blocos.find(b => b.id === id) : undefined;
    if (!id || !svg || !bloco) return;
    arraste.current = { id, px: e.clientX, py: e.clientY, x: bloco.x, y: bloco.y, escala: Math.min(svg.getBoundingClientRect().width / q.largura, svg.getBoundingClientRect().height / q.altura) };
    setCongelado(natural);
    svg.setPointerCapture(e.pointerId);
  }
  function arrastar(e: React.PointerEvent<SVGSVGElement>) {
    const a = arraste.current;
    if (!desenho || !a || a.escala <= 0) return;
    desenho.onMover(a.id, a.x + (e.clientX - a.px) / a.escala, a.y + (e.clientY - a.py) / a.escala);
  }
  function soltar() {
    arraste.current = null;
    setCongelado(null);
  }

  return (
    <div className={ampliado ? "overflow-x-auto pb-1" : ""}>
    <svg
      ref={svgRef} viewBox={`${q.x0} ${q.y0} ${q.largura} ${q.altura}`} width={ampliado ? q.largura * PASSO * 1.35 : "100%"}
      style={{ maxWidth: ampliado ? undefined : q.largura * PASSO, height: "auto", maxHeight: desenho ? "42vh" : undefined, touchAction: desenho ? "none" : undefined }} role="group" aria-label={rotuloDoMapa} className="mx-auto block"
      onPointerDown={desenho ? comecarArraste : undefined} onPointerMove={desenho ? arrastar : undefined} onPointerUp={desenho ? soltar : undefined} onPointerCancel={desenho ? soltar : undefined}
    >
      {p && (
        <g aria-hidden="true">
          <rect x={p.x - p.largura / 2} y={p.y - p.altura / 2} width={p.largura} height={p.altura} rx={0.5} fill="rgba(0,0,0,.04)" stroke="rgba(0,0,0,.15)" strokeWidth={0.06} />
          <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={0.62} letterSpacing={0.18} fill="rgba(0,0,0,.45)">{p.rotulo.toUpperCase()}</text>
        </g>
      )}
      {contorno && (
        <g pointerEvents="none" aria-hidden="true">
          <rect x={contorno.x} y={contorno.y} width={contorno.largura} height={contorno.altura} rx={0.5} fill="rgba(100,80,210,.05)" stroke="#6450D2" strokeWidth={0.1} strokeDasharray="0.35 0.25" />
          <text x={contorno.x + 0.2} y={contorno.y - 0.3} fontSize={0.6} fill="#6450D2">{contorno.nome}</text>
        </g>
      )}
      {lugares.map(l => {
        const estado = estados?.get(chaveDoLugar(l.setor, l.fileira, l.numero)) ?? "livre";
        const tipo = tipos?.get(chaveDoLugar(l.setor, l.fileira, l.numero)) ?? "comum";
        const selo = tipo === "comum" ? null : SELO_DO_TIPO[tipo];
        const nome = `Fileira ${l.fileira}, lugar ${l.numero}${tipo === "comum" ? "" : `, ${TIPO_CURTO[tipo]}`}`;
        const desligado = estado === "ocupado" || (modo === "comprador" && estado === "bloqueado");
        const preenchimento = estado === "selecionado" ? "#282525" : estado === "ocupado" ? "rgba(0,0,0,.09)" : estado === "bloqueado" ? "rgba(0,0,0,.05)" : "#fff";
        const borda = estado === "selecionado" || estado === "ocupado" ? "none" : "rgba(0,0,0,.3)";
        const texto = estado === "selecionado" ? "#fff" : estado === "ocupado" ? "rgba(0,0,0,.25)" : "#282525";
        const aoTocar = () => onAlternar?.({ setor: l.setor, fileira: l.fileira, numero: l.numero });
        const rotulo = `${nome}, ${estado === "selecionado" ? "escolhido" : estado === "ocupado" ? "ocupado" : estado === "bloqueado" ? "bloqueado" : "livre"}`;
        return (
          <g
            key={`${l.bloco}|${l.fileira}|${l.numero}`}
            data-bloco={l.bloco}
            role={desenho ? "img" : "button"}
            tabIndex={desenho || desligado ? -1 : 0}
            aria-label={rotulo}
            aria-pressed={desenho ? undefined : estado === "selecionado" || estado === "bloqueado"}
            aria-disabled={desenho ? undefined : desligado || undefined}
            onClick={desenho || desligado ? undefined : aoTocar}
            onKeyDown={desenho || desligado ? undefined : e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aoTocar(); } }}
            style={{ cursor: desenho ? "grab" : desligado ? "not-allowed" : "pointer" }}
          >
            <rect x={l.x - LADO / 2} y={l.y - LADO / 2} width={LADO} height={LADO} rx={0.2} fill={preenchimento} stroke={borda} strokeWidth={0.05} strokeDasharray={estado === "bloqueado" ? "0.18 0.12" : undefined} />
            {comNumero && <text x={l.x} y={l.y} textAnchor="middle" dominantBaseline="central" fontSize={0.4} fill={texto} pointerEvents="none">{l.numero}</text>}
            {selo && (
              <g pointerEvents="none" aria-hidden="true">
                <circle cx={l.x + LADO / 2 - 0.04} cy={l.y - LADO / 2 + 0.04} r={0.27} fill={selo.cor} stroke="#fff" strokeWidth={0.05} />
                <text x={l.x + LADO / 2 - 0.04} y={l.y - LADO / 2 + 0.05} textAnchor="middle" dominantBaseline="central" fontSize={0.32} fontWeight={700} fill="#fff">{selo.letra}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
    </div>
  );
}

/** A legenda dos tipos de lugar que aparecem no mapa (nenhuma, se só há lugares comuns). */
export function LegendaDeTiposDoMapa({ tipos }: { tipos: readonly Exclude<TipoDeLugar, "comum">[] }) {
  if (tipos.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5" aria-label="Legenda dos lugares de acessibilidade">
      {tipos.map(t => (
        <li key={t} className="flex items-center gap-2 text-[0.75rem] text-black/60">
          <span className="flex h-4 w-4 items-center justify-center rounded-full text-[0.625rem] font-bold text-white" style={{ background: SELO_DO_TIPO[t].cor }} aria-hidden="true">{SELO_DO_TIPO[t].letra}</span>
          {TIPO_EM_TEXTO[t]}
        </li>
      ))}
    </ul>
  );
}
