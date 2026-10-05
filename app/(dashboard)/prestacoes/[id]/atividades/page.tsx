"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { Plus, Upload, Image, Trash2, X, MapPin, Users, CalendarDays, ChevronDown, ChevronUp, Briefcase, HandHeart, Accessibility } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PrestacaoAtividade, PrestacaoAtividadeEvidencia } from "@/lib/supabase/types";
import { usePrestacaoOrganizacao } from "@/hooks/usePrestacaoOrganizacao";
import { montarCaminhoPrestacao } from "@/lib/prestacao/armazenamento";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";

type AtividadeComEvidencias = PrestacaoAtividade & { evidencias: PrestacaoAtividadeEvidencia[] };

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
};

export default function AtividadesPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const organizationId = usePrestacaoOrganizacao(id);
  const { confirmDelete } = useDeleteConfirm();
  const [erro, setErro] = useState("");

  const [atividades, setAtividades] = useState<AtividadeComEvidencias[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const { data: ats } = await (supabase as any)
      .from("prestacao_atividades")
      .select("*")
      .eq("prestacao_id", id)
      .order("data_realizacao", { ascending: true });

    const { data: evs } = await (supabase as any)
      .from("prestacao_atividade_evidencias")
      .select("*")
      .in("atividade_id", (ats ?? []).map((a: PrestacaoAtividade) => a.id));

    const evMap: Record<string, PrestacaoAtividadeEvidencia[]> = {};
    for (const e of (evs ?? []) as PrestacaoAtividadeEvidencia[]) {
      evMap[e.atividade_id] = [...(evMap[e.atividade_id] ?? []), e];
    }

    setAtividades(
      ((ats ?? []) as PrestacaoAtividade[]).map(a => ({ ...a, evidencias: evMap[a.id] ?? [] }))
    );
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
      setErro(`Não foi possível salvar a atividade: ${error.message}`);
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
        ? `"${at.titulo}" e ${at.evidencias.length} evidência${at.evidencias.length > 1 ? "s" : ""} serão apagadas.`
        : `"${at.titulo}" será apagada.`,
      onConfirm: async () => {
        const { error } = await (supabase as any).from("prestacao_atividades").delete().eq("id", atId);
        if (error) throw new Error(error.message);
        const caminhos = at.evidencias.map(ev => ev.storage_path);
        if (caminhos.length > 0) await supabase.storage.from("documentos").remove(caminhos);
        fetchAll();
      },
    });
  }

  async function uploadEvidencia(atId: string, file: File) {
    if (!organizationId) return;
    setUploadingFor(atId);
    const path = montarCaminhoPrestacao({
      organizationId,
      prestacaoId: id,
      pasta: { tipo: "atividade", atividadeId: atId },
      nomeOriginal: file.name,
    });
    setErro("");
    const { error } = await supabase.storage.from("documentos").upload(path, file, { upsert: false });
    if (error) {
      setErro(`Não foi possível enviar a evidência: ${error.message}`);
      setUploadingFor(null);
      return;
    }
    const { error: linhaErro } = await (supabase as any).from("prestacao_atividade_evidencias").insert({
      atividade_id: atId,
      nome_arquivo: file.name,
      storage_path: path,
      tipo: file.type.startsWith("video") ? "video" : "foto",
    });
    if (linhaErro) {
      await supabase.storage.from("documentos").remove([path]);
      setErro(`Não foi possível registrar a evidência: ${linhaErro.message}`);
    }
    fetchAll();
    setUploadingFor(null);
  }

  function excluirEvidencia(ev: PrestacaoAtividadeEvidencia) {
    confirmDelete({
      title: "Excluir evidência?",
      description: `"${ev.nome_arquivo}" será apagada.`,
      onConfirm: async () => {
        const { error } = await (supabase as any).from("prestacao_atividade_evidencias").delete().eq("id", ev.id);
        if (error) throw new Error(error.message);
        await supabase.storage.from("documentos").remove([ev.storage_path]);
        fetchAll();
      },
    });
  }

  async function getImgUrl(path: string) {
    setErro("");
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else setErro(`Não foi possível abrir o arquivo${error ? `: ${error.message}` : ""}.`);
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
                  {/* Dot */}
                  <div className="flex-shrink-0 mt-3.5">
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      style={{ borderColor: "#7259B5", background: "white" }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: "#7259B5" }} />
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
                          {(at.cidade || at.local) && (
                            <span className="flex items-center gap-1 text-[0.625rem] text-black/40">
                              <MapPin size={10} /> {[at.local, at.cidade, at.estado].filter(Boolean).join(", ")}
                            </span>
                          )}
                          {at.publico_atingido !== null && (
                            <span className="flex items-center gap-1 text-[0.625rem] text-black/40">
                              <Users size={10} /> {at.publico_atingido.toLocaleString("pt-BR")} pessoas
                              {pct !== null && <span style={{ color: pct >= 100 ? "#2E8932" : pct >= 70 ? "#B07A14" : "rgba(13,13,13,.35)" }}>({pct}% da meta)</span>}
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

                        {/* Evidências */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[0.625rem] font-bold uppercase tracking-wide text-black/30">Evidências</p>
                            <label className="flex items-center gap-1 px-2.5 py-1 rounded text-[0.625rem] font-semibold cursor-pointer transition hover:opacity-80"
                              style={{ background: "#fff", border: "1px solid #7259B547", color: "#7259B5" }}>
                              {uploadingFor === at.id
                                ? <span className="w-3 h-3 border-2 border-[#7259B5]/30 border-t-[#7259B5] rounded-full animate-spin" />
                                : <><Upload size={10} /> Adicionar</>}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*,video/*"
                                disabled={!organizationId || uploadingFor === at.id}
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadEvidencia(at.id, f);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                          {at.evidencias.length === 0 ? (
                            <p className="text-[0.6875rem] text-black/25">Nenhuma evidência adicionada.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {at.evidencias.map(ev => (
                                <div key={ev.id} className="relative group">
                                  <button
                                    onClick={() => getImgUrl(ev.storage_path)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[0.625rem] text-black/50 hover:text-[#7259B5] transition"
                                    style={{ borderColor: "rgba(13,13,13,.10)" }}
                                  >
                                    <Image size={11} /> {ev.nome_arquivo}
                                  </button>
                                  <button
                                    onClick={() => excluirEvidencia(ev)}
                                    aria-label={`Excluir evidência ${ev.nome_arquivo}`}
                                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#D94E4E] text-white hidden group-hover:flex items-center justify-center"
                                  >
                                    <X size={8} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
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
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Local</label>
                  <input
                    value={form.local ?? ""}
                    onChange={e => setForm({ ...form, local: e.target.value })}
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                    placeholder="Nome do local"
                  />
                </div>
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Cidade</label>
                  <input
                    value={form.cidade ?? ""}
                    onChange={e => setForm({ ...form, cidade: e.target.value })}
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                    placeholder="São Paulo"
                  />
                </div>
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">UF</label>
                  <input
                    value={form.estado ?? ""}
                    onChange={e => setForm({ ...form, estado: e.target.value.toUpperCase().slice(0, 2) })}
                    className="w-full px-3 py-2 text-[0.75rem] border rounded focus:outline-none uppercase"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block text-[0.625rem] font-bold uppercase tracking-wide text-black/40 mb-1">Meta (pessoas)</label>
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
