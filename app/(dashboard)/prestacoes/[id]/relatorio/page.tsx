"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PrestacaoItem, PrestacaoComprovante } from "@/lib/supabase/types";
import { executadoPorItem, executadoSemRubrica, totalExecutado } from "@/lib/prestacao/execucao";

type View = "metas" | "itens" | "sintetico" | "analitico";

const fmt = (v: number | null) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtDate = (d: string | null) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function pct(realizado: number, aprovado: number) {
  if (!aprovado) return null;
  return Math.round((realizado / aprovado) * 100);
}

function PctBar({ value, tol }: { value: number | null; tol?: number }) {
  if (value === null) return <span className="text-black/25 text-[0.625rem]">—</span>;
  const over = tol != null && value > 100 + tol;
  const warn = tol != null && value > 100;
  const color = over ? "#D94E4E" : warn ? "#B07A14" : value >= 80 ? "#2E8932" : "rgba(13,13,13,.35)";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(13,13,13,.07)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
      <span className="text-[0.625rem] font-bold tabular-nums" style={{ color }}>{value}%</span>
    </div>
  );
}

export default function RelatorioPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const [view, setView] = useState<View>("metas");
  const [itens, setItens] = useState<PrestacaoItem[]>([]);
  const [comprovantes, setComprovantes] = useState<PrestacaoComprovante[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: it }, { data: comp }] = await Promise.all([
      (supabase as any).from("prestacao_itens").select("*").eq("prestacao_id", id).order("ordem"),
      (supabase as any).from("prestacao_comprovantes").select("*").eq("prestacao_id", id).order("data_doc", { ascending: true }),
    ]);
    setItens((it as PrestacaoItem[]) ?? []);
    setComprovantes((comp as PrestacaoComprovante[]) ?? []);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { load(); }, [load]);

  // Executado = comprovantes aceitos (valor_realizado nunca foi calculado no banco).
  const aceitos = comprovantes.filter(c => c.status === "aceito");
  const executadoItem = executadoPorItem(comprovantes);
  const semRubrica = executadoSemRubrica(comprovantes);
  const aceitosSemRubrica = aceitos.filter(c => !c.item_id).length;
  const totalAprovado = itens.reduce((s, i) => s + i.valor_aprovado, 0);
  const totalRealizadoItens = itens.reduce((s, i) => s + (executadoItem.get(i.id) ?? 0), 0);
  const totalRealizado = totalExecutado(comprovantes);

  // Sintético: agrupado por rubrica
  const sintetico = itens.map(item => {
    const comps = aceitos.filter(c => c.item_id === item.id);
    return {
      item,
      qtd: comps.length,
      total: comps.reduce((s, c) => s + (c.valor_extraido ?? 0), 0),
    };
  });

  const views: { key: View; label: string }[] = [
    { key: "metas",     label: "Metas comprovadas" },
    { key: "itens",     label: "Itens comprovados" },
    { key: "sintetico", label: "Pagamentos sintético" },
    { key: "analitico", label: "Pagamentos analítico" },
  ];

  return (
    <div className="px-8 py-6">
      {/* Sub-navegação */}
      <div className="flex gap-1 mb-5 bg-white rounded border p-1" style={{ borderColor: "rgba(13,13,13,.08)", width: "fit-content" }}>
        {views.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className="px-4 py-1.5 rounded text-[0.6875rem] font-semibold transition"
            style={{
              background: view === v.key ? "#7259B5" : "transparent",
              color: view === v.key ? "white" : "rgba(13,13,13,.45)",
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-4 h-4 border-2 border-black/10 border-t-[#7259B5] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── METAS COMPROVADAS ── */}
          {view === "metas" && (
            <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <p className="text-[0.75rem] font-semibold text-black">Metas comprovadas</p>
                <p className="text-[0.625rem] text-black/35">{itens.length} rubrica{itens.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[0.75rem]">
                  <thead>
                    <tr style={{ background: "#F9F9F8" }}>
                      {["Etapa / Rubrica", "Qtde. aprovada", "Qtde. executada", "%", "Vl. aprovado", "Vl. executado", "%", "Saldo a executar"].map((h, index) => (
                        <th key={`${h}-${index}`} className="px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/30 border-b whitespace-nowrap" style={{ borderColor: "rgba(13,13,13,.07)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, i) => {
                      // Quantidades físicas só existem a partir das metas (fase 3).
                      const executado = executadoItem.get(item.id) ?? 0;
                      const pctFin = pct(executado, item.valor_aprovado);
                      const saldo = item.valor_aprovado - executado;
                      return (
                        <tr key={item.id} className="hover:bg-black/[.015] transition border-b last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-black">{i + 1} - {item.rubrica}</p>
                            {item.descricao && <p className="text-[0.625rem] text-black/35 mt-0.5">{item.descricao}</p>}
                          </td>
                          <td className="px-4 py-3 text-black/25">—</td>
                          <td className="px-4 py-3 text-black/25">—</td>
                          <td className="px-4 py-3"><PctBar value={null} /></td>
                          <td className="px-4 py-3 text-black/60 tabular-nums font-medium">{fmt(item.valor_aprovado)}</td>
                          <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: pctFin !== null && pctFin > 100 + item.tolerancia_pct ? "#D94E4E" : "#2E8932" }}>{fmt(executado)}</td>
                          <td className="px-4 py-3"><PctBar value={pctFin} tol={item.tolerancia_pct} /></td>
                          <td className="px-4 py-3 tabular-nums" style={{ color: saldo < 0 ? "#D94E4E" : "rgba(13,13,13,.50)" }}>{fmt(saldo)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F9F9F8", borderTop: "2px solid rgba(13,13,13,.08)" }}>
                      <td className="px-4 py-2.5 text-[0.6875rem] font-bold text-black/50" colSpan={4}>Total</td>
                      <td className="px-4 py-2.5 text-[0.75rem] font-bold text-black/60 tabular-nums">{fmt(totalAprovado)}</td>
                      <td className="px-4 py-2.5 text-[0.75rem] font-bold tabular-nums" style={{ color: "#2E8932" }}>{fmt(totalRealizadoItens)}</td>
                      <td className="px-4 py-2.5"><PctBar value={pct(totalRealizadoItens, totalAprovado)} /></td>
                      <td className="px-4 py-2.5 text-[0.75rem] font-bold tabular-nums text-black/50">{fmt(totalAprovado - totalRealizadoItens)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── ITENS COMPROVADOS ── */}
          {view === "itens" && (
            <div className="space-y-4">
              {itens.map((item, idx) => {
                const compsItem = aceitos.filter(c => c.item_id === item.id);
                if (compsItem.length === 0) return (
                  <div key={item.id} className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                      <p className="text-[0.75rem] font-semibold text-black">{idx + 1} - {item.rubrica}</p>
                    </div>
                    <p className="text-[0.6875rem] text-black/30 px-5 py-4">Nenhum comprovante aceito vinculado.</p>
                  </div>
                );
                return (
                  <div key={item.id} className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                      <p className="text-[0.75rem] font-semibold text-black">{idx + 1} - {item.rubrica}</p>
                      <span className="text-[0.625rem] text-black/35">{compsItem.length} item{compsItem.length !== 1 ? "s" : ""} · {fmt(compsItem.reduce((s, c) => s + (c.valor_extraido ?? 0), 0))}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[0.75rem]">
                        <thead>
                          <tr style={{ background: "#F9F9F8" }}>
                            {["Documento", "Data", "Tipo", "Valor"].map((h, index) => (
                              <th key={`${h}-${index}`} className="px-4 py-2 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/25 border-b whitespace-nowrap" style={{ borderColor: "rgba(13,13,13,.06)" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {compsItem.map(c => {
                            const val = c.valor_extraido ?? 0;
                            return (
                              <tr key={c.id} className="border-b last:border-0 hover:bg-black/[.015]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                                <td className="px-4 py-2.5">
                                  <p className="font-medium text-black/80">{c.descricao_servico || c.nome_arquivo}</p>
                                </td>
                                <td className="px-4 py-2.5 text-black/50 whitespace-nowrap tabular-nums">{fmtDate(c.data_doc)}</td>
                                <td className="px-4 py-2.5 text-[0.625rem] text-black/45">{c.tipo}</td>
                                <td className="px-4 py-2.5 font-semibold tabular-nums" style={{ color: "#2E8932" }}>{fmt(val)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── PAGAMENTOS SINTÉTICO ── */}
          {view === "sintetico" && (
            <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <p className="text-[0.75rem] font-semibold text-black">Relação de pagamentos — Sintético</p>
                <p className="text-[0.625rem] text-black/35">{aceitos.length} pagamento{aceitos.length !== 1 ? "s" : ""} aceito{aceitos.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[0.75rem]">
                  <thead>
                    <tr style={{ background: "#F9F9F8" }}>
                      {["Rubrica", "Qtde. comprovantes", "Vl. total comprovado", "Vl. aprovado", "Saldo"].map((h, index) => (
                        <th key={`${h}-${index}`} className="px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/30 border-b whitespace-nowrap" style={{ borderColor: "rgba(13,13,13,.07)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sintetico.map(({ item, qtd, total }) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-black/[.015]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-black">{item.rubrica}</p>
                          {item.descricao && <p className="text-[0.625rem] text-black/35">{item.descricao}</p>}
                        </td>
                        <td className="px-4 py-3 text-black/50 tabular-nums">{qtd}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: total > item.valor_aprovado ? "#D94E4E" : "#2E8932" }}>{fmt(total)}</td>
                        <td className="px-4 py-3 text-black/50 tabular-nums">{fmt(item.valor_aprovado)}</td>
                        <td className="px-4 py-3 tabular-nums" style={{ color: item.valor_aprovado - total < 0 ? "#D94E4E" : "rgba(13,13,13,.45)" }}>{fmt(item.valor_aprovado - total)}</td>
                      </tr>
                    ))}
                    {aceitosSemRubrica > 0 && (
                      <tr className="border-b last:border-0" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                        <td className="px-4 py-3 text-[0.6875rem] italic text-black/45">Aceitos sem rubrica</td>
                        <td className="px-4 py-3 text-black/50 tabular-nums">{aceitosSemRubrica}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: "#B07A14" }}>{fmt(semRubrica)}</td>
                        <td className="px-4 py-3 text-black/25">—</td>
                        <td className="px-4 py-3 text-black/25">—</td>
                      </tr>
                    )}
                    {aceitos.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-[0.6875rem] text-black/30">Nenhum comprovante aceito cadastrado.</td></tr>
                    )}
                  </tbody>
                  {aceitos.length > 0 && (
                    <tfoot>
                      <tr style={{ background: "#F9F9F8", borderTop: "2px solid rgba(13,13,13,.08)" }}>
                        <td className="px-4 py-2.5 text-[0.6875rem] font-bold text-black/50">Total</td>
                        <td className="px-4 py-2.5 text-[0.6875rem] font-bold text-black/50 tabular-nums">{aceitos.length}</td>
                        <td className="px-4 py-2.5 text-[0.75rem] font-bold tabular-nums" style={{ color: "#2E8932" }}>{fmt(totalRealizado)}</td>
                        <td className="px-4 py-2.5 text-[0.75rem] font-bold text-black/60 tabular-nums">{fmt(totalAprovado)}</td>
                        <td className="px-4 py-2.5 text-[0.75rem] font-bold tabular-nums text-black/50">{fmt(totalAprovado - totalRealizado)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* ── PAGAMENTOS ANALÍTICO ── */}
          {view === "analitico" && (
            <div className="bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(13,13,13,.07)" }}>
                <p className="text-[0.75rem] font-semibold text-black">Relação de pagamentos — Analítico</p>
                <p className="text-[0.625rem] text-black/35">{aceitos.length} registro{aceitos.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[0.75rem]">
                  <thead>
                    <tr style={{ background: "#F9F9F8" }}>
                      {["Data", "Rubrica", "Descrição / Documento", "Tipo", "Origem", "Valor"].map((h, index) => (
                        <th key={`${h}-${index}`} className="px-4 py-2.5 text-left text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/30 border-b whitespace-nowrap" style={{ borderColor: "rgba(13,13,13,.07)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {aceitos.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-8 text-center text-[0.6875rem] text-black/30">Nenhum comprovante aceito cadastrado.</td></tr>
                    ) : aceitos.map(c => {
                      const rubrica = itens.find(it => it.id === c.item_id);
                      return (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-black/[.015]" style={{ borderColor: "rgba(13,13,13,.05)" }}>
                          <td className="px-4 py-3 text-black/50 whitespace-nowrap tabular-nums">{fmtDate(c.data_doc)}</td>
                          <td className="px-4 py-3">
                            {rubrica
                              ? <span className="text-[0.6875rem] font-medium text-black/70">{rubrica.rubrica}</span>
                              : <span className="text-[0.625rem] text-black/25 italic">Sem rubrica</span>}
                          </td>
                          <td className="px-4 py-3 max-w-[13.75rem]">
                            <p className="font-medium text-black/80 truncate">{c.descricao_servico || c.nome_arquivo}</p>
                            {c.observacao && <p className="text-[0.625rem] text-black/35 truncate italic">{c.observacao}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[0.625rem] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                              style={{ background: "rgba(114,89,181,.10)", color: "#7259B5" }}>
                              {c.tipo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[0.625rem] text-black/40 capitalize">{c.origem}</td>
                          <td className="px-4 py-3 font-bold tabular-nums" style={{ color: "#2E8932" }}>{fmt(c.valor_extraido)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {aceitos.length > 0 && (
                    <tfoot>
                      <tr style={{ background: "#F9F9F8", borderTop: "2px solid rgba(13,13,13,.08)" }}>
                        <td colSpan={5} className="px-4 py-2.5 text-[0.6875rem] font-bold text-black/50">Total</td>
                        <td className="px-4 py-2.5 text-[0.75rem] font-bold tabular-nums" style={{ color: "#2E8932" }}>
                          {fmt(aceitos.reduce((s, c) => s + (c.valor_extraido ?? 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
