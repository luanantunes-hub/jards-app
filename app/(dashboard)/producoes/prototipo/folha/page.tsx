"use client";

import { useState } from "react";
import { BedDouble, Bus, Check, MapPin, Phone, WifiOff } from "lucide-react";
import { FaixaDoPrototipo } from "@/components/producao/prototipo/Prototipo";
import { BLOCOS, DATA, FOLHA, HOSPEDAGEM, TURNE, VIAGEM } from "@/lib/producao/prototipo/dados";

const ROTULO = "text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45";

/** Protótipo da folha do dia (PD1.12 e PD1.13): a página que a pessoa abre pelo link, no celular. */
export default function PrototipoDaFolha() {
  const [resposta, setResposta] = useState<"confirmo" | "nao" | null>(null);

  return (
    <div className="min-h-full bg-black/[.02]">
      <FaixaDoPrototipo href="/producoes/prototipo/folha" />
      <div className="mx-auto grid max-w-pagina items-start gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[24rem_minmax(0,1fr)] lg:px-10">
        <div className="mx-auto w-full max-w-[24rem] overflow-hidden rounded-[1.75rem] border-[6px] border-[#282525] bg-white shadow-[0_12px_40px_rgba(0,0,0,.12)]">
          <div className="space-y-5 px-5 pb-6 pt-7">
            <header>
              <p className="text-[0.6875rem] text-black/45">Folha do dia · {TURNE.obra}</p>
              <h1 className="mt-1 text-[1.375rem] font-semibold tracking-[-.02em] text-[#282525]">{DATA.dia}</h1>
              <p className="text-[0.8125rem] text-black/60">{DATA.lugar} · {TURNE.praca}</p>
              <a href="#mapa" className="mt-1.5 inline-flex items-center gap-1.5 text-[0.75rem] font-medium text-[#282525] underline decoration-black/20 underline-offset-2">
                <MapPin size={13} aria-hidden="true" /> Abrir no mapa
              </a>
            </header>

            <section className="rounded border p-3.5" style={{ borderColor: "rgba(13,13,13,.10)" }}>
              <p className="text-[0.8125rem] font-semibold text-[#282525]">{FOLHA.pessoa.nome} · {FOLHA.pessoa.funcao}</p>
              <p className="mt-0.5 text-[0.75rem] text-black/60">Sua {FOLHA.pessoa.horario}</p>
              {resposta === null ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setResposta("confirmo")} className="h-11 rounded bg-[#2E8932] text-[0.8125rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]">Confirmo</button>
                  <button type="button" onClick={() => setResposta("nao")} className="h-11 rounded border border-black/15 bg-white text-[0.8125rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98]">Não posso</button>
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-1.5 text-[0.75rem] text-black/60">
                  {resposta === "confirmo" ? <Check size={13} aria-hidden="true" className="text-[#2E8932]" /> : null}
                  {resposta === "confirmo" ? "Você confirmou. A produção já sabe." : "Você avisou que não pode. A produção já sabe."}
                  <button type="button" onClick={() => setResposta(null)} className="ml-auto text-[0.6875rem] font-medium text-black/45 underline underline-offset-2">Desfazer</button>
                </p>
              )}
            </section>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded bg-black/[.04] p-3">
                <p className={ROTULO}>Agora</p>
                <p className="mt-1 text-[0.875rem] font-semibold text-[#282525]">{FOLHA.agora.titulo}</p>
                <p className="text-[0.6875rem] text-black/50">{FOLHA.agora.ate}</p>
              </div>
              <div className="rounded border p-3" style={{ borderColor: "rgba(13,13,13,.10)" }}>
                <p className={ROTULO}>Próximo</p>
                <p className="mt-1 text-[0.875rem] font-semibold text-[#282525]">{FOLHA.proximo.titulo}</p>
                <p className="text-[0.6875rem] text-black/50">às {FOLHA.proximo.as}</p>
              </div>
            </div>

            <section>
              <p className={ROTULO}>O dia</p>
              <ul className="mt-2 divide-y divide-black/[.06]">
                {BLOCOS.filter(bloco => bloco.naFolha).map(bloco => (
                  <li key={bloco.titulo} className="flex gap-3 py-2 text-[0.75rem]">
                    <span className="w-28 shrink-0 tabular-nums text-black/55">{bloco.hora}</span>
                    <span className="text-[#282525]">{bloco.titulo}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2.5">
              <p className={ROTULO}>Viagem e hotel</p>
              <p className="flex gap-2 text-[0.75rem] text-[#282525]"><Bus size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-black/40" /><span>{VIAGEM.titulo}: saída {VIAGEM.saida}</span></p>
              <p className="flex gap-2 text-[0.75rem] text-[#282525]"><BedDouble size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-black/40" /><span>{HOSPEDAGEM.titulo} · {HOSPEDAGEM.endereco} · {FOLHA.pessoa.quarto}</span></p>
            </section>

            <section>
              <p className={ROTULO}>Contatos</p>
              <ul className="mt-2 space-y-1.5">
                {FOLHA.contatos.map(contato => (
                  <li key={contato.nome} className="flex items-center justify-between gap-2 text-[0.75rem]">
                    <span className="text-[#282525]">{contato.nome} <span className="text-black/45">· {contato.papel}</span></span>
                    <a href="#ligar" className="inline-flex items-center gap-1 tabular-nums text-black/60 underline decoration-black/20 underline-offset-2"><Phone size={12} aria-hidden="true" /> {contato.telefone}</a>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <p className={ROTULO}>Avisos da produção</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[0.75rem] text-[#282525]">
                {FOLHA.avisos.map(aviso => <li key={aviso}>{aviso}</li>)}
              </ul>
            </section>

            <p className="flex items-center gap-1.5 border-t pt-3 text-[0.6875rem] text-black/45" style={{ borderColor: "rgba(13,13,13,.06)" }}>
              <WifiOff size={12} aria-hidden="true" /> Salva neste celular às {FOLHA.salvaAs}. Abre sem internet.
            </p>
          </div>
        </div>

        <aside className="max-w-[30rem] space-y-4 lg:pt-6">
          <h2 className="text-[1.125rem] font-semibold tracking-[-.01em] text-[#282525]">Como a equipe recebe</h2>
          <ul className="space-y-2.5 text-[0.8125rem] leading-relaxed text-black/60">
            <li>A produção manda um link pelo WhatsApp: o da equipe toda ou o de cada pessoa, com a chamada, o quarto e o botão de confirmar.</li>
            <li>Abre sem login e sem instalar nada. Depois de aberta uma vez, funciona sem internet, até no camarim.</li>
            <li>Mostra só o que a equipe precisa: nunca dinheiro nem dado pessoal de ninguém.</li>
            <li>Quem confirma aparece na equipe da data; quem não abriu, também.</li>
            <li>Link revogado ou vencido deixa de abrir, e o que estava salvo no celular é apagado.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
