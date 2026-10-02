"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, Check, AlertCircle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CompanyLogo } from "@/components/CompanyLogo";
import type { Responsavel, Edital } from "@/lib/supabase/types";

type Empresa = {
  id: string;
  nome: string;
  setor: string | null;
  cidade: string | null;
  estado: string | null;
  site: string | null;
  email_geral: string | null;
  telefone: string | null;
  logo_url: string | null;
  descricao: string | null;
  trimestre_1: boolean | null;
  trimestre_2: boolean | null;
  trimestre_3: boolean | null;
  trimestre_4: boolean | null;
  aporte_estimado: number | null;
  tem_detalhe: boolean | null;
};

const cellCls = "w-full min-w-[7.5rem] rounded bg-transparent px-2 py-1.5 text-sm outline-none transition focus:bg-white focus:ring-1 focus:ring-[#7259B5]/30";
const theadCls = "px-2 py-2 text-left text-[0.625rem] font-semibold uppercase tracking-wide text-black/35";

function ResponsavelRow({ responsavel, onSave, onDelete }: {
  responsavel: Responsavel;
  onSave: (id: string, patch: Partial<Pick<Responsavel, "nome" | "cargo" | "email" | "linkedin_url">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(responsavel);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function commit() {
    if (
      draft.nome === responsavel.nome && draft.cargo === responsavel.cargo &&
      draft.email === responsavel.email && draft.linkedin_url === responsavel.linkedin_url
    ) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(responsavel.id, { nome: draft.nome, cargo: draft.cargo, email: draft.email, linkedin_url: draft.linkedin_url });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Remover ${responsavel.nome} da lista de responsáveis? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(responsavel.id);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao remover");
      setDeleting(false);
    }
  }

  return (
    <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
      <td><input className={cellCls} value={draft.nome} onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))} onBlur={commit} /></td>
      <td><input className={cellCls} value={draft.cargo ?? ""} onChange={(e) => setDraft((d) => ({ ...d, cargo: e.target.value }))} onBlur={commit} /></td>
      <td><input className={cellCls} value={draft.email ?? ""} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} onBlur={commit} /></td>
      <td><input className={cellCls} value={draft.linkedin_url ?? ""} onChange={(e) => setDraft((d) => ({ ...d, linkedin_url: e.target.value }))} onBlur={commit} /></td>
      <td className="w-16 whitespace-nowrap px-2 text-right">
        {error ? <span title={error}><AlertCircle size={14} className="inline text-red-500" /></span>
          : saving ? <span className="text-[0.625rem] text-black/30">salvando…</span>
          : saved ? <Check size={14} className="inline text-[#2E8932]" /> : null}
        <button onClick={remove} disabled={deleting} className="ml-2 align-middle text-black/25 transition hover:text-red-500 disabled:opacity-40">
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

function EditalRow({ edital, onSave }: {
  edital: Edital;
  onSave: (id: string, patch: Partial<Pick<Edital, "titulo" | "data_abertura" | "data_fechamento" | "url_acesso">>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(edital);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    if (
      draft.titulo === edital.titulo && draft.data_abertura === edital.data_abertura &&
      draft.data_fechamento === edital.data_fechamento && draft.url_acesso === edital.url_acesso
    ) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(edital.id, { titulo: draft.titulo, data_abertura: draft.data_abertura, data_fechamento: draft.data_fechamento, url_acesso: draft.url_acesso });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
      <td><input className={cellCls} value={draft.titulo ?? ""} onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))} onBlur={commit} /></td>
      <td><input type="date" className={cellCls} value={draft.data_abertura ?? ""} onChange={(e) => setDraft((d) => ({ ...d, data_abertura: e.target.value || null }))} onBlur={commit} /></td>
      <td><input type="date" className={cellCls} value={draft.data_fechamento ?? ""} onChange={(e) => setDraft((d) => ({ ...d, data_fechamento: e.target.value || null }))} onBlur={commit} /></td>
      <td><input className={cellCls} value={draft.url_acesso ?? ""} onChange={(e) => setDraft((d) => ({ ...d, url_acesso: e.target.value }))} onBlur={commit} placeholder="https://..." /></td>
      <td className="w-10 whitespace-nowrap px-2 text-right">
        {error ? <span title={error}><AlertCircle size={14} className="inline text-red-500" /></span>
          : saving ? <span className="text-[0.625rem] text-black/30">salvando…</span>
          : saved ? <Check size={14} className="inline text-[#2E8932]" /> : null}
      </td>
    </tr>
  );
}

function NovoEditalRow({ empresaId, onCriado }: { empresaId: string; onCriado: (edital: Edital) => void }) {
  const [draft, setDraft] = useState({ titulo: "", data_abertura: "", data_fechamento: "", url_acesso: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const criadoRef = useRef(false);

  async function commit() {
    if (criadoRef.current) return;
    if (!draft.titulo && !draft.data_abertura && !draft.data_fechamento && !draft.url_acesso) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/patrocinadores/${empresaId}/editais`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: draft.titulo || null,
          data_abertura: draft.data_abertura || null,
          data_fechamento: draft.data_fechamento || null,
          url_acesso: draft.url_acesso || null,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Não foi possível criar");
      criadoRef.current = true;
      onCriado(result.edital as Edital);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao criar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
      <td><input className={cellCls} value={draft.titulo} onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))} onBlur={commit} placeholder="Nome do edital…" /></td>
      <td><input type="date" className={cellCls} value={draft.data_abertura} onChange={(e) => setDraft((d) => ({ ...d, data_abertura: e.target.value }))} onBlur={commit} /></td>
      <td><input type="date" className={cellCls} value={draft.data_fechamento} onChange={(e) => setDraft((d) => ({ ...d, data_fechamento: e.target.value }))} onBlur={commit} /></td>
      <td><input className={cellCls} value={draft.url_acesso} onChange={(e) => setDraft((d) => ({ ...d, url_acesso: e.target.value }))} onBlur={commit} placeholder="https://..." /></td>
      <td className="w-10 whitespace-nowrap px-2 text-right">
        {error ? <span title={error}><AlertCircle size={14} className="inline text-red-500" /></span>
          : saving ? <span className="text-[0.625rem] text-black/30">salvando…</span> : null}
      </td>
    </tr>
  );
}

export default function AdminPatrocinadorPage() {
  const router        = useRouter();
  const { id }        = useParams<{ id: string }>();
  const supabase      = createClient();

  const [form, setForm]       = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [editais, setEditais] = useState<Edital[]>([]);

  useEffect(() => {
    async function load() {
      const [{ data }, { data: resp }, { data: eds }] = await Promise.all([
        (supabase as any).from("empresas").select("*").eq("id", id).single(),
        (supabase as any).from("responsaveis").select("*").eq("empresa_id", id).order("ordem", { ascending: true }),
        (supabase as any).from("editais").select("*").eq("empresa_id", id).order("data_abertura", { ascending: false }),
      ]);
      if (data) setForm(data as Empresa);
      setResponsaveis((resp ?? []) as Responsavel[]);
      setEditais((eds ?? []) as Edital[]);
      setLoading(false);
    }
    load();
  }, [id]);

  async function salvarResponsavel(responsavelId: string, patch: Partial<Pick<Responsavel, "nome" | "cargo" | "email" | "linkedin_url">>) {
    const response = await fetch(`/api/admin/patrocinadores/${id}/responsaveis/${responsavelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar");
    setResponsaveis((prev) => prev.map((r) => (r.id === responsavelId ? { ...r, ...patch } : r)));
  }

  async function removerResponsavel(responsavelId: string) {
    const response = await fetch(`/api/admin/patrocinadores/${id}/responsaveis/${responsavelId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Não foi possível remover");
    setResponsaveis((prev) => prev.filter((r) => r.id !== responsavelId));
  }

  async function salvarEdital(editalId: string, patch: Partial<Pick<Edital, "titulo" | "data_abertura" | "data_fechamento" | "url_acesso">>) {
    const response = await fetch(`/api/admin/editais/${editalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar");
    setEditais((prev) => prev.map((e) => (e.id === editalId ? { ...e, ...patch } : e)));
  }

  function set<K extends keyof Empresa>(key: K, value: Empresa[K]) {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError(null);
    const response = await fetch(`/api/admin/patrocinadores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: form.nome,
        setor: form.setor,
        cidade: form.cidade,
        estado: form.estado,
        site: form.site,
        email_geral: form.email_geral,
        telefone: form.telefone,
        logo_url: form.logo_url,
        descricao: form.descricao,
        trimestre_1: form.trimestre_1,
        trimestre_2: form.trimestre_2,
        trimestre_3: form.trimestre_3,
        trimestre_4: form.trimestre_4,
        aporte_estimado: form.aporte_estimado,
        tem_detalhe: form.tem_detalhe,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) setError(result.error ?? "Não foi possível salvar o patrocinador");
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  const inputCls = "w-full px-3 py-2 rounded text-sm outline-none bg-white placeholder:text-black/25 focus:ring-1 focus:ring-[#7259B5]/30";
  const inputStyle = { border: "1px solid rgba(13,13,13,.10)" };

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 rounded-full border-2 border-[#7259B5] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => router.push("/admin/patrocinadores")}
          className="flex items-center gap-1.5 text-sm text-black/40 hover:text-[#0D0D0D] transition"
        >
          <ChevronLeft size={16} /> Patrocinadores
        </button>
        <div className="flex items-center gap-3">
          {error && <span className="flex items-center gap-1 text-xs text-red-500"><AlertCircle size={12} />{error}</span>}
          {saved && <span className="flex items-center gap-1 text-xs text-[#2E8932]"><Check size={12} />Salvo</span>}
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-1.5 rounded text-sm font-semibold transition"
            style={{ color: "#7259B5", border: "1px solid rgba(114,89,181,.25)", background: "white" }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <CompanyLogo nome={form.nome} logo_url={form.logo_url} size={48} />
        <div>
          <h1 className="text-xl font-bold text-[#0D0D0D]">{form.nome}</h1>
          <p className="text-sm text-black/40">{form.setor ?? "Sem setor"}</p>
        </div>
      </div>

      {/* Form grid */}
      <div className="space-y-6">

        {/* Identidade */}
        <section>
          <p className="text-[0.6875rem] font-bold tracking-[.08em] uppercase text-black/30 mb-3">Identidade</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-black/50 mb-1">Nome</label>
              <input className={inputCls} style={inputStyle} value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-black/50 mb-1">Setor</label>
              <input className={inputCls} style={inputStyle} value={form.setor ?? ""} onChange={(e) => set("setor", e.target.value)} placeholder="Ex: Tecnologia" />
            </div>
            <div>
              <label className="block text-xs font-medium text-black/50 mb-1">Logo URL</label>
              <input className={inputCls} style={inputStyle} value={form.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://..." />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-black/50 mb-1">Descrição</label>
              <textarea
                className={`${inputCls} resize-none`}
                style={inputStyle}
                rows={3}
                value={form.descricao ?? ""}
                onChange={(e) => set("descricao", e.target.value)}
                placeholder="Sobre a empresa…"
              />
            </div>
          </div>
        </section>

        {/* Localização e contato */}
        <section>
          <p className="text-[0.6875rem] font-bold tracking-[.08em] uppercase text-black/30 mb-3">Contato</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-black/50 mb-1">Cidade</label>
              <input className={inputCls} style={inputStyle} value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-black/50 mb-1">Estado (UF)</label>
              <input className={inputCls} style={inputStyle} value={form.estado ?? ""} maxLength={2} onChange={(e) => set("estado", e.target.value.toUpperCase())} placeholder="SP" />
            </div>
            <div>
              <label className="block text-xs font-medium text-black/50 mb-1">Site</label>
              <input className={inputCls} style={inputStyle} value={form.site ?? ""} onChange={(e) => set("site", e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-black/50 mb-1">E-mail geral</label>
              <input className={inputCls} style={inputStyle} value={form.email_geral ?? ""} onChange={(e) => set("email_geral", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-black/50 mb-1">Telefone</label>
              <input className={inputCls} style={inputStyle} value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} />
            </div>
          </div>
        </section>

        {/* Investimento */}
        <section>
          <p className="text-[0.6875rem] font-bold tracking-[.08em] uppercase text-black/30 mb-3">Investimento</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-black/50 mb-1">Aporte estimado (R$)</label>
              <input
                className={inputCls}
                style={inputStyle}
                type="number"
                value={form.aporte_estimado ?? ""}
                onChange={(e) => set("aporte_estimado", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>
          <div className="flex gap-4 mt-3">
            {([1, 2, 3, 4] as const).map((q) => {
              const key = `trimestre_${q}` as keyof Empresa;
              return (
                <label key={q} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!(form[key])}
                    onChange={(e) => set(key, e.target.checked as any)}
                    className="accent-[#7259B5]"
                  />
                  <span className="text-sm text-black/60">T{q}</span>
                </label>
              );
            })}
            <p className="text-xs text-black/35 self-center">Trimestres com captação ativa</p>
          </div>
        </section>

        {/* Detalhes */}
        <section>
          <p className="text-[0.6875rem] font-bold tracking-[.08em] uppercase text-black/30 mb-3">Acesso</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.tem_detalhe}
              onChange={(e) => set("tem_detalhe", e.target.checked)}
              className="accent-[#7259B5] w-4 h-4"
            />
            <div>
              <span className="text-sm font-medium text-[#0D0D0D]">Detalhe disponível</span>
              <p className="text-xs text-black/40">Quando ativado, usuários podem solicitar as informações detalhadas desta empresa</p>
            </div>
          </label>
        </section>

        {/* Responsáveis */}
        <section>
          <p className="text-[0.6875rem] font-bold tracking-[.08em] uppercase text-black/30 mb-3">Responsáveis</p>
          {responsaveis.length === 0 ? (
            <p className="text-sm text-black/35">Nenhum responsável cadastrado.</p>
          ) : (
            <div className="overflow-x-auto rounded" style={inputStyle}>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.10)" }}>
                    <th className={theadCls}>Nome</th>
                    <th className={theadCls}>Cargo</th>
                    <th className={theadCls}>E-mail</th>
                    <th className={theadCls}>LinkedIn</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {responsaveis.map((r) => (
                    <ResponsavelRow key={r.id} responsavel={r} onSave={salvarResponsavel} onDelete={removerResponsavel} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Editais */}
        <section>
          <p className="text-[0.6875rem] font-bold tracking-[.08em] uppercase text-black/30 mb-3">Editais</p>
          <div className="overflow-x-auto rounded" style={inputStyle}>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b" style={{ borderColor: "rgba(13,13,13,.10)" }}>
                  <th className={theadCls}>Nome</th>
                  <th className={theadCls}>Abertura</th>
                  <th className={theadCls}>Fechamento</th>
                  <th className={theadCls}>Link de acesso</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {editais.length === 0 ? (
                  <NovoEditalRow empresaId={id} onCriado={(novo) => setEditais((prev) => [...prev, novo])} />
                ) : (
                  editais.map((e) => (
                    <EditalRow key={e.id} edital={e} onSave={salvarEdital} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
