"use client";

import { Copy, Download, Link2, Search } from "lucide-react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso } from "@/components/ticketeria/FolhasDosEventos";

// A porta melhor: buscar o ingresso pelo nome de quem comprou, o relatório da sessão e o link da equipe da porta. Só desenho: os dados e as ações chegam por props.

const BORDA = "rgba(13,13,13,.08)";
const ROTULO = "text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45";
const CAMPO = "h-12 w-full rounded-xl border border-black/15 bg-white px-3.5 text-[1rem] font-normal text-[#282525] placeholder:text-black/30 focus:border-[#7259B5] focus:outline-none";

/** Um ingresso achado pela busca. `situacao`: ainda não entrou, já entrou (com a hora) ou cancelado (compra reembolsada). */
export type IngressoAchado = { codigo: string; ingresso: string; assento?: string | null; comprador: string; situacao: "nao_entrou" | "entrou" | "cancelado"; hora?: string | null };

function Etiqueta({ texto, cor }: { texto: string; cor: string }) {
  return <span className="inline-flex shrink-0 rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={{ borderColor: cor + "47", color: cor }}>{texto}</span>;
}

/** "Buscar por nome": para quem perdeu o celular ou não achou o QR Code. A lista mostra quem comprou, o ingresso e o lugar, e dá entrada com um toque. */
export function BuscaDaPorta({ termo, onTermo, resultados, buscando, onDarEntrada, desligado }: {
  termo: string; onTermo?: (valor: string) => void; resultados: IngressoAchado[] | null; buscando?: boolean; onDarEntrada?: (codigo: string) => void; desligado?: boolean;
}) {
  return (
    <div className="mt-5 border-t pt-4" style={{ borderColor: BORDA }}>
      <label htmlFor="porta-busca" className={`mb-1.5 block ${ROTULO}`}>Ou busque pelo nome</label>
      <div className="relative">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35" />
        <input id="porta-busca" type="search" className={`${CAMPO} pl-10`} value={termo} onChange={e => onTermo?.(e.target.value)} placeholder="Nome de quem comprou" autoComplete="off" disabled={desligado} />
      </div>
      {termo.trim().length >= 2 && (
        <div className="mt-3" aria-live="polite">
          {buscando ? <p className="text-[0.8125rem] text-black/45">Buscando…</p> : resultados && resultados.length === 0 ? (
            <p className="text-[0.8125rem] text-black/45">Ninguém com esse nome nesta sessão. Confira a grafia ou o dia da sessão.</p>
          ) : resultados && (
            <ul className="divide-y divide-black/[.08] overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDA }}>
              {resultados.map(r => (
                <li key={r.codigo} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0"><p className="truncate text-[0.875rem] text-[#282525]">{r.comprador}</p><p className="text-[0.6875rem] text-black/45">{r.ingresso}{r.assento ? ` · ${r.assento}` : ""}</p></div>
                  {r.situacao === "nao_entrou" ? (
                    <button type="button" onClick={() => onDarEntrada?.(r.codigo)} className="h-10 shrink-0 rounded-xl bg-[#6450D2] px-4 text-[0.8125rem] font-normal text-white transition hover:bg-[#5342BA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Dar entrada</button>
                  ) : r.situacao === "entrou" ? <Etiqueta texto={`ENTROU ${r.hora ?? ""}`.trim()} cor="#6b6767" /> : <Etiqueta texto="CANCELADO" cor="#D94A4A" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** A confirmação de desfazer uma entrada (o ingresso volta a valer e a pessoa pode entrar de novo). */
export function DesfazerEntrada({ comprador, ingresso, trabalhando, erro, onConfirmar, onCancelar }: { comprador: string; ingresso: string; trabalhando?: boolean; erro?: string | null; onConfirmar?: () => void; onCancelar?: () => void }) {
  return (
    <div role="alertdialog" aria-label="Desfazer entrada" className="rounded-xl border px-4 py-4" style={{ borderColor: "#B07A1480", backgroundColor: "#B07A140D" }}>
      <p className="text-[1rem] font-normal text-[#282525]">Desfazer a entrada de {comprador}?</p>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-black/65">{ingresso} volta a valer e a pessoa pode entrar de novo. Use só se a entrada foi marcada por engano.</p>
      {erro && <p role="alert" className="mt-2 text-[0.8125rem] text-[#B23B3B]">{erro}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCancelar} disabled={trabalhando} className="h-11 flex-1 rounded-xl border border-black/15 bg-white text-[0.875rem] font-normal text-[#282525] transition hover:bg-black/[.04] disabled:opacity-50">Cancelar</button>
        <button type="button" onClick={onConfirmar} disabled={trabalhando} className="h-11 flex-1 rounded-xl bg-[#6450D2] text-[0.875rem] font-normal text-white transition hover:bg-[#5342BA] disabled:opacity-50">{trabalhando ? "Desfazendo…" : "Desfazer entrada"}</button>
      </div>
    </div>
  );
}

// ─── O relatório da sessão ──────────────────────────────────────────────────

export type RelatorioDaSessao = {
  validos: number; entraram: number;
  /** Por tipo de ingresso. */
  porIngresso: { nome: string; validos: number; entraram: number }[];
  /** As entradas por faixa de meia hora (a hora no fuso do local). */
  porHorario: { faixa: string; entradas: number }[];
  /** Compras reembolsadas (ingressos cancelados). */
  cancelados: number;
};

const numero = (n: number) => n.toLocaleString("pt-BR");
const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);

/** O relatório da sessão: quantos entraram e quantos não vieram, por ingresso e por horário, e a lista para baixar. */
export function RelatorioDaPorta({ sessao, relatorio, onBaixar, baixando }: { sessao: string; relatorio: RelatorioDaSessao; onBaixar?: () => void; baixando?: boolean }) {
  const naoVieram = Math.max(0, relatorio.validos - relatorio.entraram);
  const maior = Math.max(1, ...relatorio.porHorario.map(h => h.entradas));
  return (
    <div className="mx-auto w-full max-w-[44rem] space-y-4">
      <section aria-label="Resumo" className="rounded-xl border bg-white px-5 py-5" style={{ borderColor: BORDA }}>
        <p className={`mb-1.5 ${ROTULO}`}>{sessao}</p>
        <div className="grid grid-cols-3 gap-4">
          <div><p className="text-[1.75rem] font-medium tabular-nums tracking-[-.03em] text-[#282525]">{numero(relatorio.validos)}</p><p className="text-[0.75rem] text-black/50">ingressos válidos</p></div>
          <div><p className="text-[1.75rem] font-medium tabular-nums tracking-[-.03em] text-[#2E8932]">{numero(relatorio.entraram)}</p><p className="text-[0.75rem] text-black/50">entraram ({pct(relatorio.entraram, relatorio.validos)}%)</p></div>
          <div><p className="text-[1.75rem] font-medium tabular-nums tracking-[-.03em] text-[#282525]">{numero(naoVieram)}</p><p className="text-[0.75rem] text-black/50">não vieram</p></div>
        </div>
        {relatorio.cancelados > 0 && <p className="mt-3 text-[0.75rem] text-black/45">{relatorio.cancelados === 1 ? "1 ingresso cancelado" : `${numero(relatorio.cancelados)} ingressos cancelados`} por reembolso (não entram na conta).</p>}
      </section>

      <section aria-label="Por ingresso" className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
        <h2 className={`mb-3 ${ROTULO}`}>Por ingresso</h2>
        <ul className="space-y-3">
          {relatorio.porIngresso.map(i => (
            <li key={i.nome}>
              <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]"><span className="text-[#282525]">{i.nome}</span><span className="tabular-nums text-black/55">{numero(i.entraram)} de {numero(i.validos)}</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/[.08]" role="img" aria-label={`${i.nome}: ${pct(i.entraram, i.validos)}% entraram`}><div className="h-full rounded-full bg-[#3DA86A]" style={{ width: `${pct(i.entraram, i.validos)}%` }} /></div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Entradas por horário" className="rounded-xl border bg-white px-5 py-4" style={{ borderColor: BORDA }}>
        <h2 className={`mb-3 ${ROTULO}`}>Entradas por horário</h2>
        {relatorio.porHorario.length === 0 ? <p className="text-[0.8125rem] text-black/45">Ninguém entrou ainda.</p> : (
          <ul className="space-y-1.5">
            {relatorio.porHorario.map(h => (
              <li key={h.faixa} className="flex items-center gap-3 text-[0.75rem]">
                <span className="w-11 shrink-0 tabular-nums text-black/50">{h.faixa}</span>
                <span className="h-4 min-w-0 flex-1"><span className="block h-full rounded-md bg-[#7259B5]/70" style={{ width: `${Math.max(2, (h.entradas / maior) * 100)}%` }} /></span>
                <span className="w-9 shrink-0 text-right tabular-nums text-[#282525]">{numero(h.entradas)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" onClick={onBaixar} disabled={baixando} className="inline-flex h-11 items-center gap-2 rounded-xl border border-black/15 bg-white px-4 text-[0.875rem] font-normal text-[#282525] transition hover:bg-black/[.04] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"><Download size={16} aria-hidden="true" />{baixando ? "Preparando…" : "Baixar a lista (CSV)"}</button>
      <p className="text-[0.75rem] text-black/45">A lista traz o nome de quem comprou, o ingresso, o lugar, se entrou e a hora. Tem dado pessoal: guarde com cuidado.</p>
    </div>
  );
}

// ─── O link da equipe da porta ──────────────────────────────────────────────

export type LinkDaEquipe = { id: string; rotulo: string; endereco: string; valido_ate: string; ativo: boolean };

/** A folha do link da equipe: quem confere na porta abre o link no celular, sem login, e só vê esta sessão. */
export function LinkDaEquipeSheet({ sessao, links, erro, trabalhando, copiado, onCriar, onCopiar, onRevogar, onClose }: {
  sessao: string; links: LinkDaEquipe[]; erro?: string | null; trabalhando?: boolean; copiado?: string | null; onCriar?: () => void; onCopiar?: (id: string) => void; onRevogar?: (id: string) => void; onClose: () => void;
}) {
  return (
    <TopSheet titulo="Link da equipe" etiqueta={sessao} onClose={onClose} footer={fechar => <button type="button" onClick={fechar} className="rounded-xl px-3 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/60">Fechar</button>}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <p className="text-[0.8125rem] leading-relaxed text-black/60">Mande o link para quem vai conferir os ingressos na porta. Abre no celular, <strong className="font-normal text-[#282525]">sem login</strong>, e só serve para esta sessão: ler o QR Code, buscar pelo nome e dar entrada. O link vale até o dia seguinte à sessão e você pode desligá-lo quando quiser.</p>
        {links.length === 0 ? <p className="rounded-xl border px-4 py-4 text-[0.8125rem] text-black/45" style={{ borderColor: BORDA }}>Nenhum link ainda.</p> : (
          <ul className="divide-y divide-black/[.08] overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDA }}>
            {links.map(l => (
              <li key={l.id} className={`px-4 py-3 ${l.ativo ? "" : "opacity-50"}`}>
                <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-[0.875rem] text-[#282525]"><Link2 size={14} aria-hidden="true" className="text-black/40" />{l.rotulo}</p>{!l.ativo && <Etiqueta texto="DESLIGADO" cor="#6b6767" />}</div>
                <p className="mt-1 break-all text-[0.75rem] tabular-nums text-black/45">{l.endereco}</p>
                <p className="mt-0.5 text-[0.6875rem] text-black/40">Vale até {l.valido_ate}</p>
                {l.ativo && (
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => onCopiar?.(l.id)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/[.12] bg-white px-3 text-[0.75rem] font-normal text-[#282525] transition hover:bg-black/[.04]"><Copy size={13} aria-hidden="true" />{copiado === l.id ? "Copiado" : "Copiar link"}</button>
                    <button type="button" onClick={() => onRevogar?.(l.id)} className="h-9 rounded-xl px-3 text-[0.75rem] text-black/50 transition hover:bg-black/[.04] hover:text-black/70">Desligar</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={onCriar} disabled={trabalhando} className="inline-flex h-10 items-center rounded-xl border border-black/[.12] bg-white px-4 text-[0.8125rem] font-normal text-[#282525] transition hover:bg-black/[.04] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">{trabalhando ? "Criando…" : "+ Novo link"}</button>
      </div>
    </TopSheet>
  );
}
