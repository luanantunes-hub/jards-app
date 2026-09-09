"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, Check, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CompanyLogo } from "@/components/CompanyLogo";

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

export default function AdminPatrocinadorPage() {
  const router        = useRouter();
  const { id }        = useParams<{ id: string }>();
  const supabase      = createClient();

  const [form, setForm]       = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await (supabase as any)
        .from("empresas")
        .select("*")
        .eq("id", id)
        .single();
      if (data) setForm(data as Empresa);
      setLoading(false);
    }
    load();
  }, [id]);

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
          <p className="text-[11px] font-bold tracking-[.08em] uppercase text-black/30 mb-3">Identidade</p>
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
          <p className="text-[11px] font-bold tracking-[.08em] uppercase text-black/30 mb-3">Contato</p>
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
          <p className="text-[11px] font-bold tracking-[.08em] uppercase text-black/30 mb-3">Investimento</p>
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
          <p className="text-[11px] font-bold tracking-[.08em] uppercase text-black/30 mb-3">Acesso</p>
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
      </div>
    </div>
  );
}
