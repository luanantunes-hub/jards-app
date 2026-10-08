"use client";
import { useState } from "react";
import { X, Plus, Minus, GripVertical, Pencil, Trash2, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import type { CotaPatrocinio, StatusCotaPatrocinio, VendaPatrocinio } from "@/lib/supabase/types";
import { formatCotaValor } from "@/lib/cotas";
import { formatarValorCompleto, formatarValorCurto } from "@/lib/valor";
import { BarraCaptacao } from "@/components/ui/IndicadoresFinanceiros";

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
  modelo: "nivel" | "produto";
  produtoNome: string;
  precoTipo: "fixo" | "faixa";
  valorCents: string;
  valorMaximoCents: string;
  contrapartidas: string;
  unidades: number;
  unidadesIlimitadas: boolean;
};

const EMPTY_FORM: CotaFormData = { nome: "", modelo: "nivel", produtoNome: "", precoTipo: "fixo", valorCents: "", valorMaximoCents: "", contrapartidas: "", unidades: 1, unidadesIlimitadas: false };

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
      modelo: cota.modelo ?? "nivel",
      produtoNome: cota.produto_nome ?? "",
      precoTipo: cota.valor_maximo == null ? "fixo" : "faixa",
      valorCents: initCents(cota.valor),
      valorMaximoCents: initCents(cota.valor_maximo),
      contrapartidas: cota.contrapartidas.join("\n"),
      unidades: cota.unidades ?? 1,
      unidadesIlimitadas: cota.unidades_ilimitadas ?? false,
    });
    setShowForm(true);
    setErro(null);
  }

  async function handleSave() {
    setSaving(true);
    setErro(null);
    const nome = form.nome.trim();
    if (!nome) { setErro("Nome é obrigatório"); setSaving(false); return; }
    const valor = Number(form.valorCents || 0) / 100;
    const valorMaximo = form.precoTipo === "faixa" ? Number(form.valorMaximoCents || 0) / 100 : null;
    if (form.precoTipo === "faixa" && (valor <= 0 || valorMaximo == null || valorMaximo <= valor)) {
      setErro("Informe uma faixa com valor mínimo positivo e máximo maior que o mínimo."); setSaving(false); return;
    }
    if (form.modelo === "produto" && !form.produtoNome.trim()) {
      setErro("Informe o produto ou componente desta cota."); setSaving(false); return;
    }
    if (!form.unidadesIlimitadas && form.unidades < (editing?.unidades_vendidas ?? 0)) {
      setErro("O limite não pode ser menor que as unidades já vendidas."); setSaving(false); return;
    }

    const contrapartidas = form.contrapartidas
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      projeto_id: projetoId,
      organization_id: organizationId,
      nome,
      valor,
      valor_maximo: valorMaximo,
      modelo: form.modelo,
      produto_nome: form.modelo === "produto" ? form.produtoNome.trim() : null,
      contrapartidas,
      unidades: form.unidades,
      unidades_ilimitadas: form.unidadesIlimitadas,
      status: !form.unidadesIlimitadas && (editing?.unidades_vendidas ?? 0) >= form.unidades
        ? "vendida"
        : editing?.status === "reservada" ? "reservada" : "disponivel",
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

  const valorContratado = vendas.filter(v => v.cota_id && cotas.some(c => c.id === v.cota_id)).reduce((s, v) => s + Number(v.valor_vendido || 0), 0);
  const unlimitedCount = cotas.filter(c => c.unidades_ilimitadas).length;
  const vendidas = cotas.reduce((s, c) => s + (c.unidades_vendidas ?? 0), 0);
  const disponiveis = cotas.reduce((s, c) => s + (c.unidades_ilimitadas ? 0 : Math.max(0, (c.unidades ?? 1) - (c.unidades_vendidas ?? 0))), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[0.6875rem] text-black/35">
          {cotas.length > 0 ? `${cotas.length} tipo${cotas.length !== 1 ? "s" : ""} de cota` : "Nenhuma cota"}
        </p>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded border px-3 py-2 text-[0.6875rem] font-medium text-black/70 transition hover:bg-black/[.04] active:scale-[.98]"
          style={{ borderColor: "rgba(13,13,13,.18)" }}
        >
          <Plus size={12} /> Nova cota
        </button>
      </div>

      {/* Lista de cotas */}
      {cotas.length === 0 ? (
        <div className="border rounded p-8 text-center" style={{ borderColor: "rgba(13,13,13,.08)", borderStyle: "dashed" }}>
          <p className="text-[0.75rem] text-black/30 mb-3">Nenhuma cota cadastrada</p>
          <button onClick={openNew} className="text-[0.6875rem] font-semibold text-[#7259B5] hover:underline">
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
                    <p className="text-[0.8125rem] font-semibold text-black">{cota.nome}</p>
                    {cota.modelo === "produto" && <span className="text-[0.625rem] font-medium text-[#7259B5]">{cota.produto_nome}</span>}
                    <span
                      className="text-[0.625rem] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "#fff", border: `1px solid ${st.color}47`, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </div>
                  {cota.contrapartidas.length > 0 && (
                    <p className="text-[0.6875rem] text-black/40 mt-0.5 line-clamp-1">
                      {cota.contrapartidas.join(" · ")}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                  <span className="text-[0.8125rem] font-bold text-black/60">{formatCotaValor(cota)}</span>
                  {cota.unidades_ilimitadas ? (
                    <span className="text-[0.625rem] text-black/30 tabular-nums">Ilimitada · {cota.unidades_vendidas ?? 0} vendida(s)</span>
                  ) : (cota.unidades ?? 1) > 1 && (
                    <span className="text-[0.625rem] text-black/30 tabular-nums">
                      {(cota.unidades_vendidas ?? 0) > 0
                        ? `${cota.unidades_vendidas}/${cota.unidades} vendida${cota.unidades_vendidas !== 1 ? "s" : ""}`
                        : `${cota.unidades} un.`}
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
                    className="group w-7 h-7 flex items-center justify-center rounded hover:bg-black/[.04] transition"
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
                      <span key={venda.id} className="inline-flex items-center gap-1.5 text-[0.625rem] font-medium text-black/45">
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
            <div className="min-w-0">
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45 mb-1">Vendido</p>
              <p title={formatarValorCompleto(valorContratado)} className={`truncate text-[0.9375rem] font-semibold tabular-nums ${valorContratado ? "text-[#0D0D0D]" : "text-black/30"}`}>{formatarValorCurto(valorContratado)}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45 mb-1">Disponíveis</p>
              <p className={`text-[0.9375rem] font-semibold tabular-nums ${disponiveis || unlimitedCount > 0 ? "text-[#0D0D0D]" : "text-black/30"}`}>{disponiveis}{unlimitedCount > 0 ? " + ilimitadas" : ""}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45 mb-1">Vendidas</p>
              <p className={`text-[0.9375rem] font-semibold tabular-nums ${vendidas ? "text-[#0D0D0D]" : "text-black/30"}`}>{vendidas}</p>
            </div>
          </div>
          {valorTotal && valorTotal > 0 && (() => {
            const pct = Math.min(100, Math.round((valorContratado / valorTotal) * 100));
            const over = valorContratado > valorTotal;
            return (
              <div className="pt-1 border-t" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                <BarraCaptacao confirmado={valorContratado} meta={valorTotal} className="h-1.5" />
                <p className="mt-1.5 text-[0.625rem] text-black/35">
                  {pct}% do alvo contratado nestas cotas
                  {over && <span className="ml-1 font-semibold text-[#B07A14]">— acima da meta atual</span>}
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
            style={{ maxWidth: "30rem", maxHeight: "90vh" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <h2 className="text-[0.9375rem] font-bold text-black">{editing ? "Editar cota" : "Nova cota"}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/6 transition">
                <X size={15} className="text-black/40" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {erro && (
                <div className="text-[0.75rem] font-semibold text-[#D94E4E] border border-[#D94E4E]/30 bg-white rounded px-3 py-2">
                  {erro}
                </div>
              )}

              <div>
                <label className="text-[0.75rem] font-semibold text-black mb-1.5 block">Nome da cota</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Cota Ouro, Cota Master..."
                  className="w-full border rounded px-3 py-2.5 text-[0.8125rem] text-black outline-none focus:border-[#7259B5] transition"
                  style={{ borderColor: "rgba(13,13,13,.15)" }}
                />
              </div>

              <div>
                <label className="text-[0.75rem] font-semibold text-black mb-1.5 block">Organização da cota</label>
                <div className="grid grid-cols-2 gap-2">
                  {([ ["nivel", "Nível de patrocínio"], ["produto", "Produto do projeto"] ] as const).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setForm(f => ({ ...f, modelo: value }))}
                      className={`rounded border px-3 py-2 text-[0.6875rem] font-semibold ${form.modelo === value ? "border-[#7259B5] text-[#7259B5]" : "border-black/15 text-black/45"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {form.modelo === "produto" && <input value={form.produtoNome} onChange={e => setForm(f => ({ ...f, produtoNome: e.target.value }))}
                  placeholder="Ex: Palco principal, série, atividade…" className="mt-2 w-full rounded border border-black/15 px-3 py-2.5 text-[0.8125rem] text-black outline-none focus:border-[#7259B5]" />}
              </div>

              <div>
                <label className="text-[0.75rem] font-semibold text-black mb-1.5 block">Valor de referência</label>
                <div className="mb-2 flex gap-2">
                  {([ ["fixo", "Valor fixo"], ["faixa", "Faixa de valores"] ] as const).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setForm(f => ({ ...f, precoTipo: value }))}
                      className={`rounded border px-3 py-2 text-[0.6875rem] font-semibold ${form.precoTipo === value ? "border-[#7259B5] text-[#7259B5]" : "border-black/15 text-black/45"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <span className="mb-1 block text-[0.625rem] text-black/40">{form.precoTipo === "faixa" ? "Mínimo" : "Valor"}</span>
                <div className="flex items-center border rounded px-3 py-2.5 gap-2" style={{ borderColor: "rgba(13,13,13,.15)" }}>
                  <span className="text-[0.8125rem] text-black/40 flex-shrink-0">R$</span>
                  <input
                    value={atm(form.valorCents)}
                    onChange={() => {}}
                    onKeyDown={atmKey(setCents => setForm(f => ({ ...f, valorCents: setCents(f.valorCents) })))}
                    placeholder="0,00"
                    className="w-full text-[0.8125rem] text-black outline-none bg-transparent"
                  />
                </div>
                {form.precoTipo === "faixa" && <>
                  <span className="mb-1 mt-2 block text-[0.625rem] text-black/40">Máximo</span>
                  <div className="flex items-center gap-2 rounded border border-black/15 px-3 py-2.5">
                    <span className="text-[0.8125rem] text-black/40">R$</span>
                    <input value={atm(form.valorMaximoCents)} onChange={() => {}}
                      onKeyDown={atmKey(setCents => setForm(f => ({ ...f, valorMaximoCents: setCents(f.valorMaximoCents) })))}
                      placeholder="0,00" className="w-full bg-transparent text-[0.8125rem] text-black outline-none" />
                  </div>
                </>}
                <p className="mt-1.5 text-[0.625rem] text-black/35">O valor da proposta pode ser ajustado sem alterar esta referência.</p>
              </div>

              <div>
                <label className="text-[0.75rem] font-semibold text-black mb-1.5 block">Unidades disponíveis</label>
                <div className="mb-2 flex gap-2">
                  <button type="button" onClick={() => setForm(f => ({ ...f, unidadesIlimitadas: false }))}
                    className={`rounded border px-3 py-2 text-[0.6875rem] font-semibold ${!form.unidadesIlimitadas ? "border-[#7259B5] text-[#7259B5]" : "border-black/15 text-black/45"}`}>Quantidade definida</button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, unidadesIlimitadas: true }))}
                    className={`rounded border px-3 py-2 text-[0.6875rem] font-semibold ${form.unidadesIlimitadas ? "border-[#7259B5] text-[#7259B5]" : "border-black/15 text-black/45"}`}>Ilimitada</button>
                </div>
                {!form.unidadesIlimitadas && <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, unidades: Math.max(1, f.unidades - 1) }))}
                    disabled={form.unidades <= 1}
                    className="w-9 h-9 flex items-center justify-center rounded border transition hover:bg-black/[.04] disabled:opacity-30"
                    style={{ borderColor: "rgba(13,13,13,.15)" }}
                  >
                    <Minus size={13} className="text-black/60" />
                  </button>
                  <span className="text-[0.9375rem] font-semibold text-black/70 w-6 text-center tabular-nums">{form.unidades}</span>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, unidades: f.unidades + 1 }))}
                    className="w-9 h-9 flex items-center justify-center rounded border transition hover:bg-black/[.04]"
                    style={{ borderColor: "rgba(13,13,13,.15)" }}
                  >
                    <Plus size={13} className="text-black/60" />
                  </button>
                  <span className="text-[0.6875rem] text-black/35">unidade{form.unidades !== 1 ? "s" : ""} desta cota disponíveis para venda</span>
                </div>}
                {form.unidadesIlimitadas && <p className="text-[0.6875rem] text-black/40">Novos patrocinadores poderão adquirir esta cota sem limite de unidades.</p>}
              </div>

              <div>
                <label className="text-[0.75rem] font-semibold text-black mb-1.5 block">
                  Contrapartidas <span className="text-black/30 font-normal">(uma por linha)</span>
                </label>
                <textarea
                  value={form.contrapartidas}
                  onChange={e => setForm(f => ({ ...f, contrapartidas: e.target.value }))}
                  placeholder={"Logo em materiais\nReceivers no evento\nPost nas redes sociais"}
                  rows={4}
                  className="w-full border rounded px-3 py-2.5 text-[0.8125rem] text-black outline-none focus:border-[#7259B5] transition resize-none"
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
                {saving ? "Salvando…" : editing ? "Salvar" : "Criar cota"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
