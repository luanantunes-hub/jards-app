"use client";

import { useMemo, useState } from "react";
import { Download, History, Lock, Unlock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ModalPrestacao } from "@/components/prestacao/ModalPrestacao";
import { erroDaReabertura, resumoDoRetrato, textoDaGuarda, textoDaSituacao, tituloDoEnvio, type EnvioDaLista } from "@/lib/prestacao/envios";
import { slug } from "@/lib/prestacao/pacote";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const BOTAO = "inline-flex h-9 items-center gap-1.5 rounded border bg-white px-3 text-[0.6875rem] text-black/70 transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] disabled:cursor-not-allowed disabled:text-black/35 active:scale-[.98]";
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const hojeIso = () => new Date().toLocaleDateString("sv-SE");

function Etiqueta({ vigente }: { vigente: boolean }) {
  const cor = vigente ? "#2E8932" : "#6B6B6B";
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded border bg-white px-2 py-1 text-[0.625rem] font-medium" style={{ borderColor: cor + "47", color: cor }}>
      {vigente ? <Lock size={10} aria-hidden /> : <Unlock size={10} aria-hidden />}
      {vigente ? "Vale" : "Reaberto"}
    </span>
  );
}

function ReabrirModal({ envio, onClose, onReaberto }: { envio: EnvioDaLista; onClose: () => void; onReaberto: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function reabrir() {
    const problema = erroDaReabertura(motivo);
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função ainda não está no tipo Database
    const { error } = await (supabase as any).rpc("fn_prestacao_reabrir_envio", { p_envio_id: envio.id, p_motivo: motivo.trim() });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível reabrir o envio")); return; }
    onReaberto();
  }

  return (
    <ModalPrestacao
      titulo="Reabrir envio"
      subtitulo={`${tituloDoEnvio(envio)} · enviado em ${dataBr(envio.enviado_em)}`}
      onClose={onClose}
      largura="max-w-[32rem]"
      rodape={<>
        <span />
        <div className="flex items-center gap-4">
          <button type="button" onClick={onClose} className="rounded px-2 py-2 text-[0.8125rem] text-black/45 transition hover:text-black/70 focus-visible:outline-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button
            type="button"
            onClick={reabrir}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded bg-[#2E8932] px-5 py-2 text-[0.8125rem] font-semibold text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
            Reabrir envio
          </button>
        </div>
      </>}
    >
      <div className="space-y-3 px-6 py-5 text-[0.75rem]">
        <p className="text-black/60">
          {envio.etapa === "final" ? "A prestação volta para ajuste e o que foi enviado pode ser corrigido. " : "O que foi enviado pode ser corrigido. "}
          O retrato deste envio fica no histórico, o que foi enviado continua guardado (não pode ser apagado) e a correção é registrada como uma versão nova.
        </p>
        <label className="block">
          <span className="mb-1 block text-[0.625rem] font-medium text-black/45">Motivo</span>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            rows={4}
            maxLength={2000}
            autoFocus
            placeholder="Ex.: a diligência pediu a nota fiscal corrigida da despesa 12."
            className="w-full rounded border border-black/[.12] bg-white px-3 py-2 text-[0.75rem] text-[#282525] outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10"
          />
        </label>
        {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B]">{erro}</p>}
      </div>
    </ModalPrestacao>
  );
}

/**
 * Os envios registrados da prestação: a versão, a data, o protocolo, a
 * situação e a guarda de cada um; baixar o retrato e reabrir com o motivo.
 */
export function EnviosRegistrados({ envios, podeReabrir, identificador, onMudou }: {
  envios: readonly EnvioDaLista[];
  podeReabrir: boolean;
  identificador: string;
  onMudou: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [reabrindo, setReabrindo] = useState<EnvioDaLista | null>(null);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [resumos, setResumos] = useState<Record<string, string[]>>({});
  const [erro, setErro] = useState("");
  const hoje = hojeIso();

  async function baixarRetrato(e: EnvioDaLista) {
    setBaixando(e.id);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prestacao_envios ainda não está no tipo Database
    const { data, error } = await (supabase as any).from("prestacao_envios").select("*").eq("id", e.id).maybeSingle();
    setBaixando(null);
    if (error || !data) { setErro(mensagemErroPrestacao(error, "Não foi possível baixar o retrato")); return; }
    setResumos(r => ({ ...r, [e.id]: resumoDoRetrato(data.retrato) }));
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `retrato-${slug(identificador, 40) || "prestacao"}-${e.etapa}-v${e.versao}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  if (envios.length === 0) return null;
  return (
    <section className="overflow-hidden rounded border bg-white" style={BORDA} aria-labelledby="envios-registrados">
      <div className="flex items-baseline justify-between gap-3 border-b px-5 py-3" style={{ borderColor: "rgba(13,13,13,.07)" }}>
        <h3 id="envios-registrados" className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[#282525]"><History size={13} aria-hidden /> Envios registrados</h3>
        <span className="text-[0.6875rem] tabular-nums text-black/40">{envios.length}</span>
      </div>
      {erro && <p role="alert" className="px-5 pt-3 text-[0.6875rem] text-[#B23B3B]">{erro}</p>}
      <ul className="divide-y divide-black/[.05]" aria-label="Envios registrados">
        {envios.map(e => (
          <li key={e.id} className="space-y-2 px-5 py-4 text-[0.75rem]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-black/85">{tituloDoEnvio(e)}</p>
                <p className="text-[0.6875rem] text-black/55">
                  {[`Enviado em ${dataBr(e.enviado_em)}`, e.sistema ? `no ${e.sistema}` : null, e.protocolo ? `protocolo ${e.protocolo}` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Etiqueta vigente={e.situacao === "vigente"} />
            </div>
            <p className="text-[0.6875rem] text-black/55">{textoDaSituacao(e).replace(/[.!?]$/, "")}. {textoDaGuarda(e, hoje)}.</p>
            {e.comentario && <p className="text-[0.6875rem] text-black/45">{e.comentario}</p>}
            {resumos[e.id]?.length ? <p className="text-[0.6875rem] text-black/45">Retrato: {resumos[e.id].join(", ")}.</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => baixarRetrato(e)} disabled={baixando === e.id} className={BOTAO} style={BORDA}>
                <Download size={12} aria-hidden /> Baixar retrato
              </button>
              {podeReabrir && e.situacao === "vigente" && (
                <button type="button" onClick={() => setReabrindo(e)} className={BOTAO} style={BORDA}>
                  <Unlock size={12} aria-hidden /> Reabrir
                </button>
              )}
              <span className="ml-auto font-mono text-[0.625rem] text-black/30" title={`SHA-256 do retrato: ${e.retrato_sha256}`}>SHA-256 {e.retrato_sha256.slice(0, 12)}…</span>
            </div>
          </li>
        ))}
      </ul>
      {reabrindo && <ReabrirModal envio={reabrindo} onClose={() => setReabrindo(null)} onReaberto={() => { setReabrindo(null); onMudou(); }} />}
    </section>
  );
}
