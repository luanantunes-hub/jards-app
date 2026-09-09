"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Plus, Pencil, Trash2, AlertTriangle, Check, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PrestacaoItem } from "@/lib/supabase/types";
import { Select } from "@/components/ui/Select";

type ImportItem = {
  rubrica: string;
  descricao: string | null;
  valor_aprovado: number;
  tolerancia_pct: number;
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

function pctColor(pct: number, tolerancia: number) {
  if (pct > 100 + tolerancia) return "#D94E4E";
  if (pct > 100) return "#B07A14";
  if (pct >= 80) return "#2E8932";
  return "rgba(13,13,13,.40)";
}

type EditingItem = Partial<PrestacaoItem> & { _new?: boolean };

export default function OrcamentoPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [itens, setItens] = useState<PrestacaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Importação
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [preview, setPreview] = useState<ImportItem[] | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  // Mapeamento de colunas CSV (valores são índices como string)
  const [csvRaw, setCsvRaw] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapRubrica, setMapRubrica] = useState("");
  const [mapDesc, setMapDesc] = useState("");
  const [mapValor, setMapValor] = useState("");
  const [mapTol, setMapTol] = useState("");

  const fetch = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("prestacao_itens")
      .select("*")
      .eq("prestacao_id", id)
      .order("ordem", { ascending: true });
    setItens((data as PrestacaoItem[]) ?? []);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  function novoItem() {
    setEditing({
      _new: true,
      prestacao_id: id,
      rubrica: "",
      descricao: "",
      valor_aprovado: 0,
      valor_realizado: 0,
      tolerancia_pct: 15,
      ordem: itens.length,
    });
  }

  async function salvar() {
    if (!editing || !editing.rubrica?.trim()) return;
    setSaving(true);
    if (editing._new) {
      await (supabase as any).from("prestacao_itens").insert({
        prestacao_id: id,
        rubrica: editing.rubrica,
        descricao: editing.descricao || null,
        valor_aprovado: Number(editing.valor_aprovado ?? 0),
        tolerancia_pct: Number(editing.tolerancia_pct ?? 15),
        ordem: editing.ordem ?? itens.length,
      });
    } else {
      await (supabase as any).from("prestacao_itens").update({
        rubrica: editing.rubrica,
        descricao: editing.descricao || null,
        valor_aprovado: Number(editing.valor_aprovado ?? 0),
        tolerancia_pct: Number(editing.tolerancia_pct ?? 15),
      }).eq("id", editing.id);
    }
    setEditing(null);
    setSaving(false);
    fetch();
  }

  async function excluir(itemId: string) {
    setDeletingId(itemId);
    await (supabase as any).from("prestacao_itens").delete().eq("id", itemId);
    setDeletingId(null);
    fetch();
  }

  // ─── Importação CSV ──────────────────────────────────────────────────────────
  function detectSeparator(line: string): string {
    const counts = { "\t": 0, ";": 0, ",": 0, "|": 0 };
    for (const ch of line) if (ch in counts) counts[ch as keyof typeof counts]++;
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
  }

  function splitLine(line: string, sep: string): string[] {
    // suporte básico a campos entre aspas
    const result: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === sep && !inQ) { result.push(cur.trim()); cur = ""; continue; }
      cur += c;
    }
    result.push(cur.trim());
    return result;
  }

  function parseRawCSV(text: string) {
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return null;
    const sep = detectSeparator(lines[0]);
    const headers = splitLine(lines[0], sep);
    const rows = lines.slice(1).map(l => splitLine(l, sep));
    return { headers, rows };
  }

  function guessColIdx(headers: string[], candidates: string[]): string {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const c of candidates) {
      const idx = headers.findIndex(h => norm(h).includes(norm(c)));
      if (idx >= 0) return String(idx);
    }
    return "";
  }

  function buildPreviewFromMapping(raw: { headers: string[]; rows: string[][] }, rubrica: string, valor: string, desc: string, tol: string): ImportItem[] {
    const iR = parseInt(rubrica);
    const iV = parseInt(valor);
    const iD = desc !== "" ? parseInt(desc) : -1;
    const iT = tol !== "" ? parseInt(tol) : -1;
    if (isNaN(iR) || isNaN(iV)) return [];
    return raw.rows.map(cols => {
      const rawVal = (cols[iV] ?? "").replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
      return {
        rubrica: (cols[iR] ?? "").trim(),
        descricao: iD >= 0 ? ((cols[iD] ?? "").trim() || null) : null,
        valor_aprovado: parseFloat(rawVal) || 0,
        tolerancia_pct: iT >= 0 ? parseInt(cols[iT] ?? "15") || 15 : 15,
      };
    }).filter(r => r.rubrica && r.valor_aprovado > 0);
  }

  function aplicarMapeamento() {
    if (!csvRaw || mapRubrica === "" || mapValor === "") return;
    const rows = buildPreviewFromMapping(csvRaw, mapRubrica, mapValor, mapDesc, mapTol);
    if (rows.length === 0) {
      setImportStatus("Nenhuma linha válida com essa combinação de colunas.");
      return;
    }
    setCsvRaw(null);
    setPreview(rows);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportStatus("");

    if (file.name.endsWith(".csv") || file.name.endsWith(".tsv") || file.name.endsWith(".txt")) {
      const text = await file.text();
      const raw = parseRawCSV(text);
      if (!raw || raw.headers.length < 2) {
        setImportStatus("Não foi possível ler o arquivo. Verifique se é um CSV ou TSV válido.");
        setImporting(false);
        return;
      }
      // Tenta adivinhar colunas automaticamente (retorna índice como string)
      const autoRubrica = guessColIdx(raw.headers, ["despesa", "rubrica", "categoria", "item", "nome", "descricao"]);
      const autoValor   = guessColIdx(raw.headers, ["total", "valor", "aprovado", "previsto", "orcado", "proposto"]);
      const autoDesc    = guessColIdx(raw.headers, ["justificativa", "detalhe", "especificacao", "obs"]);
      setMapRubrica(autoRubrica);
      setMapValor(autoValor);
      setMapDesc(autoDesc);
      setMapTol("");
      setCsvRaw(raw);
      setImporting(false);
    } else if (file.name.endsWith(".pdf")) {
      setImportStatus("Enviando PDF para análise…");
      const path = `orcamentos/${id}/${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("documentos").upload(path, file, { upsert: false });
      if (upErr) {
        setImportStatus("Erro ao enviar PDF.");
        setImporting(false);
        return;
      }
      setImportStatus("Analisando orçamento com IA…");
      try {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke("importar-orcamento", {
          body: { storage_path: path },
        });
        if (fnErr || !fnData?.itens?.length) {
          setImportStatus("Não foi possível extrair rubricas do PDF. Tente um CSV.");
          setImporting(false);
          return;
        }
        setPreview(fnData.itens as ImportItem[]);
      } catch {
        setImportStatus("Erro na análise. Tente um CSV.");
      }
      await supabase.storage.from("documentos").remove([path]);
      setImporting(false);
      setImportStatus("");
    } else {
      setImportStatus("Formato não suportado. Use CSV ou PDF.");
      setImporting(false);
    }
  }

  async function confirmarImport() {
    if (!preview?.length) return;
    setConfirmando(true);
    const rows = preview.map((item, i) => ({
      prestacao_id: id,
      rubrica: item.rubrica,
      descricao: item.descricao || null,
      valor_aprovado: item.valor_aprovado,
      valor_realizado: 0,
      tolerancia_pct: item.tolerancia_pct ?? 15,
      ordem: itens.length + i,
    }));
    await (supabase as any).from("prestacao_itens").insert(rows);
    setConfirmando(false);
    setPreview(null);
    fetch();
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const totalAprovado  = itens.reduce((s, i) => s + i.valor_aprovado, 0);
  const totalRealizado = itens.reduce((s, i) => s + i.valor_realizado, 0);
  const totalPct       = totalAprovado > 0 ? Math.round((totalRealizado / totalAprovado) * 100) : null;

  return (
    <div className="px-8 py-6">
      {/* Totais */}
      {itens.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Total aprovado",  value: fmt(totalAprovado),  color: undefined },
            { label: "Total realizado", value: fmt(totalRealizado), color: totalPct !== null ? pctColor(totalPct, 15) : undefined },
            { label: "% executado",     value: totalPct !== null ? `${totalPct}%` : "—", color: totalPct !== null ? pctColor(totalPct, 15) : undefined },
          ].map(c => (
            <div key={c.label} className="bg-white rounded border p-3" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-[9px] font-bold uppercase tracking-wide text-black/30 mb-1">{c.label}</p>
              <p className="text-[17px] font-bold" style={{ color: c.color ?? "#0D0D0D", fontVariantNumeric: "tabular-nums" }}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <p className="text-[12px] font-semibold text-black">Rubricas orçamentárias</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => importRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold transition border"
              style={{ borderColor: "rgba(13,13,13,.15)", color: "rgba(13,13,13,.60)" }}
            >
              {importing
                ? <><span className="w-3 h-3 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />{importStatus || "Importando…"}</>
                : <><Upload size={12} /> Importar CSV / PDF</>
              }
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".csv,.pdf"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              onClick={novoItem}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold text-white transition hover:opacity-90"
              style={{ background: "#7259B5" }}
            >
              <Plus size={12} /> Adicionar rubrica
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-4 h-4 border-2 border-black/10 border-t-[#7259B5] rounded-full animate-spin" />
          </div>
        ) : itens.length === 0 && !editing ? (
          <div className="text-center py-10">
            <p className="text-[12px] text-black/30">Nenhuma rubrica cadastrada.</p>
            <p className="text-[11px] text-black/20 mt-1">Adicione as linhas do orçamento aprovado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F9F9F8" }}>
                  {["Rubrica", "Aprovado", "Realizado", "% exec.", "Tolerância", ""].map(col => (
                    <th key={col} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-black/30 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map((item, i) => {
                  const pct = item.valor_aprovado > 0 ? Math.round((item.valor_realizado / item.valor_aprovado) * 100) : null;
                  const cor = pct !== null ? pctColor(pct, item.tolerancia_pct) : "rgba(13,13,13,.35)";
                  const excedido = pct !== null && pct > 100 + item.tolerancia_pct;
                  return (
                    <tr key={item.id} className="hover:bg-black/[.02] transition" style={{ borderBottom: i < itens.length - 1 ? "1px solid rgba(13,13,13,.05)" : undefined }}>
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-semibold text-black">{item.rubrica}</p>
                        {item.descricao && <p className="text-[10px] text-black/35 mt-0.5">{item.descricao}</p>}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-black/60 font-medium tabular-nums">{fmt(item.valor_aprovado)}</td>
                      <td className="px-4 py-3 text-[12px] font-semibold tabular-nums" style={{ color: cor }}>{fmt(item.valor_realizado)}</td>
                      <td className="px-4 py-3">
                        {pct !== null ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(13,13,13,.07)" }}>
                              <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: cor }} />
                            </div>
                            <span className="text-[10px] font-bold tabular-nums" style={{ color: cor }}>{pct}%</span>
                            {excedido && <AlertTriangle size={10} style={{ color: "#D94E4E" }} />}
                          </div>
                        ) : <span className="text-[10px] text-black/25">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-black/35">{item.tolerancia_pct}%</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditing(item)} className="p-1.5 rounded hover:bg-black/5 transition text-black/30 hover:text-black/60">
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => excluir(item.id)}
                            disabled={deletingId === item.id}
                            className="p-1.5 rounded hover:bg-[#D94E4E]/10 transition text-black/20 hover:text-[#D94E4E]"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Linha de totais */}
                {itens.length > 0 && (
                  <tr style={{ background: "#F9F9F8", borderTop: "2px solid rgba(13,13,13,.08)" }}>
                    <td className="px-4 py-2.5 text-[11px] font-bold text-black/50">Total</td>
                    <td className="px-4 py-2.5 text-[12px] font-bold text-black/60 tabular-nums">{fmt(totalAprovado)}</td>
                    <td className="px-4 py-2.5 text-[12px] font-bold tabular-nums" style={{ color: totalPct !== null ? pctColor(totalPct, 15) : "rgba(13,13,13,.4)" }}>{fmt(totalRealizado)}</td>
                    <td className="px-4 py-2.5 text-[11px] font-bold tabular-nums" style={{ color: totalPct !== null ? pctColor(totalPct, 15) : "rgba(13,13,13,.35)" }}>{totalPct !== null ? `${totalPct}%` : "—"}</td>
                    <td colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form inline de edição */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditing(null)}>
          <div className="bg-white rounded shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-[14px] font-semibold text-black mb-4">{editing._new ? "Nova rubrica" : "Editar rubrica"}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-black/40 mb-1">Rubrica *</label>
                <input
                  value={editing.rubrica ?? ""}
                  onChange={e => setEditing({ ...editing, rubrica: e.target.value })}
                  className="w-full px-3 py-2 text-[13px] border rounded focus:outline-none"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                  placeholder="Ex: Cachê artístico"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-black/40 mb-1">Descrição</label>
                <input
                  value={editing.descricao ?? ""}
                  onChange={e => setEditing({ ...editing, descricao: e.target.value })}
                  className="w-full px-3 py-2 text-[13px] border rounded focus:outline-none"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                  placeholder="Detalhamento opcional"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-black/40 mb-1">Aprovado (R$)</label>
                  <input
                    type="number"
                    value={editing.valor_aprovado ?? 0}
                    onChange={e => setEditing({ ...editing, valor_aprovado: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-[12px] border rounded focus:outline-none tabular-nums"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-black/40 mb-1">Tolerância %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editing.tolerancia_pct ?? 15}
                    onChange={e => setEditing({ ...editing, tolerancia_pct: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-[12px] border rounded focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-black/35 -mt-1">O valor realizado é calculado automaticamente pelos comprovantes aceitos vinculados a esta rubrica.</p>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-[12px] text-black/35 hover:text-black/55 transition">Cancelar</button>
              <button
                onClick={salvar}
                disabled={saving || !editing.rubrica?.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white rounded transition hover:opacity-90 disabled:opacity-40"
                style={{ background: "#7259B5" }}
              >
                {saving ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={12} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de erro de importação */}
      {importStatus && !importing && (
        <p className="mt-3 text-[11px] px-3 py-2 rounded border"
          style={{ background: "#D94E4E08", borderColor: "#D94E4E30", color: "#D94E4E" }}>
          {importStatus}
        </p>
      )}

      {/* Modal de mapeamento de colunas */}
      {csvRaw && (() => {
        const namedCols = csvRaw.headers
          .map((h, i) => ({ h, i }))
          .filter(({ h }) => h.trim() !== "");
        const previewCols = [
          { idx: mapRubrica !== "" ? parseInt(mapRubrica) : -1, label: "Rubrica" },
          { idx: mapValor !== "" ? parseInt(mapValor) : -1, label: "Valor" },
          { idx: mapDesc !== "" ? parseInt(mapDesc) : -1, label: "Descrição" },
        ].filter(c => c.idx >= 0);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(13,13,13,.40)" }}>
            <div className="bg-white rounded w-full max-w-lg" style={{ boxShadow: "0 8px 32px rgba(13,13,13,.15)" }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <p className="text-[13px] font-bold text-black/80">Mapear colunas do arquivo</p>
                <p className="text-[11px] text-black/40 mt-0.5">
                  {namedCols.length} colunas identificadas · {csvRaw.rows.length} linhas
                </p>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">Rubrica / Despesa *</label>
                    <Select value={mapRubrica} onChange={e => setMapRubrica(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-[12px] focus:outline-none bg-white"
                      style={{ borderColor: "rgba(13,13,13,.12)" }}>
                      <option value="">— selecione —</option>
                      {namedCols.map(({ h, i }) => <option key={i} value={String(i)}>{h}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">Valor aprovado *</label>
                    <Select value={mapValor} onChange={e => setMapValor(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-[12px] focus:outline-none bg-white"
                      style={{ borderColor: "rgba(13,13,13,.12)" }}>
                      <option value="">— selecione —</option>
                      {namedCols.map(({ h, i }) => <option key={i} value={String(i)}>{h}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">Descrição / Justificativa</label>
                    <Select value={mapDesc} onChange={e => setMapDesc(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-[12px] focus:outline-none bg-white"
                      style={{ borderColor: "rgba(13,13,13,.12)" }}>
                      <option value="">— não usar —</option>
                      {namedCols.map(({ h, i }) => <option key={i} value={String(i)}>{h}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-black/40 mb-1.5 block">Tolerância (%)</label>
                    <Select value={mapTol} onChange={e => setMapTol(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-[12px] focus:outline-none bg-white"
                      style={{ borderColor: "rgba(13,13,13,.12)" }}>
                      <option value="">— não usar —</option>
                      {namedCols.map(({ h, i }) => <option key={i} value={String(i)}>{h}</option>)}
                    </Select>
                  </div>
                </div>
                {/* Prévia das primeiras linhas com colunas mapeadas */}
                {previewCols.length > 0 && csvRaw.rows.length > 0 && (
                  <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-black/30 px-3 py-2 border-b" style={{ borderColor: "rgba(13,13,13,.06)", background: "rgba(13,13,13,.02)" }}>
                      Prévia ({Math.min(3, csvRaw.rows.length)} primeiras linhas)
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr style={{ background: "rgba(13,13,13,.02)" }}>
                            {previewCols.map(c => (
                              <th key={c.idx} className="px-3 py-1.5 text-left text-[9px] font-bold uppercase tracking-wide text-black/30 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>{c.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvRaw.rows.slice(0, 3).map((row, ri) => (
                            <tr key={ri} className="border-b last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                              {previewCols.map(c => (
                                <td key={c.idx} className="px-3 py-1.5 text-black/60 max-w-[160px] truncate">{row[c.idx] || "—"}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-5 py-4 border-t flex items-center justify-end gap-4"
                style={{ borderColor: "rgba(13,13,13,.08)" }}>
                <button
                  onClick={() => { setCsvRaw(null); setImportStatus(""); }}
                  className="text-[12px] font-medium transition"
                  style={{ color: "rgba(13,13,13,.35)" }}
                  onMouseOver={e => (e.currentTarget.style.color = "rgba(13,13,13,.55)")}
                  onMouseOut={e => (e.currentTarget.style.color = "rgba(13,13,13,.35)")}
                >
                  Cancelar
                </button>
                <button
                  onClick={aplicarMapeamento}
                  disabled={mapRubrica === "" || mapValor === ""}
                  className="px-4 py-2 rounded text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: "#7259B5" }}
                >
                  Ver prévia →
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de preview da importação */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13,13,13,.40)" }}>
          <div className="bg-white rounded w-full max-w-2xl max-h-[80vh] flex flex-col"
            style={{ boxShadow: "0 8px 32px rgba(13,13,13,.15)" }}>
            <div className="px-5 py-4 border-b flex items-center justify-between"
              style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div>
                <p className="text-[13px] font-bold text-black/80">Pré-visualização da importação</p>
                <p className="text-[11px] text-black/40 mt-0.5">{preview.length} rubrica{preview.length > 1 ? "s" : ""} encontrada{preview.length > 1 ? "s" : ""}</p>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                    {["Rubrica", "Descrição", "Valor aprovado", "Tolerância"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-black/30">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((item, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-black/[.015]"
                      style={{ borderColor: "rgba(13,13,13,.05)" }}>
                      <td className="px-4 py-2.5 font-medium text-black/80">{item.rubrica}</td>
                      <td className="px-4 py-2.5 text-black/50 max-w-[200px] truncate">{item.descricao || "—"}</td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums text-black/80">
                        {fmt(item.valor_aprovado)}
                      </td>
                      <td className="px-4 py-2.5 text-black/45">{item.tolerancia_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 border-t flex items-center justify-between"
              style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <p className="text-[11px] text-black/40">
                Total: <strong>{fmt(preview.reduce((s, r) => s + r.valor_aprovado, 0))}</strong>
              </p>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setPreview(null)}
                  className="text-[12px] font-medium transition"
                  style={{ color: "rgba(13,13,13,.35)" }}
                  onMouseOver={e => (e.currentTarget.style.color = "rgba(13,13,13,.55)")}
                  onMouseOut={e => (e.currentTarget.style.color = "rgba(13,13,13,.35)")}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarImport}
                  disabled={confirmando}
                  className="flex items-center gap-1.5 px-4 py-2 rounded text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "#7259B5" }}
                >
                  {confirmando
                    ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importando…</>
                    : <><Check size={12} /> Confirmar importação</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
