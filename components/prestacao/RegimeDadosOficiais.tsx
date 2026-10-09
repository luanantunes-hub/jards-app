"use client";

import { Dropdown } from "@/components/ui/Dropdown";
import type { RegimePublicado } from "@/hooks/useRegimesPublicados";
import { NIVEIS_ESPORTIVOS, regimePedeNivel, rotulosDoNivel } from "@/lib/prestacao/nivel-esportivo";
import { regimeUsaProcesso } from "@/lib/prestacao/devolucoes";
import { MODALIDADES_SAUDE } from "@/lib/prestacao/cmd";
import { regraDoRegime, type RegimeNormativo } from "@/lib/prestacao/regimes";
import type { ManifestacaoEsportiva, ModalidadeSaude, PrestacaoContas } from "@/lib/supabase/types";

type Campos = Partial<Pick<PrestacaoContas,
  "regime_id" | "identificador_oficial" | "identificador_tipo" | "fonte_recurso"
  | "data_aprovacao" | "data_liberacao" | "data_termo" | "data_conclusao_objeto" | "data_envio" | "data_fim_captacao"
  | "manifestacao_esportiva" | "crc_validade" | "numero_processo" | "modalidade_saude">>;

const MARCOS: { campo: keyof Campos; rotulo: string; soQuando?: (regime: RegimeNormativo | null) => boolean }[] = [
  { campo: "data_aprovacao", rotulo: "Aprovação" },
  // P9.1: na saúde, o prazo da readequação conta do fim da captação.
  { campo: "data_fim_captacao", rotulo: "Fim da captação", soQuando: regime => Object.values(regime?.prazos ?? {}).some(p => p && "marco" in p && p.marco === "fim_captacao") },
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
  // LIE (P8.4): o nível da manifestação esportiva muda os limites; na excelência, a CRC vale para toda a execução.
  const pedeNivel = regimePedeNivel(atual);
  const rotulos = rotulosDoNivel(atual);
  const pedeCrc = pedeNivel && prestacao.manifestacao_esportiva === "excelencia" && Boolean(regraDoRegime(atual, "crc_excelencia"));
  // LIE (P8.8): o processo no SEI é a referência da GRU e vai no cabeçalho dos formulários.
  const pedeProcesso = regimeUsaProcesso(atual);
  // Saúde (P9.5): só o projeto médico-assistencial registra produção no CMD.
  const pedeModalidade = Boolean(regraDoRegime(atual, "cmd"));
  const modalidade = MODALIDADES_SAUDE.find(m => m.valor === (prestacao.modalidade_saude ?? "assistencial"));

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
              // Outra versão do mesmo regime não aparece aqui: a troca passa
              // pelo aviso de versão nova, por quem decide (P6.4).
              options={regimes
                .filter(r => r.id === prestacao.regime_id || (r.publicado && r.regime.codigo !== atual?.codigo))
                .map(r => ({ value: r.id, label: r.publicado ? r.regime.nome : `${r.regime.nome} (versão ${r.regime.versao}, substituída)` }))}
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

        {pedeProcesso && (
          <label className="block">
            <span className={ROTULO}>Nº do processo (SEI)</span>
            <input
              key={`processo-${prestacao.numero_processo ?? ""}`}
              defaultValue={prestacao.numero_processo ?? ""}
              disabled={!podeEditar}
              maxLength={60}
              placeholder="Ex.: 71000.012345/2026-11"
              onBlur={e => {
                const valor = e.target.value.trim() || null;
                if (valor !== (prestacao.numero_processo ?? null)) onSalvar({ numero_processo: valor });
              }}
              className={CAMPO}
            />
            <span className="mt-1 block text-[0.5625rem] leading-4 text-black/35">Vai na referência da GRU e no cabeçalho do formulário PCP/PCF e da grade de RH.</span>
          </label>
        )}

        {pedeModalidade && (
          <div>
            <span className={ROTULO}>Modalidade do projeto</span>
            {podeEditar ? (
              <Dropdown
                value={prestacao.modalidade_saude ?? "assistencial"}
                onChange={v => {
                  const valor = (v || null) as ModalidadeSaude | null;
                  if (valor !== (prestacao.modalidade_saude ?? "assistencial")) onSalvar({ modalidade_saude: valor });
                }}
                ariaLabel="Modalidade do projeto"
                options={MODALIDADES_SAUDE.map(m => ({ value: m.valor, label: m.rotulo }))}
              />
            ) : (
              <p className="text-[0.75rem] text-black/70">{modalidade?.rotulo ?? "—"}</p>
            )}
            {modalidade && <span className="mt-1 block text-[0.5625rem] leading-4 text-black/35">{modalidade.descricao}</span>}
          </div>
        )}

        {pedeNivel && (
          <div className="grid grid-cols-2 gap-2">
            <div className={pedeCrc ? "col-span-2 sm:col-span-1" : "col-span-2"}>
              <span className={ROTULO}>Nível da manifestação esportiva</span>
              {podeEditar ? (
                <Dropdown
                  value={prestacao.manifestacao_esportiva ?? ""}
                  onChange={v => {
                    const valor = (v || null) as ManifestacaoEsportiva | null;
                    if (valor !== (prestacao.manifestacao_esportiva ?? null)) onSalvar({ manifestacao_esportiva: valor });
                  }}
                  ariaLabel="Nível da manifestação esportiva"
                  placeholder="Escolher nível"
                  options={NIVEIS_ESPORTIVOS.map(n => ({ value: n, label: rotulos[n].replace(/^./, c => c.toUpperCase()) }))}
                />
              ) : (
                <p className="text-[0.75rem] text-black/70">{prestacao.manifestacao_esportiva ? rotulos[prestacao.manifestacao_esportiva] : "—"}</p>
              )}
            </div>
            {pedeCrc && (
              <label className="col-span-2 block sm:col-span-1">
                <span className={ROTULO}>Validade da CRC</span>
                <input
                  type="date"
                  key={`crc-${prestacao.crc_validade ?? ""}`}
                  defaultValue={prestacao.crc_validade ?? ""}
                  disabled={!podeEditar}
                  onBlur={e => {
                    const valor = e.target.value || null;
                    if (valor !== (prestacao.crc_validade ?? null)) onSalvar({ crc_validade: valor });
                  }}
                  className={CAMPO}
                />
              </label>
            )}
            <p className="col-span-2 text-[0.5625rem] leading-4 text-black/35">
              Define o limite de elaboração e captação (10%, 7% ou 5% de fim + meio; 15% no N, NE e CO), o de captação e quem recebe bolsa.
            </p>
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-[0.5625rem] font-semibold uppercase tracking-wide text-black/30">Marcos</span>
          <div className="grid grid-cols-2 gap-2">
            {MARCOS.filter(m => !m.soQuando || m.soQuando(atual) || prestacao[m.campo]).map(({ campo, rotulo }) => (
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
