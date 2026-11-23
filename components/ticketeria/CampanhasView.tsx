"use client";

import { useMemo, useState } from "react";
import { Aviso } from "@/components/ticketeria/FolhasDosEventos";
import { rotuloDoCanalDeGasto } from "@/lib/ticketeria/modelo";
import { formatarMoeda } from "@/lib/ticketeria/recebimentos";
import type { Marcacao } from "@/lib/ticketeria/campanhas";

// As campanhas do Meta e do Google, na aba Conexões: de cada uma, se é da MARCA (a instituição) ou de um EVENTO. O modelo usa isso para separar a marca, que rende devagar e por meses, dos
// anúncios de cada evento. As campanhas com o nome de um evento já chegam marcadas (sugerido pelo nome). Só desenho: os dados e a ação de salvar chegam por props.

const BORDA = "rgba(13,13,13,.08)";
const CABECALHO = "relative px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-3 text-[0.8125rem] text-[#282525]";
const EVENTOS_A_MOSTRAR = 5;

export type CampanhaDaTela = { id: string; nome: string; canal: string; gasto90dias: number; marcacao: Marcacao | null; eventoId: string | null; sugerida: boolean };
export type EventoDaTela = { id: string; titulo: string };
type Escolha = { marcacao: Marcacao | null; eventoId: string | null };

export function CampanhasDaLoja({ campanhas, eventos, salvando, erro, aviso, onSalvar }: {
  campanhas: CampanhaDaTela[]; eventos: EventoDaTela[]; salvando?: boolean; erro?: string | null; aviso?: string | null;
  /** Devolve se salvou (só então as escolhas da tela são limpas). */ onSalvar: (itens: { id: string; marcacao: Marcacao | null; evento_id: string | null }[]) => Promise<boolean>;
}) {
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [todosOsEventos, setTodosOsEventos] = useState(false);
  const atual = (c: CampanhaDaTela): Escolha => escolhas[c.id] ?? { marcacao: c.marcacao, eventoId: c.eventoId };
  const mudou = Object.keys(escolhas).length > 0;
  const semEscolha = campanhas.filter(c => atual(c).marcacao === null).length;
  // Os eventos que aparecem como opção: os que alguma campanha já usa e os primeiros da lista; "Mais eventos" abre todos.
  const usados = useMemo(() => new Set(campanhas.map(c => (escolhas[c.id]?.eventoId ?? c.eventoId)).filter(Boolean) as string[]), [campanhas, escolhas]);
  const opcoes = todosOsEventos ? eventos : eventos.filter((e, i) => usados.has(e.id) || i < EVENTOS_A_MOSTRAR);
  const escolher = (c: CampanhaDaTela, e: Escolha) => setEscolhas(x => ({ ...x, [c.id]: e }));
  const chip = (ligado: boolean) => `rounded-xl border px-2.5 py-1 text-[0.6875rem] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${ligado ? "border-[#7259B5] bg-[#F5F2FB] text-[#1C0E33]" : "bg-white text-black/55 hover:bg-black/[.03]"}`;

  if (campanhas.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="rounded-xl border px-4 py-3 text-[0.8125rem] text-black/55" style={{ borderColor: "rgba(114,89,181,.28)", background: "#FAF8FE" }}>
        <span className="text-[#282525]">Campanhas do Meta e do Google: marca ou evento?</span> O modelo separa o que é da instituição (o nome da casa, a marca) do que é de cada evento. As campanhas com o nome de um evento já vêm marcadas; confira e escolha as outras.
      </div>
      {erro && <Aviso texto={erro} />}
      {aviso && <p role="status" className="rounded-xl border bg-white px-3 py-2 text-[0.75rem] text-[#2E8932]" style={{ borderColor: "#2E893247" }}>{aviso}</p>}
      <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <table className="w-full min-w-[48rem] border-collapse">
          <thead><tr className="border-b" style={{ borderColor: BORDA }}><th className={CABECALHO}>Campanha</th><th className={CABECALHO}>Canal</th><th className={`${CABECALHO} text-right`}>Gasto em 90 dias</th><th className={CABECALHO}>É de</th></tr></thead>
          <tbody className="divide-y divide-black/[.08]">
            {campanhas.map(c => {
              const e = atual(c);
              const sugerida = c.sugerida && !escolhas[c.id];
              return (
                <tr key={c.id}>
                  <td className={CELULA}>{c.nome}</td>
                  <td className={`${CELULA} whitespace-nowrap`}>{rotuloDoCanalDeGasto(c.canal)}</td>
                  <td className={`${CELULA} whitespace-nowrap text-right tabular-nums`}>{c.gasto90dias > 0 ? formatarMoeda(c.gasto90dias) : <span className="text-black/30">—</span>}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={`É de: ${c.nome}`}>
                      <button type="button" role="radio" aria-checked={e.marcacao === "marca"} onClick={() => escolher(c, { marcacao: "marca", eventoId: null })} className={chip(e.marcacao === "marca")}>Marca</button>
                      {opcoes.map(ev => {
                        const on = e.marcacao === "evento" && e.eventoId === ev.id;
                        return <button key={ev.id} type="button" role="radio" aria-checked={on} onClick={() => escolher(c, { marcacao: "evento", eventoId: ev.id })} className={chip(on)}>{ev.titulo}</button>;
                      })}
                      {sugerida && <span className="text-[0.625rem] text-[#7259B5]">sugerido pelo nome</span>}
                      {e.marcacao === null && <span className="text-[0.625rem] text-[#B07A14]">escolha uma</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3" style={{ borderColor: BORDA }}>
          <p className="text-[0.6875rem] text-black/45">
            {semEscolha > 0 ? `${semEscolha === 1 ? "1 campanha sem escolha" : `${semEscolha} campanhas sem escolha`}: até você escolher, o gasto entra junto do canal, sem separar.` : "Todas as campanhas têm marcação."}
            {eventos.length > opcoes.length && <> <button type="button" onClick={() => setTodosOsEventos(true)} className="text-[#7259B5] underline-offset-2 hover:underline">Mostrar todos os eventos</button></>}
          </p>
          <button type="button" disabled={!mudou || salvando} className="rounded-xl bg-[#2E8932] px-4 py-2 text-[0.75rem] font-normal text-white transition hover:bg-[#277A2B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] disabled:opacity-50"
            onClick={() => { void onSalvar(Object.entries(escolhas).map(([id, x]) => ({ id, marcacao: x.marcacao, evento_id: x.marcacao === "evento" ? x.eventoId : null }))).then(ok => { if (ok) setEscolhas({}); }); }}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
      <p className="max-w-4xl text-[0.75rem] leading-relaxed text-black/45">Campanha nova que tiver o nome de um evento no título é marcada sozinha. Você pode mudar quando quiser; o modelo usa a marcação na próxima rodada. Gasto lançado à mão em Ações e gasto sem evento conta como marca.</p>
    </div>
  );
}
