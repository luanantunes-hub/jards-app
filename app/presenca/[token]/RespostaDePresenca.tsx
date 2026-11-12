"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { ConvitePublico } from "@/lib/producao/convite-publico";

const CAMPO = "h-11 w-full rounded border border-black/[.14] bg-white px-3 text-[0.875rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/50 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.75rem] font-medium text-black/60";

type Escolha = "vou" | "nao_vou" | null;

/** A resposta ao convite: vou ou não vou, e para quem vai, a chegada, a saída e uma observação. Sem conta. */
export function RespostaDePresenca({ codigo, convite }: { codigo: string; convite: ConvitePublico }) {
  const [escolha, setEscolha] = useState<Escolha>(convite.resposta === "pendente" ? null : convite.resposta);
  const [chegadaDia, setChegadaDia] = useState(convite.chegadaDia ?? "");
  const [chegadaHora, setChegadaHora] = useState(convite.chegadaHora ?? "");
  const [saidaDia, setSaidaDia] = useState(convite.saidaDia ?? "");
  const [saidaHora, setSaidaHora] = useState(convite.saidaHora ?? "");
  const [observacao, setObservacao] = useState(convite.observacao ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<Escolha>(null);

  async function enviar() {
    if (!escolha) { setErro("Diga se você vai ou não."); return; }
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/presenca/${encodeURIComponent(codigo)}/responder`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resposta: escolha, chegada_dia: chegadaDia, chegada_hora: chegadaHora, saida_dia: saidaDia, saida_hora: saidaHora, observacao }),
      });
      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };
      if (!resposta.ok) { setErro(corpo.error ?? "Não foi possível enviar agora. Tente de novo."); return; }
      setEnviado(escolha);
    } catch {
      setErro("Sem conexão. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const botao = (valor: "vou" | "nao_vou", texto: string) => (
    <button type="button" onClick={() => setEscolha(valor)} aria-pressed={escolha === valor} disabled={enviando}
      className={`h-12 flex-1 rounded border text-[0.9375rem] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] ${escolha === valor ? "border-[#282525] bg-[#282525] text-white" : "border-black/[.16] bg-white text-[#282525] hover:bg-black/[.04]"}`}>
      {texto}
    </button>
  );

  return (
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-8">
      <div className="mx-auto max-w-[30rem]">
        <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{convite.organizacao}</p>
        <h1 className="mt-1 text-[1.375rem] font-semibold tracking-[-.01em] text-[#282525]">{convite.primeiroNome ? `Oi, ${convite.primeiroNome}!` : "Olá!"}</h1>
        <p className="mt-1 text-[0.875rem] text-black/60">Você foi convidada(o) para <strong className="font-medium text-[#282525]">{convite.temporada}</strong>. Confirme em poucos segundos; não precisa de conta.</p>

        {enviado ? (
          <div role="status" className="mt-6 rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.1)" }}>
            <Check size={20} aria-hidden="true" className="mx-auto text-[#2E8932]" />
            <p className="mt-2 text-[0.9375rem] font-medium text-[#282525]">{enviado === "vou" ? "Presença confirmada" : "Resposta enviada"}</p>
            <p className="mt-1 text-[0.8125rem] text-black/55">{enviado === "vou" ? "Obrigado! A produção já recebeu." : "Obrigado por avisar."} Se mudar de ideia, abra este link de novo e responda outra vez.</p>
          </div>
        ) : (
          <form onSubmit={event => { event.preventDefault(); void enviar(); }} className="mt-6 space-y-5">
            <div role="group" aria-label="Você vai?" className="flex gap-3">
              {botao("vou", "Eu vou")}
              {botao("nao_vou", "Não vou")}
            </div>

            {escolha === "vou" && (
              <div className="space-y-4">
                <div className="grid grid-cols-[1fr_7.5rem] gap-3">
                  <div>
                    <label className={ROTULO} htmlFor="chegada-dia">Dia da chegada (opcional)</label>
                    <input id="chegada-dia" type="date" className={CAMPO} value={chegadaDia} onChange={event => setChegadaDia(event.target.value)} disabled={enviando} />
                  </div>
                  <div>
                    <label className={ROTULO} htmlFor="chegada-hora">Hora</label>
                    <input id="chegada-hora" type="time" className={CAMPO} value={chegadaHora} onChange={event => setChegadaHora(event.target.value)} disabled={enviando} />
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_7.5rem] gap-3">
                  <div>
                    <label className={ROTULO} htmlFor="saida-dia">Dia da saída (opcional)</label>
                    <input id="saida-dia" type="date" className={CAMPO} value={saidaDia} onChange={event => setSaidaDia(event.target.value)} disabled={enviando} />
                  </div>
                  <div>
                    <label className={ROTULO} htmlFor="saida-hora">Hora</label>
                    <input id="saida-hora" type="time" className={CAMPO} value={saidaHora} onChange={event => setSaidaHora(event.target.value)} disabled={enviando} />
                  </div>
                </div>
              </div>
            )}

            {escolha && (
              <div>
                <label className={ROTULO} htmlFor="observacao">Quer avisar algo? (opcional)</label>
                <textarea id="observacao" rows={3} maxLength={500} className="w-full resize-none rounded border border-black/[.14] bg-white px-3 py-2.5 text-[0.875rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/50 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50"
                  value={observacao} onChange={event => setObservacao(event.target.value)} disabled={enviando} placeholder={escolha === "vou" ? "Por exemplo: chego de carro, preciso de vaga." : ""} />
                <p className="mt-1 text-[0.6875rem] text-black/45">Não escreva aqui dados de saúde, documentos ou senhas.</p>
              </div>
            )}

            {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

            <button type="submit" disabled={enviando || !escolha} className="h-12 w-full rounded bg-[#2E8932] text-[0.9375rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.99] disabled:opacity-50">
              {enviando ? "Enviando…" : "Enviar resposta"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
