"use client";

import { Hourglass } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { TopSheet } from "@/components/ui/TopSheet";
import { Aviso, Rodape } from "@/components/ticketeria/FolhasDosEventos";
import { Moldura, type EventoParaComprar } from "@/components/ticketeria/CompraView";
import type { IngressoComEspera, PessoaNaEspera, SessaoComEspera } from "@/lib/ticketeria/espera";

// A lista de espera da Ticketeria, desenhada: quem compra entra na lista quando o ingresso esgota (sem pagar e sem reservar lugar) e o produtor avisa por
// e-mail, na ordem de chegada, quando voltam lugares. Só desenho: os dados e as ações chegam por props.

// Lado de quem compra (segue o site da pessoa, como as telas de CompraView).
const BOTAO = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#282525] px-5 py-3 text-[0.9375rem] text-white transition hover:bg-[#3A3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525] disabled:cursor-not-allowed disabled:bg-black/20";
const BOTAO_SECUNDARIO = "inline-flex min-h-11 items-center justify-center rounded-xl border border-black/15 bg-white px-4 py-2.5 text-[0.875rem] text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525]";
const ROTULO_COMPRA = "mb-1.5 block text-[0.6875rem] uppercase tracking-[.08em] text-black/50";
const CAMPO_COMPRA = "h-12 w-full rounded-xl border border-black/15 bg-white px-3.5 text-[1rem] text-[#282525] placeholder:text-black/30 focus:border-[#282525] focus:outline-none";

type Site = { titulo: string; cor?: string };

/** A tela de entrar na lista: nome, e-mail e quantos ingressos a pessoa quer. */
export function TelaListaDeEspera({ site, evento, ingresso, valores, quantidade, max, erro, trabalhando, onMudar, onQuantidade, onVoltar, onEntrar }: {
  site: Site; evento: EventoParaComprar; ingresso: { nome: string }; valores: { nome: string; email: string }; quantidade: number; max: number; erro?: string | null; trabalhando?: boolean;
  onMudar?: (campo: "nome" | "email", valor: string) => void; onQuantidade?: (novo: number) => void; onVoltar?: () => void; onEntrar?: () => void;
}) {
  const botao = "flex h-11 w-11 items-center justify-center rounded-xl border border-black/15 bg-white text-[1.25rem] leading-none text-[#282525] transition hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282525]";
  return (
    <Moldura titulo={site.titulo} cor={site.cor}
      rodape={<div className="flex items-center gap-3"><button type="button" className={`${BOTAO_SECUNDARIO} shrink-0`} onClick={onVoltar}>Voltar</button><button type="button" className={BOTAO} disabled={trabalhando} onClick={onEntrar}>{trabalhando ? "Entrando…" : "Entrar na lista"}</button></div>}>
      <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">Avise-me se voltar</h1>
      <p className="mt-1 text-[0.875rem] text-black/60">{evento.titulo} · {evento.quando}</p>
      <p className="mt-0.5 text-[0.875rem] text-black/60">{ingresso.nome} esgotado</p>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-black/70">Se voltarem lugares, mandamos um e-mail com o link para comprar. Você não paga nada agora e o lugar não fica reservado: quem comprar primeiro leva.</p>
      {erro && <p role="alert" className="mt-4 rounded-xl border px-3.5 py-2.5 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
      <div className="mt-5 space-y-4">
        <div><label className={ROTULO_COMPRA} htmlFor="espera-nome">Nome</label><input id="espera-nome" className={CAMPO_COMPRA} value={valores.nome} onChange={e => onMudar?.("nome", e.target.value)} autoComplete="name" maxLength={120} disabled={trabalhando} /></div>
        <div><label className={ROTULO_COMPRA} htmlFor="espera-email">E-mail</label><input id="espera-email" type="email" inputMode="email" className={CAMPO_COMPRA} value={valores.email} onChange={e => onMudar?.("email", e.target.value)} autoComplete="email" maxLength={200} disabled={trabalhando} /></div>
        <div>
          <span className={ROTULO_COMPRA}>Quantos ingressos você quer</span>
          <div className="flex items-center gap-3" role="group" aria-label="Quantidade de ingressos">
            <button type="button" className={botao} disabled={quantidade <= 1} onClick={() => onQuantidade?.(quantidade - 1)} aria-label="Menos um ingresso">−</button>
            <span className="w-6 text-center text-[1.0625rem] tabular-nums" aria-live="polite">{quantidade}</span>
            <button type="button" className={botao} disabled={quantidade >= max} onClick={() => onQuantidade?.(quantidade + 1)} aria-label="Mais um ingresso">+</button>
          </div>
        </div>
      </div>
      <p className="mt-5 text-[0.75rem] leading-relaxed text-black/50">Usamos seu nome e e-mail só para este aviso e apagamos depois da sessão. Para sair da lista, use o link que vai em cada e-mail.</p>
    </Moldura>
  );
}

/** A confirmação: a pessoa está na lista. */
export function TelaNaListaDeEspera({ site, evento, ingresso, email, quantidade, onVoltar }: { site: Site; evento: EventoParaComprar; ingresso: { nome: string }; email: string; quantidade: number; onVoltar?: () => void }) {
  return (
    <Moldura titulo={site.titulo} cor={site.cor}>
      <h1 className="text-[1.5rem] font-medium tracking-[-.025em]">Você está na lista</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-black/65">Se voltar {quantidade === 1 ? "um lugar" : `${quantidade} lugares`} de {ingresso.nome} para {evento.titulo}, avisamos em <strong className="font-normal text-[#282525]">{email}</strong>.</p>
      <ul className="mt-5 space-y-2 text-[0.875rem] leading-relaxed text-black/65">
        <li>Os avisos seguem a ordem de chegada à lista.</li>
        <li>O aviso não reserva o lugar: quem comprar primeiro leva.</li>
        <li>Para sair da lista, use o link que vai no e-mail.</li>
      </ul>
      <button type="button" className={`${BOTAO} mt-6`} onClick={onVoltar}>Voltar aos ingressos</button>
    </Moldura>
  );
}

// Lado do produtor (Ticketeria > Lista de espera).

const BORDA = "rgba(13,13,13,.08)";
const CABECALHO = "px-4 py-2.5 text-left text-[0.625rem] font-normal uppercase tracking-[.08em] text-black/35";
const CELULA = "px-4 py-2.5 text-[0.8125rem] text-[#282525]";

export type { IngressoComEspera, PessoaNaEspera, SessaoComEspera };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** As sessões com gente esperando, por ingresso: quem é, quantos quer, quando entrou, e o botão de avisar quando há lugar. */
export function EsperaDaLoja({ sessoes, onAvisar }: { sessoes: SessaoComEspera[]; onAvisar?: (sessao: string, ingresso: string) => void }) {
  if (sessoes.length === 0) {
    return (
      <div className="rounded-xl border bg-white" style={{ borderColor: BORDA }}>
        <div className="flex flex-col items-center px-4 py-20 text-center">
          <Hourglass size={28} className="mb-3 text-black/15" aria-hidden="true" />
          <p className="text-[0.875rem] font-medium text-black/55">Ninguém na lista de espera</p>
          <p className="mt-1.5 max-w-sm text-[0.75rem] leading-relaxed text-black/35">Quando um ingresso esgotar, o comprador vê &ldquo;Avise-me se voltar&rdquo; e entra aqui. Você avisa quando voltarem lugares.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {sessoes.map(s => (
        <section key={s.id} aria-label={`${s.titulo}, ${s.quando}`} className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: BORDA }}>
          <div className="border-b px-4 py-3" style={{ borderColor: BORDA }}><p className="text-[0.875rem] font-normal text-[#282525]">{s.titulo}</p><p className="text-[0.75rem] text-black/45">{s.quando}</p></div>
          {s.ingressos.map(i => {
            const esperando = i.pessoas.filter(p => p.avisado_em === null);
            const querem = esperando.reduce((soma, p) => soma + p.quantidade, 0);
            return (
              <div key={i.id} className="border-b last:border-b-0" style={{ borderColor: BORDA }}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-black/[.015] px-4 py-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="text-[0.8125rem] font-normal text-[#282525]">{i.nome}</p>
                    <p className="text-[0.6875rem] text-black/45">{esperando.length === 0 ? "Todos já foram avisados" : `${plural(esperando.length, "pessoa esperando", "pessoas esperando")} · ${plural(querem, "ingresso", "ingressos")}`} · {i.livres === 0 ? "esgotado" : `${plural(i.livres, "lugar livre", "lugares livres")} agora`}</p>
                  </div>
                  <button type="button" disabled={i.livres === 0 || esperando.length === 0} onClick={() => onAvisar?.(s.id, i.id)} className="inline-flex h-9 items-center rounded-xl border border-black/[.12] bg-white px-3.5 text-[0.75rem] font-normal text-[#282525] transition enabled:hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Avisar quem espera</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] border-collapse">
                    <thead><tr className="border-y" style={{ borderColor: BORDA }}><th className={CABECALHO}>Nome</th><th className={CABECALHO}>E-mail</th><th className={`${CABECALHO} text-right`}>Quer</th><th className={CABECALHO}>Entrou em</th><th className={CABECALHO}><span className="sr-only">Situação</span></th></tr></thead>
                    <tbody className="divide-y divide-black/[.08]">
                      {i.pessoas.map(p => (
                        <tr key={p.id}>
                          <td className={CELULA}>{p.nome}</td><td className={`${CELULA} text-black/70`}>{p.email}</td><td className={`${CELULA} text-right tabular-nums`}>{p.quantidade}</td><td className={`${CELULA} tabular-nums text-black/70`}>{p.entrou}</td>
                          <td className={`${CELULA} text-right`}><span className="inline-flex rounded-xl border bg-white px-2 py-1 text-[0.625rem] font-normal" style={p.avisado_em ? { borderColor: "#6b676747", color: "#6b6767" } : { borderColor: "#B07A1447", color: "#B07A14" }}>{p.avisado_em ? `AVISADO ${p.avisado_em}` : "ESPERANDO"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/** A folha de avisar: escolhe quantas pessoas, na ordem de chegada, e mostra o e-mail que vai. */
export function AvisarSheet({ ingresso, sessao, livres, opcoes, quantas, erro, enviando, onQuantas, onClose, onEnviar }: {
  ingresso: string; sessao: string; livres: number; opcoes: { value: string; label: string }[]; quantas: string; erro?: string | null; enviando?: boolean;
  onQuantas?: (valor: string) => void; onClose: () => void; onEnviar?: () => void;
}) {
  return (
    <TopSheet titulo="Avisar quem espera" etiqueta={`${ingresso} · ${sessao}`} onClose={onClose} footer={fechar => <Rodape fechar={fechar} salvando={!!enviando} rotulo="Enviar avisos" onSalvar={() => onEnviar?.()} />}>
      <div className="space-y-4">
        {erro && <Aviso texto={erro} />}
        <p className="text-[0.8125rem] text-black/60">Agora {livres === 1 ? "há 1 lugar livre" : `há ${livres} lugares livres`}. O e-mail vai para quem está esperando, na ordem de chegada. Ninguém tem lugar reservado: quem comprar primeiro leva.</p>
        <div><span className="mb-1.5 block text-[0.6875rem] font-normal text-black/55">Quem avisar</span><Dropdown ariaLabel="Quem avisar" value={quantas} onChange={v => onQuantas?.(v)} options={opcoes} disabled={enviando} /></div>
        <div className="rounded-xl border bg-black/[.02] px-4 py-3" style={{ borderColor: BORDA }}>
          <p className="text-[0.6875rem] font-normal uppercase tracking-[.08em] text-black/40">O e-mail</p>
          <p className="mt-2 text-[0.8125rem] font-normal text-[#282525]">Voltaram ingressos para {sessao.split(" · ")[0]}</p>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-black/65">Você pediu para ser avisado: voltaram lugares de {ingresso}. Os ingressos não ficam reservados, então garanta o seu pelo link abaixo. Para sair da lista, use o link no fim deste e-mail.</p>
          <p className="mt-2 text-[0.8125rem] text-[#7259B5] underline underline-offset-2">Comprar ingressos</p>
        </div>
      </div>
    </TopSheet>
  );
}
