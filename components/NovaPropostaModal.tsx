"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, ExternalLink, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dropdown } from "@/components/ui/Dropdown";

type CotaOption = { id: string; nome: string; valor: number };
export type PropostaRow = { id: string; titulo: string; valor_proposto: number | null; cota_id: string | null; created_at: string };

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function NovaPropostaModal({
  parentField,
  parentId,
  projetoId,
  projetoNome,
  empresaNome,
  organizationId,
  proposta,
  onClose,
  onCreated,
  onSavedValor,
}: {
  parentField: "captacao_id" | "edital_user_id";
  parentId: string;
  projetoId: string;
  projetoNome: string;
  empresaNome: string;
  organizationId: string | null;
  proposta?: PropostaRow | null;
  onClose: () => void;
  onCreated: () => void;
  onSavedValor?: (valor: number) => void;
}) {
  const supabase = createClient();
  const [cotas, setCotas] = useState<CotaOption[]>([]);
  const [cotaId, setCotaId] = useState(proposta?.cota_id ?? "");
  const [valorInput, setValorInput] = useState(proposta?.valor_proposto != null ? String(proposta.valor_proposto) : "");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let active = true;
    (supabase as any).from("cotas_patrocinio").select("id,nome,valor").eq("projeto_id", projetoId).order("ordem").then(({ data }: any) => {
      if (active) setCotas(data ?? []);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId]);

  function selectCota(id: string) {
    setCotaId(id);
    const cota = cotas.find(c => c.id === id);
    if (cota) setValorInput(String(cota.valor));
  }

  async function salvar() {
    if (!valorInput.trim()) return;
    setSalvando(true);
    const valor = parseFloat(valorInput.replace(/\./g, "").replace(",", "."));

    if (proposta) {
      const { error } = await (supabase as any).from("propostas").update({
        cota_id: cotaId || null,
        valor_proposto: Number.isFinite(valor) ? valor : null,
      }).eq("id", proposta.id);
      setSalvando(false);
      if (!error) {
        onCreated();
        if (Number.isFinite(valor)) onSavedValor?.(valor);
        onClose();
      }
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !organizationId) { setSalvando(false); return; }
    const { error } = await (supabase as any).from("propostas").insert({
      account_id: user.id,
      organization_id: organizationId,
      projeto_id: projetoId,
      [parentField]: parentId,
      cota_id: cotaId || null,
      titulo: `Proposta — ${empresaNome}`,
      valor_proposto: Number.isFinite(valor) ? valor : null,
      status: "enviada",
    });
    setSalvando(false);
    if (!error) {
      onCreated();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose}>
      <div className="bg-white rounded shadow-2xl w-full overflow-hidden" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-black/5 flex items-center justify-center">
              <Coins size={16} className="text-black/50" />
            </div>
            <h2 className="text-[15px] font-bold text-black">{proposta ? "Editar proposta" : "Nova proposta"}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/6 transition">
            <X size={15} className="text-black/40" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4 rounded border bg-black/[.02] px-3 py-2.5" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-black/30">Projeto</p>
              <p className="truncate text-[11px] font-semibold text-black/65">{projetoNome}</p>
            </div>
            <div className="h-6 w-px bg-black/10" />
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-black/30">Empresa</p>
              <p className="truncate text-[11px] font-semibold text-black/65">{empresaNome}</p>
            </div>
          </div>

          {cotas.length > 0 && (
            <div>
              <label className="text-[10px] text-black/40 mb-1 block">Cota-base (opcional)</label>
              <Dropdown
                value={cotaId}
                onChange={selectCota}
                placeholder="Construir sem cota-base"
                options={cotas.map(c => ({ value: c.id, label: `${c.nome} · ${formatCurrency(c.valor)}` }))}
              />
              <p className="mt-1.5 text-[10px] text-black/35">Escolher uma cota pré-preenche o valor — pode ajustar livremente depois (proposta adaptada).</p>
            </div>
          )}

          <div>
            <label className="text-[10px] text-black/40 mb-1 block">Valor proposto (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={valorInput}
              onChange={(e) => setValorInput(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 text-[13px] border rounded focus:outline-none focus:ring-2 focus:ring-[#7259B5]/20 focus:border-[#7259B5]"
              style={{ borderColor: "rgba(13,13,13,.12)" }}
            />
          </div>

          <button
            onClick={salvar}
            disabled={salvando || !valorInput.trim()}
            className="w-full px-3 py-2 text-[11px] font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 rounded hover:bg-black/[.04] transition disabled:opacity-40"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
          <Link href={`/projetos/${projetoId}`} className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-black/35 hover:text-[#7259B5] transition">
            Gerenciar cotas do projeto <ExternalLink size={9} />
          </Link>
        </div>
      </div>
    </div>
  );
}
