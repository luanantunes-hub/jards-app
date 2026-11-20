"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { Dropdown } from "@/components/ui/Dropdown";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { horaLocalParaInstante, ROTULO_DO_TIPO_DE_BLOCO } from "@/lib/producao/dia";
import type { ExibicaoDoBloco } from "@/lib/producao/estados";
import type { TipoBloco } from "@/lib/producao/vocabulario";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

const EXIBICOES: { value: ExibicaoDoBloco; label: string }[] = [
  { value: "exata", label: "Hora exata" },
  { value: "aproximada", label: "Hora aproximada" },
  { value: "a_definir", label: "A definir" },
  { value: "oculta", label: "Hora oculta na folha" },
];

/** Cadastro de um bloco do dia: tipo, nome, hora de início e fim (na hora do lugar da data). */
export function NovoBlocoSheet({ organizationId, dataId, dia, fuso, proximaOrdem, onClose, onCreated }: {
  organizationId: string;
  dataId: string;
  dia: string;
  fuso: string;
  proximaOrdem: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tipo, setTipo] = useState<TipoBloco>("sessao");
  const [titulo, setTitulo] = useState("");
  const [exibicao, setExibicao] = useState<ExibicaoDoBloco>("exata");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const semHora = exibicao === "a_definir";

  async function salvar(fechar: () => void) {
    if (!semHora && !inicio) { setErro("Informe a hora de início."); return; }
    setSalvando(true);
    setErro(null);
    const instanteInicio = semHora ? null : horaLocalParaInstante(dia, inicio, fuso);
    // Um fim antes do início passa da meia-noite: cai no dia seguinte.
    let instanteFim: string | null = null;
    if (!semHora && fim) {
      const mesmoDia = horaLocalParaInstante(dia, fim, fuso);
      instanteFim = mesmoDia > (instanteInicio as string) ? mesmoDia : new Date(Date.parse(mesmoDia) + 86_400_000).toISOString();
    }
    const { error } = await clienteDaProducao(createClient()).from("producao_blocos").insert({
      organization_id: organizationId, data_id: dataId, dia, tipo, titulo: titulo.trim() || null,
      exibicao, inicio: instanteInicio, fim: instanteFim, ordem: proximaOrdem,
    });
    setSalvando(false);
    if (error) { setErro("Não foi possível criar. Tente de novo."); return; }
    onCreated();
    fechar();
  }

  return (
    <TopSheet
      titulo="Novo bloco"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded acao-salvar px-4 py-2.5 text-[0.75rem] font-medium text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">
            {salvando ? "Criando…" : "Criar bloco"}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <span className={ROTULO}>Tipo</span>
          <Dropdown ariaLabel="Tipo do bloco" value={tipo} onChange={valor => setTipo(valor as TipoBloco)} disabled={salvando} options={(Object.keys(ROTULO_DO_TIPO_DE_BLOCO) as TipoBloco[]).map(item => ({ value: item, label: ROTULO_DO_TIPO_DE_BLOCO[item] }))} />
        </div>
        <div>
          <label className={ROTULO} htmlFor="bloco-titulo">Nome (opcional)</label>
          <input id="bloco-titulo" className={CAMPO} value={titulo} onChange={event => setTitulo(event.target.value)} placeholder={ROTULO_DO_TIPO_DE_BLOCO[tipo]} maxLength={200} disabled={salvando} />
        </div>
        <div>
          <span className={ROTULO}>Hora</span>
          <Dropdown ariaLabel="Como a hora aparece" value={exibicao} onChange={valor => setExibicao(valor as ExibicaoDoBloco)} disabled={salvando} options={EXIBICOES} />
        </div>
        {!semHora && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={ROTULO} htmlFor="bloco-inicio">Início</label>
              <input id="bloco-inicio" type="time" autoFocus className={CAMPO} value={inicio} onChange={event => setInicio(event.target.value)} disabled={salvando} />
            </div>
            <div>
              <label className={ROTULO} htmlFor="bloco-fim">Fim (opcional)</label>
              <input id="bloco-fim" type="time" className={CAMPO} value={fim} onChange={event => setFim(event.target.value)} disabled={salvando} />
            </div>
          </div>
        )}
      </div>
    </TopSheet>
  );
}
