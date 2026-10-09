"use client";

import { useId, useState } from "react";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CanalContato, ResultadoInteracao, TipoAtividade } from "@/lib/supabase/types";
import { useTaxonomiasComerciais } from "@/contexts/TaxonomiasComerciaisContext";
import { Select } from "@/components/ui/Select";
import { Dropdown } from "@/components/ui/Dropdown";
import { useModalDismiss } from "@/hooks/useModalDismiss";

function suggestedChannel(tipo: TipoAtividade | null): CanalContato {
  if (tipo === "email" || tipo === "telefone" || tipo === "linkedin") return tipo;
  if (tipo === "reuniao" || tipo === "evento") return "videoconferencia";
  return "outro";
}

export function ConcluirAtividadeModal({ atividade, onClose, onCompleted }: {
  atividade: { id: string; nome: string; tipo: TipoAtividade | null; captacao_id: string | null };
  onClose: () => void;
  onCompleted: (result: { feita: boolean; data_realizada: string | null }) => void;
}) {
  const supabase = createClient();
  const { canais, resultados } = useTaxonomiasComerciais();
  const [houveContato, setHouveContato] = useState(Boolean(atividade.captacao_id && atividade.tipo !== "tarefa"));
  const [canal, setCanal] = useState<CanalContato>(suggestedChannel(atividade.tipo));
  const [resultado, setResultado] = useState<ResultadoInteracao | "">("");
  const [resumo, setResumo] = useState("");
  const [ocorreuEm, setOcorreuEm] = useState(() => new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canaisAtivos = canais.filter(item => item.ativo || item.chave === canal);
  const resultadosAtivos = resultados.filter(item => item.ativo || item.chave === resultado);
  const titleId = useId();
  useModalDismiss(onClose);

  async function save() {
    if (houveContato && !resultado) { setError("Informe o resultado do contato."); return; }
    setSaving(true); setError(null);
    const { data, error: rpcError } = await (supabase as any).rpc("fn_concluir_atividade_com_interacao", {
      p_atividade_id: atividade.id,
      p_registrar_interacao: houveContato,
      p_canal: houveContato ? canal : null,
      p_resultado: houveContato ? resultado : null,
      p_resumo: houveContato ? resumo.trim() || null : null,
      p_ocorreu_em: ocorreuEm ? new Date(ocorreuEm).toISOString() : new Date().toISOString(),
      p_direcao: "saida",
    });
    setSaving(false);
    if (rpcError) { setError(rpcError.message); return; }
    onCompleted({ feita: true, data_realizada: data?.data_realizada ?? new Date().toISOString() });
  }

  return <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{background:"rgba(0,0,0,.45)"}} onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-lg rounded bg-white shadow-2xl" onClick={e=>e.stopPropagation()}>
      <header className="flex items-center justify-between border-b px-6 py-4" style={{borderColor:"rgba(13,13,13,.08)"}}><div><p id={titleId} className="text-[0.875rem] font-bold text-[#282525]">Concluir atividade</p><p className="mt-0.5 text-[0.6875rem] text-black/40">{atividade.nome}</p></div><button type="button" onClick={onClose} aria-label="Fechar" className="text-black/30 hover:text-black/55"><X size={15}/></button></header>
      <div className="space-y-5 p-6">
        <div><p className="mb-2 text-[0.75rem] font-semibold text-[#282525]">Houve contato com a empresa?</p><div className="flex gap-2"><button onClick={()=>setHouveContato(true)} disabled={!atividade.captacao_id} className="rounded border bg-white px-3 py-2 text-[0.75rem] font-medium disabled:opacity-35" style={{color:houveContato?"#7259B5":"rgba(13,13,13,.45)",borderColor:houveContato?"#7259B560":"rgba(13,13,13,.12)"}}>Sim, registrar interação</button><button onClick={()=>setHouveContato(false)} className="rounded border bg-white px-3 py-2 text-[0.75rem] font-medium" style={{color:!houveContato?"#7259B5":"rgba(13,13,13,.45)",borderColor:!houveContato?"#7259B560":"rgba(13,13,13,.12)"}}>Não, apenas concluir</button></div>{!atividade.captacao_id && <p className="mt-2 text-[0.625rem] text-black/35">Vincule a atividade a uma negociação para medir a eficácia do contato.</p>}</div>
        {houveContato && <div className="grid grid-cols-2 gap-3"><div><label className="mb-1.5 block text-[0.6875rem] font-semibold">Canal *</label><Select value={canal} onChange={e=>setCanal(e.target.value as CanalContato)} className="w-full rounded border bg-white px-3 py-2.5 text-[0.75rem]" style={{borderColor:"rgba(13,13,13,.15)"}}>{canaisAtivos.map(c=><option key={c.chave} value={c.chave}>{c.label}</option>)}</Select></div><div><label className="mb-1.5 block text-[0.6875rem] font-semibold">Resultado *</label><Dropdown value={resultado} onChange={v=>setResultado(v as ResultadoInteracao | "")} options={resultadosAtivos.map(r=>({value:r.chave,label:r.label}))} placeholder="Selecionar" /></div><div><label className="mb-1.5 block text-[0.6875rem] font-semibold">Quando aconteceu</label><input type="datetime-local" value={ocorreuEm} onChange={e=>setOcorreuEm(e.target.value)} className="w-full rounded border px-3 py-2.5 text-[0.75rem]" style={{borderColor:"rgba(13,13,13,.15)"}}/></div><div><label className="mb-1.5 block text-[0.6875rem] font-semibold">Resumo</label><input value={resumo} onChange={e=>setResumo(e.target.value)} placeholder="O que aconteceu?" className="w-full rounded border px-3 py-2.5 text-[0.75rem]" style={{borderColor:"rgba(13,13,13,.15)"}}/></div></div>}
        {error && <p role="alert" className="text-[0.6875rem] font-medium text-[#D94E4E]">{error}</p>}
      </div>
      <footer className="flex justify-end gap-3 border-t px-6 py-4" style={{borderColor:"rgba(13,13,13,.08)"}}><button onClick={onClose} className="text-[0.75rem] font-medium text-black/35 hover:text-black/55">Cancelar</button><button onClick={save} disabled={saving||(houveContato&&!resultado)} className="inline-flex items-center gap-1.5 rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-semibold text-white hover:bg-[#26752A] disabled:opacity-40 disabled:cursor-not-allowed"><Check size={13}/>{saving?"Salvando…":"Concluir"}</button></footer>
    </div>
  </div>;
}
