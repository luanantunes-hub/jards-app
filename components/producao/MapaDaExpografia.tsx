"use client";

import { useRef, useState } from "react";
import { pixelsParaMetros } from "@/lib/producao/planta";
import { lugarDaObra, obrasNaPlanta, tamanhoNaPlanta, type ObraDeArte, type ObraNaSala } from "@/lib/producao/expografia";

export type PlantaDaSala = { id: string; nome: string; largura_m: number; profundidade_m: number; fundo: string | null; fundo_opacidade: number };

const BOTAO_PEQUENO = "h-8 rounded border border-black/12 bg-white px-2.5 text-[0.6875rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50";

/**
 * Onde cada obra fica na planta da sala (PD8.5, segundo corte): arrastar a obra pelo desenho, ou — no celular —
 * escolher a obra na lista e tocar no lugar. Quem só lê vê o desenho e não mexe.
 */
export function MapaDaExpografia({ planta, obras, inventario, podeEditar, onMover, onTirar }: {
  planta: PlantaDaSala;
  obras: readonly ObraNaSala[];
  inventario: Map<string, ObraDeArte>;
  podeEditar: boolean;
  onMover: (obraId: string, lugar: { x_m: number; y_m: number }) => void;
  onTirar: (obraId: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const arrasto = useRef<{ id: string; deslocX: number; deslocY: number } | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const { postas, fora } = obrasNaPlanta(obras);
  const viewBox = { x: -0.5, y: -0.5, largura: planta.largura_m + 1, altura: planta.profundidade_m + 1 };
  const tamanho = (obra: ObraNaSala) => tamanhoNaPlanta(inventario.get(obra.item_id) ?? { largura_cm: null, comprimento_cm: null });
  const nome = (obra: ObraNaSala) => inventario.get(obra.item_id)?.nome ?? "Obra";

  function pontoEm(event: React.PointerEvent, alvo: Element) {
    return pixelsParaMetros({ x: event.clientX, y: event.clientY }, alvo.getBoundingClientRect(), viewBox);
  }

  function aoPressionar(event: React.PointerEvent<SVGGElement>, obra: ObraNaSala) {
    setEscolhida(obra.id);
    if (!podeEditar || !svgRef.current) return;
    const ponto = pontoEm(event, svgRef.current);
    arrasto.current = { id: obra.id, deslocX: ponto.x - (obra.x_m ?? 0), deslocY: ponto.y - (obra.y_m ?? 0) };
    svgRef.current.setPointerCapture(event.pointerId);
  }

  function aoMover(event: React.PointerEvent<SVGSVGElement>) {
    const atual = arrasto.current;
    if (!atual) return;
    const obra = obras.find(item => item.id === atual.id);
    if (!obra) return;
    const ponto = pontoEm(event, event.currentTarget);
    onMover(obra.id, lugarDaObra({ x: ponto.x - atual.deslocX, y: ponto.y - atual.deslocY }, tamanho(obra), planta));
  }

  /** Tocar no desenho põe a obra escolhida ali: o jeito de quem está no celular e não consegue arrastar. */
  function aoTocar(event: React.PointerEvent<SVGSVGElement>) {
    if (!podeEditar || arrasto.current || !escolhida) return;
    const obra = obras.find(item => item.id === escolhida);
    if (!obra) return;
    const ponto = pontoEm(event, event.currentTarget);
    const medida = tamanho(obra);
    onMover(obra.id, lugarDaObra({ x: ponto.x - medida.largura_m / 2, y: ponto.y - medida.profundidade_m / 2 }, medida, planta));
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded border bg-white p-3" style={{ borderColor: "rgba(13,13,13,.1)" }}>
        <svg
          ref={svgRef}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.largura} ${viewBox.altura}`}
          role="img"
          aria-label={`Planta ${planta.nome} com ${postas.length} de ${obras.length} obras no lugar`}
          className="block w-full select-none"
          style={{ maxHeight: "28rem" }}
          onPointerMove={aoMover}
          onPointerUp={() => { arrasto.current = null; }}
          onPointerCancel={() => { arrasto.current = null; }}
          onPointerDown={event => { if (event.target === event.currentTarget) aoTocar(event); }}
        >
          <rect x={0} y={0} width={planta.largura_m} height={planta.profundidade_m} fill="#FAFAF9" stroke="rgba(13,13,13,.35)" strokeWidth={0.05} />
          {planta.fundo && <image href={planta.fundo} x={0} y={0} width={planta.largura_m} height={planta.profundidade_m} preserveAspectRatio="xMidYMid meet" opacity={planta.fundo_opacidade / 100} aria-hidden="true" style={{ pointerEvents: "none" }} />}
          {postas.map(obra => {
            const medida = tamanho(obra);
            const marcada = obra.id === escolhida;
            const letra = Math.max(0.14, Math.min(0.3, (medida.largura_m / Math.max(nome(obra).length, 1)) * 1.7));
            return (
              <g key={obra.id} transform={`translate(${obra.x_m ?? 0} ${obra.y_m ?? 0})`} onPointerDown={event => aoPressionar(event, obra)} style={{ cursor: podeEditar ? "grab" : "pointer" }}>
                <title>{nome(obra)}</title>
                <rect
                  width={medida.largura_m} height={medida.profundidade_m}
                  fill={obra.instalada_em ? "rgba(46,137,50,.16)" : "rgba(114,89,181,.14)"}
                  stroke={marcada ? "#7259B5" : obra.instalada_em ? "#2E8932" : "rgba(13,13,13,.45)"}
                  strokeWidth={marcada ? 0.08 : 0.04}
                />
                <text x={medida.largura_m / 2} y={medida.profundidade_m / 2 + letra * 0.35} textAnchor="middle" fontSize={letra} fill="#282525" style={{ pointerEvents: "none" }}>{obra.ordem_montagem}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {escolhida && podeEditar && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.75rem] text-black/55">{nome(obras.find(obra => obra.id === escolhida) ?? ({ item_id: "" } as ObraNaSala))}</span>
          <button type="button" className={BOTAO_PEQUENO} onClick={() => { onTirar(escolhida); setEscolhida(null); }}>Tirar da planta</button>
          <button type="button" className={BOTAO_PEQUENO} onClick={() => setEscolhida(null)}>Soltar seleção</button>
        </div>
      )}

      {fora.length > 0 && (
        <div>
          <p className="mb-1.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">Ainda fora da planta</p>
          <ul className="flex flex-wrap gap-2">
            {fora.map(obra => (
              <li key={obra.id}>
                <button
                  type="button"
                  disabled={!podeEditar}
                  onClick={() => setEscolhida(obra.id)}
                  aria-pressed={obra.id === escolhida}
                  className={`${BOTAO_PEQUENO} ${obra.id === escolhida ? "border-[#7259B5] text-[#7259B5]" : ""}`}
                >
                  {obra.ordem_montagem} · {nome(obra)}
                </button>
              </li>
            ))}
          </ul>
          {escolhida && fora.some(obra => obra.id === escolhida) && <p className="mt-1.5 text-[0.6875rem] text-black/45">Toque na planta para pôr aqui.</p>}
        </div>
      )}
    </div>
  );
}
