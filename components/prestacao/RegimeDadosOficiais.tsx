"use client";

import { Dropdown } from "@/components/ui/Dropdown";
import type { RegimeNormativo } from "@/lib/prestacao/regimes";
import type { PrestacaoContas } from "@/lib/supabase/types";

export type RegimePublicado = { id: string; regime: RegimeNormativo };

type Campos = Partial<Pick<PrestacaoContas,
  "regime_id" | "identificador_oficial" | "identificador_tipo" | "fonte_recurso"
  | "data_aprovacao" | "data_liberacao" | "data_termo" | "data_conclusao_objeto" | "data_envio">>;

const MARCOS: { campo: keyof Campos; rotulo: string }[] = [
  { campo: "data_aprovacao", rotulo: "Aprovação" },
  { campo: "data_liberacao", rotulo: "Liberação" },
  { campo: "data_termo", rotulo: "Termo ou contrato" },
  { campo: "data_conclusao_objeto", rotulo: "Conclusão do objeto" },
  { campo: "data_envio", rotulo: "Envio da prestação" },
];

const ROTULO = "mb-1 block text-[0.5625rem] text-black/40";
const CAMPO = "w-full rounded border border-black/[.12] px-2 py-1.5 text-[0.6875rem] outline-none focus:border-[#7259B5] disabled:bg-black/[.02] disabled:text-black/45";

/**
 * Regime normativo, identificador oficial, fonte do recurso e marcos da
 * prestação (P1.2). Cada campo grava ao sair dele; o prazo final é refeito
 * pelo banco.
 */
export function RegimeDadosOficiais({ prestacao, regimes, podeEditar, onSalvar }: {
  prestacao: PrestacaoContas;
  regimes: RegimePublicado[];
  podeEditar: boolean;
  onSalvar: (campos: Campos) => void;
}) {
  const atual = regimes.find(r => r.id === prestacao.regime_id)?.regime ?? null;
  const identificador = atual?.identificadorOficial;

  function trocarRegime(regimeId: string) {
    if (!regimeId || regimeId === prestacao.regime_id) return;
    const novo = regimes.find(r => r.id === regimeId)?.regime;
    onSalvar({ regime_id: regimeId, identificador_tipo: novo?.identificadorOficial?.tipo ?? null });
  }

  return (
    <div className="bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
      <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/35 mb-3">Regime e dados oficiais</p>

      <div className="space-y-3">
        <div>
          <span className={ROTULO}>Regime</span>
          {podeEditar ? (
            <Dropdown
              value={prestacao.regime_id ?? ""}
              onChange={trocarRegime}
              ariaLabel="Regime normativo"
              placeholder="Escolher regime"
              options={regimes.map(r => ({ value: r.id, label: r.regime.nome }))}
            />
          ) : (
            <p className="text-[0.75rem] text-black/70">{atual?.nome ?? "—"}</p>
          )}
          {atual && (
            <p className="mt-1 text-[0.5625rem] leading-4 text-black/35">
              {atual.normaReferencia}{atual.sistemaOficial ? ` · envio pelo ${atual.sistemaOficial}` : ""}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={ROTULO}>{identificador?.rotulo ?? "Identificador oficial"}</span>
            <input
              key={`id-${prestacao.identificador_oficial ?? ""}`}
              defaultValue={prestacao.identificador_oficial ?? ""}
              disabled={!podeEditar}
              onBlur={e => {
                const valor = e.target.value.trim() || null;
                if (valor !== (prestacao.identificador_oficial ?? null)) {
                  onSalvar({ identificador_oficial: valor, identificador_tipo: identificador?.tipo ?? prestacao.identificador_tipo ?? null });
                }
              }}
              className={CAMPO}
            />
          </label>
          <label className="block">
            <span className={ROTULO}>Fonte do recurso</span>
            <input
              key={`fonte-${prestacao.fonte_recurso ?? ""}`}
              defaultValue={prestacao.fonte_recurso ?? ""}
              disabled={!podeEditar}
              placeholder="Ex.: incentivo fiscal"
              onBlur={e => {
                const valor = e.target.value.trim() || null;
                if (valor !== (prestacao.fonte_recurso ?? null)) onSalvar({ fonte_recurso: valor });
              }}
              className={CAMPO}
            />
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-[0.5625rem] font-semibold uppercase tracking-wide text-black/30">Marcos</span>
          <div className="grid grid-cols-2 gap-2">
            {MARCOS.map(({ campo, rotulo }) => (
              <label key={campo} className="block">
                <span className={ROTULO}>{rotulo}</span>
                <input
                  type="date"
                  key={`${campo}-${prestacao[campo] ?? ""}`}
                  defaultValue={(prestacao[campo] as string | null | undefined) ?? ""}
                  disabled={!podeEditar}
                  onBlur={e => {
                    const valor = e.target.value || null;
                    if (valor !== ((prestacao[campo] as string | null | undefined) ?? null)) onSalvar({ [campo]: valor });
                  }}
                  className={CAMPO}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
