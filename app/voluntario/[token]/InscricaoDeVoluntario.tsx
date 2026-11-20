"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { InscricaoPublica } from "@/lib/producao/voluntario-publico";
import { TEXTO_DA_CONCORDANCIA } from "@/lib/producao/voluntarios";
import { AvisoDePrivacidade } from "@/components/producao/AvisoDePrivacidade";

const CAMPO = "h-11 w-full rounded border border-black/[.14] bg-white px-3 text-[0.875rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/50 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.75rem] font-medium text-black/60";

/** A inscrição de voluntário: nome, um contato, quando pode ajudar e a concordância. Sem conta. */
export function InscricaoDeVoluntario({ codigo, inscricao }: { codigo: string; inscricao: InscricaoPublica }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [disponibilidade, setDisponibilidade] = useState("");
  const [concordou, setConcordou] = useState(false);
  const [site, setSite] = useState(""); // campo escondido: gente de verdade não preenche
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/voluntario/${encodeURIComponent(codigo)}/inscrever`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome, email, telefone, disponibilidade, concordou, site }),
      });
      const corpo = (await resposta.json().catch(() => ({}))) as { error?: string };
      if (!resposta.ok) { setErro(corpo.error ?? "Não foi possível enviar agora. Tente de novo."); return; }
      setEnviado(true);
    } catch {
      setErro("Sem conexão. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAFAF9] px-4 py-8">
      <div className="mx-auto max-w-[30rem]">
        <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">{inscricao.organizacao}</p>
        <h1 className="mt-1 text-[1.375rem] font-semibold tracking-[-.01em] text-[#282525]">{inscricao.titulo ?? "Seja voluntário"}</h1>
        <p className="mt-1 text-[0.875rem] text-black/60">Quer ajudar em <strong className="font-medium text-[#282525]">{inscricao.temporada}</strong>? Deixe seus dados; a produção entra em contato. Não precisa de conta.</p>

        {enviado ? (
          <div role="status" className="mt-6 rounded border bg-white px-5 py-6 text-center" style={{ borderColor: "rgba(13,13,13,.1)" }}>
            <Check size={20} aria-hidden="true" className="mx-auto text-[#2E8932]" />
            <p className="mt-2 text-[0.9375rem] font-medium text-[#282525]">Inscrição enviada</p>
            <p className="mt-1 text-[0.8125rem] text-black/55">Obrigado! A produção vai analisar e falar com você.</p>
          </div>
        ) : (
          <form onSubmit={event => { event.preventDefault(); void enviar(); }} className="mt-6 space-y-4">
            <div>
              <label className={ROTULO} htmlFor="nome">Seu nome</label>
              <input id="nome" className={CAMPO} value={nome} maxLength={120} autoComplete="name" onChange={event => setNome(event.target.value)} disabled={enviando} required />
            </div>
            <div>
              <label className={ROTULO} htmlFor="email">E-mail</label>
              <input id="email" type="email" className={CAMPO} value={email} maxLength={200} autoComplete="email" onChange={event => setEmail(event.target.value)} disabled={enviando} />
            </div>
            <div>
              <label className={ROTULO} htmlFor="telefone">Telefone ou WhatsApp</label>
              <input id="telefone" type="tel" className={CAMPO} value={telefone} maxLength={30} autoComplete="tel" onChange={event => setTelefone(event.target.value)} disabled={enviando} />
              <p className="mt-1 text-[0.6875rem] text-black/45">Informe pelo menos um: e-mail ou telefone.</p>
            </div>
            <div>
              <label className={ROTULO} htmlFor="disponibilidade">Quando você pode ajudar? (opcional)</label>
              <textarea id="disponibilidade" rows={3} maxLength={500} className="w-full resize-none rounded border border-black/[.14] bg-white px-3 py-2.5 text-[0.875rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/50 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50"
                value={disponibilidade} onChange={event => setDisponibilidade(event.target.value)} disabled={enviando} placeholder="Por exemplo: noites e fins de semana." />
              <p className="mt-1 text-[0.6875rem] text-black/45">Não escreva aqui dados de saúde, documentos ou senhas.</p>
            </div>

            {/* Armadilha para robôs: escondido de quem usa a tela e de leitor de tela. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden" }}>
              <label htmlFor="site">Não preencha este campo</label>
              <input id="site" tabIndex={-1} autoComplete="off" value={site} onChange={event => setSite(event.target.value)} />
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-[0.8125rem] text-black/70">
              <input type="checkbox" checked={concordou} onChange={event => setConcordou(event.target.checked)} disabled={enviando} className="mt-0.5 h-5 w-5 shrink-0 accent-[#282525]" />
              <span>{TEXTO_DA_CONCORDANCIA}</span>
            </label>

            {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}

            <button type="submit" disabled={enviando || !concordou} className="h-12 w-full rounded bg-[#2E8932] text-[0.9375rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.99] disabled:opacity-50">
              {enviando ? "Enviando…" : "Enviar inscrição"}
            </button>
          </form>
        )}
        <AvisoDePrivacidade />
      </div>
    </main>
  );
}
