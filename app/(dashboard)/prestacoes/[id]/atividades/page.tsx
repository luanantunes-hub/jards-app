"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, MapPin, Users, CalendarDays, ChevronDown, ChevronUp, Briefcase, HandHeart, Accessibility } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PrestacaoAtividade, PrestacaoEvidencia, PrestacaoLocal, PrestacaoMeta } from "@/lib/supabase/types";
import { EvidenciaModal } from "@/components/prestacao/objeto/EvidenciaModal";
import { GradeSemanal } from "@/components/prestacao/grade/GradeSemanal";
import { ListaEvidencias } from "@/components/prestacao/objeto/ListaEvidencias";
import { checarEvidencias } from "@/lib/prestacao/checagens/checar-evidencias";
import type { Achado } from "@/lib/prestacao/checagens";
import { Dropdown } from "@/components/ui/Dropdown";
import { rotuloDoLocal } from "@/lib/prestacao/objeto";
import { mensagemErroPrestacao } from "@/lib/prestacao/status";
import { usePrestacaoOrganizacao } from "@/hooks/usePrestacaoOrganizacao";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";

// Evidências da tabela do objeto (P3.2), ligadas à atividade.
type AtividadeComEvidencias = PrestacaoAtividade & { evidencias: PrestacaoEvidencia[] };
type LocalDaAtividade = Pick<PrestacaoLocal, "id" | "pais" | "uf" | "municipio" | "espaco" | "status" | "latitude" | "longitude">;

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

type FormState = Partial<PrestacaoAtividade> & { _new?: boolean };

const EMPTY_FORM: FormState = {
  _new: true,
  titulo: "",
  descricao: "",
  data_realizacao: "",
  data_inicio: "",
  data_fim: "",
  local: "",
  cidade: "",
  estado: "",
  publico_atingido: undefined,
  meta_prevista: undefined,
  empregos_diretos: undefined,
  empregos_indiretos: undefined,
  democratizacao_descricao: "",
  acessibilidade_descricao: "",
  status_realizacao: "realizado",
  justificativa_nao_realizacao: "",
  meta_id: null,
  local_id: null,
};

export default function AtividadesPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const organizationId = usePrestacaoOrganizacao(id);
  const { confirmDelete } = useDeleteConfirm();
  const [erro, setErro] = useState("");

  const [atividades, setAtividades] = useState<AtividadeComEvidencias[]>([]);
  const [metas, setMetas] = useState<Pick<PrestacaoMeta, "id" | "descricao">[]>([]);
  const [locais, setLocais] = useState<LocalDaAtividade[]>([]);
  const [execucao, setExecucao] = useState<{ data_inicio_execucao: string | null; data_fim_execucao: string | null }>({ data_inicio_execucao: null, data_fim_execucao: null });
  const [evidenciaAberta, setEvidenciaAberta] = useState<{ evidencia: PrestacaoEvidencia | null; atividade: AtividadeComEvidencias } | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    const { data: ats } = await (supabase as any)
      .from("prestacao_atividades")
      .select("*")
      .eq("prestacao_id", id)
      .order("data_realizacao", { ascending: true });

    const { data: evs } = await (supabase as any)
      .from("prestacao_evidencias")
      .select("*")
      .eq("prestacao_id", id)
      .not("atividade_id", "is", null)
      .order("created_at");

    const evMap: Record<string, PrestacaoEvidencia[]> = {};
    for (const e of (evs ?? []) as PrestacaoEvidencia[]) {
      if (e.atividade_id) evMap[e.atividade_id] = [...(evMap[e.atividade_id] ?? []), e];
    }

    setAtividades(
      ((ats ?? []) as PrestacaoAtividade[]).map(a => ({ ...a, evidencias: evMap[a.id] ?? [] }))
    );
    // Metas e locais do objeto (P3.1), para ligar a atividade; datas da execução para conferir as fotos.
    const [{ data: ms }, { data: ls }, { data: prest }] = await Promise.all([
      (supabase as any).from("prestacao_metas").select("id, descricao").eq("prestacao_id", id).order("ordem").order("created_at"),
      (supabase as any).from("prestacao_locais").select("id, pais, uf, municipio, espaco, status, latitude, longitude").eq("prestacao_id", id).order("ordem").order("created_at"),
      (supabase as any).from("prestacoes_contas").select("data_inicio_execucao, data_fim_execucao").eq("id", id).maybeSingle(),
    ]);
    setMetas(ms ?? []);
    setLocais(ls ?? []);
    setExecucao({ data_inicio_execucao: prest?.data_inicio_execucao ?? null, data_fim_execucao: prest?.data_fim_execucao ?? null });
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function salvar() {
    if (!form || !form.titulo?.trim() || !form.data_realizacao) return;
    setSaving(true);
    setErro("");
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao?.trim() || null,
      data_realizacao: form.data_realizacao,
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      local: form.local?.trim() || null,
      cidade: form.cidade?.trim() || null,
      estado: form.estado?.trim() || null,
      publico_atingido: form.publico_atingido ? Number(form.publico_atingido) : null,
      meta_prevista: form.meta_prevista ? Number(form.meta_prevista) : null,
      empregos_diretos: form.empregos_diretos != null ? Number(form.empregos_diretos) : null,
      empregos_indiretos: form.empregos_indiretos != null ? Number(form.empregos_indiretos) : null,
      democratizacao_descricao: form.democratizacao_descricao?.trim() || null,
      acessibilidade_descricao: form.acessibilidade_descricao?.trim() || null,
      status_realizacao: form.status_realizacao ?? "realizado",
      justificativa_nao_realizacao: form.status_realizacao === "nao_realizado"
        ? (form.justificativa_nao_realizacao?.trim() || null)
        : null,
      meta_id: form.meta_id || null,
      local_id: form.local_id || null,
    };
    // Edição não mexe na ordem nem em quem criou.
    const { error } = form._new
      ? await (supabase as any).from("prestacao_atividades").insert({
          ...payload,
          prestacao_id: id,
          ordem: atividades.length,
          criado_por: user?.id ?? null,
        })
      : await (supabase as any).from("prestacao_atividades").update(payload).eq("id", form.id);
    setSaving(false);
    if (error) {
      setErro(mensagemErroPrestacao(error, "Não foi possível salvar a atividade"));
      return;
    }
    setForm(null);
    fetchAll();
  }

  function excluir(atId: string) {
    const at = atividades.find(a => a.id === atId);
    if (!at) return;
    confirmDelete({
      title: "Excluir atividade?",
      description: at.evidencias.length > 0
        ? `"${at.titulo}" será apagada. ${at.evidencias.length === 1 ? "A evidência fica" : `As ${at.evidencias.length} evidências ficam`} na aba Objeto, sem atividade.`
        : `"${at.titulo}" será apagada.`,
      onConfirm: async () => {
        const { error } = await (supabase as any).from("prestacao_atividades").delete().eq("id", atId);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir a atividade"));
        fetchAll();
      },
    });
  }

  function excluirEvidencia(ev: PrestacaoEvidencia) {
    confirmDelete({
      title: "Excluir evidência?",
      description: `"${ev.nome_arquivo || ev.url || "Evidência"}" será apagada.`,
      onConfirm: async () => {
        const { error } = await (supabase as any).from("prestacao_evidencias").delete().eq("id", ev.id);
        if (error) throw new Error(mensagemErroPrestacao(error, "Não foi possível excluir a evidência"));
        if (ev.storage_path) await supabase.storage.from("documentos").remove([ev.storage_path]);
        fetchAll();
      },
    });
  }

  // A conferência das evidências, a mesma do motor.
  const alertasDasEvidencias = useMemo(() => {
    const achados = checarEvidencias({
      regime: null, despesas: [], fornecedores: [], documentosDosFornecedores: [], itens: [], pagamentos: [], lancamentos: [],
      prestacao: execucao, atividades, locais, evidencias: atividades.flatMap(a => a.evidencias),
    });
    const porEvidencia = new Map<string, Achado[]>();
    for (const a of achados) if (a.entidade.id) porEvidencia.set(a.entidade.id, [...(porEvidencia.get(a.entidade.id) ?? []), a]);
    return porEvidencia;
  }, [execucao, atividades, locais]);

  function vinculosDaEvidencia(e: PrestacaoEvidencia): string {
    const local = e.local_id ? locais.find(l => l.id === e.local_id) : null;
    return [e.meta_id ? metas.find(m => m.id === e.meta_id)?.descricao : null, local ? rotuloDoLocal(local) : null].filter(Boolean).join(" · ");
  }

  function toggle(atId: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(atId) ? next.delete(atId) : next.add(atId);
      return next;
    });
  }

  return (
    <div className="px-8 py-6 space-y-4">
      {/* Grade semanal (P8.6): só quando o regime pede ou já há turmas */}
      <GradeSemanal prestacaoId={id} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[0.8125rem] font-semibold text-black/50">
          {atividades.length > 0 ? `${atividades.length} atividade${atividades.length > 1 ? "s" : ""}` : "Nenhuma atividade registrada"}
        </p>
        <button
          onClick={() => setForm({ ...EMPTY_FORM, ordem: atividades.length })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[0.6875rem] font-semibold text-white transition hover:opacity-90"
          style={{ background: "#7259B5" }}
        >
          <Plus size={12} /> Nova atividade
        </button>
      </div>

      {erro && !form && (
        <p role="alert" className="px-4 py-3 rounded border text-[0.75rem]"
          style={{ background: "#fff", borderColor: "#D94E4E30", color: "#D94E4E" }}>
          {erro}
        </p>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-4 h-4 border-2 border-black/10 border-t-[#7259B5] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="relative">
          {atividades.length > 0 && (
            <div className="absolute left-[0.6875rem] top-4 bottom-4 w-px" style={{ background: "rgba(13,13,13,.08)" }} />
          )}
          <div className="space-y-3">
            {atividades.map(at => {
              const open = expanded.has(at.id);
              const pct = at.meta_prevista && at.meta_prevista > 0 && at.publico_atingido
                ? Math.round((at.publico_atingido / at.meta_prevista) * 100)
                : null;
              return (
                <div key={at.id} className="flex gap-4">
                  {/* Marcador */}
                  <div className="flex-shrink-0 mt-3.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full border border-black/[.12] bg-white">
                      <CalendarDays size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-black/40" />
                    </div>
                  </div>

                  {/* Card */}
                  <div className="flex-1 bg-white rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                    <div
                      className="flex items-start justify-between px-4 py-3 cursor-pointer hover:bg-black/[.01] transition"
                      onClick={() => toggle(at.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8125rem] font-semibold text-black">{at.titulo}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-[0.625rem] text-black/40">
                            <CalendarDays size={10} /> {fmtDate(at.data_realizacao)}
                          </span>
                          {(() => {
                            const doObjeto = at.local_id ? locais.find(l => l.id === at.local_id) : null;
                            const onde = [at.local, doObjeto ? rotuloDoLocal(doObjeto) : null, doObjeto ? null : at.cidade, doObjeto ? null : at.estado].filter(Boolean).join(", ");
                            return onde ? (
                              <span className="flex items-center gap-1 text-[0.625rem] text-black/40">
                                <MapPin size={10} /> {onde}
                              </span>
                            ) : null;
                          })()}
                          {at.meta_id && metas.find(m => m.id === at.meta_id) && (
                            <span className="text-[0.625rem] text-black/40">Meta: {metas.find(m => m.id === at.meta_id)!.descricao}</span>
                          )}
                          {at.publico_atingido !== null && (
                            <span className="flex items-center gap-1 text-[0.625rem] text-black/40">
                              <Users size={10} /> {at.publico_atingido.toLocaleString("pt-BR")} pessoas
                              {pct !== null && <span className="tabular-nums">({pct}% do previsto)</span>}
                            </span>
                          )}
                          {at.evidencias.length > 0 && (
                            <span className="text-[0.625rem] text-black/30">{at.evidencias.length} evidência{at.evidencias.length > 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); setForm({ ...at }); }}
                          className="p-1.5 rounded hover:bg-black/5 text-black/25 hover:text-black/55 transition"
                        >
                          ✎
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); excluir(at.id); }}
                          aria-label={`Excluir atividade ${at.titulo}`}
                          className="p-1.5 rounded hover:bg-black/[.04] text-black/20 hover:text-[#D94E4E] transition"
                        >
                          <Trash2 size={12} />
                        </button>
                        {open ? <ChevronUp size={13} className="text-black/30" /> : <ChevronDown size={13} className="text-black/30" />}
                      </div>
                    </div>

                    {open && (
                      <div className="border-t px-4 py-3 space-y-3" style={{ borderColor: "rgba(13,13,13,.06)", background: "#FAFAFA" }}>
                        {/* Status */}
                        {at.status_realizacao === "nao_realizado" && (
                          <div className="flex items-start gap-2 px-3 py-2 rounded text-[0.6875rem]"
                            style={{ background: "#fff", borderLeft: "2px solid #D94E4E40", color: "#D94E4E" }}>
                            <span className="font-semibold">Não realizado</span>
                            {at.justificativa_nao_realizacao && (
                              <span className="text-[#D94E4E]/70">— {at.justificativa_nao_realizacao}</span>
                            )}
                          </div>
                        )}

                        {at.descricao && (
                          <p className="text-[0.75rem] text-black/55 leading-relaxed">{at.descricao}</p>
                        )}

                        {/* Empregos */}
                        {(at.empregos_diretos != null || at.empregos_indiretos != null) && (
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1 text-[0.625rem] text-black/40">
                              <Briefcase size={10} />
                              {(at.empregos_diretos ?? 0) + (at.empregos_indiretos ?? 0)} empregos gerados
                              <span className="text-black/25">
                                ({at.empregos_diretos ?? 0} diretos · {at.empregos_indiretos ?? 0} indiretos)
                              </span>
                            </span>
                          </div>
                        )}

                        {/* Democratização */}
                        {at.democratizacao_descricao && (
                          <div>
                            <p className="flex items-center gap-1 text-[0.5625rem] font-bold uppercase tracking-wide text-black/30 mb-0.5">
                              <HandHeart size={9} /> Democratização do acesso
                            </p>
                            <p className="text-[0.6875rem] text-black/50 leading-relaxed">{at.democratizacao_descricao}</p>
                          </div>
                        )}

                        {/* Acessibilidade */}
                        {at.acessibilidade_descricao && (
                          <div>
                            <p className="flex items-center gap-1 text-[0.5625rem] font-bold uppercase tracking-wide text-black/30 mb-0.5">
                              <Accessibility size={9} /> Acessibilidade
                            </p>
                            <p className="text-[0.6875rem] text-black/50 leading-relaxed">{at.acessibilidade_descricao}</p>
                          </div>
                        )}

                        {/* Evidências (P3.2): as da tabela do objeto, com a data e o local conferidos */}
                        <div className="-mx-4 border-t" style={{ borderColor: "rgba(13,13,13,.06)" }}>
                          <div className="flex items-center justify-between px-4 pt-3">
                            <p className="text-[0.625rem] font-bold uppercase tracking-wide text-black/30">Evidências</p>
                            <button
                              type="button"
                              onClick={() => setEvidenciaAberta({ evidencia: null, atividade: at })}
                              disabled={!organizationId}
                              className="flex h-8 items-center gap-1 rounded border bg-white px-2.5 text-[0.6875rem] text-black/65 transition hover:border-black/25 hover:text-black/85 focus-visible:outline-2 focus-visible:outline-[#7259B5] disabled:opacity-40"
                              style={{ borderColor: "rgba(13,13,13,.14)" }}
                            >
                              <Plus size={11} aria-hidden /> Adicionar
                            </button>
                          </div>
                          <ListaEvidencias
                            evidencias={at.evidencias}
                            vinculos={vinculosDaEvidencia}
                            alertas={alertasDasEvidencias}
                            podeEditar
                            onEditar={ev => setEvidenciaAberta({ evidencia: ev, atividade: at })}
                            onExcluir={excluirEvidencia}
                            vazio={<p className="px-4 py-3 text-[0.6875rem] text-black/30">Nenhuma evidência. Da foto, a data e o local são lidos sozinhos.</p>}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {evidenciaAberta && (
        <EvidenciaModal
          prestacaoId={id}
          organizationId={organizationId}
          evidencia={evidenciaAberta.evidencia}
          inicial={{ atividade_id: evidenciaAberta.atividade.id, meta_id: evidenciaAberta.atividade.meta_id, local_id: evidenciaAberta.atividade.local_id }}
          atividades={atividades}
          metas={metas}
          locais={locais}
          execucao={execucao}
          onClose={() => setEvidenciaAberta(null)}
          onSaved={() => { setEvidenciaAberta(null); fetchAll(); }}
        />
      )}

      {/* Modal de criação/edição */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setForm(null); setErro(""); }}>
          <div className="bg-white rounded shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-[0.875rem] font-semibold text-black mb-4">
              {form._new ? "Nova atividade" : "Editar atividade"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Título *</label>
                <input
                  value={form.titulo ?? ""}
                  onChange={e => setForm({ ...form, titulo: e.target.value })}
                  className="w-full px-3 py-2 text-[0.8125rem] border rounded focus:outline-none"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                  placeholder="Ex: Show de abertura"
                />
              </div>
              <div>
                <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={form.descricao ?? ""}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  className="w-full px-3 py-2 text-[0.8125rem] border rounded focus:outline-none resize-none"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                  placeholder="Descreva a atividade realizada…"
                />
              </div>
              {/* Status de realização */}
              <div>
                <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Status</label>
                <div className="flex gap-2">
                  {(["realizado", "nao_realizado"] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, status_realizacao: s })}
                      className="px-3 py-1.5 rounded text-[0.6875rem] font-semibold border transition"
                      style={{
                        background: form.status_realizacao === s ? "white" : "white",
                        borderColor: form.status_realizacao === s ? (s === "realizado" ? "#2E8932" : "#D94E4E") : "rgba(13,13,13,.12)",
                        color: form.status_realizacao === s ? (s === "realizado" ? "#2E8932" : "#D94E4E") : "rgba(13,13,13,.45)",
                      }}
                    >
                      {s === "realizado" ? "Realizado" : "Não realizado"}
                    </button>
                  ))}
                </div>
              </div>

              {form.status_realizacao === "nao_realizado" && (
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Justificativa *</label>
                  <textarea
                    rows={2}
                    value={form.justificativa_nao_realizacao ?? ""}
                    onChange={e => setForm({ ...form, justificativa_nao_realizacao: e.target.value })}
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none resize-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                    placeholder="Explique o motivo da não realização…"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Data ref. *</label>
                  <input
                    type="date"
                    value={form.data_realizacao ?? ""}
                    onChange={e => setForm({ ...form, data_realizacao: e.target.value })}
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Início</label>
                  <input
                    type="date"
                    value={form.data_inicio ?? ""}
                    onChange={e => setForm({ ...form, data_inicio: e.target.value })}
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Fim</label>
                  <input
                    type="date"
                    value={form.data_fim ?? ""}
                    onChange={e => setForm({ ...form, data_fim: e.target.value })}
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Meta</span>
                  <Dropdown
                    value={form.meta_id ?? ""}
                    onChange={valor => setForm({ ...form, meta_id: valor || null })}
                    ariaLabel="Meta da atividade"
                    placeholder={metas.length ? "Escolha a meta" : "Cadastre as metas na aba Objeto"}
                    disabled={metas.length === 0}
                    options={[{ value: "", label: "Sem meta" }, ...metas.map(m => ({ value: m.id, label: m.descricao }))]}
                  />
                </div>
                <div>
                  <span className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Local de realização</span>
                  <Dropdown
                    value={form.local_id ?? ""}
                    onChange={valor => setForm({ ...form, local_id: valor || null })}
                    ariaLabel="Local de realização da atividade"
                    placeholder={locais.length ? "Escolha o local" : "Cadastre os locais na aba Objeto"}
                    disabled={locais.length === 0}
                    options={[{ value: "", label: "Sem local" }, ...locais.map(l => ({ value: l.id, label: [rotuloDoLocal(l), l.espaco].filter(Boolean).join(" · ") }))]}
                  />
                </div>
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Espaço</label>
                  <input
                    value={form.local ?? ""}
                    onChange={e => setForm({ ...form, local: e.target.value })}
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                    placeholder="Teatro, escola, praça"
                  />
                </div>
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Público previsto</label>
                  <input
                    type="number"
                    value={form.meta_prevista ?? ""}
                    onChange={e => setForm({ ...form, meta_prevista: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none tabular-nums"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                    placeholder="0"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Público atingido</label>
                  <input
                    type="number"
                    value={form.publico_atingido ?? ""}
                    onChange={e => setForm({ ...form, publico_atingido: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none tabular-nums"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                    placeholder="0"
                    min={0}
                  />
                </div>
              </div>

              {/* Empregos */}
              <div>
                <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Empregos gerados</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[0.5625rem] text-black/35 mb-1">Diretos</label>
                    <input
                      type="number"
                      value={form.empregos_diretos ?? ""}
                      onChange={e => setForm({ ...form, empregos_diretos: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none tabular-nums"
                      style={{ borderColor: "rgba(13,13,13,.12)" }}
                      placeholder="0"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-[0.5625rem] text-black/35 mb-1">Indiretos</label>
                    <input
                      type="number"
                      value={form.empregos_indiretos ?? ""}
                      onChange={e => setForm({ ...form, empregos_indiretos: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none tabular-nums"
                      style={{ borderColor: "rgba(13,13,13,.12)" }}
                      placeholder="0"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Democratização */}
              <div>
                <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Democratização do acesso</label>
                <textarea
                  rows={2}
                  value={form.democratizacao_descricao ?? ""}
                  onChange={e => setForm({ ...form, democratizacao_descricao: e.target.value })}
                  className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none resize-none"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                  placeholder="Descreva as medidas adotadas (local de fácil acesso, entrada franca, transporte, distribuição…)"
                />
              </div>

              {/* Acessibilidade */}
              <div>
                <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Acessibilidade</label>
                <textarea
                  rows={2}
                  value={form.acessibilidade_descricao ?? ""}
                  onChange={e => setForm({ ...form, acessibilidade_descricao: e.target.value })}
                  className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none resize-none"
                  style={{ borderColor: "rgba(13,13,13,.12)" }}
                  placeholder="Descreva as medidas de acessibilidade (libras, closed caption, rampas, banheiros adaptados…)"
                />
              </div>
            </div>
            {erro && (
              <p role="alert" className="mt-4 text-[0.6875rem] px-3 py-2 rounded border"
                style={{ background: "#fff", borderColor: "#D94E4E30", color: "#D94E4E" }}>
                {erro}
              </p>
            )}
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => { setForm(null); setErro(""); }} className="px-4 py-2 text-[0.75rem] text-black/35 hover:text-black/55 transition">Cancelar</button>
              <button
                onClick={salvar}
                disabled={saving || !form.titulo?.trim() || !form.data_realizacao}
                className="flex items-center gap-1.5 px-4 py-2 text-[0.75rem] font-semibold text-white rounded transition hover:opacity-90 disabled:opacity-40"
                style={{ background: "#7259B5" }}
              >
                {saving ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
