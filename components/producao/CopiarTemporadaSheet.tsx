"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { copiarDatas, type DataParaCopiar } from "@/lib/producao/agenda";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

export type TemporadaParaCopiar = { id: string; titulo: string; tipo: string; formato: string; lado: "circula" | "recebe"; obra_id: string | null; projeto_id: string | null };

/**
 * Copia a temporada: as datas andam juntas para o começo novo e nascem como opção, sem
 * prazo. Pessoas, blocos e documentos não vão (cada temporada monta os seus).
 */
export function CopiarTemporadaSheet({ organizationId, temporada, datas, onClose, onCreated }: {
  organizationId: string;
  temporada: TemporadaParaCopiar;
  datas: readonly DataParaCopiar[];
  onClose: () => void;
  onCreated: (temporadaId: string) => void;
}) {
  const [titulo, setTitulo] = useState(`${temporada.titulo} (cópia)`);
  const [inicio, setInicio] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    if (!titulo.trim()) { setErro("Dê um nome."); return; }
    if (datas.length > 0 && !inicio) { setErro("Informe quando a nova começa."); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { data: nova, error } = await producao
      .from("producao_temporadas")
      .insert({ organization_id: organizationId, tipo: temporada.tipo, formato: temporada.formato, lado: temporada.lado, titulo: titulo.trim(), obra_id: temporada.obra_id, projeto_id: temporada.projeto_id })
      .select("id")
      .single();
    if (error || !nova) { setSalvando(false); setErro("Não foi possível copiar. Tente de novo."); return; }
    const linhas = copiarDatas(datas, inicio).map(item => ({ organization_id: organizationId, temporada_id: nova.id, obra_id: temporada.obra_id, ...item }));
    if (linhas.length > 0) {
      const { error: erroDatas } = await producao.from("producao_datas").insert(linhas);
      if (erroDatas) {
        // A temporada nova já existe, sem as datas: abre assim mesmo e avisa.
        setSalvando(false);
        setErro("A temporada foi criada, mas as datas não. Abra a nova e crie as datas.");
        onCreated(nova.id);
        return;
      }
    }
    setSalvando(false);
    onCreated(nova.id);
    fechar();
  }

  return (
    <TopSheet
      titulo="Copiar temporada"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">
            {salvando ? "Copiando…" : "Criar cópia"}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <label className={ROTULO} htmlFor="copia-nome">Nome</label>
          <input id="copia-nome" autoFocus className={CAMPO} value={titulo} onChange={event => setTitulo(event.target.value)} maxLength={200} disabled={salvando} />
        </div>
        {datas.length > 0 && (
          <div>
            <label className={ROTULO} htmlFor="copia-inicio">A primeira data cai em</label>
            <input id="copia-inicio" type="date" className={CAMPO} value={inicio} onChange={event => setInicio(event.target.value)} disabled={salvando} />
          </div>
        )}
        <p className="text-[0.6875rem] text-black/45">{datas.length === 1 ? "1 data vai junto" : `${datas.length} datas vão juntas`}, como opção.</p>
      </div>
    </TopSheet>
  );
}
