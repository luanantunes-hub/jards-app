"use client";

// Infográfico do post sobre o olhar da responsabilidade social: o tempo da
// comunidade e o tempo corporativo, que o texto diz raramente coincidirem. O
// corporativo sobe e volta ao zero a cada ciclo orçamentário anual; o da
// comunidade segue em linha contínua, atravessando os ciclos. Dois pontos de
// luz percorrem as linhas no mesmo intervalo (SMIL). Os pontos só entram
// depois que a página carrega e quando o sistema não pede menos movimento;
// sem eles, o desenho fica parado.

import { useSyncExternalStore } from "react";

const MENOS_MOVIMENTO = "(prefers-reduced-motion: reduce)";
function assinar(aviso: () => void) {
  const consulta = window.matchMedia(MENOS_MOVIMENTO);
  consulta.addEventListener("change", aviso);
  return () => consulta.removeEventListener("change", aviso);
}

const ROTULO = "font-(family-name:--font-mono) text-[0.6875rem] font-medium uppercase tracking-[.08em]";
const DURACAO = 9;

// Três ciclos de 180 de largura, de x=40 a x=580.
const CORPORATIVO = "M40,100 L220,44 L220,100 L400,44 L400,100 L580,44";
// Posição do ponto ao longo da linha: as quedas no fim de cada ciclo são
// quase instantâneas, a subida ocupa o ciclo inteiro.
const DIAG = Math.hypot(180, 56);
const TOTAL = DIAG * 3 + 56 * 2;
const PONTOS = [0, DIAG, DIAG + 56, DIAG * 2 + 56, DIAG * 2 + 112, TOTAL].map((d) => (d / TOTAL).toFixed(4)).join(";");
const TEMPOS = "0;0.3333;0.345;0.6667;0.678;1";
const COMUNIDADE = "M40,198 C90,196 110,190 150,188 S230,176 270,178 S340,166 380,162 S460,152 500,148 S560,140 580,138";

export default function InfograficoDoisTempos() {
  // No servidor (e antes de hidratar) conta como "menos movimento": sem pontos.
  const comMovimento = useSyncExternalStore(assinar, () => !window.matchMedia(MENOS_MOVIMENTO).matches, () => false);

  const visivel = { values: "0;1;1;0", keyTimes: "0;0.04;0.94;1", dur: `${DURACAO}s`, repeatCount: "indefinite" };

  return (
    <figure className="my-12" aria-labelledby="info-tempos-titulo">
      <div className="rounded bg-[#F7F7F5] px-5 py-7 sm:px-8">
        <p className={`${ROTULO} text-[#684DB0]`}>Dois tempos</p>
        <p id="info-tempos-titulo" className="mt-2 text-lg leading-snug font-bold tracking-[-0.01em] text-balance text-[#282525]">
          O tempo da comunidade e o tempo corporativo raramente coincidem
        </p>

        <ul className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-8">
          <li className="flex items-center gap-2.5 text-[0.8125rem] text-black/70">
            <svg viewBox="0 0 24 12" className="h-3 w-6 shrink-0" aria-hidden="true"><path d="M1,11 L11,2 L11,11 L23,2" fill="none" stroke="#4A6385" strokeWidth={1.5} /></svg>
            Corporativo: métricas, prazos e entregas
          </li>
          <li className="flex items-center gap-2.5 text-[0.8125rem] text-black/70">
            <svg viewBox="0 0 24 12" className="h-3 w-6 shrink-0" aria-hidden="true"><path d="M1,10 C8,9 14,6 23,3" fill="none" stroke="#E08A3C" strokeWidth={2} /></svg>
            Comunidade: vínculos, confiança e reciprocidade
          </li>
        </ul>

        {/* Ciclos em HTML: dentro do desenho ficariam com ~6px no celular */}
        <div className="mt-6 grid grid-cols-[40fr_180fr_180fr_180fr_20fr]" aria-hidden="true">
          {["Ciclo 1", "Ciclo 2", "Ciclo 3"].map((t, i) => (
            <span key={t} className={`${ROTULO} text-center text-black/50`} style={{ gridColumn: i + 2 }}>{t}</span>
          ))}
        </div>
        <svg
          viewBox="0 0 600 224"
          className="mt-1 h-auto w-full"
          role="img"
          aria-label="Ao longo de três ciclos anuais, a linha corporativa sobe e volta ao zero a cada ciclo; a linha da comunidade sobe devagar e sem interrupção."
        >
          {[220, 400].map((x) => (
            <line key={x} x1={x} y1={30} x2={x} y2={212} className="stroke-[#282525]/20" strokeWidth={1} strokeDasharray="3 5" />
          ))}
          <line x1={40} y1={100} x2={580} y2={100} className="stroke-[#282525]/12" strokeWidth={1} />
          <line x1={40} y1={204} x2={580} y2={204} className="stroke-[#282525]/12" strokeWidth={1} />

          <path d={CORPORATIVO} fill="none" stroke="#4A6385" strokeWidth={1.75} strokeLinejoin="round" />
          <path d={COMUNIDADE} fill="none" stroke="#E08A3C" strokeWidth={2.5} strokeLinecap="round" />

          {comMovimento && (<>
          <g>
            <animateMotion path={CORPORATIVO} keyPoints={PONTOS} keyTimes={TEMPOS} calcMode="linear" dur={`${DURACAO}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" {...visivel} />
            <circle r={9} fill="#4A6385" opacity=".18" />
            <circle r={3.5} fill="#4A6385" />
          </g>
          <g>
            <animateMotion path={COMUNIDADE} dur={`${DURACAO}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" {...visivel} />
            <circle r={10} fill="#E08A3C" opacity=".22" />
            <circle r={4} fill="#E08A3C" />
          </g>
          </>)}
        </svg>

        <figcaption className="mt-4 text-xs leading-relaxed text-black/50">
          Projetos híbridos exigem permanência e continuidade; a inovação social de longo prazo nasce da repetição e da escuta, que nem sempre cabem nos ciclos orçamentários anuais.
        </figcaption>
      </div>
    </figure>
  );
}
