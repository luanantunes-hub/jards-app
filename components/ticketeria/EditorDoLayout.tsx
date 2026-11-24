"use client";

import { useEffect, useState } from "react";
import { Dropdown } from "@/components/ui/Dropdown";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Redo2, Undo2 } from "lucide-react";
import { CAMAROTE_MAX, COLUNAS_MAX, MESA_MAX, MESA_MIN, colunasDoCamarote, conferirLayout, rotuloDoGrupo, type Layout, type Numeracao } from "@/lib/ticketeria/mapa-layout";
import {
  CAMPOS_DO_MODELO, ERRO_DO_LAYOUT_EM_TEXTO, MODELOS, MODELO_EM_TEXTO, PARAMETROS_PADRAO, comAngulo, comCorredorNoMeio, comNumeracao, comPalcoAcima, comPrimeiroNumero, comRaio,
  centralizarBloco, comColunasDoGrupo, comLugaresDoGrupo, comVendaInteira, deslocarBloco, duplicarBloco, maisUmCamarote, maisUmaMesa, empurrarVizinhos, layoutDoModelo, maisLugaresNoBloco, maisUmBloco, maisUmaFileira, menosUmaFileira, temCorredorNoMeio, tirarBloco, type ModeloId, type ParametrosDoModelo,
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

/** Desfazer e refazer do desenho: o estado fica com quem guarda o layout (a folha do setor); aqui só os botões e os atalhos. */
export type HistoricoDoEditor = { podeDesfazer: boolean; podeRefazer: boolean; onDesfazer: () => void; onRefazer: () => void };

/**
 * O editor a serviço do desenho da SALA: os blocos têm setor (cada um é pintado com o setor a que pertence), os modelos são ACRESCENTADOS ao desenho em vez de o trocarem e não há "voltar à lista
 * de fileiras". `setores`: os setores da sala com a cor; `onAtribuir`: dá (ou tira, com null) o setor a estes blocos; `onNovoSetor`: a pessoa quer criar um setor; `onModelo`: um modelo escolhido.
 */
export type EdicaoDaSala = {
  setores: { id: string; nome: string; cor: string }[];
  onAtribuir: (blocos: string[], setor: string | null) => void;
  onNovoSetor: () => void;
  onModelo: (modelo: Layout) => void;
};

export function EditorDoLayout({ layout, onLayout, blocoEscolhido, onEscolherBloco, historico, sala }: {
  layout: Layout | null;
  /** `agrupar`: a mudança faz parte de um gesto (arrastar, girar) e entra no histórico junto com as vizinhas dele. */
  onLayout: (l: Layout | null, agrupar?: boolean) => void;
  blocoEscolhido: string | null;
  onEscolherBloco: (id: string | null) => void;
  historico?: HistoricoDoEditor;
  sala?: EdicaoDaSala;
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
  // Todas as mudanças de um bloco passam por aqui: o palco acompanha o desenho e, quando a mudança aumenta o bloco (lugares, fileiras, curva, ângulo, corredor), os vizinhos
  // que ele passou a atingir saem do caminho.
  const muda = (f: (l: Layout) => Layout, empurrar = false) => {
    if (!layout || !bloco) return;
    const novo = f(layout);
    onLayout(comPalcoAcima(empurrar ? empurrarVizinhos(novo, bloco.id) : novo));
  };

  const duplicar = () => {
    if (!layout || !bloco) return;
    const novo = duplicarBloco(layout, bloco.id);
    if (novo === layout) return;
    onLayout(novo);
    onEscolherBloco(novo.blocos[novo.blocos.length - 1].id);
  };

  // Atalhos: Ctrl/Cmd+Z desfaz, Ctrl/Cmd+Shift+Z (ou Ctrl+Y) refaz, Ctrl/Cmd+D duplica o bloco. Não valem dentro de campo de texto.
  useEffect(() => {
    if (!historico) return;
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName))) return;
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const tecla = e.key.toLowerCase();
      if (tecla === "z" && !e.shiftKey && historico.podeDesfazer) { e.preventDefault(); historico.onDesfazer(); }
      else if (((tecla === "z" && e.shiftKey) || (tecla === "y" && !e.shiftKey)) && historico.podeRefazer) { e.preventDefault(); historico.onRefazer(); }
      else if (tecla === "d" && !e.shiftKey && bloco) { e.preventDefault(); duplicar(); }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  });

  const lugaresDasFileiras = bloco ? bloco.fileiras.map(f => f.lugares) : [];
  const lugaresTexto = lugaresDasFileiras.length === 0 ? "" : Math.min(...lugaresDasFileiras) === Math.max(...lugaresDasFileiras) ? String(lugaresDasFileiras[0]) : `${Math.min(...lugaresDasFileiras)} a ${Math.max(...lugaresDasFileiras)}`;
  const raio = bloco?.raio ?? null;

  return (
    <div className="space-y-4">
      {historico && (
        <div className="flex items-center justify-end gap-1.5">
          <button type="button" className={BOTAO} onClick={historico.onDesfazer} disabled={!historico.podeDesfazer} aria-label="Desfazer" title="Desfazer (Ctrl+Z)"><Undo2 size={14} aria-hidden="true" className="mr-1.5" />Desfazer</button>
          <button type="button" className={BOTAO} onClick={historico.onRefazer} disabled={!historico.podeRefazer} aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)"><Redo2 size={14} aria-hidden="true" className="mr-1.5" />Refazer</button>
        </div>
      )}
      <div>
        <p className="text-[0.6875rem] uppercase tracking-[.08em] text-black/40">{sala ? "Acrescentar ao desenho" : "Modelo"}</p>
        <div role="radiogroup" aria-label="Modelo do desenho" className="mt-2 grid gap-2 sm:grid-cols-3">
          {MODELOS.map(m => {
            const ativo = !sala && modelo === m;
            return (
              <button key={m} type="button" role="radio" aria-checked={ativo} onClick={() => (sala ? sala.onModelo(layoutDoModelo(m, PARAMETROS_PADRAO)) : usarModelo(m, ativo ? parametros : PARAMETROS_PADRAO))}
                className={`rounded-xl border px-3.5 py-3 text-left transition ${FOCO} ${ativo ? "border-[#6450D2] bg-[#6450D2]/[.05]" : "border-black/[.12] bg-white hover:bg-black/[.03]"}`}>
                <span className="block text-[0.8125rem] text-[#282525]">{MODELO_EM_TEXTO[m].nome}</span>
                <span className="mt-0.5 block text-[0.6875rem] leading-snug text-black/50">{MODELO_EM_TEXTO[m].descricao}</span>
              </button>
            );
          })}
        </div>
        {!sala && modelo && (
          <div className="mt-3 space-y-2 rounded-xl border bg-white px-4 py-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {CAMPOS_DO_MODELO[modelo].map(c => (
              <Passo key={c.campo} rotulo={c.rotulo} valor={String(parametros[c.campo])} menosDesligado={parametros[c.campo] <= c.min} maisDesligado={parametros[c.campo] >= c.max}
                onMenos={() => usarModelo(modelo, { ...parametros, [c.campo]: parametros[c.campo] - 1 })} onMais={() => usarModelo(modelo, { ...parametros, [c.campo]: parametros[c.campo] + 1 })} />
            ))}
            <p className="text-[0.6875rem] text-black/45">Mudar estes números refaz o desenho do modelo.</p>
          </div>
        )}
        {!sala && !layout && <p className="mt-2 text-[0.75rem] text-black/50">Sem modelo, o mapa segue como uma lista de fileiras.</p>}
      </div>

      {layout && (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Bloco" className="flex flex-wrap items-center gap-1.5">
              {layout.blocos.map((b, i) => (
                <button key={b.id} type="button" role="radio" aria-checked={b.id === blocoEscolhido} onClick={() => onEscolherBloco(b.id)}
                  className={`h-8 rounded-xl border px-3 text-[0.75rem] transition ${FOCO} ${b.id === blocoEscolhido ? "border-[#6450D2] bg-[#6450D2]/[.06] text-[#282525]" : "border-black/[.12] bg-white text-black/60 hover:bg-black/[.04]"}`}>
                  {sala && <span aria-hidden="true" className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: sala.setores.find(x => x.id === b.setor)?.cor ?? "rgba(0,0,0,.2)" }} />}
                  {b.grupo ? rotuloDoGrupo(b.fileiras[0]?.nome ?? "", b.grupo.forma) : `Bloco ${i + 1}`}
                  {sala && <span className="ml-1 text-black/45">· {sala.setores.find(x => x.id === b.setor)?.nome ?? "sem setor"}</span>}
                </button>
              ))}
            </div>
            <button type="button" className={BOTAO} onClick={() => { const novo = maisUmBloco(layout); onLayout(novo); onEscolherBloco(novo.blocos[novo.blocos.length - 1].id); }} disabled={layout.blocos.length >= 30}>+ Bloco</button>
            <button type="button" className={BOTAO} onClick={() => { const novo = maisUmaMesa(layout); onLayout(novo); onEscolherBloco(novo.blocos[novo.blocos.length - 1].id); }} disabled={layout.blocos.length >= 30}>+ Mesa</button>
            <button type="button" className={BOTAO} onClick={() => { const novo = maisUmCamarote(layout); onLayout(novo); onEscolherBloco(novo.blocos[novo.blocos.length - 1].id); }} disabled={layout.blocos.length >= 30}>+ Camarote</button>
          </div>

          {bloco ? (
            <div className="mt-3 space-y-3 rounded-xl border bg-white px-4 py-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-[0.8125rem] font-medium text-[#282525]">{bloco.grupo ? rotuloDoGrupo(bloco.fileiras[0]?.nome ?? "", bloco.grupo.forma) : `Bloco ${indice}`}</p>
              {sala && (
                <div>
                  <p className="mb-1.5 text-[0.8125rem] text-black/65">Setor</p>
                  <Dropdown ariaLabel="Setor deste bloco" value={bloco.setor ?? ""} onChange={v => { if (v === "__novo") sala.onNovoSetor(); else sala.onAtribuir([bloco.id], v === "" ? null : v); }}
                    options={[{ value: "", label: "Sem setor" }, ...sala.setores.map(x => ({ value: x.id, label: x.nome })), { value: "__novo", label: "Criar um setor…" }]} />
                  {bloco.setor && layout.blocos.filter(b => !b.setor).length >= 2 && (
                    <button type="button" className="mt-2 text-[0.75rem] text-black/55 underline underline-offset-2 hover:text-black/75" onClick={() => sala.onAtribuir(layout.blocos.filter(b => !b.setor).map(b => b.id), bloco.setor)}>
                      Dar este setor a todos os blocos sem setor ({layout.blocos.filter(b => !b.setor).length})
                    </button>
                  )}
                </div>
              )}
              {!bloco.grupo ? (
              <>
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
                onMenos={() => muda(l => menosUmaFileira(l, bloco.id), true)} onMais={() => muda(l => maisUmaFileira(l, bloco.id), true)} />
              <Passo rotulo="Lugares por fileira" valor={lugaresTexto} menosDesligado={Math.min(...lugaresDasFileiras) <= 1} maisDesligado={Math.max(...lugaresDasFileiras) >= 80}
                onMenos={() => muda(l => maisLugaresNoBloco(l, bloco.id, -1), true)} onMais={() => muda(l => maisLugaresNoBloco(l, bloco.id, 1), true)} />
              <Passo rotulo="Curva" valor={raio === null ? "Reta" : `Raio ${raio}`} menosDesligado={raio === null} maisDesligado={raio !== null && raio <= RAIO_MINIMO}
                rotuloMenos="Menos curva" rotuloMais="Mais curva"
                onMenos={() => muda(l => comRaio(l, bloco.id, raio === null ? null : raio + PASSO_DO_RAIO > RAIO_MAXIMO ? null : raio + PASSO_DO_RAIO), true)}
                onMais={() => muda(l => comRaio(l, bloco.id, raio === null ? RAIO_MAXIMO - PASSO_DO_RAIO : Math.max(RAIO_MINIMO, raio - PASSO_DO_RAIO)), true)} />
              </>
              ) : (
              <>
                <Passo rotulo="Lugares" valor={String(bloco.fileiras[0]?.lugares ?? 0)} menosDesligado={(bloco.fileiras[0]?.lugares ?? 0) <= (bloco.grupo?.forma === "mesa" ? MESA_MIN : 1)} maisDesligado={(bloco.fileiras[0]?.lugares ?? 0) >= (bloco.grupo?.forma === "mesa" ? MESA_MAX : CAMAROTE_MAX)}
                  onMenos={() => muda(l => comLugaresDoGrupo(l, bloco.id, (bloco.fileiras[0]?.lugares ?? 0) - 1), true)} onMais={() => muda(l => comLugaresDoGrupo(l, bloco.id, (bloco.fileiras[0]?.lugares ?? 0) + 1), true)} />
                {bloco.grupo?.forma === "camarote" && (
                  <Passo rotulo="Lugares por fila" valor={String(colunasDoCamarote(bloco.fileiras[0]?.lugares ?? 1, bloco.grupo.colunas))} menosDesligado={colunasDoCamarote(bloco.fileiras[0]?.lugares ?? 1, bloco.grupo.colunas) <= 1} maisDesligado={colunasDoCamarote(bloco.fileiras[0]?.lugares ?? 1, bloco.grupo.colunas) >= Math.min(COLUNAS_MAX, bloco.fileiras[0]?.lugares ?? 1)}
                    onMenos={() => muda(l => comColunasDoGrupo(l, bloco.id, colunasDoCamarote(bloco.fileiras[0]?.lugares ?? 1, bloco.grupo?.colunas) - 1), true)} onMais={() => muda(l => comColunasDoGrupo(l, bloco.id, colunasDoCamarote(bloco.fileiras[0]?.lugares ?? 1, bloco.grupo?.colunas) + 1), true)} />
                )}
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0"><span className="block text-[0.8125rem] text-black/65">Vende inteiro</span><span className="block text-[0.6875rem] leading-snug text-black/45">{bloco.grupo?.inteiro ? "Só se compra com todos os lugares, num pedido só." : "Dá para comprar só alguns lugares."}</span></span>
                  <button type="button" role="switch" aria-checked={!!bloco.grupo?.inteiro} aria-label="Vende inteiro" onClick={() => muda(l => comVendaInteira(l, bloco.id, !bloco.grupo?.inteiro))}
                    className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${FOCO} ${bloco.grupo?.inteiro ? "bg-[#6450D2]" : "bg-black/20"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${bloco.grupo?.inteiro ? "left-[1.375rem]" : "left-0.5"}`} />
                  </button>
                </div>
              </>
              )}
              <Passo rotulo="Ângulo" valor={`${bloco.angulo}°`} menosDesligado={bloco.angulo <= -360} maisDesligado={bloco.angulo >= 360} rotuloMenos="Girar para a esquerda" rotuloMais="Girar para a direita"
                onMenos={() => muda(l => comAngulo(l, bloco.id, bloco.angulo - 5), true)} onMais={() => muda(l => comAngulo(l, bloco.id, bloco.angulo + 5), true)} />
              {!bloco.grupo && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.8125rem] text-black/65">Corredor no meio</span>
                <button type="button" role="switch" aria-checked={temCorredorNoMeio(bloco)} aria-label="Corredor no meio do bloco" onClick={() => muda(l => comCorredorNoMeio(l, bloco.id, !temCorredorNoMeio(bloco)), true)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${FOCO} ${temCorredorNoMeio(bloco) ? "bg-[#6450D2]" : "bg-black/20"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${temCorredorNoMeio(bloco) ? "left-[1.375rem]" : "left-0.5"}`} />
                </button>
              </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-[0.8125rem] text-black/65">Mover</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" className={BOTAO_PASSO} aria-label="Mover para a esquerda" onClick={() => muda(l => deslocarBloco(l, bloco.id, -1, 0))}><ArrowLeft size={14} aria-hidden="true" /></button>
                  <button type="button" className={BOTAO_PASSO} aria-label="Mover para cima" onClick={() => muda(l => deslocarBloco(l, bloco.id, 0, -1))}><ArrowUp size={14} aria-hidden="true" /></button>
                  <button type="button" className={BOTAO_PASSO} aria-label="Mover para baixo" onClick={() => muda(l => deslocarBloco(l, bloco.id, 0, 1))}><ArrowDown size={14} aria-hidden="true" /></button>
                  <button type="button" className={BOTAO_PASSO} aria-label="Mover para a direita" onClick={() => muda(l => deslocarBloco(l, bloco.id, 1, 0))}><ArrowRight size={14} aria-hidden="true" /></button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button type="button" className={BOTAO} onClick={duplicar} disabled={layout.blocos.length >= 30} title="Duplicar o bloco (Ctrl+D)"><Copy size={14} aria-hidden="true" className="mr-1.5" />Duplicar bloco</button>
                {layout.blocos.length > 1 && <button type="button" className={BOTAO} onClick={() => muda(l => centralizarBloco(l, bloco.id))} title="Pôr o bloco no meio dos outros">Centralizar</button>}
              </div>
              {layout.blocos.length > 1 && (
                <div className="pt-1">
                  <button type="button" className="text-[0.75rem] text-[#B23B3B] underline underline-offset-2 hover:text-[#8f2e2e]" onClick={() => { const novo = tirarBloco(layout, bloco.id); onLayout(novo); onEscolherBloco(novo.blocos[0]?.id ?? null); }}>Apagar {bloco.grupo ? rotuloDoGrupo(bloco.fileiras[0]?.nome ?? "", bloco.grupo.forma).toLowerCase() : `o bloco ${indice}`}</button>
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

          {!sala && (<div className="mt-3">
            <button type="button" className="text-[0.75rem] text-black/55 underline underline-offset-2 hover:text-black/75" onClick={() => { onLayout(null); onEscolherBloco(null); setModelo(null); }}>Voltar à lista de fileiras</button>
          </div>)}
        </div>
      )}
    </div>
  );
}
