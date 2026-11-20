"use client";

import { useState } from "react";
import { COMBUSTIVEIS_DO_VEICULO } from "@/lib/producao/estados";
import { ROTULO_DO_COMBUSTIVEL } from "@/lib/producao/veiculos";
import { lerRegistroDaViagem, textoDaViagem, type RegistroDaViagem } from "@/lib/producao/viagem-motorista";
import type { DeslocamentoDaFolha } from "@/lib/producao/folha";

const CAMPO = "h-11 w-full rounded border border-black/[.14] bg-white px-3 text-[0.875rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/50 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.75rem] font-medium text-black/60";

/**
 * O registro da viagem pelo motorista (PD6.4): o odômetro na saída e na chegada e, se abasteceu, os litros, o combustível e o posto.
 * Quem fala com o banco é a página (`onEnviar`); aqui só se confere o que foi digitado.
 */
export function RegistroDaViagemDoMotorista({ deslocamento, onEnviar }: {
  deslocamento: DeslocamentoDaFolha;
  onEnviar: (args: RegistroDaViagem) => Promise<string>;
}) {
  const abastecimentos = deslocamento.abastecimentos ?? [];
  const [aberto, setAberto] = useState(false);
  const [odometroSaida, setOdometroSaida] = useState(deslocamento.odometro_saida_km?.toString() ?? "");
  const [odometroChegada, setOdometroChegada] = useState(deslocamento.odometro_chegada_km?.toString() ?? "");
  const [litros, setLitros] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [posto, setPosto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar() {
    const leitura = lerRegistroDaViagem({ odometroSaida, odometroChegada, litros, combustivel, posto }, { saida: deslocamento.odometro_saida_km ?? null, chegada: deslocamento.odometro_chegada_km ?? null });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setEnviando(true);
    setErro(null);
    setAviso(null);
    const resultado = await onEnviar(leitura.args);
    setEnviando(false);
    if (resultado !== "ok") { setErro(resultado); return; }
    setLitros(""); setCombustivel(""); setPosto("");
    setAviso("Registrado.");
    setAberto(false);
  }

  const totalLitros = abastecimentos.reduce((soma, item) => soma + Number(item.litros), 0);
  const resumo = textoDaViagem({ odometro_saida_km: deslocamento.odometro_saida_km ?? null, odometro_chegada_km: deslocamento.odometro_chegada_km ?? null, litros: totalLitros });

  return (
    <div className="mt-1.5">
      {resumo && <p className="text-black/60">{resumo}</p>}
      {aviso && <p role="status" className="text-[#2E8932]">{aviso}</p>}
      {!aberto ? (
        <button type="button" onClick={() => { setAberto(true); setAviso(null); }} className="mt-1 h-10 rounded border border-black/[.16] bg-white px-3.5 text-[0.75rem] font-medium text-[#282525] transition hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
          Registrar odômetro e abastecimento
        </button>
      ) : (
        <form onSubmit={event => { event.preventDefault(); void enviar(); }} className="mt-2 space-y-3 rounded border bg-white p-3" style={{ borderColor: "rgba(13,13,13,.12)" }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={ROTULO} htmlFor={`odo-saida-${deslocamento.id}`}>Odômetro na saída (km)</label>
              <input id={`odo-saida-${deslocamento.id}`} inputMode="numeric" className={CAMPO} value={odometroSaida} onChange={event => setOdometroSaida(event.target.value)} disabled={enviando} />
            </div>
            <div>
              <label className={ROTULO} htmlFor={`odo-chegada-${deslocamento.id}`}>Odômetro na chegada (km)</label>
              <input id={`odo-chegada-${deslocamento.id}`} inputMode="numeric" className={CAMPO} value={odometroChegada} onChange={event => setOdometroChegada(event.target.value)} disabled={enviando} />
            </div>
          </div>
          <p className="text-[0.6875rem] text-black/45">Abasteceu? Preencha os litros (deixe em branco se não).</p>
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <div>
              <label className={ROTULO} htmlFor={`litros-${deslocamento.id}`}>Litros</label>
              <input id={`litros-${deslocamento.id}`} inputMode="decimal" className={CAMPO} value={litros} onChange={event => setLitros(event.target.value)} placeholder="45,3" disabled={enviando} />
            </div>
            <div>
              <label className={ROTULO} htmlFor={`combustivel-${deslocamento.id}`}>Combustível</label>
              <select id={`combustivel-${deslocamento.id}`} className={CAMPO} value={combustivel} onChange={event => setCombustivel(event.target.value)} disabled={enviando}>
                <option value="">Escolha</option>
                {COMBUSTIVEIS_DO_VEICULO.map(valor => <option key={valor} value={valor}>{ROTULO_DO_COMBUSTIVEL[valor]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={ROTULO} htmlFor={`posto-${deslocamento.id}`}>Posto (opcional)</label>
            <input id={`posto-${deslocamento.id}`} className={CAMPO} value={posto} onChange={event => setPosto(event.target.value)} maxLength={200} disabled={enviando} />
          </div>
          {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.8125rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={enviando} className="h-11 flex-1 rounded bg-[#2E8932] text-[0.875rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.99] disabled:opacity-50">{enviando ? "Enviando…" : "Enviar"}</button>
            <button type="button" onClick={() => { setAberto(false); setErro(null); }} disabled={enviando} className="h-11 rounded px-4 text-[0.8125rem] font-medium text-black/55 transition hover:bg-black/[.05]">Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
