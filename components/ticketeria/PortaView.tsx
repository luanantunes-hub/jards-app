"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ScanLine, XCircle } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { BuscaDaPorta, DesfazerEntrada, type IngressoAchado } from "@/components/ticketeria/PortaExtrasView";

// A porta (passo C5 da T5): quem confere os ingressos na entrada do evento. Só desenho: os dados e as ações chegam por props. Pensada para o celular, com o polegar:
// o resultado da conferência ocupa a largura toda e se lê de longe (verde pode entrar, âmbar já usado, vermelho não vale).

const BORDA = "rgba(13,13,13,.08)";
const ROTULO = "text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/45";
const CAMPO = "h-12 w-full rounded-xl border border-black/15 bg-white px-3.5 text-[1.0625rem] font-normal uppercase tracking-[.14em] text-[#282525] placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-black/30 focus:border-[#7259B5] focus:outline-none";

export type SessaoDaPorta = { id: string; rotulo: string };
/** `assento`: o lugar do ingresso de um setor numerado ("Plateia · Fileira C · lugar 7"); nulo no setor comum. */
export type EntradaRecente = { codigo: string; ingresso: string; assento?: string | null; comprador: string; hora: string };

/** O que a conferência de um código respondeu. */
export type ResultadoDaConferencia =
  | { tipo: "pode_entrar"; ingresso: string; assento?: string | null; comprador: string; codigo: string; restantes: number }
  | { tipo: "ja_usado"; ingresso: string; assento?: string | null; comprador: string; codigo: string; usado_em: string }
  | { tipo: "outra_sessao"; ingresso: string; sessao_do_ingresso: string; codigo: string }
  | { tipo: "cancelado"; ingresso: string; codigo: string }
  | { tipo: "nao_encontrado"; codigo: string };

const SECOES = "rounded-xl border bg-white";

function Cartao({ children, rotulo }: { children: ReactNode; rotulo: string }) {
  return <section aria-label={rotulo} className={`${SECOES} px-4 py-4 md:px-5`} style={{ borderColor: BORDA }}>{children}</section>;
}

/** O resultado, em um bloco só, com cor e palavra (nunca só a cor). */
export function ResultadoDaPorta({ resultado, onProximo }: { resultado: ResultadoDaConferencia; onProximo?: () => void }) {
  const base = "rounded-xl border px-4 py-4 md:px-5";
  const proximo = onProximo && <button type="button" onClick={onProximo} className="mt-4 h-11 w-full rounded-xl border border-black/15 bg-white text-[0.875rem] font-normal text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Próximo ingresso</button>;
  if (resultado.tipo === "pode_entrar") {
    return (
      <div role="status" className={base} style={{ borderColor: "#2E893280", backgroundColor: "#2E89320D" }}>
        <p className="flex items-center gap-2 text-[1.375rem] font-medium tracking-[-.02em] text-[#2E8932]"><CheckCircle2 size={24} aria-hidden="true" />Pode entrar</p>
        <p className="mt-2 text-[1.0625rem] font-normal text-[#282525]">{resultado.ingresso}</p>
        {resultado.assento && <p className="mt-0.5 text-[1.25rem] font-medium tracking-[-.01em] text-[#282525]">{resultado.assento}</p>}
        <p className="text-[0.875rem] text-black/60">{resultado.comprador}</p>
        <p className="mt-2 text-[0.75rem] tabular-nums tracking-[.1em] text-black/45">{resultado.codigo} · faltam {resultado.restantes.toLocaleString("pt-BR")} entrar</p>
        {proximo}
      </div>
    );
  }
  if (resultado.tipo === "ja_usado") {
    return (
      <div role="alert" className={base} style={{ borderColor: "#B07A1480", backgroundColor: "#B07A140D" }}>
        <p className="flex items-center gap-2 text-[1.375rem] font-medium tracking-[-.02em] text-[#B07A14]"><AlertTriangle size={24} aria-hidden="true" />Já foi usado</p>
        <p className="mt-2 text-[1.0625rem] font-normal text-[#282525]">{resultado.ingresso}</p>
        {resultado.assento && <p className="mt-0.5 text-[1.0625rem] text-black/70">{resultado.assento}</p>}
        <p className="text-[0.875rem] text-black/60">{resultado.comprador}</p>
        <p className="mt-2 text-[0.875rem] text-black/70">Entrou às {resultado.usado_em}. Não deixe entrar de novo.</p>
        <p className="mt-1 text-[0.75rem] tabular-nums tracking-[.1em] text-black/45">{resultado.codigo}</p>
        {proximo}
      </div>
    );
  }
  const motivo = resultado.tipo === "outra_sessao" ? { titulo: "Não vale nesta sessão", texto: `Este ingresso é de ${resultado.sessao_do_ingresso}.`, ingresso: resultado.ingresso }
    : resultado.tipo === "cancelado" ? { titulo: "Ingresso cancelado", texto: "A compra foi reembolsada. O ingresso não vale mais.", ingresso: resultado.ingresso }
      : { titulo: "Código não encontrado", texto: "Confira o código e tente de novo.", ingresso: null };
  return (
    <div role="alert" className={base} style={{ borderColor: "#D94A4A80", backgroundColor: "#D94A4A0D" }}>
      <p className="flex items-center gap-2 text-[1.375rem] font-medium tracking-[-.02em] text-[#D94A4A]"><XCircle size={24} aria-hidden="true" />{motivo.titulo}</p>
      {motivo.ingresso && <p className="mt-2 text-[1.0625rem] font-normal text-[#282525]">{motivo.ingresso}</p>}
      <p className="mt-1 text-[0.875rem] text-black/70">{motivo.texto}</p>
      <p className="mt-1 text-[0.75rem] tabular-nums tracking-[.1em] text-black/45">{resultado.codigo}</p>
      {proximo}
    </div>
  );
}

export function PortaView({ sessoes, sessaoId, onSessao, entraram, lugares, codigo, onCodigo, onConferir, onLerQr, lendo, conferindo, resultado, onProximo, recentes, semCamera, previa, busca, onBusca, onDarEntrada, desfazer, onDesfazer, onConfirmarDesfazer, onCancelarDesfazer, relatorioHref, acoes }: {
  sessoes: SessaoDaPorta[]; sessaoId: string; onSessao?: (id: string) => void;
  /** Quantos já entraram e quantos ingressos válidos há para a sessão. */
  entraram: number; lugares: number;
  codigo: string; onCodigo?: (valor: string) => void; onConferir?: () => void; onLerQr?: () => void; lendo?: boolean; conferindo?: boolean;
  resultado: ResultadoDaConferencia | null; onProximo?: () => void; recentes: EntradaRecente[];
  /** O navegador não lê QR Code pela câmera (BarcodeDetector): só o código digitado. */
  semCamera?: boolean;
  /** A imagem da câmera, acima do botão, enquanto lê. */
  previa?: ReactNode;
  /** Buscar pelo nome de quem comprou: o termo, o que achou (null = ainda não buscou) e o que fazer. Sem isto a busca não aparece. */
  busca?: { termo: string; resultados: IngressoAchado[] | null; buscando?: boolean };
  onBusca?: (termo: string) => void; onDarEntrada?: (codigo: string) => void;
  /** Desfazer uma entrada: a entrada que se pediu para desfazer (a confirmação aparece) e as ações. Sem `onDesfazer` o botão não aparece. */
  desfazer?: { codigo: string; comprador: string; ingresso: string; trabalhando?: boolean; erro?: string | null } | null;
  onDesfazer?: (codigo: string) => void; onConfirmarDesfazer?: () => void; onCancelarDesfazer?: () => void;
  /** O endereço do relatório da sessão (só para quem edita a Ticketeria). */
  relatorioHref?: string;
  /** Ações extras no cartão da sessão (por exemplo, o link da equipe). */
  acoes?: ReactNode;
}) {
  const pct = lugares > 0 ? Math.min(100, Math.round((entraram / lugares) * 100)) : 0;
  return (
    <div className="mx-auto w-full max-w-[34rem] space-y-4">
      <Cartao rotulo="Sessão">
        <p className={`mb-1.5 ${ROTULO}`}>Sessão</p>
        <Dropdown ariaLabel="Sessão" value={sessaoId} onChange={id => onSessao?.(id)} options={sessoes.map(s => ({ value: s.id, label: s.rotulo }))} />
        <div className="mt-4 flex items-baseline justify-between gap-3">
          <p className="text-[1.75rem] font-medium tabular-nums tracking-[-.03em] text-[#282525]">{entraram.toLocaleString("pt-BR")} <span className="text-[1rem] font-normal text-black/45">de {lugares.toLocaleString("pt-BR")} entraram</span></p>
          <p className="text-[0.8125rem] tabular-nums text-black/45">{pct}%</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[.08]" role="img" aria-label={`${pct}% dos ingressos já entraram`}><div className="h-full rounded-full bg-[#3DA86A]" style={{ width: `${pct}%` }} /></div>
        {(relatorioHref || acoes) && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">{relatorioHref && <a href={relatorioHref} className="text-black/55 underline underline-offset-2 hover:text-black/75">Relatório da sessão</a>}{acoes}</div>}
      </Cartao>

      {resultado ? <ResultadoDaPorta resultado={resultado} onProximo={onProximo} /> : (
        <Cartao rotulo="Conferir ingresso">
          {previa}
          {!semCamera && (
            <button type="button" onClick={onLerQr} disabled={conferindo} className="acao-principal flex h-14 w-full items-center justify-center gap-2 rounded-xl border-transparent text-[1rem] font-normal text-white transition-transform duration-150 disabled:opacity-50">
              <ScanLine size={20} aria-hidden="true" />{lendo ? "Aponte para o QR Code…" : "Ler QR Code"}
            </button>
          )}
          <form className={semCamera ? "" : "mt-4"} onSubmit={e => { e.preventDefault(); onConferir?.(); }}>
            <label htmlFor="porta-codigo" className={`mb-1.5 block ${ROTULO}`}>{semCamera ? "Código do ingresso" : "Ou digite o código"}</label>
            <div className="flex gap-2">
              <input id="porta-codigo" className={CAMPO} value={codigo} onChange={e => onCodigo?.(e.target.value)} placeholder="Código do ingresso" autoComplete="off" autoCapitalize="characters" maxLength={14} disabled={conferindo} />
              <button type="submit" disabled={conferindo || codigo.trim().length === 0} className="h-12 shrink-0 rounded-xl border border-black/15 bg-white px-5 text-[0.875rem] font-normal text-[#282525] transition hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Conferir</button>
            </div>
          </form>
          {busca && <BuscaDaPorta termo={busca.termo} onTermo={onBusca} resultados={busca.resultados} buscando={busca.buscando} onDarEntrada={onDarEntrada} desligado={conferindo} />}
        </Cartao>
      )}
      {desfazer && <DesfazerEntrada comprador={desfazer.comprador} ingresso={desfazer.ingresso} trabalhando={desfazer.trabalhando} erro={desfazer.erro} onConfirmar={onConfirmarDesfazer} onCancelar={onCancelarDesfazer} />}

      <section aria-label="Últimas entradas">
        <h2 className={`mb-2 ${ROTULO}`}>Últimas entradas</h2>
        {recentes.length === 0 ? (
          <p className="rounded-xl border bg-white px-4 py-5 text-[0.8125rem] text-black/45" style={{ borderColor: BORDA }}>Ninguém entrou ainda.</p>
        ) : (
          <ul className="divide-y divide-black/[.08] overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDA }}>
            {recentes.map(r => (
              <li key={r.codigo} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0"><p className="truncate text-[0.875rem] text-[#282525]">{r.comprador}</p><p className="text-[0.6875rem] text-black/45">{r.ingresso}{r.assento ? ` · ${r.assento}` : ""} · <span className="tabular-nums tracking-[.08em]">{r.codigo}</span></p></div>
                <div className="flex shrink-0 items-center gap-3"><span className="text-[0.75rem] tabular-nums text-black/45">{r.hora}</span>{onDesfazer && <button type="button" onClick={() => onDesfazer(r.codigo)} className="rounded-xl px-1 text-[0.75rem] text-black/45 underline underline-offset-2 hover:text-black/70" aria-label={`Desfazer a entrada de ${r.comprador}`}>Desfazer</button>}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
