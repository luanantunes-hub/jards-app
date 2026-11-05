"use client";

import { useState } from "react";
import { TopSheet } from "@/components/ui/TopSheet";
import { createClient } from "@/lib/supabase/client";
import { clienteDaProducao } from "@/lib/producao/cliente";
import { lerValorDaEquipe, lerVinculo } from "@/lib/producao/equipe";

const CAMPO = "h-10 w-full rounded border border-black/[.12] bg-white px-3 text-[0.8125rem] text-[#282525] outline-none transition placeholder:text-black/30 focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10 disabled:opacity-50";
const ROTULO = "mb-1.5 block text-[0.6875rem] font-medium text-black/55";

function emTexto(valor: number | null | undefined): string {
  return valor ? valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

export type VinculoEditavel = { id: string; funcao: string; grupo: string | null; valores: { cache: number | null; diaria: number | null } | null };

/** Muda a função, o grupo e (para quem vê o dinheiro) o cachê e a diária de uma pessoa na temporada. */
export function EditarVinculoSheet({ organizationId, vinculo, nome, comDinheiro, onClose, onSaved }: {
  organizationId: string; vinculo: VinculoEditavel; nome: string; comDinheiro: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [funcao, setFuncao] = useState(vinculo.funcao);
  const [grupo, setGrupo] = useState(vinculo.grupo ?? "");
  const [cache, setCache] = useState(emTexto(vinculo.valores?.cache));
  const [diaria, setDiaria] = useState(emTexto(vinculo.valores?.diaria));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(fechar: () => void) {
    const dados = lerVinculo({ funcao, grupo });
    if (!dados.ok) { setErro(dados.erro); return; }
    const valorCache = comDinheiro ? lerValorDaEquipe(cache) : { ok: true as const, valor: null };
    const valorDiaria = comDinheiro ? lerValorDaEquipe(diaria) : { ok: true as const, valor: null };
    if (!valorCache.ok) { setErro(`Cachê: ${valorCache.erro}`); return; }
    if (!valorDiaria.ok) { setErro(`Diária: ${valorDiaria.erro}`); return; }
    setSalvando(true);
    setErro(null);
    const producao = clienteDaProducao(createClient());
    const { error } = await producao.from("producao_vinculos").update({ funcao: dados.funcao, grupo: dados.grupo }).eq("id", vinculo.id);
    if (error) { setSalvando(false); setErro(error.code === "42501" ? "Você não pode mudar esta função." : "Não foi possível salvar. Tente de novo."); return; }
    if (comDinheiro) {
      const { error: erroDoValor } = await producao.from("producao_vinculos_valores")
        .upsert({ vinculo_id: vinculo.id, organization_id: organizationId, cache: valorCache.valor, diaria: valorDiaria.valor }, { onConflict: "vinculo_id" });
      if (erroDoValor) { setSalvando(false); setErro("A função foi salva, mas o cachê e a diária não. Tente de novo."); onSaved(); return; }
    }
    setSalvando(false);
    onSaved();
    fechar();
  }

  return (
    <TopSheet
      titulo={`Editar ${nome}`}
      onClose={onClose}
      footer={fechar => (
        <>
          <button type="button" onClick={fechar} disabled={salvando} className="rounded px-4 py-2.5 text-[0.75rem] font-medium text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]">Cancelar</button>
          <button type="button" onClick={() => void salvar(fechar)} disabled={salvando} className="rounded bg-[#2E8932] px-4 py-2.5 text-[0.75rem] font-medium text-white transition hover:bg-[#26752A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50">{salvando ? "Salvando…" : "Salvar"}</button>
        </>
      )}
    >
      <div className="space-y-4">
        {erro && <p role="alert" className="rounded border bg-white px-3 py-2 text-[0.75rem] text-[#B23B3B]" style={{ borderColor: "#B23B3B47" }}>{erro}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={ROTULO} htmlFor="vinculo-funcao">Função</label>
            <input id="vinculo-funcao" autoFocus className={CAMPO} value={funcao} onChange={event => setFuncao(event.target.value)} maxLength={80} disabled={salvando} />
          </div>
          <div>
            <label className={ROTULO} htmlFor="vinculo-grupo">Grupo (opcional)</label>
            <input id="vinculo-grupo" className={CAMPO} value={grupo} onChange={event => setGrupo(event.target.value)} maxLength={80} disabled={salvando} />
          </div>
        </div>
        {comDinheiro && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={ROTULO} htmlFor="vinculo-cache">Cachê (R$)</label>
              <input id="vinculo-cache" inputMode="decimal" className={CAMPO} value={cache} onChange={event => setCache(event.target.value)} placeholder="1.500,00" disabled={salvando} />
            </div>
            <div>
              <label className={ROTULO} htmlFor="vinculo-diaria">Diária (R$)</label>
              <input id="vinculo-diaria" inputMode="decimal" className={CAMPO} value={diaria} onChange={event => setDiaria(event.target.value)} placeholder="250,00" disabled={salvando} />
            </div>
          </div>
        )}
      </div>
    </TopSheet>
  );
}
