"use client";
import { useState } from "react";
import Link from "next/link";
import { SegmentedControl } from "@/components/ui/FilterControls";
import { CornerSheet } from "@/components/ui/CornerSheet";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const AREA = "min-h-[11rem] w-full resize-y rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.8125rem] leading-relaxed text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

export type InicioDoEmail = { para?: string[]; cc?: string[]; assunto?: string; responderAEmailId?: string };
export type ResultadoDoEnvio = { agendado: boolean; enviarEm: string | null };

/** "ana@x.com, bia@y.com" ou separado por espaço, ponto e vírgula ou quebra de linha. */
function enderecosDoCampo(texto: string): string[] {
  return texto.split(/[\s,;]+/).map((parte) => parte.trim()).filter(Boolean);
}

/** O valor de um campo datetime-local ("2026-11-19T15:30") na hora local da pessoa, daqui a `minutos`. */
function proximaHoraLocal(minutos: number): string {
  const quando = new Date(Date.now() + minutos * 60_000);
  const local = new Date(quando.getTime() - quando.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/**
 * Folha para escrever, responder ou agendar um e-mail. Sai da própria caixa da pessoa (Gmail ou Outlook), então fica em
 * Enviados e a próxima sincronização o traz de volta para o Jards.
 */
export function EscreverEmail({ inicio, onClose, onEnviado }: { inicio?: InicioDoEmail; onClose: () => void; onEnviado: (resultado: ResultadoDoEnvio) => void }) {
  const [para, setPara] = useState((inicio?.para ?? []).join(", "));
  const [cc, setCc] = useState((inicio?.cc ?? []).join(", "));
  const [mostrarCc, setMostrarCc] = useState((inicio?.cc ?? []).length > 0);
  const [cco, setCco] = useState("");
  const [mostrarCco, setMostrarCco] = useState(false);
  const [assunto, setAssunto] = useState(inicio?.assunto ?? "");
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState<"agora" | "agendar">("agora");
  const [quando, setQuando] = useState(() => proximaHoraLocal(60));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [precisaReconectar, setPrecisaReconectar] = useState(false);

  async function enviar(fechar: () => void) {
    setEnviando(true);
    setErro(null);
    setPrecisaReconectar(false);
    try {
      const resposta = await fetch("/api/email/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          para: enderecosDoCampo(para),
          cc: enderecosDoCampo(cc),
          cco: enderecosDoCampo(cco),
          assunto,
          texto,
          responderAEmailId: inicio?.responderAEmailId,
          ...(modo === "agendar" ? { enviarEm: new Date(quando).toISOString() } : {}),
        }),
      });
      const json = (await resposta.json().catch(() => ({}))) as { error?: string; reconectar?: string; agendado?: boolean; enviarEm?: string };
      if (!resposta.ok) {
        setPrecisaReconectar(Boolean(json.reconectar));
        throw new Error(json.error || "Não foi possível enviar.");
      }
      onEnviado({ agendado: json.agendado === true, enviarEm: json.enviarEm ?? null });
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <CornerSheet
      titulo={inicio?.responderAEmailId ? "Responder e-mail" : "Escrever e-mail"}
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={enviando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void enviar(fechar)} disabled={enviando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">
            {enviando ? (modo === "agendar" ? "Agendando…" : "Enviando…") : modo === "agendar" ? "Agendar" : "Enviar"}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && (
          <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>
            {erro}
            {precisaReconectar && <> <Link href="/configuracoes?section=ferramentas" className="font-medium underline underline-offset-2">Abrir Minhas ferramentas</Link></>}
          </p>
        )}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label className="text-[0.6875rem] font-medium text-black/55" htmlFor="email-para">Para</label>
            <div className="flex items-center gap-3">
              {!mostrarCc && <button type="button" onClick={() => setMostrarCc(true)} className="text-[0.6875rem] font-medium text-black/40 hover:text-black/60">Cc</button>}
              {!mostrarCco && <button type="button" onClick={() => setMostrarCco(true)} className="text-[0.6875rem] font-medium text-black/40 hover:text-black/60">Cco</button>}
            </div>
          </div>
          <input id="email-para" autoFocus={!inicio?.para?.length} className={CAMPO} value={para} onChange={event => setPara(event.target.value)} placeholder="nome@empresa.com.br" disabled={enviando} />
        </div>
        {mostrarCc && (
          <div>
            <label className={ROTULO} htmlFor="email-cc">Cc</label>
            <input id="email-cc" className={CAMPO} value={cc} onChange={event => setCc(event.target.value)} disabled={enviando} />
          </div>
        )}
        {mostrarCco && (
          <div>
            <label className={ROTULO} htmlFor="email-cco">Cco</label>
            <input id="email-cco" className={CAMPO} value={cco} onChange={event => setCco(event.target.value)} disabled={enviando} />
          </div>
        )}
        <div>
          <label className={ROTULO} htmlFor="email-assunto">Assunto</label>
          <input id="email-assunto" className={CAMPO} value={assunto} onChange={event => setAssunto(event.target.value)} disabled={enviando} />
        </div>
        <div>
          <label className={ROTULO} htmlFor="email-texto">Mensagem</label>
          <textarea id="email-texto" autoFocus={Boolean(inicio?.para?.length)} className={AREA} value={texto} onChange={event => setTexto(event.target.value)} disabled={enviando} />
        </div>
        <div>
          <span className={ROTULO}>Quando</span>
          <SegmentedControl<"agora" | "agendar"> ariaLabel="Quando enviar" value={modo} onChange={setModo} options={[{ value: "agora", label: "Enviar agora" }, { value: "agendar", label: "Agendar" }]} />
          {modo === "agendar" && (
            <input type="datetime-local" aria-label="Data e hora do envio" className={`${CAMPO} mt-3`} value={quando} min={proximaHoraLocal(2)} onChange={event => setQuando(event.target.value)} disabled={enviando} />
          )}
        </div>
      </div>
    </CornerSheet>
  );
}
