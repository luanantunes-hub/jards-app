"use client";

import { useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { conferirLayout, type Layout, type Numeracao } from "@/lib/ticketeria/mapa-layout";
import {
  CAMPOS_DO_MODELO, ERRO_DO_LAYOUT_EM_TEXTO, MODELOS, MODELO_EM_TEXTO, PARAMETROS_PADRAO, comAngulo, comCorredorNoMeio, comNumeracao, comPalcoAcima, comPrimeiroNumero, comRaio,
  deslocarBloco, layoutDoModelo, maisLugaresNoBloco, maisUmBloco, maisUmaFileira, menosUmaFileira, temCorredorNoMeio, tirarBloco, type ModeloId, type ParametrosDoModelo,
} from "@/lib/ticketeria/mapa-layout-editor";

// Os controles do desenho do mapa: o modelo para começar e, para o bloco escolhido, a numeração, a curva, o ângulo, o corredor, as fileiras e a posição.
// Só desenho: o layout e o que muda nele chegam por props (as contas estão em lib/ticketeria/mapa-layout-editor.ts). O desenho em si (e o arrastar) é o MapaPorLayout.

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]";
const BOTAO = `inline-flex h-8 items-center justify-center rounded-xl border border-black/[.12] bg-white px-3 text-[0.75rem] text-[#282525] transition hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-40 ${FOCO}`;
const BOTAO_PASSO = `flex h-7 w-7 items-center justify-center rounded-lg border border-black/[.12] bg-white text-[0.875rem] leading-none text-black/60 transition hover:bg-black/[.05] disabled:cursor-not-allowed disabled:opacity-35 ${FOCO}`;

const NUMERACAO_CURTA: Record<Numeracao, string> = { "esq-dir": "1, 2, 3…", "dir-esq": "…3, 2, 1", "centro-fora": "Do centro" };

/** Um número com − e +: o rótulo, o valor como a pessoa o lê e os dois botões. */
function Passo({ rotulo, valor, onMenos, onMais, menosDesligado = false, maisDesligado = false, rotuloMenos, rotuloMais }: {
  rotulo: string; valor: string; onMenos: () => void; onMais: () => void; menosDesligado?: boolean; maisDesligado?: boolean; rotuloMenos?: string; rotuloMais?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[0.8125rem] text-black/65">{rotulo}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={BOTAO_PASSO} aria-label={rotuloMenos ?? `Menos: ${rotulo}`} disabled={menosDesligado} onClick={onMenos}>−</button>
        <span className="min-w-[4.5rem] text-center text-[0.8125rem] tabular-nums text-[#282525]" aria-live="polite">{valor}</span>
        <button type="button" className={BOTAO_PASSO} aria-label={rotuloMais ?? `Mais: ${rotulo}`} disabled={maisDesligado} onClick={onMais}>+</button>
      </div>
    </div>
  );
}

const RAIO_MINIMO = 6;
const RAIO_MAXIMO = 40;
const PASSO_DO_RAIO = 4;

export function EditorDoLayout({ layout, onLayout, blocoEscolhido, onEscolherBloco }: {
  layout: Layout | null;
  onLayout: (l: Layout | null) => void;
  blocoEscolhido: string | null;
  onEscolherBloco: (id: string | null) => void;
}) {
  const [modelo, setModelo] = useState<ModeloId | null>(null);
  const [parametros, setParametros] = useState<ParametrosDoModelo>(PARAMETROS_PADRAO);

  const usarModelo = (m: ModeloId, p: ParametrosDoModelo) => {
    setModelo(m);
    setParametros(p);
    const novo = layoutDoModelo(m, p);
    onLayout(novo);
    onEscolherBloco(novo.blocos[0]?.id ?? null);
  };

  const erros = layout ? conferirLayout(layout) : [];
  const bloco = layout?.blocos.find(b => b.id === blocoEscolhido) ?? null;
  const indice = layout && bloco ? layout.blocos.indexOf(bloco) + 1 : 0;
  // Todas as mudanças de um bloco passam por aqui: o palco acompanha o desenho.
  const muda = (f: (l: Layout) => Layout) => { if (layout) onLayout(comPalcoAcima(f(layout))); };

  const lugaresDasFileiras = bloco ? bloco.fileiras.map(f => f.lugares) : [];
  const lugaresTexto = lugaresDasFileiras.length === 0 ? "" : Math.min(...lugaresDasFileiras) === Math.max(...lugaresDasFileiras) ? String(lugaresDasFileiras[0]) : `${Math.min(...lugaresDasFileiras)} a ${Math.max(...lugaresDasFileiras)}`;
  const raio = bloco?.raio ?? null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[0.6875rem] uppercase tracking-[.08em] text-black/40">Modelo</p>
        <div role="radiogroup" aria-label="Modelo do desenho" className="mt-2 grid gap-2 sm:grid-cols-3">
          {MODELOS.map(m => {
            const ativo = modelo === m;
            return (
              <button key={m} type="button" role="radio" aria-checked={ativo} onClick={() => usarModelo(m, ativo ? parametros : PARAMETROS_PADRAO)}
                className={`rounded-xl border px-3.5 py-3 text-left transition ${FOCO} ${ativo ? "border-[#6450D2] bg-[#6450D2]/[.05]" : "border-black/[.12] bg-white hover:bg-black/[.03]"}`}>
                <span className="block text-[0.8125rem] text-[#282525]">{MODELO_EM_TEXTO[m].nome}</span>
                <span className="mt-0.5 block text-[0.6875rem] leading-snug text-black/50">{MODELO_EM_TEXTO[m].descricao}</span>
              </button>
            );
          })}
        </div>
        {modelo && (
          <div className="mt-3 space-y-2 rounded-xl border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {CAMPOS_DO_MODELO[modelo].map(c => (
              <Passo key={c.campo} rotulo={c.rotulo} valor={String(parametros[c.campo])} menosDesligado={parametros[c.campo] <= c.min} maisDesligado={parametros[c.campo] >= c.max}
                onMenos={() => usarModelo(modelo, { ...parametros, [c.campo]: parametros[c.campo] - 1 })} onMais={() => usarModelo(modelo, { ...parametros, [c.campo]: parametros[c.campo] + 1 })} />
            ))}
            <p className="text-[0.6875rem] text-black/45">Mudar estes números refaz o desenho do modelo.</p>
          </div>
        )}
        {!layout && <p className="mt-2 text-[0.75rem] text-black/50">Sem modelo, o mapa segue como uma lista de fileiras.</p>}
      </div>

      {layout && (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Bloco" className="flex flex-wrap items-center gap-1.5">
              {layout.blocos.map((b, i) => (
                <button key={b.id} type="button" role="radio" aria-checked={b.id === blocoEscolhido} onClick={() => onEscolherBloco(b.id)}
                  className={`h-8 rounded-xl border px-3 text-[0.75rem] transition ${FOCO} ${b.id === blocoEscolhido ? "border-[#6450D2] bg-[#6450D2]/[.06] text-[#282525]" : "border-black/[.12] bg-white text-black/60 hover:bg-black/[.04]"}`}>Bloco {i + 1}</button>
              ))}
            </div>
            <button type="button" className={BOTAO} onClick={() => { const novo = maisUmBloco(layout); onLayout(novo); onEscolherBloco(novo.blocos[novo.blocos.length - 1].id); }} disabled={layout.blocos.length >= 30}>+ Bloco</button>
          </div>

          {bloco ? (
            <div className="mt-3 space-y-3 rounded-xl border bg-white px-4 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-[0.8125rem] font-medium text-[#282525]">Bloco {indice}</p>
              <div>
                <p className="mb-1.5 text-[0.8125rem] text-black/65">Numeração</p>
                <div role="radiogroup" aria-label="Numeração do bloco" className="flex flex-wrap gap-1.5">
                  {(["esq-dir", "dir-esq", "centro-fora"] as const).map(n => (
                    <button key={n} type="button" role="radio" aria-checked={bloco.numeracao === n} onClick={() => muda(l => comNumeracao(l, bloco.id, n))}
                      className={`h-8 rounded-xl border px-3 text-[0.75rem] transition ${FOCO} ${bloco.numeracao === n ? "border-[#6450D2] bg-[#6450D2]/[.06] text-[#282525]" : "border-black/[.12] bg-white text-black/60 hover:bg-black/[.04]"}`}>{NUMERACAO_CURTA[n]}</button>
                  ))}
                </div>
                {bloco.numeracao === "centro-fora" && <p className="mt-1.5 text-[0.6875rem] text-black/45">Ímpares à direita e pares à esquerda, a partir do centro.</p>}
              </div>
              <Passo rotulo="Primeiro número" valor={String(bloco.primeiroNumero)} menosDesligado={bloco.primeiroNumero <= 1} maisDesligado={bloco.primeiroNumero >= 999}
                onMenos={() => muda(l => comPrimeiroNumero(l, bloco.id, bloco.primeiroNumero - 1))} onMais={() => muda(l => comPrimeiroNumero(l, bloco.id, bloco.primeiroNumero + 1))} />
              <Passo rotulo="Fileiras" valor={String(bloco.fileiras.length)} menosDesligado={bloco.fileiras.length <= 1} maisDesligado={bloco.fileiras.length >= 60}
                onMenos={() => muda(l => menosUmaFileira(l, bloco.id))} onMais={() => muda(l => maisUmaFileira(l, bloco.id))} />
              <Passo rotulo="Lugares por fileira" valor={lugaresTexto} menosDesligado={Math.min(...lugaresDasFileiras) <= 1} maisDesligado={Math.max(...lugaresDasFileiras) >= 80}
                onMenos={() => muda(l => maisLugaresNoBloco(l, bloco.id, -1))} onMais={() => muda(l => maisLugaresNoBloco(l, bloco.id, 1))} />
              <Passo rotulo="Curva" valor={raio === null ? "Reta" : `Raio ${raio}`} menosDesligado={raio === null} maisDesligado={raio !== null && raio <= RAIO_MINIMO}
                rotuloMenos="Menos curva" rotuloMais="Mais curva"
                onMenos={() => muda(l => comRaio(l, bloco.id, raio === null ? null : raio + PASSO_DO_RAIO > RAIO_MAXIMO ? null : raio + PASSO_DO_RAIO))}
                onMais={() => muda(l => comRaio(l, bloco.id, raio === null ? RAIO_MAXIMO - PASSO_DO_RAIO : Math.max(RAIO_MINIMO, raio - PASSO_DO_RAIO)))} />
              <Passo rotulo="Ângulo" valor={`${bloco.angulo}°`} menosDesligado={bloco.angulo <= -360} maisDesligado={bloco.angulo >= 360} rotuloMenos="Girar para a esquerda" rotuloMais="Girar para a direita"
                onMenos={() => muda(l => comAngulo(l, bloco.id, bloco.angulo - 5))} onMais={() => muda(l => comAngulo(l, bloco.id, bloco.angulo + 5))} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.8125rem] text-black/65">Corredor no meio</span>
                <button type="button" role="switch" aria-checked={temCorredorNoMeio(bloco)} aria-label="Corredor no meio do bloco" onClick={() => muda(l => comCorredorNoMeio(l, bloco.id, !temCorredorNoMeio(bloco)))}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${FOCO} ${temCorredorNoMeio(bloco) ? "bg-[#6450D2]" : "bg-black/20"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${temCorredorNoMeio(bloco) ? "left-[1.375rem]" : "left-0.5"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.8125rem] text-black/65">Mover</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" className={BOTAO_PASSO} aria-label="Mover para a esquerda" onClick={() => muda(l => deslocarBloco(l, bloco.id, -1, 0))}><ArrowLeft size={14} aria-hidden="true" /></button>
                  <button type="button" className={BOTAO_PASSO} aria-label="Mover para cima" onClick={() => muda(l => deslocarBloco(l, bloco.id, 0, -1))}><ArrowUp size={14} aria-hidden="true" /></button>
                  <button type="button" className={BOTAO_PASSO} aria-label="Mover para baixo" onClick={() => muda(l => deslocarBloco(l, bloco.id, 0, 1))}><ArrowDown size={14} aria-hidden="true" /></button>
                  <button type="button" className={BOTAO_PASSO} aria-label="Mover para a direita" onClick={() => muda(l => deslocarBloco(l, bloco.id, 1, 0))}><ArrowRight size={14} aria-hidden="true" /></button>
                </div>
              </div>
              {layout.blocos.length > 1 && (
                <div className="pt-1">
                  <button type="button" className="text-[0.75rem] text-[#B23B3B] underline underline-offset-2 hover:text-[#8f2e2e]" onClick={() => { const novo = tirarBloco(layout, bloco.id); onLayout(novo); onEscolherBloco(novo.blocos[0]?.id ?? null); }}>Apagar o bloco {indice}</button>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-[0.8125rem] text-black/55">Toque num bloco no desenho ou escolha um acima para ajustá-lo.</p>
          )}

          {erros.length > 0 && (
            <ul role="alert" className="mt-3 space-y-1 rounded-xl border border-[#B23B3B]/25 bg-[#B23B3B]/[.04] px-4 py-3 text-[0.8125rem] text-[#B23B3B]">
              {erros.map(e => <li key={e}>{ERRO_DO_LAYOUT_EM_TEXTO[e]}</li>)}
            </ul>
          )}

          <div className="mt-3">
            <button type="button" className="text-[0.75rem] text-black/55 underline underline-offset-2 hover:text-black/75" onClick={() => { onLayout(null); onEscolherBloco(null); setModelo(null); }}>Voltar à lista de fileiras</button>
          </div>
        </div>
      )}
    </div>
  );
}
