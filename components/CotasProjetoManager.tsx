"use client";
import { useState } from "react";
import { X, Plus, Minus, GripVertical, Pencil, Trash2, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import type { CotaPatrocinio, StatusCotaPatrocinio, VendaPatrocinio } from "@/lib/supabase/types";

export type VendaPatrocinioComEmpresa = VendaPatrocinio & {
  empresa_crm: { nome: string } | null;
  empresa_pub: { nome: string } | null;
};

function atm(cents: string) {
  return cents
    ? (parseInt(cents, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";
}

function initCents(v: number | null) {
  return v != null ? Math.round(v * 100).toString() : "";
}

function atmKey(setCents: (fn: (p: string) => string) => void) {
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") { e.preventDefault(); setCents(p => p.slice(0, -1)); }
    else if (/^\d$/.test(e.key)) { e.preventDefault(); setCents(p => p.length < 13 ? p + e.key : p); }
    else if (!["Tab","ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)) e.preventDefault();
  };
}

const STATUS_LABELS: Record<StatusCotaPatrocinio, { label: string; color: string }> = {
  disponivel: { label: "Disponível", color: "#2E8932" },
  reservada:  { label: "Disponível", color: "#2E8932" },
  vendida:    { label: "Vendida",    color: "rgba(13,13,13,.40)" },
};

type CotaFormData = {
  nome: string;
  valorCents: string;
  contrapartidas: string;
  unidades: number;
};

const EMPTY_FORM: CotaFormData = { nome: "", valorCents: "", contrapartidas: "", unidades: 1 };

export function CotasProjetoManager({
  projetoId,
  cotas,
  onRefresh,
  valorTotal,
  vendas = [],
}: {
  projetoId: string;
  cotas: CotaPatrocinio[];
  onRefresh: () => void;
  hideTitle?: boolean;
  valorTotal?: number;
  vendas?: VendaPatrocinioComEmpresa[];
}) {
  const supabase = createClient();
  const organizationId = useOrganizationId();
  const { confirmDelete } = useDeleteConfirm();
  const [editing, setEditing] = useState<CotaPatrocinio | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CotaFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setErro(null);
  }

  function openEdit(cota: CotaPatrocinio) {
    setEditing(cota);
    setForm({
      nome: cota.nome,
      valorCents: initCents(cota.valor),
      contrapartidas: cota.contrapartidas.join("\n"),
      unidades: cota.unidades ?? 1,
    });
    setShowForm(true);
    setErro(null);
  }

  async function handleSave() {
    setSaving(true);
    setErro(null);
    const nome = form.nome.trim();
    if (!nome) { setErro("Nome é obrigatório"); setSaving(false); return; }

    const contrapartidas = form.contrapartidas
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      projeto_id: projetoId,
      organization_id: organizationId,
      nome,
      valor: form.valorCents ? parseInt(form.valorCents, 10) / 100 : 0,
      contrapartidas,
      unidades: form.unidades,
      ordem: editing?.ordem ?? cotas.length,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { error } = editing
      ? await sb.from("cotas_patrocinio").update(payload).eq("id", editing.id)
      : await sb.from("cotas_patrocinio").insert(payload);

    setSaving(false);
    if (error) { setErro((error as Error).message); return; }
    setShowForm(false);
    onRefresh();
  }

  function handleDelete(id: string, nome: string) {
    confirmDelete({
      title: `Excluir cota "${nome}"?`,
      description: "Todas as unidades e configurações desta cota serão removidas permanentemente.",
      onConfirm: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const { error } = await sb.from("cotas_patrocinio").delete().eq("id", id);
        if (!error) onRefresh();
      },
    });
  }

  const totalValue = cotas.reduce((s, c) => s + c.valor * (c.unidades ?? 1), 0);
  const totalUnidades = cotas.reduce((s, c) => s + (c.unidades ?? 1), 0);
  const vendidas = cotas.reduce((s, c) => s + (c.unidades_vendidas ?? 0), 0);
  const disponiveis = totalUnidades - vendidas;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-black/35">
          {totalUnidades > 0 ? `${totalUnidades} cota${totalUnidades !== 1 ? "s" : ""}` : "Nenhuma cota"}
        </p>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded border px-3 py-2 text-[11px] font-medium text-black/70 transition hover:bg-black/[.04] active:scale-[.98]"
          style={{ borderColor: "rgba(13,13,13,.18)" }}
        >
          <Plus size={12} /> Nova cota
        </button>
      </div>

      {/* Lista de cotas */}
      {cotas.length === 0 ? (
        <div className="border rounded p-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)", borderStyle: "dashed" }}>
          <p className="text-[12px] text-black/30 mb-3">Nenhuma cota cadastrada</p>
          <button onClick={openNew} className="text-[11px] font-semibold text-[#7259B5] hover:underline">
            + Criar primeira cota
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {cotas.map((cota) => {
            const st = STATUS_LABELS[cota.status];
            const vendasDaCota = vendas.filter(venda => venda.cota_id === cota.id);
            return (
              <div key={cota.id} className="rounded border transition hover:bg-black/[0.02]" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-shrink-0 text-black/20">
                  <GripVertical size={14} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-black">{cota.nome}</p>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${st.color}14`, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </div>
                  {cota.contrapartidas.length > 0 && (
                    <p className="text-[11px] text-black/40 mt-0.5 line-clamp-1">
                      {cota.contrapartidas.join(" · ")}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                  <span className="text-[13px] font-bold text-black/60">R$ {atm(cota.valor.toString())}</span>
                  {(cota.unidades ?? 1) > 1 && (
                    <span className="text-[10px] text-black/30 tabular-nums">
                      {(cota.unidades_vendidas ?? 0) > 0
                        ? `${cota.unidades_vendidas}/${cota.unidades} vendida${cota.unidades_vendidas !== 1 ? "s" : ""}`
                        : `${cota.unidades} un.`}
                    </span>
                  )}
                  {valorTotal && valorTotal > 0 && (
                    <span className="text-[10px] text-black/25">
                      {Math.round((cota.valor * (cota.unidades ?? 1)) / (valorTotal * 100) * 100)}%
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(cota)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 transition"
                    title="Editar"
                  >
                    <Pencil size={12} className="text-black/35" />
                  </button>
                  <button
                    onClick={() => handleDelete(cota.id, cota.nome)}
                    className="group w-7 h-7 flex items-center justify-center rounded hover:bg-[#D94E4E]/10 transition"
                    title="Excluir"
                  >
                    <Trash2 size={12} className="text-black/25 group-hover:text-[#D94E4E] transition-colors" />
                  </button>
                </div>
              </div>
              {vendasDaCota.length > 0 && (
                <div className="border-t border-black/[.06] px-11 py-2.5">
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {vendasDaCota.map(venda => (
                      <span key={venda.id} className="inline-flex items-center gap-1.5 text-[10px] font-medium text-black/45">
                        <Building2 size={10} className="text-[#2E8932]" />
                        {venda.empresa_crm?.nome || venda.empresa_pub?.nome || "Empresa compradora"}
                        <span className="text-black/25">·</span>
                        <span className="tabular-nums">{venda.valor_vendido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}

      {/* Painel de resumo */}
      {cotas.length > 0 && (
        <div className="rounded border p-4 space-y-3" style={{ borderColor: "rgba(13,13,13,.08)", background: "rgba(13,13,13,.018)" }}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-black/35 mb-1">Total</p>
              <p className="text-[15px] font-semibold text-black/75 tabular-nums">R$ {atm(totalValue.toString())}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-[#2E8932]/70 mb-1">Disponíveis</p>
              <p className="text-[15px] font-semibold tabular-nums" style={{ color: "#2E8932" }}>{disponiveis}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.08em] text-black/35 mb-1">Vendidas</p>
              <p className="text-[15px] font-semibold text-black/60 tabular-nums">{vendidas}</p>
            </div>
          </div>
          {valorTotal && valorTotal > 0 && (() => {
            const pct = Math.min(100, Math.round((totalValue / (valorTotal * 100)) * 100));
            const over = totalValue / 100 > valorTotal;
            return (
              <div className="pt-1 border-t" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                <div className="h-1.5 overflow-hidden rounded bg-black/[.07]">
                  <div
                    className="h-full rounded transition-all"
                    style={{ width: `${pct}%`, background: over ? "#D94E4E" : pct === 100 ? "#2E8932" : "#7259B5" }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-black/35">
                  {pct}% do orçamento coberto
                  {over && <span className="ml-1 font-semibold text-[#D94E4E]">— excede o total</span>}
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.45)" }}
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded shadow-2xl w-full overflow-hidden flex flex-col"
            style={{ maxWidth: 480, maxHeight: "90vh" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <h2 className="text-[15px] font-bold text-black">{editing ? "Editar cota" : "Nova cota"}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/6 transition">
                <X size={15} className="text-black/40" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {erro && (
                <div className="text-[12px] font-semibold text-[#D94E4E] bg-[#D94E4E]/8 rounded px-3 py-2">
                  {erro}
                </div>
              )}

              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">Nome da cota</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Cota Ouro, Cota Master..."
                  className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">Valor</label>
                <div className="flex items-center border rounded px-3 py-2.5 gap-2" style={{ borderColor: "rgba(13,13,13,.15)" }}>
                  <span className="text-[13px] text-black/40 flex-shrink-0">R$</span>
                  <input
                    value={atm(form.valorCents)}
                    onChange={() => {}}
                    onKeyDown={atmKey(setCents => setForm(f => ({ ...f, valorCents: setCents(f.valorCents) })))}
                    placeholder="0,00"
                    className="w-full text-[13px] text-black outline-none bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">Unidades disponíveis</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, unidades: Math.max(1, f.unidades - 1) }))}
                    disabled={form.unidades <= 1}
                    className="w-9 h-9 flex items-center justify-center rounded border transition hover:bg-black/[.04] disabled:opacity-30"
                    style={{ borderColor: "rgba(13,13,13,.15)" }}
                  >
                    <Minus size={13} className="text-black/60" />
                  </button>
                  <span className="text-[15px] font-semibold text-black/70 w-6 text-center tabular-nums">{form.unidades}</span>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, unidades: f.unidades + 1 }))}
                    className="w-9 h-9 flex items-center justify-center rounded border transition hover:bg-black/[.04]"
                    style={{ borderColor: "rgba(13,13,13,.15)" }}
                  >
                    <Plus size={13} className="text-black/60" />
                  </button>
                  <span className="text-[11px] text-black/35">unidade{form.unidades !== 1 ? "s" : ""} desta cota disponíveis para venda</span>
                </div>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-black mb-1.5 block">
                  Contrapartidas <span className="text-black/30 font-normal">(uma por linha)</span>
                </label>
                <textarea
                  value={form.contrapartidas}
                  onChange={e => setForm(f => ({ ...f, contrapartidas: e.target.value }))}
                  placeholder={"Logo em materiais\nReceivers no evento\nPost nas redes sociais"}
                  rows={4}
                  className="w-full border rounded px-3 py-2.5 text-[13px] text-black outline-none focus:border-[#7259B5] transition resize-none"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-semibold text-black/40 rounded hover:bg-black/5 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-[#2E8932] text-white border border-[#2E8932] rounded hover:bg-[#26752A] transition disabled:opacity-40"
              >
                {saving ? "Salvando..." : editing ? "Salvar" : "Criar cota"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
