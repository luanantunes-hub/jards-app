"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, FileSpreadsheet, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { excluirPorId } from "@/lib/supabase/exclusao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import type { CotaPatrocinio, ProjetoOrcamentoItem } from "@/lib/supabase/types";
import { Select } from "@/components/ui/Select";

type Rateio = { id: string; item_id: string; cota_id: string; valor: number };
type ItemWithRateios = ProjetoOrcamentoItem & { rateios: Rateio[] };
type DraftItem = Partial<ProjetoOrcamentoItem> & { _new?: boolean };
type ImportItem = { rubrica: string; descricao: string | null; valor: number };

const fmt = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function parseMoney(value: string): number {
  const normalized = value
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  return Number.parseFloat(normalized) || 0;
}

function detectSeparator(line: string): string {
  const counts = { "\t": 0, ";": 0, ",": 0, "|": 0 };
  for (const char of line) if (char in counts) counts[char as keyof typeof counts]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function splitLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') { quoted = !quoted; continue; }
    if (char === separator && !quoted) { result.push(current.trim()); current = ""; continue; }
    current += char;
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return null;
  const separator = detectSeparator(lines[0]);
  return { headers: splitLine(lines[0], separator), rows: lines.slice(1).map(line => splitLine(line, separator)) };
}

function guessColumn(headers: string[], candidates: string[]): string {
  const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const candidate of candidates) {
    const index = headers.findIndex(header => normalize(header).includes(normalize(candidate)));
    if (index >= 0) return String(index);
  }
  return "";
}

function buildImportPreview(raw: { headers: string[]; rows: string[][] }, rubrica: string, valor: string, descricao: string): ImportItem[] {
  const rubricaIndex = Number.parseInt(rubrica, 10);
  const valorIndex = Number.parseInt(valor, 10);
  const descricaoIndex = descricao ? Number.parseInt(descricao, 10) : -1;
  if (Number.isNaN(rubricaIndex) || Number.isNaN(valorIndex)) return [];
  return raw.rows.map(columns => ({
    rubrica: (columns[rubricaIndex] ?? "").trim(),
    descricao: descricaoIndex >= 0 ? ((columns[descricaoIndex] ?? "").trim() || null) : null,
    valor: parseMoney(columns[valorIndex] ?? ""),
  })).filter(item => item.rubrica && item.valor > 0);
}

export function ProjetoOrcamentoManager({
  projetoId,
  cotas,
  onChanged,
  onTotalsChange,
  onTotalChange,
  valorTotal,
}: {
  projetoId: string;
  cotas: CotaPatrocinio[];
  onChanged?: () => void;
  onTotalsChange?: (totals: Record<string, number>) => void;
  onTotalChange?: (total: number) => void;
  valorTotal?: number;
}) {
  const supabase = createClient();
  const { confirmDelete } = useDeleteConfirm();
  const organizationId = useOrganizationId();
  const importRef = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<ItemWithRateios[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editing, setEditing] = useState<DraftItem | null>(null);
  const [cotaFilter, setCotaFilter] = useState<string | null>(null);
  const [csvRaw, setCsvRaw] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapRubrica, setMapRubrica] = useState("");
  const [mapValor, setMapValor] = useState("");
  const [mapDescricao, setMapDescricao] = useState("");
  const [preview, setPreview] = useState<ImportItem[] | null>(null);

  const fetchItems = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("projeto_orcamento_itens")
      .select("*, rateios:projeto_orcamento_rateios(id, item_id, cota_id, valor)")
      .eq("projeto_id", projetoId)
      .order("ordem", { ascending: true });
    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }
    const rows = ((data ?? []) as any[]).map(row => ({
      ...row,
      valor: Number(row.valor ?? 0),
      rateios: ((row.rateios ?? []) as any[]).map(rateio => ({ ...rateio, valor: Number(rateio.valor ?? 0) })),
    })) as ItemWithRateios[];
    setItens(rows);
    const rowTotal = rows.reduce((s, item) => s + item.valor, 0);
    onTotalChange?.(rowTotal);
    const totals: Record<string, number> = {};
    rows.forEach(item => item.rateios.forEach(rateio => { totals[rateio.cota_id] = (totals[rateio.cota_id] ?? 0) + rateio.valor; }));
    onTotalsChange?.(totals);
    setLoading(false);
  }, [onTotalChange, onTotalsChange, projetoId, supabase]);

  useEffect(() => { void fetchItems(); }, [fetchItems]); // eslint-disable-line react-hooks/set-state-in-effect

  function openNew() {
    setErro(null);
    setEditing({ _new: true, rubrica: "", descricao: "", valor: 0, ordem: itens.length, origem: "manual" });
  }

  function openEdit(item: ItemWithRateios) {
    setErro(null);
    setEditing({ ...item });
  }

  async function getOrgId() {
    if (organizationId) return organizationId;
    const { data } = await supabase.rpc("auth_org_ids");
    return (data as unknown as string[] | null)?.[0] ?? null;
  }

  async function saveItem() {
    if (!editing?.rubrica?.trim()) { setErro("Informe a rubrica do orçamento."); return; }
    const orgId = await getOrgId();
    if (!orgId) { setErro("Organização não encontrada."); return; }
    setSaving(true);
    const payload = {
      projeto_id: projetoId,
      organization_id: orgId,
      rubrica: editing.rubrica.trim(),
      descricao: editing.descricao?.trim() || null,
      valor: Math.max(0, Number(editing.valor ?? 0)),
      origem: editing.origem ?? "manual",
      ordem: editing.ordem ?? itens.length,
    };
    const result = editing._new
      ? await (supabase as any).from("projeto_orcamento_itens").insert(payload)
      : await (supabase as any).from("projeto_orcamento_itens").update(payload).eq("id", editing.id);
    setSaving(false);
    if (result.error) { setErro(result.error.message); return; }
    setEditing(null);
    await fetchItems();
    onChanged?.();
  }

  function deleteItem(item: ItemWithRateios) {
    confirmDelete({
      title: `Excluir a rubrica “${item.rubrica}”?`,
      description: "Os rateios desta rubrica entre as cotas também são removidos.",
      onConfirm: async () => {
        await excluirPorId(supabase, "projeto_orcamento_itens", item.id);
        await fetchItems();
        onChanged?.();
      },
    });
  }

  function exportCsv(cota: CotaPatrocinio & { pct: number }) {
    const q = (s: string) => '"' + s.replace(/"/g, '""') + '"';
    const pctLabel = (cota.pct * 100).toFixed(1) + '%';
    const header = [q('Rubrica'), q('Descrição'), q('Valor Total (R$)'), q(cota.nome + ' (' + pctLabel + ') (R$)')].join(',');
    const rows = itens.map(item => {
      const cotaVal = item.valor * cota.pct;
      return [q(item.rubrica), q(item.descricao ?? ''), q(item.valor.toFixed(2)), q(cotaVal.toFixed(2))].join(',');
    });
    const totalGeral = itens.reduce((s, i) => s + i.valor, 0);
    const totalCota = totalGeral * cota.pct;
    rows.push([q('Total'), q(''), q(totalGeral.toFixed(2)), q(totalCota.toFixed(2))].join(','));
    const csv = '﻿' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orcamento-' + cota.nome.toLowerCase().replace(/\s+/g, '-') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setErro("O CSV deve ter no máximo 10 MB."); return; }
    const raw = parseCsv(await file.text());
    if (!raw || raw.headers.length < 2) { setErro("Não foi possível ler o arquivo CSV."); return; }
    setErro(null);
    setMapRubrica(guessColumn(raw.headers, ["rubrica", "categoria", "item", "despesa", "nome", "descricao"]));
    setMapValor(guessColumn(raw.headers, ["valor", "total", "orcado", "orçado", "previsto", "proposto"]));
    setMapDescricao(guessColumn(raw.headers, ["detalhe", "especificacao", "especificação", "observacao", "observação"]));
    setCsvRaw(raw);
  }

  function createPreview() {
    if (!csvRaw || !mapRubrica || !mapValor) return;
    const rows = buildImportPreview(csvRaw, mapRubrica, mapValor, mapDescricao);
    if (rows.length === 0) { setErro("Nenhuma linha válida foi encontrada com essas colunas."); return; }
    setCsvRaw(null);
    setPreview(rows);
  }

  async function confirmImport() {
    if (!preview?.length) return;
    const orgId = await getOrgId();
    if (!orgId) { setErro("Organização não encontrada."); return; }
    setSaving(true);
    const rows = preview.map((item, index) => ({
      projeto_id: projetoId,
      organization_id: orgId,
      rubrica: item.rubrica,
      descricao: item.descricao,
      valor: item.valor,
      origem: "csv",
      ordem: itens.length + index,
    }));
    const { error } = await (supabase as any).from("projeto_orcamento_itens").insert(rows);
    setSaving(false);
    if (error) { setErro(error.message); return; }
    setPreview(null);
    await fetchItems();
    onChanged?.();
  }

  const total = itens.reduce((sum, item) => sum + item.valor, 0);

  // Rateio automático por percentual do valor total
  const cotaData = cotas.map(cota => {
    const pct = valorTotal && valorTotal > 0 ? cota.valor / valorTotal : 0;
    return { ...cota, pct };
  });
  const haCotaFlexivel = cotas.some(cota => cota.valor_maximo != null || cota.unidades_ilimitadas || cota.modelo === "produto");
  const activeCota = cotaFilter ? cotaData.find(c => c.id === cotaFilter) : null;

  if (loading) return <div className="h-40 animate-pulse rounded bg-black/[.03]" />;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Filtro por cota */}
        {cotas.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-black/35 font-medium uppercase tracking-wide">Visão da cota</span>
            <div className="flex items-center gap-1 rounded border bg-white" style={{ borderColor: "rgba(13,13,13,.12)" }}>
              <button
                type="button"
                onClick={() => setCotaFilter(null)}
                className={`rounded px-2.5 py-1.5 text-[11px] font-medium transition ${!cotaFilter ? "bg-black/[.07] text-black/70" : "text-black/35 hover:text-black/55"}`}
              >
                Geral
              </button>
              {cotaData.map(cota => (
                <button
                  key={cota.id}
                  type="button"
                  onClick={() => setCotaFilter(cotaFilter === cota.id ? null : cota.id)}
                  className={`rounded px-2.5 py-1.5 text-[11px] font-medium transition ${cotaFilter === cota.id ? "bg-black/[.07] text-black/70" : "text-black/35 hover:text-black/55"}`}
                >
                  {cota.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeCota && (
          <button
            type="button"
            onClick={() => exportCsv(activeCota)}
            className="flex items-center gap-1.5 rounded border bg-white px-3 py-1.5 text-[11px] font-medium text-black/60 transition hover:bg-black/[.04]"
            style={{ borderColor: "rgba(13,13,13,.14)" }}
          >
            <Upload size={11} className="rotate-180" /> Exportar CSV
          </button>
        )}

        <input ref={importRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleImportFile} />
        <button onClick={() => importRef.current?.click()} className="flex items-center gap-1.5 rounded border border-black/[.12] bg-white px-3 py-1.5 text-[11px] font-medium text-black/55 transition hover:bg-black/[.03]">
          <Upload size={11} /> Importar CSV
        </button>
        <button type="button" onClick={openNew} className="flex items-center gap-1.5 rounded border border-black/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-black/70 transition hover:bg-black/[.04] active:scale-[.98]">
          <Plus size={11} /> Adicionar item
        </button>
      </div>

      {/* Summary cards */}
      <div className="flex gap-3 overflow-x-auto pb-0.5">
        <Summary label="Rubricas" value={String(itens.length)} />
        <Summary label="Orçamento total" value={fmt(total)} />
        {activeCota ? (
          <Summary label={`${activeCota.nome} (${(activeCota.pct * 100).toFixed(1)}%)`} value={fmt(total * activeCota.pct)} color="#7259B5" />
        ) : valorTotal && valorTotal > 0 ? (
          cotaData.map(cota => (
            <Summary key={cota.id} label={`${cota.nome} (${(cota.pct * 100).toFixed(1)}%)`} value={fmt(total * cota.pct)} color="#7259B5" />
          ))
        ) : (
          <Summary label="Cadastre o orçamento total para ver a cobertura por cota" value="—" />
        )}
      </div>

      {haCotaFlexivel && <p className="text-[11px] text-black/40">O rateio por cota é uma simulação individual pelo valor de referência mínimo. Cotas por nível e por produto podem coexistir; seus valores não devem ser somados como receita projetada.</p>}

      {erro && <p className="rounded border border-[#D94E4E]/20 bg-[#D94E4E]/[.04] px-3 py-2 text-[11px] text-[#991B1B]">{erro}</p>}

      {/* Cabeçalho do filtro ativo */}
      {activeCota && (
        <div className="flex items-center justify-between rounded border px-4 py-3" style={{ borderColor: "rgba(114,89,181,.2)", background: "rgba(114,89,181,.04)" }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#7259B5]">{activeCota.nome}</p>
            <p className="mt-0.5 text-[12px] text-black/50">
              {(activeCota.pct * 100).toFixed(1)}% do projeto · <span className="font-semibold">{fmt(activeCota.valor)}</span> de referência por unidade
            </p>
          </div>
          <p className="text-[12px] font-bold tabular-nums text-[#7259B5]">{fmt(total * activeCota.pct)} nesta cota</p>
        </div>
      )}

      {itens.length === 0 ? (
        <div className="rounded border border-dashed border-black/[.12] px-6 py-12 text-center">
          <FileSpreadsheet size={24} className="mx-auto mb-3 text-black/15" />
          <p className="text-[13px] font-medium text-black/45">Nenhum item de orçamento cadastrado</p>
          <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-black/30">Adicione itens manualmente ou importe um CSV com rubrica e valor.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-black/[.08] bg-white">
          <div className="overflow-x-auto">
            <table className="w-max min-w-full text-[12px]">
              <thead className="border-b bg-black/[.02]" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-black/35">Rubrica</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-black/35">Descrição</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-black/35">Valor total</th>
                  {activeCota ? (
                    <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide" style={{ color: "#7259B5" }}>
                      {activeCota.nome} ({(activeCota.pct * 100).toFixed(1)}%)
                    </th>
                  ) : valorTotal && valorTotal > 0 && cotaData.length > 0 ? (
                    cotaData.map(cota => (
                      <th key={cota.id} className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-black/35">
                        {cota.nome} <span className="font-normal text-black/25">({(cota.pct * 100).toFixed(1)}%)</span>
                      </th>
                    ))
                  ) : null}
                  <th className="w-16 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {itens.map(item => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-black/[.015]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                    <td className="px-4 py-3 font-semibold text-black/75">{item.rubrica}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-black/40">{item.descricao || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-black/65">{fmt(item.valor)}</td>
                    {activeCota ? (
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold tabular-nums" style={{ color: "#7259B5" }}>{fmt(item.valor * activeCota.pct)}</span>
                      </td>
                    ) : valorTotal && valorTotal > 0 && cotaData.length > 0 ? (
                      cotaData.map(cota => (
                        <td key={cota.id} className="px-4 py-3 text-right tabular-nums text-black/45">
                          {fmt(item.valor * cota.pct)}
                        </td>
                      ))
                    ) : null}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button title="Editar" onClick={() => openEdit(item)} className="rounded p-1.5 text-black/25 transition hover:bg-black/5 hover:text-black/60"><Pencil size={12} /></button>
                        <button title="Excluir" aria-label={`Excluir a rubrica ${item.rubrica}`} onClick={() => deleteItem(item)} className="rounded p-1.5 text-black/20 transition hover:bg-[#D94E4E]/10 hover:text-[#D94E4E]"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-black/[.02]">
                  <td colSpan={2} className="px-4 py-3 text-[11px] font-bold text-black/45">Total</td>
                  <td className="px-4 py-3 text-right text-[12px] font-bold tabular-nums text-black/70">{fmt(total)}</td>
                  {activeCota ? (
                    <td className="px-4 py-3 text-right text-[12px] font-bold tabular-nums" style={{ color: "#7259B5" }}>{fmt(total * activeCota.pct)}</td>
                  ) : valorTotal && valorTotal > 0 && cotaData.length > 0 ? (
                    cotaData.map(cota => (
                      <td key={cota.id} className="px-4 py-3 text-right text-[11px] font-bold tabular-nums text-black/55">{fmt(total * cota.pct)}</td>
                    ))
                  ) : null}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {editing && <ItemModal editing={editing} saving={saving} onChange={setEditing} onClose={() => setEditing(null)} onSave={() => void saveItem()} />}

      {csvRaw && <CsvMappingModal raw={csvRaw} rubrica={mapRubrica} valor={mapValor} descricao={mapDescricao} onChangeRubrica={setMapRubrica} onChangeValor={setMapValor} onChangeDescricao={setMapDescricao} onClose={() => setCsvRaw(null)} onPreview={createPreview} />}

      {preview && <Modal title="Prévia da importação" onClose={() => setPreview(null)}>
        <p className="mb-4 text-[11px] text-black/40">{preview.length} itens válidos encontrados. Eles ainda não foram salvos.</p>
        <div className="max-h-[45vh] overflow-y-auto rounded border border-black/[.08]">
          {preview.map((item, index) => <div key={`${item.rubrica}-${index}`} className="flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}><div className="min-w-0"><p className="truncate text-[12px] font-semibold text-black/75">{item.rubrica}</p><p className="truncate text-[10px] text-black/35">{item.descricao || "Sem descrição"}</p></div><span className="shrink-0 text-[12px] font-semibold tabular-nums text-black/60">{fmt(item.valor)}</span></div>)}
        </div>
        <div className="mt-4 flex items-center justify-between"><span className="text-[11px] text-black/40">Total <strong className="text-black/65">{fmt(preview.reduce((sum, item) => sum + item.valor, 0))}</strong></span><div className="flex gap-3"><button onClick={() => setPreview(null)} className="px-2 py-2 text-[12px] text-black/35 hover:text-black/55">Cancelar</button><button disabled={saving} onClick={() => void confirmImport()} className="flex items-center gap-1.5 rounded bg-[#2E8932] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40">{saving ? "Importando…" : <><Check size={12} /> Importar itens</>}</button></div></div>
      </Modal>}
    </div>
  );
}

function Summary({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div className="flex-1 rounded bg-black/[.025] px-4 py-3 min-w-[140px]"><p className="text-[10px] font-medium text-black/35 truncate">{label}</p><p className="mt-1 text-[14px] font-bold tabular-nums" style={{ color: color ?? "rgba(13,13,13,.7)" }}>{value}</p></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}><div className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><h3 className="text-[14px] font-semibold text-black/80">{title}</h3><button onClick={onClose} className="rounded p-1 text-black/25 hover:bg-black/5 hover:text-black/60"><X size={15} /></button></div>{children}</div></div>;
}

function ItemModal({ editing, saving, onChange, onClose, onSave }: { editing: DraftItem; saving: boolean; onChange: (item: DraftItem) => void; onClose: () => void; onSave: () => void }) {
  return <Modal title={editing._new ? "Novo item de orçamento" : "Editar item de orçamento"} onClose={onClose}>
    <div className="space-y-3">
      <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-black/55">Rubrica *</span><input autoFocus value={editing.rubrica ?? ""} onChange={event => onChange({ ...editing, rubrica: event.target.value })} placeholder="Ex: Produção executiva" className="w-full rounded border border-black/[.12] px-3 py-2.5 text-[13px] outline-none focus:border-[#7259B5]" /></label>
      <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-black/55">Descrição</span><input value={editing.descricao ?? ""} onChange={event => onChange({ ...editing, descricao: event.target.value })} placeholder="Detalhamento opcional" className="w-full rounded border border-black/[.12] px-3 py-2.5 text-[13px] outline-none focus:border-[#7259B5]" /></label>
      <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-black/55">Valor (R$)</span><input type="number" min="0" step="0.01" value={editing.valor ?? 0} onChange={event => onChange({ ...editing, valor: Number(event.target.value) })} className="w-full rounded border border-black/[.12] px-3 py-2.5 text-[13px] tabular-nums outline-none focus:border-[#7259B5]" /></label>
    </div>
    <div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="px-2 py-2 text-[12px] text-black/35 hover:text-black/55">Cancelar</button><button type="button" disabled={saving || !editing.rubrica?.trim()} onClick={onSave} className="flex items-center gap-1.5 rounded bg-[#2E8932] px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 active:scale-[.98] disabled:opacity-40">{saving ? "Salvando…" : <><Check size={12} /> Salvar</>}</button></div>
  </Modal>;
}

function CsvMappingModal({ raw, rubrica, valor, descricao, onChangeRubrica, onChangeValor, onChangeDescricao, onClose, onPreview }: { raw: { headers: string[]; rows: string[][] }; rubrica: string; valor: string; descricao: string; onChangeRubrica: (value: string) => void; onChangeValor: (value: string) => void; onChangeDescricao: (value: string) => void; onClose: () => void; onPreview: () => void }) {
  const columns = raw.headers.map((header, index) => ({ header, index })).filter(column => column.header.trim());
  return <Modal title="Mapear colunas do CSV" onClose={onClose}>
    <p className="mb-4 text-[11px] text-black/40">{columns.length} colunas · {raw.rows.length} linhas. Confirme quais campos representam cada informação.</p>
    <div className="space-y-3">
      <MappingSelect label="Rubrica / item *" value={rubrica} options={columns} onChange={onChangeRubrica} />
      <MappingSelect label="Valor *" value={valor} options={columns} onChange={onChangeValor} />
      <MappingSelect label="Descrição" value={descricao} options={columns} onChange={onChangeDescricao} emptyLabel="Não usar" />
    </div>
    <div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="px-2 py-2 text-[12px] text-black/35 hover:text-black/55">Cancelar</button><button disabled={!rubrica || !valor} onClick={onPreview} className="rounded bg-[#2E8932] px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40">Ver prévia →</button></div>
  </Modal>;
}

function MappingSelect({ label, value, options, onChange, emptyLabel = "Selecione" }: { label: string; value: string; options: { header: string; index: number }[]; onChange: (value: string) => void; emptyLabel?: string }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-black/55">{label}</span><Select value={value} onChange={event => onChange(event.target.value)} className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[12px] outline-none focus:border-[#7259B5]"><option value="">— {emptyLabel} —</option>{options.map(option => <option key={option.index} value={String(option.index)}>{option.header}</option>)}</Select></label>;
}
