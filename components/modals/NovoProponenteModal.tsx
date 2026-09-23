"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Building2, Hash, Globe, Mail, Phone, AlignLeft, Save, Check, UserPlus, FolderPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import type { TipoProponente } from "@/lib/supabase/types";
import { PROPONENTE_ICON_OPTIONS, IDENTITY_COLORS } from "@/components/ui/ProjectIdentity";
import type { IdentityType } from "@/components/ui/ProjectIdentity";
import { IdentityEditor } from "@/components/ui/IdentityEditor";
import { NovoContatoModal } from "@/components/modals/NovoContatoModal";
import { useEtiquetas } from "@/contexts/EtiquetasContext";
import { Dropdown } from "@/components/ui/Dropdown";

export type EditDataProponente = {
  id: string;
  nome: string;
  cnpj: string | null;
  tipo: TipoProponente | null;
  maturidade?: string | null;
  cidade: string | null;
  estado: string | null;
  email: string | null;
  telefone: string | null;
  site: string | null;
  descricao: string | null;
  identidade_tipo?: IdentityType;
  identidade_valor?: string | null;
  identidade_logo_url?: string | null;
  identidade_cor?: string | null;
};

function normalizeKey(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function formatDocument(value: string, person: boolean) {
  const digits = value.replace(/\D/g, "").slice(0, person ? 11 : 14);
  if (person) return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function NovoProponenteModal({ onClose, onSaved, editData, nested = false }: {
  onClose: () => void;
  onSaved: (id: string, nome: string) => void;
  editData?: EditDataProponente;
  nested?: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const organizationId = useOrganizationId();
  const { etiquetasProponente, etiquetasMaturidadeProponente } = useEtiquetas();
  const [saving, setSaving] = useState(false);
  const [erro, setErro]     = useState<string | null>(null);
  const [savedProponente, setSavedProponente] = useState<{ id: string; nome: string } | null>(null);
  const [showContato, setShowContato] = useState(false);

  const [nome, setNome]         = useState(editData?.nome ?? "");
  const [cnpj, setCnpj]         = useState(editData?.cnpj ?? "");
  const [tipo, setTipo]         = useState<TipoProponente | "">(editData?.tipo ?? "");
  const [maturidade, setMaturidade] = useState(editData?.maturidade ?? "");
  const [cidade, setCidade]     = useState(editData?.cidade ?? "");
  const [estado, setEstado]     = useState(editData?.estado ?? "");
  const [email, setEmail]       = useState(editData?.email ?? "");
  const [telefone, setTelefone] = useState(editData?.telefone ?? "");
  const [site, setSite]         = useState(editData?.site ?? "");
  const [descricao, setDescricao] = useState(editData?.descricao ?? "");
  const [identidadeTipo, setIdentidadeTipo] = useState<IdentityType>(editData?.identidade_tipo ?? "icone");
  const [identidadeValor, setIdentidadeValor] = useState(editData?.identidade_valor ?? "");
  const [identidadeCor, setIdentidadeCor] = useState(editData?.identidade_cor ?? IDENTITY_COLORS[0].cor);
  const [logoPreview, setLogoPreview] = useState<string | null>(editData?.identidade_logo_url ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editData?.id || editData.maturidade !== undefined) return;
    let active = true;
    supabase.from("proponentes").select("maturidade").eq("id", editData.id).maybeSingle()
      .then(({ data }: { data: { maturidade: string | null } | null }) => { if (active) setMaturidade(data?.maturidade ?? ""); });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editData?.id]);

  async function handleSalvar() {
    if (!nome.trim()) { setErro("Nome é obrigatório"); return; }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) { setErro("Informe um e-mail válido"); return; }
    setSaving(true);
    setErro(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErro("Não autenticado"); setSaving(false); return; }

    if (cnpj.trim()) {
      let duplicateQuery = supabase.from("proponentes").select("id,nome").eq("cnpj", cnpj.trim()).limit(1);
      if (editData?.id) duplicateQuery = duplicateQuery.neq("id", editData.id);
      const { data: duplicateData } = await duplicateQuery.maybeSingle();
      const duplicate = duplicateData as unknown as { nome: string } | null;
      if (duplicate) { setErro(`Este documento já está vinculado a ${duplicate.nome}.`); setSaving(false); return; }
    }

    const payload = {
      nome:         nome.trim(),
      nome_key:     normalizeKey(nome.trim()),
      cnpj:         cnpj.trim()     || null,
      tipo:         tipo             || null,
      maturidade: maturidade || null,
      cidade:       cidade.trim()   || null,
      estado:       estado.trim()   || null,
      email:        email.trim()    || null,
      telefone:     telefone.trim() || null,
      site:         site.trim()     || null,
      descricao:    descricao.trim() || null,
      identidade_tipo: identidadeTipo,
      identidade_valor: identidadeTipo === "icone" || identidadeTipo === "emoji" ? identidadeValor || null : null,
      identidade_cor: identidadeTipo === "icone" ? identidadeCor : null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    let savedId: string | null | undefined = editData?.id;
    if (editData?.id) {
      const { error } = await sb.from("proponentes").update(payload).eq("id", editData.id);
      setSaving(false);
      if (error) { setErro((error as Error).message); return; }
    } else {
      const { data, error } = await sb
        .from("proponentes")
        .insert({ account_id: user.id, organization_id: organizationId, ...payload })
        .select("id")
        .single();
      setSaving(false);
      if (error || !data) { setErro((error as Error)?.message ?? "Erro ao salvar"); return; }
      savedId = (data as { id: string }).id;
    }

    if (identidadeTipo === "logo" && logoFile && organizationId && savedId) {
      const path = `${organizationId}/${savedId}/logo.png`;
      const { error: uploadError } = await supabase.storage.from("projetos-identidade").upload(path, logoFile, { upsert: true, contentType: "image/png" });
      if (uploadError) { setErro(uploadError.message); return; }
      const { data: publicUrl } = supabase.storage.from("projetos-identidade").getPublicUrl(path);
      const { error: logoError } = await sb.from("proponentes").update({ identidade_logo_url: publicUrl.publicUrl }).eq("id", savedId);
      if (logoError) { setErro((logoError as Error).message); return; }
    }

    const finalId = savedId ?? editData?.id ?? "";
    onSaved(finalId, nome.trim());
    if (editData) onClose();
    else setSavedProponente({ id: finalId, nome: nome.trim() });
  }

  const isPerson = tipo === "pessoa_fisica";
  const documentLabel = isPerson ? "CPF" : "CNPJ";

  if (savedProponente && showContato) return <NovoContatoModal proponentePreId={savedProponente.id} onClose={() => setShowContato(false)} onSaved={() => { setShowContato(false); onClose(); }} />;

  if (savedProponente) return <>
    <div className={`fixed inset-0 ${nested ? "z-[70]" : "z-50"} flex items-start justify-center bg-black/45 px-3 sm:px-5`} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="proponente-created-title" className="w-full max-w-[680px] overflow-hidden rounded-b bg-white shadow-[0_22px_72px_rgba(13,13,13,.2)]" onClick={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-4"><h2 id="proponente-created-title" className="text-[16px] font-semibold text-black">Proponente criado</h2><button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded text-black/35 hover:bg-black/[.05]"><X size={15}/></button></header>
        <div className="px-6 py-8 sm:px-8"><span className="flex h-10 w-10 items-center justify-center rounded bg-[#2E8932]/10 text-[#2E8932]"><Check size={18}/></span><p className="mt-4 text-[17px] font-semibold text-black/80">{savedProponente.nome}</p><p className="mt-1 text-[12px] text-black/40">O cadastro está pronto. Escolha o próximo passo para completar o relacionamento.</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setShowContato(true)} className="flex items-center gap-3 rounded border border-black/[.1] px-4 py-4 text-left transition hover:bg-black/[.025]"><UserPlus size={16} className="text-black/40"/><span><strong className="block text-[12px] font-semibold text-black/70">Adicionar contato</strong><small className="mt-0.5 block text-[10px] text-black/35">Cadastre o ponto focal</small></span></button><button type="button" onClick={() => { onClose(); router.push(`/projetos?novo=1&proponente=${savedProponente.id}`); }} className="flex items-center gap-3 rounded border border-black/[.1] px-4 py-4 text-left transition hover:bg-black/[.025]"><FolderPlus size={16} className="text-black/40"/><span><strong className="block text-[12px] font-semibold text-black/70">Criar primeiro projeto</strong><small className="mt-0.5 block text-[10px] text-black/35">Inicie o portfólio</small></span></button></div></div>
        <footer className="flex justify-end border-t border-black/[.08] px-6 py-4"><button type="button" onClick={onClose} className="px-3 py-2 text-[12px] font-medium text-black/40 hover:text-black/60">Concluir depois</button></footer>
      </div>
    </div>
  </>;

  return (
    <div
      className={`fixed inset-0 ${nested ? "z-[70]" : "z-50"} flex items-start justify-center bg-black/45 px-3 sm:px-5`}
      style={{ background: "rgba(0,0,0,.45)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="proponente-sheet-title"
        className="flex max-h-[94dvh] w-full max-w-[1040px] flex-col overflow-hidden rounded-b bg-white shadow-[0_22px_72px_rgba(13,13,13,.2)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex flex-shrink-0 items-center justify-between border-b border-black/[.08] px-6 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-black/5 flex items-center justify-center">
              <Building2 size={16} className="text-black/50" />
            </div>
            <h2 id="proponente-sheet-title" className="text-[16px] font-semibold text-black">{editData ? "Editar proponente" : "Novo proponente"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/[.06] transition">
            <X size={15} className="text-black/40" />
          </button>
        </header>

        {/* Body */}
        <div className="grid flex-1 overflow-y-auto sm:grid-cols-[minmax(0,1.12fr)_minmax(280px,.88fr)]">
          {/* Col 1 — principal */}
          <section className="flex min-w-0 flex-col gap-4 p-6 sm:p-7 lg:p-8">
            {/* Nome */}
            <div className="order-1">
              <label className="text-[12px] font-semibold text-black mb-1.5 block">Nome</label>
              <div className="flex items-center border rounded px-3 py-2.5 gap-2" style={{ borderColor: nome ? "rgba(13,13,13,.25)" : "rgba(13,13,13,.15)" }}>
                <Building2 size={13} className="text-black/35 flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Nome da organização ou pessoa"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="flex-1 text-[13px] outline-none bg-transparent text-black min-w-0"
                />
              </div>
            </div>

            {/* Identidade visual */}
            <div className="order-5 border-t border-black/[.07] pt-4">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/webp"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setLogoFile(file);
                  setLogoPreview(URL.createObjectURL(file));
                }}
              />
              <IdentityEditor
                name={nome || "Proponente"}
                type={identidadeTipo}
                value={identidadeValor}
                logoUrl={logoPreview}
                color={identidadeCor}
                iconOptions={PROPONENTE_ICON_OPTIONS}
                colors={IDENTITY_COLORS}
                onTypeChange={setIdentidadeTipo}
                onValueChange={setIdentidadeValor}
                onColorChange={setIdentidadeCor}
                onLogoRequest={() => logoInputRef.current?.click()}
                logoHelp="PNG ou WebP, até 2 MB. Recorte quadrado automático."
              />
            </div>

            {/* Tipo */}
            <div className="order-2">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[12px] font-semibold text-black">Tipo</label>
                <a href="/configuracoes?section=funis" target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium text-black/30 transition hover:text-[#7259B5]">Editar em configurações</a>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {etiquetasProponente.map(t => (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => { const next = tipo === t.key ? "" : t.key; setTipo(next); setCnpj(formatDocument(cnpj, next === "pessoa_fisica")); }}
                    className="rounded border px-3 py-1.5 text-[11px] font-semibold transition"
                    style={{ borderColor: tipo === t.key ? t.cor : "rgba(13,13,13,.12)", background: "white", color: tipo === t.key ? t.cor : "rgba(13,13,13,.45)" }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="order-2">
              <label className="mb-1.5 block text-[12px] font-semibold text-black">Maturidade institucional</label>
              <p className="mb-2 text-[11px] text-black/40">Nível de estrutura do proponente para executar e captar recursos.</p>
              <Dropdown value={maturidade} onChange={setMaturidade} options={[
                { value: "", label: "Não avaliado" },
                ...etiquetasMaturidadeProponente.map(item => ({ value: item.key, label: item.label })),
              ]} />
            </div>

            {/* Documento */}
            <div className="order-3">
              <label className="text-[12px] font-semibold text-black mb-1.5 block">{documentLabel}</label>
              <div className="flex items-center border rounded px-3 py-2.5 gap-2" style={{ borderColor: "rgba(13,13,13,.15)" }}>
                <Hash size={13} className="text-black/35 flex-shrink-0" />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={isPerson ? "000.000.000-00" : "00.000.000/0001-00"}
                  value={cnpj}
                  onChange={e => setCnpj(formatDocument(e.target.value, isPerson))}
                  className="flex-1 text-[13px] outline-none bg-transparent text-black min-w-0"
                />
              </div>
            </div>

            {/* Descrição */}
            <div className="order-4">
              <div className="mb-1.5 flex items-center justify-between"><label className="text-[12px] font-semibold text-black">Descrição</label><span className="text-[10px] font-medium text-black/25">Opcional</span></div>
              <div className="flex items-start border rounded px-3 py-2.5 gap-2" style={{ borderColor: "rgba(13,13,13,.15)" }}>
                <AlignLeft size={13} className="text-black/35 flex-shrink-0 mt-0.5" />
                <textarea
                  placeholder="Breve descrição da organização…"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  rows={2}
                  className="flex-1 text-[13px] outline-none bg-transparent text-black min-w-0 resize-none"
                />
              </div>
            </div>
          </section>

          {/* Col 2 — contato e localização */}
          <aside className="min-w-0 space-y-4 border-t border-black/[.07] p-6 sm:border-l sm:border-t-0 sm:p-7 lg:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-black/30">Contato</p>

            <div>
              <label className="text-[12px] font-semibold text-black mb-1.5 block">E-mail</label>
              <div className="flex items-center border rounded px-3 py-2.5 gap-2" style={{ borderColor: "rgba(13,13,13,.15)" }}>
                <Mail size={12} className="text-black/35 flex-shrink-0" />
                <input
                  type="email"
                  placeholder="contato@org.com.br"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 text-[12px] outline-none bg-transparent text-black min-w-0"
                />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-black mb-1.5 block">Telefone</label>
              <div className="flex items-center border rounded px-3 py-2.5 gap-2" style={{ borderColor: "rgba(13,13,13,.15)" }}>
                <Phone size={12} className="text-black/35 flex-shrink-0" />
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  className="flex-1 text-[12px] outline-none bg-transparent text-black min-w-0"
                />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-black mb-1.5 block">Site</label>
              <div className="flex items-center border rounded px-3 py-2.5 gap-2" style={{ borderColor: "rgba(13,13,13,.15)" }}>
                <Globe size={12} className="text-black/35 flex-shrink-0" />
                <input
                  type="url"
                  placeholder="www.org.com.br"
                  value={site}
                  onChange={e => setSite(e.target.value)}
                  className="flex-1 text-[12px] outline-none bg-transparent text-black min-w-0"
                />
              </div>
            </div>

            <div className="pt-1">
              <p className="text-[10px] font-bold uppercase tracking-[.13em] text-black/30 mb-3">Localização</p>
              <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-3">
                <div>
                  <label className="text-[12px] font-semibold text-black mb-1.5 block">Cidade</label>
                  <input
                    type="text"
                    placeholder="São Paulo"
                    value={cidade}
                    onChange={e => setCidade(e.target.value)}
                    className="w-full border rounded px-3 py-2.5 text-[12px] outline-none text-black"
                    style={{ borderColor: "rgba(13,13,13,.15)" }}
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-black mb-1.5 block">Estado</label>
                  <input
                    type="text"
                    placeholder="SP"
                    maxLength={2}
                    value={estado}
                    onChange={e => setEstado(e.target.value.toUpperCase())}
                    className="w-full border rounded px-3 py-2.5 text-[12px] outline-none text-black uppercase"
                    style={{ borderColor: "rgba(13,13,13,.15)" }}
                  />
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Footer */}
        <footer className="flex flex-shrink-0 items-center justify-between border-t border-black/[.08] bg-white px-6 py-4 sm:px-8">
          {erro && <p className="text-xs text-[#D94E4E] font-medium">{erro}</p>}
          {!erro && <div />}
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2.5 text-[12px] font-semibold text-black/35 hover:text-black/55 transition">
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 text-[12px] font-bold bg-[#2E8932] text-white rounded hover:bg-[#2E8932]/90 transition disabled:opacity-60"
            >
              <Save size={12} /> {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
