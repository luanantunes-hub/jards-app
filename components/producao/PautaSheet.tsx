"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { SITUACOES_DA_PAUTA, type SituacaoDaPauta } from "@/lib/producao/estados";
import { lerPauta, ROTULO_DA_SITUACAO_DA_PAUTA, type PautaDaGrade } from "@/lib/producao/pauta";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

export type SalaDaPauta = { id: string; rotulo: string };

/** Cadastro e edição de uma pauta: a sala, o período, o contratante e a situação (a fila e a validade são da pré-reserva). */
export function PautaSheet({ organizationId, salas, pauta, salaInicial, diaInicial, onClose, onSaved }: {
  organizationId: string; salas: SalaDaPauta[]; pauta?: PautaDaGrade; salaInicial?: string; diaInicial?: string; onClose: () => void; onSaved: () => void;
}) {
  const { confirmDelete } = useDeleteConfirm();
  const [salaId, setSalaId] = useState(pauta?.sala_id ?? salaInicial ?? salas[0]?.id ?? "");
  const [titulo, setTitulo] = useState(pauta?.titulo ?? "");
  const [contratante, setContratante] = useState(pauta?.contratante ?? "");
  const [inicio, setInicio] = useState(pauta?.inicio ?? diaInicial ?? "");
  const [fim, setFim] = useState(pauta?.fim ?? diaInicial ?? "");
  const [situacao, setSituacao] = useState<SituacaoDaPauta>(pauta?.situacao ?? "consulta");
  const [ordem, setOrdem] = useState(pauta?.ordem_na_fila?.toString() ?? "");
  const [validade, setValidade] = useState(pauta?.valida_ate ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    if (!salaId) { setErro("Escolha a sala."); return; }
    const leitura = lerPauta({ titulo, contratante, inicio, fim, situacao, ordem, validade });
    if (!leitura.ok) { setErro(leitura.erro); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = pauta
      ? await producao.from("producao_pautas").update({ sala_id: salaId, ...leitura.pauta }).eq("id", pauta.id)
      : await producao.from("producao_pautas").insert({ organization_id: organizationId, sala_id: salaId, ...leitura.pauta });
    setSalvando(false);
    if (error) { setErro(error.code === "42501" ? "Você não pode salvar pautas nesta sala." : "Não foi possível salvar. Tente de novo."); return; }
    onSaved();
    fechar();
  }

  function apagar(fechar: () => void) {
    if (!pauta) return;
    confirmDelete({
      title: "Apagar pauta?",
      description: `"${pauta.titulo}" sai da pauta da sala.`,
      confirmLabel: "Apagar",
      pendingLabel: "Apagando…",
      illustration: false,
      onConfirm: async () => {
        const { error } = await clienteDaProducao(createClient()).from("producao_pautas").delete().eq("id", pauta.id);
        if (error) throw new Error("Não foi possível apagar a pauta.");
        onSaved();
        fechar();
      },
    });
  }

  return (
    <TopSheet
      titulo={pauta ? "Editar pauta" : "Nova pauta"}
      onClose={onClose}
      footer={fechar => (
        <>
          {pauta && <button type="button" onClick={() => apagar(fechar)} disabled={salvando} className="mr-auto rounded px-4 py-2.5 text-[0.75rem] font-medium text-[#B23B3B] transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Apagar</button>}
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : pauta ? "Salvar" : "Criar pauta"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <label className={ROTULO} htmlFor="pauta-titulo">Título</label>
          <input id="pauta-titulo" autoFocus className={CAMPO} value={titulo} onChange={event => setTitulo(event.target.value)} placeholder="Show da banda" maxLength={200} disabled={salvando} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={ROTULO}>Sala</span>
            <Dropdown value={salaId} onChange={setSalaId} options={salas.map(sala => ({ value: sala.id, label: sala.rotulo }))} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="pauta-contratante">Contratante (opcional)</label>
            <input id="pauta-contratante" className={CAMPO} value={contratante} onChange={event => setContratante(event.target.value)} maxLength={200} disabled={salvando} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO} htmlFor="pauta-inicio">Primeiro dia</label>
            <input id="pauta-inicio" type="date" className={CAMPO} value={inicio} onChange={event => { setInicio(event.target.value); if (fim === "" || fim < event.target.value) setFim(event.target.value); }} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="pauta-fim">Último dia</label>
            <input id="pauta-fim" type="date" className={CAMPO} value={fim} min={inicio} onChange={event => setFim(event.target.value)} disabled={salvando} />
          </div>
        </div>
        <div>
          <span className={ROTULO}>Situação</span>
          <Dropdown value={situacao} onChange={valor => setSituacao(valor as SituacaoDaPauta)} options={SITUACOES_DA_PAUTA.map(item => ({ value: item, label: ROTULO_DA_SITUACAO_DA_PAUTA[item] }))} />
        </div>
        {situacao === "pre_reserva" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={ROTULO} htmlFor="pauta-ordem">Ordem na fila</label>
              <input id="pauta-ordem" inputMode="numeric" className={CAMPO} value={ordem} onChange={event => setOrdem(event.target.value)} placeholder="1" disabled={salvando} />
            </div>
            <div>
              <label className={ROTULO} htmlFor="pauta-validade">Vale até</label>
              <input id="pauta-validade" type="date" className={CAMPO} value={validade} onChange={event => setValidade(event.target.value)} disabled={salvando} />
            </div>
          </div>
        )}
      </div>
    </TopSheet>
  );
}
