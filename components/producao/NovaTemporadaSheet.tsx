"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { SegmentedControl } from "@/components/ui/FilterControls";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import type { LadoDaTemporada } from "@/lib/producao/estados";
import { ROTULO_DO_FORMATO, TIPOS_DE_PRODUCAO, rotuloNovo, tipoDeProducao, vocabularioDe, type FormatoTemporada, type TipoProducao } from "@/lib/producao/vocabulario";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

/** Cadastro de uma temporada: o essencial numa lista direta (tipo, formato, lado e nome). */
export function NovaTemporadaSheet({ organizationId, tipoInicial = "show", onClose, onCreated }: {
  organizationId: string;
  tipoInicial?: TipoProducao;
  onClose: () => void;
  onCreated: (temporadaId: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoProducao>(tipoInicial);
  const [formato, setFormato] = useState<FormatoTemporada>(tipoDeProducao(tipoInicial).formatos[0]);
  const [lado, setLado] = useState<LadoDaTemporada>("circula");
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const nomeDaTemporada = vocabularioDe(tipo, formato).temporada;

  function trocarTipo(novo: TipoProducao) {
    setTipo(novo);
    // O formato volta ao padrão do tipo novo, se o atual não existe nele.
    const formatos = tipoDeProducao(novo).formatos;
    if (!formatos.includes(formato)) setFormato(formatos[0]);
  }

  async function salvar(fechar: () => void) {
    if (!titulo.trim()) { setErro("Dê um nome."); return; }
    setSalvando(true);
    setErro(null);
    const { data, error } = await clienteDaProducao(createClient())
      .from("producao_temporadas")
      .insert({ organization_id: organizationId, tipo, formato, lado, titulo: titulo.trim() })
      .select("id")
      .single();
    setSalvando(false);
    if (error || !data) { setErro("Não foi possível criar. Tente de novo."); return; }
    onCreated(data.id);
    fechar();
  }

  return (
    <TopSheet
      titulo={rotuloNovo(nomeDaTemporada)}
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">
            {salvando ? "Criando…" : `Criar ${nomeDaTemporada.singular.toLocaleLowerCase("pt-BR")}`}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <label className={ROTULO} htmlFor="temporada-nome">Nome</label>
          <input id="temporada-nome" autoFocus className={CAMPO} value={titulo} onChange={event => setTitulo(event.target.value)} placeholder="Ex.: Turnê Sul 2027" maxLength={200} disabled={salvando} />
        </div>
        <div>
          <span className={ROTULO}>O que vocês produzem</span>
          <Dropdown ariaLabel="Tipo de produção" value={tipo} onChange={valor => trocarTipo(valor as TipoProducao)} disabled={salvando} options={TIPOS_DE_PRODUCAO.map(item => ({ value: item.id, label: item.rotulo }))} />
        </div>
        <div>
          <span className={ROTULO}>Como acontece</span>
          <Dropdown ariaLabel="Formato" value={formato} onChange={valor => setFormato(valor as FormatoTemporada)} disabled={salvando} options={tipoDeProducao(tipo).formatos.map(item => ({ value: item, label: ROTULO_DO_FORMATO[item] }))} />
        </div>
        <div>
          <span className={ROTULO}>Vocês</span>
          <SegmentedControl
            value={lado}
            onChange={setLado}
            ariaLabel="Lado da produção"
            options={[{ value: "circula", label: "Viajam com a produção" }, { value: "recebe", label: "Recebem em um espaço" }] as const}
          />
        </div>
      </div>
    </TopSheet>
  );
}
