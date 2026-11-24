"use client";

import { useEffect, useId, useState } from "react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { SeloDePrecisao } from "@/components/ticketeria/PainelView";
import { nomeDaSessaoNova, porQueEssaEstimativa, rotuloDaOpcao, type DiaEHorario, type EstimativaDaSessao, type ProcuraSobrando } from "@/lib/ticketeria/previsao-sessao";
import type { PrevisaoDaLoja } from "@/lib/ticketeria/previsao-sessao-servidor";

// A previsão por sessão (lib/ticketeria/previsao-sessao.ts): o aviso de procura sobrando na página do evento, o "e se eu acrescentar uma sessão?" e o gráfico de como cada dia
// vende na casa (página Eventos). Os dados vêm de GET /api/ticketeria/lojas/{id}/previsao-sessao; só quem edita a Ticketeria lê (para os outros, nada aparece).

const BORDA = "rgba(13,13,13,.08)";

/** A previsão da loja (e do evento, quando há). Null enquanto carrega ou quando não dá para ler (quem não edita a Ticketeria, por exemplo): a tela segue sem ela. */
export function usePrevisaoDaSessao(lojaId: string | null, eventoId: string | null, versao = 0): PrevisaoDaLoja | null {
  const [dados, setDados] = useState<{ chave: string; previsao: PrevisaoDaLoja } | null>(null);
  const chave = `${lojaId}|${eventoId}|${versao}`;
  useEffect(() => {
    if (!lojaId) return;
    let ativo = true;
    void fetch(`/api/ticketeria/lojas/${lojaId}/previsao-sessao${eventoId ? `?evento=${eventoId}` : ""}`)
      .then(r => (r.ok ? (r.json() as Promise<PrevisaoDaLoja>) : null))
      .then(p => { if (ativo && p) setDados({ chave, previsao: p }); })
      .catch(() => {});
    return () => { ativo = false; };
  }, [lojaId, eventoId, chave]);
  return dados?.chave === chave ? dados.previsao : null;
}

/** O aviso na página do evento: só com sinal medido (sessões esgotadas e lista de espera). */
export function ProcuraSobrandoAviso({ procura, temOpcoes, onAbrir }: { procura: ProcuraSobrando; temOpcoes: boolean; onAbrir: () => void }) {
  const esgotaram = procura.esgotadas === procura.sessoes ? (procura.sessoes === 1 ? "A sessão esgotou" : `As ${procura.sessoes} sessões esgotaram`) : `${procura.esgotadas} das ${procura.sessoes} sessões ${procura.esgotadas === 1 ? "esgotou" : "esgotaram"}`;
  const espera = procura.naEspera > 0 ? ` e há ${procura.naEspera} ${procura.naEspera === 1 ? "pessoa" : "pessoas"} na lista de espera` : "";
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-4" style={{ borderColor: "rgba(114,89,181,.28)", background: "#FAF8FE" }}>
      <div className="min-w-0 flex-1 basis-72">
        <p className="text-[0.875rem] text-[#282525]">Procura sobrando</p>
        <p className="mt-1 text-[0.78rem] leading-relaxed text-black/55">
          {esgotaram}{espera}. {temOpcoes ? "Uma sessão a mais tende a vender bem; veja quanto, por dia e horário." : "A sua casa ainda não tem sessões suficientes em cada dia e horário para estimar uma sessão a mais."}
        </p>
      </div>
      {temOpcoes && <button type="button" onClick={onAbrir} className="inline-flex h-10 shrink-0 items-center rounded-xl bg-[#1C0E33] px-4 text-[0.75rem] font-normal text-white transition hover:bg-[#2A1A47] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">E se eu acrescentar uma sessão?</button>}
    </div>
  );
}

/** A venda da sessão na lista de sessões do evento ("198 de 200 · esgotou"). */
export function VendaDaSessao({ vendidos, lugares, esgotou }: { vendidos: number; lugares: number; esgotou: boolean }) {
  if (lugares <= 0) return null;
  return (
    <span className="inline-flex items-center gap-2 text-[0.6875rem] tabular-nums text-black/50">
      {Math.min(vendidos, lugares)} de {lugares}
      {esgotou && <span className="rounded-xl border px-2 py-0.5 text-[0.625rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>esgotou</span>}
    </span>
  );
}

/** "E se eu acrescentar uma sessão?": as opções de dia e horário e quanto cada uma deve vender. "Criar esta sessão" abre o cadastro da sessão já preenchido. */
export function ESeAcrescentarSessao({ opcoes, evento, naEspera, onFechar, onCriar }: {
  opcoes: EstimativaDaSessao[]; evento: string; naEspera: number; onFechar: () => void; onCriar: (opcao: EstimativaDaSessao) => void;
}) {
  const tituloId = useId();
  const [escolhida, setEscolhida] = useState(0);
  useModalDismiss(onFechar);
  const e = opcoes[escolhida] ?? opcoes[0];
  if (!e) return null;
  const chip = (ligado: boolean) => `rounded-xl border px-3 py-1.5 text-[0.75rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${ligado ? "border-[#7259B5] bg-[#F5F2FB] text-[#1C0E33]" : "bg-white text-black/55 hover:bg-black/[.03]"}`;
  return (
    <div className="veu fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onFechar}>
      <div role="dialog" aria-modal="true" aria-labelledby={tituloId} className="folha-vidro-centro w-full max-w-[38rem] px-6 py-6 sm:px-8 sm:py-7" onClick={x => x.stopPropagation()}>
        <h2 id={tituloId} className="text-[1.125rem] font-normal text-[#282525]">E se eu acrescentar uma sessão?</h2>
        <p className="mt-1 text-[0.78rem] text-black/50">O Jards estima pelo que a sua casa já vendeu em cada dia e horário, e pelo quanto este evento vende.</p>
        <p className="mt-5 text-[0.625rem] uppercase tracking-[.08em] text-black/40">Dia e horário</p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Dia e horário">
          {opcoes.map((o, i) => <button key={`${o.dia}|${o.hora}`} type="button" role="radio" aria-checked={i === escolhida} onClick={() => setEscolhida(i)} className={chip(i === escolhida)}>{rotuloDaOpcao(o)}</button>)}
        </div>
        <div className="mt-4 rounded-xl border bg-white px-4 py-3.5" style={{ borderColor: BORDA }} aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[0.8125rem] text-[#282525]">{nomeDaSessaoNova(e)} deve vender</p>
            <SeloDePrecisao selo={e.selo} />
          </div>
          <p className="mt-1 text-[1.375rem] font-light tabular-nums text-[#282525]">{e.baixo === e.alto ? e.alto : `${e.baixo} a ${e.alto}`} <span className="text-[0.8125rem] font-normal text-black/45">dos {e.lugares} lugares</span></p>
          <p className="mt-1.5 text-[0.75rem] leading-relaxed text-black/50">{porQueEssaEstimativa(e, evento, naEspera)}</p>
        </div>
        <div className="mt-6 flex items-center justify-end gap-4">
          <button type="button" onClick={onFechar} className="text-[0.78rem] text-black/35 transition hover:text-black/55 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Fechar</button>
          <button type="button" onClick={() => onCriar(e)} className="inline-flex h-10 items-center rounded-xl bg-[#7259B5] px-4 text-[0.78rem] font-normal text-white transition hover:bg-[#634CA3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Criar esta sessão</button>
        </div>
      </div>
    </div>
  );
}

/** Como cada dia vende na casa: a lotação média por dia e horário, das sessões que já aconteceram (com 4 ou mais). Nada aparece sem nenhum dia medido. */
export function ComoCadaDiaVende({ dias, frase }: { dias: DiaEHorario[]; frase: string | null }) {
  if (dias.length === 0) return null;
  const linhas = [0, 25, 50, 75, 100];
  return (
    <section aria-labelledby="como-cada-dia-vende" className="mb-6">
      <div className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="como-cada-dia-vende" className="text-[0.875rem] font-normal text-[#282525]">Como cada dia vende na sua casa</h2>
            <p className="mt-0.5 text-[0.75rem] text-black/45">Lotação média das sessões que já aconteceram, por dia e horário (só os que têm 4 sessões ou mais).</p>
          </div>
          <SeloDePrecisao selo="medido" />
        </div>
        <div className="mt-2 overflow-x-auto pt-4">
          <div className="relative flex min-w-max gap-3 pl-9" style={{ height: "11.5rem" }}>
            <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: "8.5rem" }} aria-hidden="true">
              {linhas.map(l => (
                <div key={l} className="absolute inset-x-0 flex items-center" style={{ bottom: `${l}%`, transform: "translateY(50%)" }}>
                  <span className="w-8 pr-1 text-right text-[0.5625rem] tabular-nums text-black/30">{l}%</span>
                  <span className="h-px flex-1 bg-black/[.06]" />
                </div>
              ))}
            </div>
            {dias.map(d => (
              <figure key={`${d.diaDaSemana}|${d.turno}`} className="relative flex w-16 flex-col items-center sm:w-20">
                <div className="relative w-full" style={{ height: "8.5rem" }}>
                  <div className="absolute inset-x-0 bottom-0 rounded-t bg-[#7259B5]" style={{ height: `${Math.max(1, d.ocupacao * 100)}%` }} />
                  <span className="absolute inset-x-0 text-center text-[0.625rem] tabular-nums text-black/60" style={{ bottom: `calc(${Math.max(1, d.ocupacao * 100)}% + 2px)` }}>{Math.round(d.ocupacao * 100)}%</span>
                </div>
                <figcaption className="mt-1.5 text-center">
                  <span className="block whitespace-nowrap text-[0.625rem] text-black/55">{d.rotulo}</span>
                  <span className="block text-[0.5625rem] text-black/35">{d.sessoes} sessões</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
      {frase && <p className="mt-2 text-[0.75rem] text-black/45">{frase} Isso é da sua casa: em outro espaço pode ser bem diferente.</p>}
    </section>
  );
}
