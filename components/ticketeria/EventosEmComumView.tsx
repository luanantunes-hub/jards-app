"use client";

import { Dropdown } from "@/components/ui/Dropdown";

// A aba "Eventos em comum" do Público: os eventos que dividem público com um evento (quem comprou os dois), o alerta de datas próximas que dividem a venda e o envio "quem foi a este e
// não comprou aquele". O que é parecido vem do público da casa, não de rótulo de gênero. Só desenho: os dados e as ações chegam por props.

const BORDA = "rgba(13,13,13,.08)";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const quando = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}` : "");
const numero = (n: number) => n.toLocaleString("pt-BR");

export type LinhaEmComum = {
  eventoId: string; titulo: string; quando: string | null; futuro: boolean; diasDeDistancia: number | null; dividemAVenda: boolean; mesmoArtista: boolean;
  parte: number; emComum: number; segmento: string | null; alcancaveis: number; semCompra: number;
};
export type DadosEmComum = { eventos: { id: string; titulo: string; compradores: number }[]; escolhido: string | null; compradores: number; linhas: LinhaEmComum[] };

export function EventosEmComum({ dados, carregando, onEscolher, onEnviar }: { dados: DadosEmComum | null; carregando?: boolean; onEscolher: (eventoId: string) => void; onEnviar: (linha: LinhaEmComum, titulo: string) => void }) {
  if (!dados) return <p className="text-[0.8125rem] text-black/40" aria-live="polite">{carregando ? "Carregando…" : "Não foi possível carregar agora."}</p>;
  if (!dados.escolhido) return <div className="rounded-xl border bg-white px-4 py-16 text-center text-[0.875rem] text-black/50" style={{ borderColor: BORDA }}>Quando houver eventos com venda, o Jards mostra quais dividem o mesmo público.</div>;
  const atual = dados.eventos.find(e => e.id === dados.escolhido);
  const tituloAtual = atual?.titulo ?? "este evento";
  const comEnvio = dados.linhas.find(l => l.segmento && l.alcancaveis > 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-2.5" style={{ borderColor: BORDA }}>
        <div className="flex items-center gap-2 text-[0.8125rem] text-black/55"><span>Evento:</span>
          <div className="min-w-[16rem]"><Dropdown ariaLabel="Evento" value={dados.escolhido} onChange={onEscolher} options={dados.eventos.map(e => ({ value: e.id, label: e.titulo }))} /></div>
        </div>
        <span className="text-[0.75rem] text-black/45">{numero(dados.compradores)} {dados.compradores === 1 ? "comprador" : "compradores"}</span>
      </div>
      {dados.linhas.length === 0 ? (
        <p className="rounded-xl border bg-white px-4 py-10 text-center text-[0.8125rem] text-black/50" style={{ borderColor: BORDA }}>Nenhum outro evento da casa divide pelo menos 5% do público de {tituloAtual}.</p>
      ) : (
        <div className="divide-y divide-black/[.08] rounded-xl border bg-white" style={{ borderColor: BORDA }}>
          {dados.linhas.map(l => (
            <div key={l.eventoId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0 max-w-2xl">
                <p className="text-[0.8125rem] text-[#282525]">{l.titulo}{l.quando ? ` · ${l.futuro ? quando(l.quando) : `${MESES[Number(l.quando.slice(5, 7)) - 1]} de ${l.quando.slice(0, 4)}`}` : ""}</p>
                <p className="mt-0.5 text-[0.75rem] leading-relaxed text-black/50">
                  {Math.round(l.parte * 100)}% de quem comprou {tituloAtual} também comprou {l.titulo}.{l.mesmoArtista ? " Mesmo artista." : ""}
                  {l.dividemAVenda && <span className="text-[#B07A14]"> Estão a {l.diasDeDistancia} {l.diasDeDistancia === 1 ? "dia" : "dias"} um do outro: podem dividir a venda.</span>}
                </p>
              </div>
              {l.futuro && l.segmento && l.alcancaveis > 0
                ? <button type="button" onClick={() => onEnviar(l, tituloAtual)} className="rounded-xl border bg-white px-3 py-2 text-left text-[0.75rem] text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]" style={{ borderColor: BORDA }}>Enviar para quem foi a {tituloAtual} e não comprou {l.titulo} · {numero(l.alcancaveis)}</button>
                : <span className="text-[0.6875rem] text-black/40">{l.futuro ? "ninguém para receber" : "já aconteceu"}</span>}
            </div>
          ))}
        </div>
      )}
      <p className="max-w-3xl text-[0.75rem] leading-relaxed text-black/45">
        {comEnvio ? `O envio só vai para quem aceitou receber novidades e não saiu da lista (${numero(comEnvio.alcancaveis)} das ${numero(comEnvio.semCompra)} pessoas). ` : ""}
        Eventos com o mesmo público muito perto um do outro tendem a dividir a venda: espaçar ajuda. O que é parecido vem do seu público, não de rótulo de gênero.
      </p>
    </div>
  );
}
