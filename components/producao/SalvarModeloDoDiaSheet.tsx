"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import type { BlocoDoModelo } from "@/lib/producao/modelos-dia";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";

/** Guarda o dia desta data como modelo da organização: o nome e a lista de blocos (tipo, título e duração). */
export function SalvarModeloDoDiaSheet({ organizationId, blocos, onClose, onSaved }: { organizationId: string; blocos: BlocoDoModelo[]; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const limpo = nome.trim();
    if (limpo === "") { setErro("Dê um nome ao modelo."); return; }
    if (limpo.length > 120) { setErro("O nome pode ter até 120 letras."); return; }
    if (blocos.length === 0) { setErro("Os blocos deste dia não têm título; dê um título a pelo menos um."); return; }
    setSalvando(true);
    setErro(null);
    const { error } = await clienteDaProducao(createClient()).from("producao_modelos_dia").insert({ organization_id: organizationId, nome: limpo, blocos });
    setSalvando(false);
    if (error) {
      setErro(error.code === "23505" ? "Já existe um modelo com esse nome." : error.code === "42501" ? "Você não pode criar modelos aqui." : "Não foi possível guardar. Tente de novo.");
      return;
    }
    onSaved();
    fechar();
  }

  return (
    <TopSheet
      titulo="Salvar o dia como modelo"
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Guardando…" : "Guardar modelo"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div>
          <label htmlFor="modelo-nome" className="mb-1.5 block text-[0.6875rem] font-medium text-black/55">Nome do modelo</label>
          <input id="modelo-nome" autoFocus className={CAMPO} value={nome} onChange={event => setNome(event.target.value)} placeholder="Show com passagem de som" maxLength={120} disabled={salvando} />
        </div>
        <div>
          <p className="mb-1.5 text-[0.6875rem] font-medium text-black/55">Blocos do modelo</p>
          <ul className="divide-y divide-black/[.06] rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            {blocos.map((bloco, indice) => (
              <li key={indice} className="flex items-center justify-between gap-3 px-4 py-2 text-[0.8125rem] text-[#282525]">
                <span className="min-w-0 truncate">{bloco.titulo}</span>
                <span className="shrink-0 text-[0.6875rem] tabular-nums text-black/45">{bloco.duracaoMin} min</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </TopSheet>
  );
}
