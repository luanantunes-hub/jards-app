"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { erroDoRegistro, tituloDoEnvio, type EnvioDaLista } from "@/lib/prestacao/envios";
import type { EtapaEnvio } from "@/lib/prestacao/envio";
import type { Manifesto } from "@/lib/prestacao/pacote";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";

const BORDA = { borderColor: "rgba(13,13,13,.08)" };
const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.75rem] text-black outline-none transition placeholder:text-black/25 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10";
const ROTULO = "mb-1 block text-[0.625rem] font-medium text-black/45";
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const hojeIso = () => new Date().toLocaleDateString("sv-SE");

/**
 * Depois de gerar o pacote: registrar o envio ao sistema oficial, com a data,
 * o protocolo e o manifesto do pacote. O banco grava o retrato e trava o que
 * foi enviado.
 */
export function RegistrarEnvio({ prestacaoId, etapa, sistema, manifesto, podeRegistrar, vigente, onRegistrado }: {
  prestacaoId: string;
  etapa: EtapaEnvio;
  sistema: string | null;
  /** O manifesto do pacote gerado agora; sem ele, só o aviso do envio que vale. */
  manifesto: Manifesto | null;
  podeRegistrar: boolean;
  vigente: EnvioDaLista | null;
  onRegistrado: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [enviadoEm, setEnviadoEm] = useState(hojeIso());
  const [protocolo, setProtocolo] = useState("");
  const [comentario, setComentario] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [registrado, setRegistrado] = useState(false);

  async function registrar() {
    const problema = erroDoRegistro({ enviadoEm, protocolo, comentario }, hojeIso());
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função ainda não está no tipo Database
    const { error } = await (supabase as any).rpc("fn_prestacao_registrar_envio", {
      p_prestacao_id: prestacaoId,
      p_etapa: etapa,
      p_enviado_em: enviadoEm,
      p_protocolo: protocolo.trim() || null,
      p_manifesto: manifesto,
      p_comentario: comentario.trim() || null,
    });
    setSalvando(false);
    if (error) { setErro(mensagemErroPrestacao(error, "Não foi possível registrar o envio")); return; }
    setRegistrado(true);
    onRegistrado();
  }

  const destino = sistema ? `ao ${sistema}` : "ao sistema oficial";

  if (!registrado && !vigente && !manifesto) return null;
  if (registrado || vigente || !manifesto) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border bg-white px-5 py-3 text-[0.75rem]" style={{ borderColor: "#2E893247" }}>
        <p className="flex items-start gap-1.5 text-[#2E8932]">
          <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            {vigente ? `${tituloDoEnvio(vigente)} registrada como enviada em ${dataBr(vigente.enviado_em)}` : "Envio registrado"}: o que foi enviado está guardado e não muda enquanto o envio vale.
          </span>
        </p>
        <Link href={`/prestacoes/${prestacaoId}/envio#envios-registrados`} className="inline-flex items-center gap-1 rounded text-[0.6875rem] text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-[#7259B5]">
          Ver os envios <ArrowRight size={11} aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded border bg-white px-5 py-4" style={BORDA} aria-labelledby="registrar-envio">
      <div>
        <h3 id="registrar-envio" className="text-[0.75rem] font-semibold text-black">Registrar o envio</h3>
        <p className="max-w-[46rem] text-[0.6875rem] text-black/50">
          Depois de enviar {destino}, registre aqui. O Jards guarda um retrato do que foi enviado, com o manifesto deste pacote, e trava o que foi enviado: nada muda enquanto o envio vale, e nada sai pelo prazo de guarda do regime.
        </p>
      </div>
      {podeRegistrar ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr_1fr]">
            <label>
              <span className={ROTULO}>Data do envio</span>
              <input type="date" value={enviadoEm} max={hojeIso()} onChange={e => setEnviadoEm(e.target.value)} className={`${CAMPO} tabular-nums`} />
            </label>
            <label>
              <span className={ROTULO}>Protocolo ou número do envio</span>
              <input value={protocolo} onChange={e => setProtocolo(e.target.value)} maxLength={120} placeholder="Opcional" className={CAMPO} />
            </label>
            <label>
              <span className={ROTULO}>Comentário</span>
              <input value={comentario} onChange={e => setComentario(e.target.value)} maxLength={2000} placeholder="Opcional" className={CAMPO} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={registrar}
              disabled={salvando}
              className="flex h-9 items-center gap-1.5 rounded bg-[#2E8932] px-4 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {salvando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />}
              <Lock size={12} aria-hidden /> Registrar envio
            </button>
            {erro && <p role="alert" className="text-[0.6875rem] text-[#B23B3B]">{erro}</p>}
          </div>
        </>
      ) : (
        <p className="text-[0.6875rem] text-black/45">Registrar o envio cabe ao administrador ou ao responsável da prestação.</p>
      )}
    </section>
  );
}
