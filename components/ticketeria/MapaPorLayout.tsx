"use client";

import { useEffect, useId, useRef, useState } from "react";
import { calcularLayout, type Layout } from "@/lib/ticketeria/mapa-layout";
import { anguloParaPonto, posicaoDaAlca } from "@/lib/ticketeria/mapa-layout-editor";
import type { EstadoDoAssento } from "@/lib/ticketeria/mapa";
import type { AreaNoDesenho } from "@/lib/ticketeria/mapa-sala";
import { SELO_DO_TIPO, TIPO_CURTO, TIPO_EM_TEXTO, type TipoDeLugar } from "@/lib/ticketeria/mapa-acessibilidade";

// O mapa de assentos desenhado pelo motor de layout (lib/ticketeria/mapa-layout.ts): um SVG que se ajusta à largura, com cada lugar na posição que o motor calculou.
// Só desenho: o estado de cada lugar e o que acontece ao tocar chegam por props. Na compra mostra o mapa do setor que tem layout; no editor (modo `desenho`), escolhe e arrasta blocos.

/** A chave de um lugar no mapa de estados: setor (ou vazio), fileira e número. */
export const chaveDoLugar = (setor: string | null, fileira: string, numero: number) => `${setor ?? ""}|${fileira}|${numero}`;

const PASSO = 28; // pixels de um passo (distância entre dois lugares) no tamanho natural
const LADO = 0.84; // o lado do lugar, em passos
const COM_NUMERO_ATE = 400; // acima disso o número do lugar não cabe e sai do desenho
const ZOOM_MAXIMO = 4;
const BOTAO_ZOOM = "flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[0.75rem] text-black/65 transition hover:bg-black/[.05] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5]";

/** O enquadramento do desenho (o que o SVG mostra), em passos. */
type Quadro = { x0: number; y0: number; largura: number; altura: number };

/** Para quem monta o mapa: tocar num lugar escolhe o bloco dele e arrastar move o bloco todo. */
export type DesenhoDoMapa = {
  blocoEscolhido: string | null; onEscolher: (id: string | null) => void; onMover: (id: string, x: number, y: number) => void;
  /** Girar o bloco escolhido arrastando a alça (`fim`: a pessoa soltou; é quando os vizinhos podem ser empurrados). Sem isto não há alça. */
  onGirar?: (id: string, angulo: number, fim: boolean) => void;
  /** Ajustar a planta de fundo: com `fundoAtivo`, arrastar em qualquer ponto do desenho move o fundo (`onMoverFundo` recebe o canto de cima à esquerda) em vez dos blocos. */
  fundoAtivo?: boolean; onMoverFundo?: (x: number, y: number) => void;
  /** Arrastar uma área em pé (pista): recebe o setor e o canto de cima à esquerda. Tocar nela escolhe `area:<setor>` em `onEscolher`. */
  onMoverArea?: (setor: string, x: number, y: number) => void;
};

/** A planta de fundo (M4): a imagem por baixo do desenho, no lugar e tamanho dados (em lugares), com a opacidade de 10 a 100. */
export type FundoNoDesenho = { url: string; x: number; y: number; largura: number; altura: number; opacidade: number };

export function MapaPorLayout({ layout, estados, tipos, modo, onAlternar, rotuloDoMapa = "Mapa de lugares", ampliado = false, desenho, cores, contexto, rotulos, fundo, areas }: {
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
  /** O mapa da sala: a cor de cada setor (pelo id que os blocos levam em `setor`). Sem ela, o desenho é o de sempre. */
  cores?: ReadonlyMap<string, string>;
  /** Setores só para situar a pessoa (o resto da sala): tingidos e sem resposta ao toque, nem para o leitor de tela. */
  contexto?: ReadonlySet<string>;
  /** O nome de cada setor, escrito em cima dele no desenho. */
  rotulos?: ReadonlyMap<string, string>;
  /** A planta de fundo, por baixo de tudo. O enquadramento passa a incluí-la. */
  fundo?: FundoNoDesenho;
  /** As áreas em pé (pista): retângulos coloridos com nome e capacidade, entre os setores. Os setores de `contexto` ficam tingidos e sem resposta ao toque. */
  areas?: readonly AreaNoDesenho[];
}) {
  const { lugares, caixa } = calcularLayout(layout);
  // No modo desenho sobra espaço em volta, para o bloco poder ser arrastado para fora do que já está desenhado.
  const folga = desenho ? 4 : 0.8;
  const dosLugares: Quadro = { x0: caixa.x0 - folga, y0: caixa.y0 - folga, largura: caixa.x1 - caixa.x0 + 2 * folga, altura: caixa.y1 - caixa.y0 + 2 * folga };
  // Com planta de fundo, o enquadramento é a união do desenho com ela.
  // Sem nenhum lugar (só áreas em pé), a caixa dos lugares não traz o palco: ele entra aqui.
  const palcoSozinho = layout.palco && lugares.length === 0 ? [{ x: layout.palco.x - layout.palco.largura / 2 - folga, y: layout.palco.y - layout.palco.altura / 2 - folga, largura: layout.palco.largura + 2 * folga, altura: layout.palco.altura + 2 * folga }] : [];
  const retangulos = [...palcoSozinho, ...(fundo ? [{ x: fundo.x, y: fundo.y, largura: fundo.largura, altura: fundo.altura }] : []), ...(areas ?? []).map(a => ({ x: a.x - folga, y: a.y - folga, largura: a.largura + 2 * folga, altura: a.altura + 2 * folga }))];
  const natural: Quadro = retangulos.length === 0 ? dosLugares : (() => {
    const todos = [...(lugares.length > 0 ? [{ x: dosLugares.x0, y: dosLugares.y0, largura: dosLugares.largura, altura: dosLugares.altura }] : []), ...retangulos];
    const x0 = Math.min(...todos.map(r => r.x)), y0 = Math.min(...todos.map(r => r.y)), x1 = Math.max(...todos.map(r => r.x + r.largura)), y1 = Math.max(...todos.map(r => r.y + r.altura));
    return { x0, y0, largura: x1 - x0, altura: y1 - y0 };
  })();
  // Enquanto se arrasta, o enquadramento fica parado (senão ele cresce junto com o bloco e o desenho foge do dedo).
  const [congelado, setCongelado] = useState<Quadro | null>(null);
  const q = congelado ?? natural;
  const svgRef = useRef<SVGSVGElement>(null);
  // Zoom e deslocamento só no editor: o enquadramento `q` é o desenho inteiro, e o que se vê é uma janela menor, deslocada do centro (em passos).
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const arrasteDaArea = useRef<{ setor: string; px: number; py: number; x: number; y: number; escala: number } | null>(null);
  const arrasteDoFundo = useRef<{ px: number; py: number; x: number; y: number; escala: number } | null>(null);
  const panando = useRef<{ px: number; py: number; x: number; y: number; escala: number } | null>(null);
  const idDaGrade = useId().replace(/:/g, "");
  const z = desenho ? zoom : 1;
  const vw = q.largura / z;
  const vh = q.altura / z;
  const vista: Quadro = z === 1 && pan.x === 0 && pan.y === 0 ? q : { x0: q.x0 + q.largura / 2 + pan.x - vw / 2, y0: q.y0 + q.altura / 2 + pan.y - vh / 2, largura: vw, altura: vh };
  const mudarZoom = (f: (z: number) => number) => setZoom(atual => { const novo = Math.min(ZOOM_MAXIMO, Math.max(1, Math.round(f(atual) * 100) / 100)); if (novo === 1) setPan({ x: 0, y: 0 }); return novo; });
  // Ctrl/Cmd + roda (e o gesto de pinça do trackpad) dão zoom; o ouvinte é nativo porque o do React não pode cancelar a rolagem da página.
  useEffect(() => {
    const svg = svgRef.current;
    if (!desenho || !svg) return;
    const aoRolar = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      mudarZoom(atual => atual * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
    };
    svg.addEventListener("wheel", aoRolar, { passive: false });
    return () => svg.removeEventListener("wheel", aoRolar);
  }, [!!desenho]); // eslint-disable-line react-hooks/exhaustive-deps
  const arraste = useRef<{ id: string; px: number; py: number; x: number; y: number; escala: number } | null>(null);
  const girando = useRef<{ id: string; ultimo: number | null } | null>(null);
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

  const nomesNoDesenho = (() => {
    if (!rotulos || rotulos.size === 0) return [];
    const caixas = new Map<string, { x0: number; x1: number; y0: number }>();
    for (const l of lugares) {
      if (!l.setor || !rotulos.has(l.setor)) continue;
      const c = caixas.get(l.setor);
      if (!c) caixas.set(l.setor, { x0: l.x, x1: l.x, y0: l.y });
      else { c.x0 = Math.min(c.x0, l.x); c.x1 = Math.max(c.x1, l.x); c.y0 = Math.min(c.y0, l.y); }
    }
    return [...caixas].map(([setor, c]) => ({ setor, nome: rotulos.get(setor) ?? "", x: (c.x0 + c.x1) / 2, y: c.y0 - 0.95 }));
  })();

  /** Prende o ponteiro ao desenho (o arraste continua mesmo fora dele); se o ponteiro já acabou, segue sem prender. */
  function capturar(svg: SVGSVGElement, pointerId: number) {
    try { svg.setPointerCapture(pointerId); } catch { /* ponteiro que já não existe */ }
  }
  function comecarArraste(e: React.PointerEvent<SVGSVGElement>) {
    if (!desenho) return;
    // Ajustando a planta de fundo: arrastar em qualquer ponto move o fundo.
    if (desenho.fundoAtivo && fundo && svgRef.current) {
      const caixaDoSvg = svgRef.current.getBoundingClientRect();
      arrasteDoFundo.current = { px: e.clientX, py: e.clientY, x: fundo.x, y: fundo.y, escala: Math.min(caixaDoSvg.width / vista.largura, caixaDoSvg.height / vista.altura) };
      setCongelado(natural);
      capturar(svgRef.current, e.pointerId);
      return;
    }
    // A alça de girar (não é um bloco: não muda o bloco escolhido).
    if (desenho.onGirar && escolhido && (e.target as Element).closest("[data-alca]")) {
      if (!svgRef.current) return;
      girando.current = { id: escolhido, ultimo: null };
      setCongelado(natural);
      capturar(svgRef.current, e.pointerId);
      return;
    }
    // Tocar numa área em pé: escolhe e arrasta a área.
    const idDaArea = (e.target as Element).closest("[data-area]")?.getAttribute("data-area") ?? null;
    const daArea = idDaArea ? areas?.find(a => a.setor === idDaArea) : undefined;
    if (daArea && svgRef.current) {
      desenho.onEscolher(`area:${daArea.setor}`);
      const caixaDoSvg = svgRef.current.getBoundingClientRect();
      arrasteDaArea.current = { setor: daArea.setor, px: e.clientX, py: e.clientY, x: daArea.x, y: daArea.y, escala: Math.min(caixaDoSvg.width / vista.largura, caixaDoSvg.height / vista.altura) };
      setCongelado(natural);
      capturar(svgRef.current, e.pointerId);
      return;
    }
    const id = (e.target as Element).closest("[data-bloco]")?.getAttribute("data-bloco") ?? null;
    desenho.onEscolher(id);
    const svg = svgRef.current;
    const bloco = id ? layout.blocos.find(b => b.id === id) : undefined;
    const escala = svg ? Math.min(svg.getBoundingClientRect().width / vista.largura, svg.getBoundingClientRect().height / vista.altura) : 0;
    // Com zoom, arrastar o fundo desloca a vista.
    if (!id && svg && z > 1 && escala > 0) { panando.current = { px: e.clientX, py: e.clientY, x: pan.x, y: pan.y, escala }; capturar(svg, e.pointerId); return; }
    if (!id || !svg || !bloco) return;
    arraste.current = { id, px: e.clientX, py: e.clientY, x: bloco.x, y: bloco.y, escala };
    setCongelado(natural);
    capturar(svg, e.pointerId);
  }
  function arrastar(e: React.PointerEvent<SVGSVGElement>) {
    const a0 = arrasteDaArea.current;
    if (a0 && desenho && a0.escala > 0) { desenho.onMoverArea?.(a0.setor, a0.x + (e.clientX - a0.px) / a0.escala, a0.y + (e.clientY - a0.py) / a0.escala); return; }
    const f0 = arrasteDoFundo.current;
    if (f0 && desenho && f0.escala > 0) { desenho.onMoverFundo?.(f0.x + (e.clientX - f0.px) / f0.escala, f0.y + (e.clientY - f0.py) / f0.escala); return; }
    const p0 = panando.current;
    if (p0) {
      const limite = (v: number, max: number) => Math.min(max, Math.max(-max, v));
      setPan({ x: limite(p0.x - (e.clientX - p0.px) / p0.escala, q.largura / 2), y: limite(p0.y - (e.clientY - p0.py) / p0.escala, q.altura / 2) });
      return;
    }
    const g = girando.current;
    if (desenho && g) {
      const svg = svgRef.current;
      const bloco = layout.blocos.find(b => b.id === g.id);
      const matriz = svg?.getScreenCTM();
      if (!svg || !bloco || !matriz) return;
      const ponto = svg.createSVGPoint();
      ponto.x = e.clientX;
      ponto.y = e.clientY;
      const noDesenho = ponto.matrixTransform(matriz.inverse());
      const angulo = anguloParaPonto(bloco, noDesenho);
      if (angulo !== null) { g.ultimo = angulo; desenho.onGirar?.(g.id, angulo, false); }
      return;
    }
    const a = arraste.current;
    if (!desenho || !a || a.escala <= 0) return;
    desenho.onMover(a.id, a.x + (e.clientX - a.px) / a.escala, a.y + (e.clientY - a.py) / a.escala);
  }
  function soltar() {
    const g = girando.current;
    if (g && g.ultimo !== null) desenho?.onGirar?.(g.id, g.ultimo, true);
    girando.current = null;
    arraste.current = null;
    panando.current = null;
    arrasteDoFundo.current = null;
    arrasteDaArea.current = null;
    setCongelado(null);
  }

  return (
    <div className={`${ampliado ? "overflow-x-auto pb-1" : ""} ${desenho ? "relative" : ""}`}>
    {desenho && (
      <div className="absolute right-0 top-0 z-[1] flex items-center gap-1 rounded-lg border border-black/[.1] bg-white/90 p-1 shadow-sm backdrop-blur">
        <button type="button" aria-label="Menos zoom" disabled={zoom <= 1} onClick={() => mudarZoom(a => a - 0.25)} className={BOTAO_ZOOM}>−</button>
        <button type="button" aria-label="Ajustar o desenho à tela" title="Ajustar à tela" disabled={zoom === 1 && pan.x === 0 && pan.y === 0} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className={`${BOTAO_ZOOM} w-12 tabular-nums`}>{Math.round(zoom * 100)}%</button>
        <button type="button" aria-label="Mais zoom" disabled={zoom >= ZOOM_MAXIMO} onClick={() => mudarZoom(a => a + 0.25)} className={BOTAO_ZOOM}>+</button>
      </div>
    )}
    <svg
      ref={svgRef} viewBox={`${vista.x0} ${vista.y0} ${vista.largura} ${vista.altura}`} width={ampliado ? q.largura * PASSO * 1.35 : "100%"}
      style={{ maxWidth: ampliado ? undefined : q.largura * PASSO, height: "auto", maxHeight: desenho ? "42vh" : undefined, touchAction: desenho ? "none" : undefined, userSelect: desenho ? "none" : undefined }} role="group" aria-label={rotuloDoMapa} className="mx-auto block"
      onPointerDown={desenho ? comecarArraste : undefined} onPointerMove={desenho ? arrastar : undefined} onPointerUp={desenho ? soltar : undefined} onPointerCancel={desenho ? soltar : undefined}
    >
      {fundo && (
        <image href={fundo.url} x={fundo.x} y={fundo.y} width={fundo.largura} height={fundo.altura} preserveAspectRatio="none" opacity={fundo.opacidade / 100} pointerEvents="none" aria-hidden="true" />
      )}
      {desenho && (
        <g aria-hidden="true" pointerEvents="none">
          <defs>
            <pattern id={idDaGrade} x={-0.5} y={-0.5} width={1} height={1} patternUnits="userSpaceOnUse"><circle cx={0.5} cy={0.5} r={0.035} fill="rgba(0,0,0,.2)" /></pattern>
          </defs>
          <rect x={vista.x0} y={vista.y0} width={vista.largura} height={vista.altura} fill={`url(#${idDaGrade})`} />
        </g>
      )}
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
      {desenho?.onGirar && escolhido && (() => {
        const bloco = layout.blocos.find(b => b.id === escolhido);
        if (!bloco) return null;
        const alca = posicaoDaAlca(bloco);
        return (
          <g>
            <line x1={bloco.x} y1={bloco.y} x2={alca.x} y2={alca.y} stroke="#6450D2" strokeWidth={0.08} strokeDasharray="0.3 0.2" pointerEvents="none" aria-hidden="true" />
            <g data-alca="1" role="img" aria-label="Alça para girar o bloco" style={{ cursor: "grab" }}>
              <title>Girar o bloco</title>
              <circle cx={alca.x} cy={alca.y} r={0.75} fill="#6450D2" stroke="#fff" strokeWidth={0.12} />
              <text x={alca.x} y={alca.y + 0.04} textAnchor="middle" dominantBaseline="central" fontSize={0.95} fill="#fff" pointerEvents="none">↻</text>
            </g>
          </g>
        );
      })()}
      {areas?.map(a => {
        const soContexto = !!contexto?.has(a.setor);
        const escolhida = escolhido === `area:${a.setor}`;
        return (
          <g key={`area-${a.setor}`} data-area={desenho ? a.setor : undefined} role="img" aria-label={`${a.nome}, ${a.detalhe}`} pointerEvents={desenho ? undefined : "none"} style={{ cursor: desenho ? "grab" : undefined }}>
            <rect x={a.x} y={a.y} width={a.largura} height={a.altura} rx={0.8} fill={`${a.cor}${soContexto ? "2E" : "22"}`} stroke={a.cor} strokeWidth={0.1} strokeDasharray={soContexto ? undefined : "0.5 0.3"} />
            {escolhida && <rect x={a.x - 0.4} y={a.y - 0.4} width={a.largura + 0.8} height={a.altura + 0.8} rx={1} fill="none" stroke="#6450D2" strokeWidth={0.1} strokeDasharray="0.35 0.25" pointerEvents="none" />}
            <text x={a.x + a.largura / 2} y={a.y + a.altura / 2 - 0.7} textAnchor="middle" dominantBaseline="central" fontSize={1.1} fontWeight={600} fill={a.cor} pointerEvents="none" aria-hidden="true">{a.nome}</text>
            <text x={a.x + a.largura / 2} y={a.y + a.altura / 2 + 0.7} textAnchor="middle" dominantBaseline="central" fontSize={0.75} fill={a.cor} opacity={0.85} pointerEvents="none" aria-hidden="true">{a.detalhe}</text>
          </g>
        );
      })}
      {nomesNoDesenho.map(n => (
        <text key={n.setor} x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" fontSize={0.7} fontWeight={600} letterSpacing={0.05} fill={cores?.get(n.setor) ?? "rgba(0,0,0,.55)"} opacity={contexto?.has(n.setor) ? 0.7 : 1} pointerEvents="none" aria-hidden="true">{n.nome}</text>
      ))}
      {lugares.map(l => {
        const estado = estados?.get(chaveDoLugar(l.setor, l.fileira, l.numero)) ?? "livre";
        const tipo = tipos?.get(chaveDoLugar(l.setor, l.fileira, l.numero)) ?? "comum";
        const selo = tipo === "comum" ? null : SELO_DO_TIPO[tipo];
        const nome = `Fileira ${l.fileira}, lugar ${l.numero}${tipo === "comum" ? "" : `, ${TIPO_CURTO[tipo]}`}`;
        const cor = l.setor ? cores?.get(l.setor) : undefined;
        const soContexto = !!l.setor && !!contexto?.has(l.setor);
        if (soContexto) {
          return (
            <g key={`${l.bloco}|${l.fileira}|${l.numero}`} data-bloco={desenho ? l.bloco : undefined} aria-hidden="true" pointerEvents={desenho ? undefined : "none"}>
              <rect x={l.x - LADO / 2} y={l.y - LADO / 2} width={LADO} height={LADO} rx={0.2} fill={cor ? `${cor}38` : "rgba(0,0,0,.08)"} />
            </g>
          );
        }
        const desligado = estado === "ocupado" || (modo === "comprador" && (estado === "bloqueado" || estado === "reservado"));
        const preenchimento = estado === "selecionado" ? "#282525" : estado === "ocupado" ? "rgba(0,0,0,.09)" : estado === "bloqueado" ? "rgba(0,0,0,.05)" : estado === "reservado" ? "rgba(29,78,216,.07)" : cor ? `${cor}14` : "#fff";
        const borda = estado === "selecionado" || estado === "ocupado" ? "none" : estado === "reservado" ? "rgba(29,78,216,.5)" : cor ?? "rgba(0,0,0,.3)";
        const texto = estado === "selecionado" ? "#fff" : estado === "ocupado" ? "rgba(0,0,0,.25)" : estado === "reservado" ? "rgba(29,78,216,.6)" : "#282525";
        const aoTocar = () => onAlternar?.({ setor: l.setor, fileira: l.fileira, numero: l.numero });
        const rotulo = `${nome}, ${estado === "selecionado" ? "escolhido" : estado === "ocupado" ? "ocupado" : estado === "bloqueado" ? "bloqueado" : estado === "reservado" ? "reservado" : "livre"}`;
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
            <rect x={l.x - LADO / 2} y={l.y - LADO / 2} width={LADO} height={LADO} rx={0.2} fill={preenchimento} stroke={borda} strokeWidth={0.05} strokeDasharray={estado === "bloqueado" || estado === "reservado" ? "0.18 0.12" : undefined} />
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
