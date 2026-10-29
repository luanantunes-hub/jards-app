"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { SegmentedControl } from "@/components/ui/FilterControls";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { diasDoLote, ROTULO_DO_TIPO_DE_DATA } from "@/lib/producao/agenda";
import { TIPOS_DE_DATA } from "@/lib/producao/estados";
import type { TipoData } from "@/lib/producao/vocabulario";

export type TemporadaParaData = { id: string; titulo: string };

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

/** Cadastro de datas: uma, ou várias de uma vez, um dia por linha, entre o primeiro e o último dia. */
export function NovaDataSheet({ organizationId, temporadas, temporadaInicial, onClose, onCreated }: {
  organizationId: string;
  temporadas: readonly TemporadaParaData[];
  temporadaInicial?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [temporadaId, setTemporadaId] = useState(temporadaInicial ?? temporadas[0]?.id ?? "");
  const [tipo, setTipo] = useState<TipoData>("apresentacao");
  const [situacao, setSituacao] = useState<"confirmada" | "opcao">("confirmada");
  const [dia, setDia] = useState("");
  const [varios, setVarios] = useState(false);
  const [ultimoDia, setUltimoDia] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    if (!temporadaId) { setErro("Escolha a temporada."); return; }
    const lote = varios ? diasDoLote(dia, ultimoDia) : dia ? { ok: true as const, dias: [dia] } : { ok: false as const, erro: "Informe o dia." };
    if (!lote.ok) { setErro(lote.erro); return; }
    setSalvando(true);
    setErro(null);
    // A opção entra na fila (ordem 1) sem prazo: o prazo e a ordem se ajustam na página da data.
    const linhas = lote.dias.map(data => ({
      organization_id: organizationId,
      temporada_id: temporadaId,
      tipo,
      data,
      situacao,
      ...(situacao === "opcao" ? { opcao_ordem: 1 } : {}),
    }));
    const { error } = await clienteDaProducao(createClient()).from("producao_datas").insert(linhas);
    setSalvando(false);
    if (error) { setErro("Não foi possível criar. Tente de novo."); return; }
    onCreated();
    fechar();
  }

  return (
    <TopSheet
      titulo="Nova data"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">
            {salvando ? "Criando…" : varios ? "Criar datas" : "Criar data"}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <span className={ROTULO}>Temporada</span>
          <Dropdown ariaLabel="Temporada" value={temporadaId} onChange={setTemporadaId} disabled={salvando} options={temporadas.map(item => ({ value: item.id, label: item.titulo }))} />
        </div>
        <div>
          <span className={ROTULO}>Tipo do dia</span>
          <Dropdown ariaLabel="Tipo do dia" value={tipo} onChange={valor => setTipo(valor as TipoData)} disabled={salvando} options={TIPOS_DE_DATA.map(item => ({ value: item, label: ROTULO_DO_TIPO_DE_DATA[item] }))} />
        </div>
        <div className={varios ? "grid grid-cols-2 gap-3" : ""}>
          <div>
            <label className={ROTULO} htmlFor="data-dia">{varios ? "Primeiro dia" : "Dia"}</label>
            <input id="data-dia" type="date" autoFocus className={CAMPO} value={dia} onChange={event => setDia(event.target.value)} disabled={salvando} />
          </div>
          {varios && (
            <div>
              <label className={ROTULO} htmlFor="data-ultimo">Último dia</label>
              <input id="data-ultimo" type="date" className={CAMPO} value={ultimoDia} min={dia || undefined} onChange={event => setUltimoDia(event.target.value)} disabled={salvando} />
            </div>
          )}
        </div>
        <button type="button" onClick={() => setVarios(atual => !atual)} aria-pressed={varios} className="text-[0.75rem] font-medium text-black/55 underline-offset-2 hover:text-black/75 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">
          {varios ? "Só um dia" : "Vários dias seguidos"}
        </button>
        <div>
          <span className={ROTULO}>Situação</span>
          <SegmentedControl value={situacao} onChange={setSituacao} ariaLabel="Situação da data" options={[{ value: "confirmada", label: "Confirmada" }, { value: "opcao", label: "Opção" }] as const} />
        </div>
      </div>
    </TopSheet>
  );
}
