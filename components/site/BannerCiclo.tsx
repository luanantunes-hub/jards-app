"use client";

// Convite ao produto no fim do blog. O desenho conta a frase: as cinco etapas
// da jornada (as mesmas da landing) numa pista; um ponto de luz percorre a
// pista, acende cada etapa e chega à luz da marca em Renovar; depois volta pela
// linha tracejada do próximo ciclo. Traço de prancheta, como na landing.
// Animação em SMIL (roda no Safari sem script); com menos movimento, o desenho
// para no quadro com todas as etapas acesas.

import { useEffect, useRef } from "react";

const ETAPAS = ["Encontrar", "Estruturar", "Negociar", "Entregar", "Renovar"];
const DURACAO = 12; // segundos por volta
// Fração da volta em que o ponto chega à primeira e à última etapa: a ida
// pelas etapas leva a maior parte do tempo; a volta é mais rápida.
const T_INICIO = 0.06;
const T_FIM = 0.72;
const QUADRO_PARADO = DURACAO * (T_FIM + 0.01);

type Ponto = { x: number; y: number };
type Variante = {
  id: string;
  guia: (p: Ponto) => string; // linha de construção que passa pela etapa
  largura: number;
  altura: number;
  pista: string; // volta inteira, começando no meio da curva antes da 1ª etapa
  ida: string; // só o trecho das etapas, para o rastro
  estacoes: Ponto[];
  fracaoInicio: number; // posição da 1ª etapa na volta (0 a 1)
  fracaoFim: number; // posição da última etapa na volta
  rotulo: (i: number, p: Ponto) => { numero: Ponto; nome: Ponto; ancora: "middle" | "start" };
  proximo: { x: number; y: number; ancora: "middle" | "start"; texto: string };
  cruzes: Ponto[];
};

// Pista deitada (computador): etapas na linha de cima, retorno embaixo.
const DEITADA: Variante = (() => {
  const x0 = 60, x1 = 500, y = 104, r = 50;
  const total = Math.PI * r * 2 + (x1 - x0) * 2;
  return {
    id: "deitada",
    largura: 560,
    altura: 244,
    pista: `M${x0 - r},${y + r} A${r},${r} 0 0 1 ${x0},${y} H${x1} A${r},${r} 0 0 1 ${x1},${y + 2 * r} H${x0} A${r},${r} 0 0 1 ${x0 - r},${y + r}`,
    ida: `M${x0},${y} H${x1}`,
    guia: (p) => `M${p.x},${p.y - 22} V${y + 2 * r + 8}`,
    estacoes: ETAPAS.map((_, i) => ({ x: x0 + ((x1 - x0) * i) / 4, y })),
    fracaoInicio: (Math.PI * r) / 2 / total,
    fracaoFim: ((Math.PI * r) / 2 + (x1 - x0)) / total,
    rotulo: (_, p) => ({ numero: { x: p.x, y: p.y - 60 }, nome: { x: p.x, y: p.y - 42 }, ancora: "middle" }),
    proximo: { x: (x0 + x1) / 2, y: y + 2 * r + 24, ancora: "middle", texto: "← próximo ciclo" },
    cruzes: [{ x: 10, y: 14 }, { x: 550, y: 14 }, { x: 10, y: 234 }, { x: 550, y: 234 }],
  };
})();

// Pista em pé (celular): etapas descendo, retorno pela esquerda.
const EM_PE: Variante = (() => {
  const x = 62, y0 = 52, y1 = 332, r = 22;
  const total = Math.PI * r * 2 + (y1 - y0) * 2;
  return {
    id: "em-pe",
    largura: 320,
    altura: 384,
    pista: `M${x - r},${y0 - r} A${r},${r} 0 0 1 ${x},${y0} V${y1} A${r},${r} 0 0 1 ${x - 2 * r},${y1} V${y0} A${r},${r} 0 0 1 ${x - r},${y0 - r}`,
    ida: `M${x},${y0} V${y1}`,
    guia: (p) => `M${x - 2 * r - 10},${p.y} H${p.x + 30}`,
    estacoes: ETAPAS.map((_, i) => ({ x, y: y0 + ((y1 - y0) * i) / 4 })),
    fracaoInicio: (Math.PI * r) / 2 / total,
    fracaoFim: ((Math.PI * r) / 2 + (y1 - y0)) / total,
    rotulo: (_, p) => ({ numero: { x: p.x + 40, y: p.y + 4 }, nome: { x: p.x + 64, y: p.y + 5 }, ancora: "start" }),
    proximo: { x: 8, y: y1 + 44, ancora: "start", texto: "↑ próximo ciclo" },
    cruzes: [{ x: 300, y: 12 }, { x: 300, y: 372 }],
  };
})();

const tempoDaEtapa = (i: number) => T_INICIO + ((T_FIM - T_INICIO) * i) / (ETAPAS.length - 1);
const fmt = (n: number) => n.toFixed(4);

function Cruz({ p }: { p: Ponto }) {
  return <path d={`M${p.x - 5},${p.y} H${p.x + 5} M${p.x},${p.y - 5} V${p.y + 5}`} className="stroke-[#282525]/40" strokeWidth={1} />;
}

function Diagrama({ v, className }: { v: Variante; className: string }) {
  const ultima = v.estacoes[v.estacoes.length - 1];
  const g = (nome: string) => `${v.id}-${nome}`;
  return (
    <svg viewBox={`0 0 ${v.largura} ${v.altura}`} className={className} role="img" aria-label="Encontrar, estruturar, negociar, entregar e renovar: a jornada recomeça a cada ciclo." focusable="false">
      <defs>
        <radialGradient id={g("roxo")}><stop offset="0" stopColor="#7C62D6" stopOpacity=".55" /><stop offset="1" stopColor="#7C62D6" stopOpacity="0" /></radialGradient>
        <radialGradient id={g("coral")}><stop offset="0" stopColor="#EE7C66" stopOpacity=".6" /><stop offset="1" stopColor="#EE7C66" stopOpacity="0" /></radialGradient>
        <radialGradient id={g("branco")}><stop offset=".45" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <radialGradient id={g("brilho")}><stop offset="0" stopColor="#684DB0" stopOpacity=".28" /><stop offset="1" stopColor="#684DB0" stopOpacity="0" /></radialGradient>
      </defs>

      {v.cruzes.map((p, i) => <Cruz key={i} p={p} />)}
      {v.estacoes.map((p, i) => (
        <path key={i} d={v.guia(p)} fill="none" className="stroke-[#282525]/15" strokeWidth={1} strokeDasharray="2 5" />
      ))}

      {/* pista: ida em traço contínuo, volta tracejada */}
      <path d={v.pista} fill="none" className="stroke-[#282525]/25" strokeWidth={1} strokeDasharray="3 6" />
      <path d={v.ida} fill="none" className="stroke-[#282525]/45" strokeWidth={1} />
      <circle cx={ultima.x} cy={ultima.y} r={34} fill="none" className="stroke-[#282525]/20" strokeWidth={1} strokeDasharray="2 6" />

      {/* rastro: a ida vai ficando roxa conforme o ponto passa */}
      <path d={v.ida} fill="none" stroke="#684DB0" strokeWidth={1.5} pathLength={1} strokeDasharray="1" strokeDashoffset="1">
        <animate attributeName="stroke-dashoffset" values="1;1;0;0" keyTimes={`0;${T_INICIO};${T_FIM};1`} dur={`${DURACAO}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.8;0.92;1" dur={`${DURACAO}s`} repeatCount="indefinite" />
      </path>

      {v.estacoes.map((p, i) => {
        const r = v.rotulo(i, p);
        const t = tempoDaEtapa(i);
        const eUltima = i === v.estacoes.length - 1;
        return (
          <g key={ETAPAS[i]}>
            <text x={r.numero.x} y={r.numero.y} textAnchor={r.ancora} className="fill-[#282525]/45 font-(family-name:--font-mono) text-[10.5px] font-medium tracking-[.04em]">
              {String(i + 1).padStart(2, "0")}
            </text>
            <text x={r.nome.x} y={r.nome.y} textAnchor={r.ancora} className="fill-[#282525] text-[13.5px] font-medium" opacity=".5">
              {ETAPAS[i]}
              <animate attributeName="opacity" values=".5;.5;1;1;.5;.5" keyTimes={`0;${fmt(t)};${fmt(t + 0.01)};0.8;0.92;1`} dur={`${DURACAO}s`} repeatCount="indefinite" />
            </text>
            {!eUltima && (
              <>
                <circle cx={p.x} cy={p.y} r={4} className="fill-[#F7F7F5] stroke-[#282525]/55" strokeWidth={1} />
                <circle cx={p.x} cy={p.y} r={4} fill="#684DB0" opacity="0">
                  <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes={`0;${fmt(t)};${fmt(t + 0.01)};0.8;0.92;1`} dur={`${DURACAO}s`} repeatCount="indefinite" />
                </circle>
              </>
            )}
          </g>
        );
      })}

      {/* luz da marca em Renovar: roxo e coral em volta de um miolo branco;
          cresce um pouco quando o ponto chega */}
      <g transform={`translate(${ultima.x} ${ultima.y})`}>
        <g>
          <animateTransform attributeName="transform" type="scale" values="1;1;1.22;1;1" keyTimes={`0;${T_FIM};${fmt(T_FIM + 0.04)};${fmt(T_FIM + 0.14)};1`} dur={`${DURACAO}s`} repeatCount="indefinite" />
          <circle cx={-8} cy={5} r={27} fill={`url(#${g("roxo")})`} />
          <circle cx={9} cy={-2} r={30} fill={`url(#${g("coral")})`} />
          <circle r={16} fill={`url(#${g("branco")})`} />
          <circle r={9} fill="#fff" />
        </g>
      </g>

      {/* ponto de luz: forte na ida, mais fraco no caminho de volta; dois
          pontos menores, um pouco atrasados, fazem o rastro */}
      {[0.32, 0.16].map((atraso, i) => (
        <g key={atraso}>
          <animateMotion path={v.pista} keyPoints={`0;${fmt(v.fracaoInicio)};${fmt(v.fracaoFim)};1`} keyTimes={`0;${T_INICIO};${T_FIM};1`} calcMode="linear" dur={`${DURACAO}s`} begin={`-${DURACAO - atraso}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values=".1;.3;.3;.1;.1" keyTimes={`0;${T_INICIO};${T_FIM};${fmt(T_FIM + 0.06)};1`} dur={`${DURACAO}s`} begin={`-${DURACAO - atraso}s`} repeatCount="indefinite" />
          <circle r={i === 0 ? 1.6 : 2.4} fill="#684DB0" />
        </g>
      ))}
      <g>
        <animateMotion path={v.pista} keyPoints={`0;${fmt(v.fracaoInicio)};${fmt(v.fracaoFim)};1`} keyTimes={`0;${T_INICIO};${T_FIM};1`} calcMode="linear" dur={`${DURACAO}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values=".35;1;1;.35;.35" keyTimes={`0;${T_INICIO};${T_FIM};${fmt(T_FIM + 0.06)};1`} dur={`${DURACAO}s`} repeatCount="indefinite" />
        <circle r={12} fill={`url(#${g("brilho")})`} />
        <circle r={3.5} fill="#684DB0" />
      </g>

      <text x={v.proximo.x} y={v.proximo.y} textAnchor={v.proximo.ancora} className="fill-[#282525]/45 font-(family-name:--font-mono) text-[10.5px] font-medium tracking-[.04em] uppercase">
        {v.proximo.texto}
      </text>
    </svg>
  );
}

export default function BannerCiclo() {
  const caixa = useRef<HTMLDivElement>(null);

  // Com menos movimento, para no quadro com todas as etapas acesas.
  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aplicar = () => {
      caixa.current?.querySelectorAll("svg").forEach((svg) => {
        if (consulta.matches) { svg.pauseAnimations(); svg.setCurrentTime(QUADRO_PARADO); }
        else svg.unpauseAnimations();
      });
    };
    aplicar();
    consulta.addEventListener("change", aplicar);
    return () => consulta.removeEventListener("change", aplicar);
  }, []);

  return (
    <section className="mx-auto max-w-pagina px-5 py-20 md:px-8 md:py-28">
      <div ref={caixa} className="grid items-center gap-10 rounded bg-[#F7F7F5] px-6 py-10 md:grid-cols-12 md:gap-8 md:px-12 md:py-14">
        <div className="md:col-span-5">
          <h2 className="text-[clamp(1.5rem,2.6vw,2.25rem)] leading-[1.12] font-bold tracking-[-0.02em] text-balance text-[#282525]">
            Da prospecção à renovação, toda a captação num só lugar.
          </h2>
          <p className="mt-3 max-w-[48ch] text-base leading-relaxed text-black/55">
            Veja quem incentiva cada lei, empresa por empresa, e acompanhe negociações, propostas e prazos até a renovação.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href="/cadastro"
              className="inline-flex h-11 items-center gap-2 rounded bg-[#282525] px-5 text-sm font-medium text-white transition-colors hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
            >
              Começar grátis
              <i className="ph ph-arrow-right" aria-hidden="true" />
            </a>
            <a
              href="/crm"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#282525] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
            >
              Conhecer o CRM
            </a>
          </div>
        </div>
        <div className="md:col-span-7">
          <Diagrama v={DEITADA} className="hidden h-auto w-full md:block" />
          <Diagrama v={EM_PE} className="mx-auto block h-auto w-full max-w-[20rem] md:hidden" />
        </div>
      </div>
    </section>
  );
}
