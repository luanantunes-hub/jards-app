"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Select } from "@/components/ui/Select";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";

type Tipo = "pago" | "gratuito" | "cortesia";
type PublicoAlvo = "geral" | "idosos" | "pne" | "estudantes" | "professores" | "outro";

type DistItem = {
  id: string;
  tipo: Tipo;
  categoria: string | null;
  quantidade: number;
  preco_unitario: number | null;
  publico_alvo: PublicoAlvo;
  observacoes: string | null;
};

const TIPO_META: Record<Tipo, { label: string; color: string; bg: string }> = {
  pago:      { label: "Pago",      color: "#2D72B0", bg: "#2D72B010" },
  gratuito:  { label: "Gratuito",  color: "#2E8932", bg: "#2E893210" },
  cortesia:  { label: "Cortesia",  color: "#7259B5", bg: "#7259B510" },
};

const PUBLICO_LABEL: Record<PublicoAlvo, string> = {
  geral:       "Público geral",
  idosos:      "Idosos (60+)",
  pne:         "PNE / Acessibilidade",
  estudantes:  "Estudantes",
  professores: "Professores",
  outro:       "Outro",
};

const EMPTY: Omit<DistItem, "id"> = {
  tipo: "gratuito",
  categoria: "",
  quantidade: 0,
  preco_unitario: null,
  publico_alvo: "geral",
  observacoes: "",
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DistribuicaoPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const { confirmDelete } = useDeleteConfirm();

  const [items, setItems] = useState<DistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Omit<DistItem, "id">>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("prestacao_distribuicao")
      .select("*")
      .eq("prestacao_id", id)
      .order("created_at");
    if (error) setErro(error.message);
    else {
      setErro(null);
      setItems((data ?? []) as DistItem[]);
    }
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { load(); }, [load]);

  async function salvar() {
    setSaving(true);
    setErro(null);
    const { error } = await (supabase as any).from("prestacao_distribuicao").insert({
      prestacao_id: id,
      tipo: form.tipo,
      categoria: form.categoria || null,
      quantidade: form.quantidade,
      preco_unitario: form.tipo === "pago" ? form.preco_unitario : null,
      publico_alvo: form.publico_alvo,
      observacoes: form.observacoes || null,
    });
    setSaving(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setModalOpen(false);
    setForm(EMPTY);
    load();
  }

  function remover(itemId: string) {
    confirmDelete({
      title: "Excluir categoria?",
      description: "A categoria sai do plano de distribuição desta prestação.",
      onConfirm: async () => {
        setDeletingId(itemId);
        setErro(null);
        const { error } = await (supabase as any).from("prestacao_distribuicao").delete().eq("id", itemId);
        setDeletingId(null);
        if (error) throw new Error(error.message);
        load();
      },
    });
  }

  // Totais
  const totalGratuito = items.filter(i => i.tipo !== "pago").reduce((s, i) => s + i.quantidade, 0);
  const totalPago = items.filter(i => i.tipo === "pago").reduce((s, i) => s + i.quantidade, 0);
  const total = totalGratuito + totalPago;
  const pctGratuito = total > 0 ? Math.round((totalGratuito / total) * 100) : 0;
  const receitaEstimada = items
    .filter(i => i.tipo === "pago" && i.preco_unitario)
    .reduce((s, i) => s + i.quantidade * (i.preco_unitario ?? 0), 0);

  if (loading) return <div className="p-8 text-[0.8125rem] text-black/30">Carregando…</div>;

  return (
    <div className="px-8 py-6 max-w-4xl">

      {erro && (
        <div className="mb-4 rounded border border-[#D94E4E]/25 bg-[#D94E4E]/[.06] px-4 py-3 text-[0.75rem] font-medium text-[#B23A3A]">
          Não foi possível concluir a operação: {erro}
        </div>
      )}

      {/* Resumo */}
      {items.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total de acessos", value: total.toLocaleString("pt-BR"), sub: null },
            { label: "Gratuitos / Cortesia", value: totalGratuito.toLocaleString("pt-BR"), sub: `${pctGratuito}% do total` },
            { label: "Pagos", value: totalPago.toLocaleString("pt-BR"), sub: null },
            { label: "Receita estimada", value: receitaEstimada > 0 ? fmt(receitaEstimada) : "—", sub: null },
          ].map(c => (
            <div key={c.label} className="bg-white rounded border p-4" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-[0.5625rem] font-semibold uppercase tracking-wide text-black/30 mb-1">{c.label}</p>
              <p className="text-[1.0625rem] font-bold text-black/80">{c.value}</p>
              {c.sub && <p className="text-[0.625rem] text-black/35 mt-0.5">{c.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Header da tabela */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[0.6875rem] font-semibold text-black/45">
          {items.length > 0 ? `${items.length} categoria${items.length > 1 ? "s" : ""} cadastrada${items.length > 1 ? "s" : ""}` : "Nenhuma categoria cadastrada"}
        </p>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded text-[0.75rem] font-semibold text-white transition hover:opacity-90"
          style={{ background: "#7259B5" }}
        >
          <Plus size={13} /> Adicionar categoria
        </button>
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <div className="bg-white rounded border flex flex-col items-center justify-center py-16 text-center"
          style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <Users size={28} className="text-black/15 mb-3" />
          <p className="text-[0.8125rem] text-black/35 font-medium">Nenhum plano de distribuição</p>
          <p className="text-[0.6875rem] text-black/25 mt-1 max-w-xs">
            Cadastre como os ingressos ou acessos à atividade serão distribuídos — pagos, gratuitos e cotas reservadas.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
          <table className="w-full text-[0.75rem]">
            <thead>
              <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                {["Tipo", "Categoria", "Público-alvo", "Quantidade", "Preço unit.", "Observações", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/30">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const tm = TIPO_META[item.tipo];
                return (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-black/[.015] transition"
                    style={{ borderColor: "rgba(13,13,13,.05)" }}>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[0.625rem] font-semibold"
                        style={{ background: tm.bg, color: tm.color }}>
                        {tm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-black/70">{item.categoria || "—"}</td>
                    <td className="px-4 py-3 text-black/60">{PUBLICO_LABEL[item.publico_alvo]}</td>
                    <td className="px-4 py-3 font-semibold text-black/80 tabular-nums">
                      {item.quantidade.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-black/60 tabular-nums">
                      {item.tipo === "pago" && item.preco_unitario ? fmt(item.preco_unitario) : "—"}
                    </td>
                    <td className="px-4 py-3 text-black/45 max-w-[11.25rem] truncate">{item.observacoes || "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => remover(item.id)}
                        disabled={deletingId === item.id}
                        className="text-black/20 hover:text-[#D94E4E] transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13,13,13,.35)" }}
          onClick={e => { if (e.target === e.currentTarget) { setModalOpen(false); setForm(EMPTY); } }}>
          <div className="bg-white rounded w-full max-w-md" style={{ boxShadow: "0 8px 32px rgba(13,13,13,.15)" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-[0.8125rem] font-bold text-black/80">Adicionar categoria de distribuição</p>
            </div>
            <div className="p-5 space-y-4">

              {/* Tipo */}
              <div>
                <label className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">Tipo de acesso</label>
                <div className="flex gap-2">
                  {(["gratuito", "pago", "cortesia"] as Tipo[]).map(t => (
                    <button key={t}
                      onClick={() => setForm(f => ({ ...f, tipo: t }))}
                      className="flex-1 py-2 rounded text-[0.6875rem] font-semibold transition border"
                      style={{
                        background: form.tipo === t ? TIPO_META[t].bg : "transparent",
                        color: form.tipo === t ? TIPO_META[t].color : "rgba(13,13,13,.40)",
                        borderColor: form.tipo === t ? TIPO_META[t].color + "60" : "rgba(13,13,13,.12)",
                      }}>
                      {TIPO_META[t].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Categoria e público */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">Categoria</label>
                  <input
                    value={form.categoria ?? ""}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    placeholder="Show, exposição, oficina…"
                    className="w-full border rounded px-3 py-2 text-[0.75rem] focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
                <div>
                  <label className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">Público-alvo</label>
                  <Select
                    value={form.publico_alvo}
                    onChange={e => setForm(f => ({ ...f, publico_alvo: e.target.value as PublicoAlvo }))}
                    className="w-full border rounded px-3 py-2 text-[0.75rem] focus:outline-none bg-white"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  >
                    {(Object.entries(PUBLICO_LABEL) as [PublicoAlvo, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Quantidade e preço */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">Quantidade</label>
                  <input
                    type="number"
                    min={0}
                    value={form.quantidade}
                    onChange={e => setForm(f => ({ ...f, quantidade: parseInt(e.target.value) || 0 }))}
                    className="w-full border rounded px-3 py-2 text-[0.75rem] focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
                {form.tipo === "pago" && (
                  <div>
                    <label className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">Preço unitário (R$)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.preco_unitario ?? ""}
                      onChange={e => setForm(f => ({ ...f, preco_unitario: parseFloat(e.target.value) || null }))}
                      className="w-full border rounded px-3 py-2 text-[0.75rem] focus:outline-none"
                      style={{ borderColor: "rgba(13,13,13,.12)" }}
                    />
                  </div>
                )}
              </div>

              {/* Observações */}
              <div>
                <label className="text-[0.625rem] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">Observações</label>
                <textarea
                  rows={2}
                  value={form.observacoes ?? ""}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Critérios de seleção, documentação necessária…"
                  className="w-full border rounded px-3 py-2 text-[0.75rem] focus:outline-none resize-none"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t flex items-center justify-end gap-4"
              style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <button
                onClick={() => { setModalOpen(false); setForm(EMPTY); }}
                className="text-[0.75rem] font-medium transition"
                style={{ color: "rgba(13,13,13,.35)" }}
                onMouseOver={e => (e.currentTarget.style.color = "rgba(13,13,13,.55)")}
                onMouseOut={e => (e.currentTarget.style.color = "rgba(13,13,13,.35)")}
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={saving || form.quantidade === 0}
                className="px-4 py-2 rounded text-[0.75rem] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                style={{ background: "#7259B5" }}
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
