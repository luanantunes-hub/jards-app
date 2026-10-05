"use client";

import { useState } from "react";
import { hojeEmBrasilia } from "@/lib/modulos-contrato";
import { descreverRegra, prazoFinalCalculado, ROTULO_DO_MARCO } from "@/lib/prestacao/prazo-final";
import { situacaoDoPrazo } from "@/lib/prestacao/prazos";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import type { PrestacaoContas } from "@/lib/supabase/types";

const dataBr = (data: string | null | undefined) => (data ? data.split("-").reverse().join("/") : "—");

type CamposPrazo = Partial<Pick<PrestacaoContas, "prazo_final_override" | "prazo_final_justificativa">>;

/**
 * Prazo de envio e de onde ele vem (P1.2): calculado pelo regime a partir do
 * marco, ou informado à mão com justificativa. O banco recalcula e guarda o
 * prazo vigente em "prazo".
 */
export function PrazoPrestacao({ prestacao, regime, podeEditar, onSalvar }: {
  prestacao: PrestacaoContas;
  regime: RegimeNormativo | null;
  podeEditar: boolean;
  onSalvar: (campos: CamposPrazo) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [data, setData] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [salvando, setSalvando] = useState(false);

  const calculado = prestacao.prazo_final ?? null;
  const informado = prestacao.prazo_final_override ?? null;
  const regra = regime?.prazos.prestacaoFinal ?? null;
  const explicacao = prazoFinalCalculado(regime, prestacao);
  const situacao = prestacao.prazo ? situacaoDoPrazo(hojeEmBrasilia(), prestacao.prazo) : null;
  const encerrada = prestacao.status === "aprovado" || prestacao.status === "arquivado";
  const vencido = situacao?.situacao === "vencido" && !encerrada;
  const precisaJustificar = calculado !== null && data !== "" && data !== calculado;

  function abrirEditor() {
    setData(informado ?? calculado ?? "");
    setJustificativa(prestacao.prazo_final_justificativa ?? "");
    setEditando(true);
  }

  async function salvar(campos: CamposPrazo) {
    setSalvando(true);
    const ok = await onSalvar(campos);
    setSalvando(false);
    if (ok) setEditando(false);
  }

  return (
    <div>
      <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/35 mb-2">Prazo de envio</p>
      <p className="text-[0.9375rem] font-bold tabular-nums" style={{ color: vencido ? "#D94E4E" : "rgba(13,13,13,.75)" }}>
        {dataBr(prestacao.prazo)}
      </p>
      {situacao && !encerrada && situacao.diasRestantes >= 0 && (
        <p className="text-[0.625rem] mt-1" style={{ color: situacao.diasRestantes <= 15 ? "#B07A14" : "rgba(13,13,13,.35)" }}>
          {situacao.diasRestantes > 0 ? `${situacao.diasRestantes} dias restantes` : "Vence hoje"}
        </p>
      )}

      <div className="mt-2 space-y-1 text-[0.625rem] leading-4 text-black/45">
        {informado ? (
          <>
            <p>Informado à mão{prestacao.prazo_final_justificativa ? `: “${prestacao.prazo_final_justificativa}”` : "."}</p>
            {calculado && calculado !== informado && (
              <p style={{ color: prestacao.prazo_final_justificativa ? undefined : "#B07A14" }}>
                Pelo regime, seria {dataBr(calculado)}{prestacao.prazo_final_justificativa ? "." : ", e falta a justificativa."}
              </p>
            )}
          </>
        ) : calculado && regra ? (
          <>
            <p>Calculado: {descreverRegra(regra)} ({regra.fonte.documento}, {regra.fonte.dispositivo}).</p>
            {explicacao?.data === calculado && explicacao.prorrogadoPor && (
              <p>Cairia em {dataBr(explicacao.dataOriginal)} ({explicacao.prorrogadoPor.toLowerCase()}); passa para o próximo dia útil.</p>
            )}
          </>
        ) : regra ? (
          <p>Informe o {ROTULO_DO_MARCO[regra.marco] ?? regra.marco} para calcular o prazo ({descreverRegra(regra)}).</p>
        ) : (
          <p>Este regime não define prazo de envio. Informe o do contrato ou do edital.</p>
        )}
      </div>

      {podeEditar && !editando && (
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="button" onClick={abrirEditor} className="text-[0.625rem] font-medium text-[#684DB0] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
            {informado ? "Alterar prazo informado" : "Informar outro prazo"}
          </button>
          {informado && (
            <button
              type="button"
              disabled={salvando}
              onClick={() => void salvar({ prazo_final_override: null, prazo_final_justificativa: null })}
              className="text-[0.625rem] text-black/45 hover:text-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
            >
              {calculado ? "Usar o prazo calculado" : "Remover prazo informado"}
            </button>
          )}
        </div>
      )}

      {editando && (
        <div className="mt-3 space-y-2 rounded border border-black/[.08] bg-black/[.015] p-3">
          <label className="block">
            <span className="mb-1 block text-[0.5625rem] text-black/40">Prazo</span>
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className="w-full rounded border border-black/[.12] bg-white px-2 py-1.5 text-[0.6875rem] outline-none focus:border-[#7259B5]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[0.5625rem] text-black/40">
              Justificativa{precisaJustificar ? " (obrigatória: o prazo é diferente do calculado)" : ""}
            </span>
            <textarea
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              rows={2}
              placeholder="Ex.: prorrogação deferida pelo órgão em 10/09"
              className="w-full resize-none rounded border border-black/[.12] bg-white px-2 py-1.5 text-[0.6875rem] outline-none focus:border-[#7259B5]"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(false)} className="px-2 py-1.5 text-[0.6875rem] text-black/45 hover:text-black/70">
              Cancelar
            </button>
            <button
              type="button"
              disabled={salvando || !data || (precisaJustificar && justificativa.trim().length < 3)}
              onClick={() => void salvar({ prazo_final_override: data, prazo_final_justificativa: justificativa.trim() || null })}
              className="rounded bg-[#2E8932] px-3 py-1.5 text-[0.6875rem] text-white transition hover:bg-[#26752A] disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar prazo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
