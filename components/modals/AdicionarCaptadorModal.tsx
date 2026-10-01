"use client";

import { useState, useEffect, useId, useRef } from "react";
import { X, UserPlus, Pencil, Check, Plus, User, ArrowUp, Minus, ArrowDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { NovoContatoModal } from "@/components/modals/NovoContatoModal";
import { CAPTADOR_ICON_OPTIONS, IDENTITY_COLORS } from "@/components/ui/ProjectIdentity";
import type { IdentityType } from "@/components/ui/ProjectIdentity";
import { IdentityEditor } from "@/components/ui/IdentityEditor";
import { useModalDismiss } from "@/hooks/useModalDismiss";

type Prioridade = "alta" | "media" | "baixa";

interface EditData {
  id: string;
  nome: string;
  prioridade: Prioridade;
  logo_url?: string | null;
  identidade_tipo?: IdentityType | null;
  identidade_valor?: string | null;
  identidade_logo_url?: string | null;
  identidade_cor?: string | null;
  email?: string | null;
  telefone?: string | null;
  agencia?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editData?: EditData;
}

interface ContatoItem {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
}

const PRIORIDADE_OPTS: { value: Prioridade; label: string; color: string; Icon: React.ElementType }[] = [
  { value: "baixa", label: "Baixa", color: "#888888", Icon: ArrowDown },
  { value: "media", label: "Média", color: "#B07A14", Icon: Minus },
  { value: "alta",  label: "Alta",  color: "#D94E4E", Icon: ArrowUp },
];

export default function AdicionarCaptadorModal({ open, onClose, onSaved, editData }: Props) {
  const organizationId = useOrganizationId();
  const isEdit = !!editData;
  const [step, setStep] = useState<"form" | "success">("form");
  const [nome, setNome]             = useState(editData?.nome ?? "");
  const [agencia, setAgencia]       = useState(editData?.agencia ?? "");
  const [email, setEmail]           = useState(editData?.email ?? "");
  const [telefone, setTelefone]     = useState(editData?.telefone ?? "");
  const [logoUrl, setLogoUrl]       = useState(editData?.logo_url ?? "");
  const [identidadeTipo, setIdentidadeTipo] = useState<IdentityType>(editData?.identidade_tipo ?? (editData?.logo_url ? "logo" : "icone"));
  const [identidadeValor, setIdentidadeValor] = useState(editData?.identidade_valor ?? "");
  const [identidadeCor, setIdentidadeCor] = useState(editData?.identidade_cor ?? IDENTITY_COLORS[0].cor);
  const [identidadeLogoPreview, setIdentidadeLogoPreview] = useState<string | null>(editData?.identidade_logo_url ?? editData?.logo_url ?? null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [prioridade, setPrioridade] = useState<Prioridade>(editData?.prioridade ?? "media");
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving]         = useState(false);
  const [erro, setErro]             = useState<string | null>(null);
  const [savedId, setSavedId]       = useState<string | null>(editData?.id ?? null);

  const [contatos, setContatos]           = useState<ContatoItem[]>([]);
  const [showContatoModal, setShowContatoModal] = useState(false);

  useEffect(() => {
    if (editData) {
      setNome(editData.nome);
      setAgencia(editData.agencia ?? "");
      setEmail(editData.email ?? "");
      setTelefone(editData.telefone ?? "");
      setLogoUrl(editData.logo_url ?? "");
      setPrioridade(editData.prioridade);
      setIdentidadeTipo(editData.identidade_tipo ?? (editData.logo_url ? "logo" : "icone"));
      setIdentidadeValor(editData.identidade_valor ?? "");
      setIdentidadeCor(editData.identidade_cor ?? IDENTITY_COLORS[0].cor);
      const logoUrlFallback = editData.identidade_logo_url ?? editData.logo_url ?? null;
      setIdentidadeLogoPreview(logoUrlFallback);
      setLogoFile(null);
      setSavedId(editData.id);
    }
  }, [editData]);

  function resetState() {
    setStep("form");
    setNome(""); setAgencia(""); setEmail(""); setTelefone(""); setLogoUrl("");
    setPrioridade("media");
    setIdentidadeTipo("icone"); setIdentidadeValor(""); setIdentidadeCor(IDENTITY_COLORS[0].cor);
    setIdentidadeLogoPreview(null); setLogoFile(null);
    setErro(null); setSavedId(null);
    setContatos([]); setShowContatoModal(false);
  }

  async function fetchContatos(captadorId: string) {
    const supabase = createClient();
    const { data } = await (supabase as any)
      .from("contatos")
      .select("id, nome, cargo, email")
      .eq("captador_id", captadorId)
      .order("created_at");
    setContatos(data ?? []);
  }

  async function handleSalvar() {
    if (!nome.trim()) { setErro("Nome da agência é obrigatório"); return; }
    setSaving(true); setErro(null);

    const supabase = createClient();

    if (isEdit && editData) {
      const { error } = await (supabase as any).from("captadores").update({
        nome:      nome.trim(),
        prioridade,
        logo_url:  identidadeLogoPreview?.trim() || logoUrl.trim() || null,
        email:     email.trim() || null,
        telefone:  telefone.trim() || null,
        agencia:   agencia.trim() || null,
        identidade_tipo: identidadeTipo,
        identidade_valor: identidadeTipo === "icone" || identidadeTipo === "emoji" ? identidadeValor || null : null,
        identidade_cor: identidadeTipo === "icone" ? identidadeCor : null,
      }).eq("id", editData.id);
      if (error) { setSaving(false); setErro(error.message); return; }
      if (identidadeTipo === "logo" && logoFile) await uploadIdentidadeLogo(supabase, editData.id);
      setSaving(false);
      onSaved(); onClose();
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErro("Usuário não autenticado"); setSaving(false); return; }

    let orgId = organizationId;
    if (!orgId) {
      const { data: ids, error: rpcErr } = await supabase.rpc("auth_org_ids");
      const list = ids as unknown as string[] | null;
      orgId = list?.[0] ?? null;
      if (!orgId) {
        setErro(rpcErr ? `Erro DB: ${rpcErr.code} — ${rpcErr.message}` : "Organização não encontrada");
        setSaving(false); return;
      }
    }

    const { data, error } = await (supabase as any).from("captadores").insert({
      organization_id: orgId,
      nome:      nome.trim(),
      prioridade,
      logo_url:  identidadeLogoPreview?.trim() || logoUrl.trim() || null,
      email:     email.trim() || null,
      telefone:  telefone.trim() || null,
      agencia:   agencia.trim() || null,
      ativo:     true,
      identidade_tipo: identidadeTipo,
      identidade_valor: identidadeTipo === "icone" || identidadeTipo === "emoji" ? identidadeValor || null : null,
      identidade_cor: identidadeTipo === "icone" ? identidadeCor : null,
    }).select("id").single();

    if (error) { setSaving(false); setErro(error.message); return; }
    setSavedId(data?.id ?? null);
    if (identidadeTipo === "logo" && logoFile && data?.id) await uploadIdentidadeLogo(supabase, data.id);
    setSaving(false);
    setStep("success");
  }

  async function uploadIdentidadeLogo(supabase: ReturnType<typeof createClient>, captadorId: string) {
    if (!logoFile) return;
    const ext = logoFile.name.split(".").pop() ?? "png";
    const path = `captadores/${captadorId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, logoFile, { upsert: true });
    if (error) { setErro(`Upload: ${error.message}`); return; }
    const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
    await (supabase as any).from("captadores").update({ identidade_logo_url: publicUrl, logo_url: publicUrl }).eq("id", captadorId);
    setIdentidadeLogoPreview(publicUrl);
  }

  function handleClose() {
    onSaved(); onClose(); resetState();
  }

  const titleId = useId();
  useModalDismiss(handleClose, { enabled: open });

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,.45)" }}
        onClick={handleClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="bg-white rounded shadow-2xl w-full overflow-hidden flex flex-col"
          style={{ maxWidth: 560, maxHeight: "90vh" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-black/[.05] text-black">
                {isEdit ? <Pencil size={15} /> : <UserPlus size={16} />}
              </div>
              <h2 id={titleId} className="text-[15px] font-bold text-black">
                {isEdit ? "Editar agência" : step === "form" ? "Adicionar agência" : "Agência cadastrada"}
              </h2>
            </div>
            <button type="button" onClick={handleClose} aria-label="Fechar" className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/5 transition">
              <X size={15} className="text-black/40" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1">
            {step === "form" || isEdit ? (
              <div className="space-y-4">
                {erro && (
                  <div className="px-3 py-2 rounded text-[12px] font-medium" style={{ background: "#D94E4E14", color: "#D94E4E" }}>
                    {erro}
                  </div>
                )}

                {/* Nome */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-black/30 block mb-1.5">Nome da agência *</label>
                  <input
                    autoFocus={!isEdit}
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSalvar(); }}
                    placeholder="Ex: Captação Cultural SP"
                    className="w-full px-3 py-2.5 text-[13px] border rounded bg-white outline-none focus:border-black/25 transition"
                    style={{ borderColor: "rgba(13,13,13,.12)" }}
                  />
                </div>

                {/* Identidade visual */}
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setLogoFile(file);
                      setIdentidadeLogoPreview(URL.createObjectURL(file));
                    }}
                  />
                  <IdentityEditor
                    name={nome || "Agência"}
                    type={identidadeTipo}
                    value={identidadeValor}
                    logoUrl={identidadeLogoPreview}
                    color={identidadeCor}
                    iconOptions={CAPTADOR_ICON_OPTIONS}
                    colors={IDENTITY_COLORS}
                    onTypeChange={setIdentidadeTipo}
                    onValueChange={setIdentidadeValor}
                    onColorChange={setIdentidadeCor}
                    onLogoRequest={() => fileRef.current?.click()}
                    logoHelp="PNG, JPEG ou WebP, até 2 MB. Recorte quadrado automático."
                  />
                </div>

                {/* Contato principal */}
                <div className="space-y-3 border-t border-black/[.07] pt-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-black/30">Contato principal</p>
                    <p className="mt-0.5 text-[10px] text-black/35">Pessoa responsável pela relação com a agência.</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-black/50">Representante principal</label>
                    <input type="text" value={agencia} onChange={e => setAgencia(e.target.value)} placeholder="Ex: Maria Silva" className="w-full rounded border bg-white px-3 py-2.5 text-[13px] outline-none focus:border-black/25 transition" style={{ borderColor: "rgba(13,13,13,.12)" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-black/50">E-mail</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@agencia.com.br" className="w-full rounded border bg-white px-3 py-2.5 text-[12px] outline-none focus:border-black/25 transition" style={{ borderColor: "rgba(13,13,13,.12)" }} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-black/50">Telefone</label>
                      <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 99999-9999" className="w-full rounded border bg-white px-3 py-2.5 text-[12px] outline-none focus:border-black/25 transition" style={{ borderColor: "rgba(13,13,13,.12)" }} />
                    </div>
                  </div>
                </div>

                {/* Prioridade */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-black/30 block">Prioridade da parceria</label>
                  <p className="mb-2 mt-0.5 text-[10px] text-black/35">Define a ordem de atenção na carteira.</p>
                  <div className="flex">
                    {PRIORIDADE_OPTS.map((opt, index) => (
                      <button
                        key={opt.value}
                        onClick={() => setPrioridade(opt.value)}
                        type="button"
                        className={`relative flex flex-1 items-center justify-center gap-1.5 border px-3 py-2 text-[12px] font-semibold transition hover:z-10 hover:bg-black/[.025] ${index > 0 ? "-ml-px" : ""} ${index === 0 ? "rounded-l" : index === PRIORIDADE_OPTS.length - 1 ? "rounded-r" : ""}`}
                        style={{
                          borderColor: prioridade === opt.value ? `${opt.color}70` : "rgba(13,13,13,.10)",
                          background: prioridade === opt.value ? `${opt.color}0A` : "white",
                          color: opt.color,
                        }}
                      >
                        <opt.Icon size={12} strokeWidth={2.5} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Success banner */}
                <div className="flex items-center gap-3 p-4 rounded" style={{ background: "#2E893210", border: "1px solid #2E893230" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#2E893218" }}>
                    <Check size={18} style={{ color: "#2E8932" }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-black">{nome}</p>
                    <p className="text-[11px] text-black/40">Agência cadastrada com sucesso</p>
                  </div>
                </div>

                {/* Contacts section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[12px] font-bold text-black">Contatos da agência</p>
                      <p className="text-[11px] text-black/35 mt-0.5">Pessoas vinculadas a esta agência no CRM</p>
                    </div>
                    <button
                      onClick={() => setShowContatoModal(true)}
                      className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded border transition hover:bg-black/5"
                      style={{ borderColor: "rgba(13,13,13,.12)", color: "#7259B5" }}
                    >
                      <Plus size={12} /> Adicionar
                    </button>
                  </div>

                  {contatos.length > 0 ? (
                    <div className="space-y-2">
                      {contatos.map(c => (
                        <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded border" style={{ borderColor: "rgba(13,13,13,.08)" }}>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(114,89,181,0.10)" }}>
                            <User size={12} style={{ color: "#7259B5" }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-semibold text-black truncate">{c.nome}</p>
                            {c.cargo && <p className="text-[11px] text-black/35 truncate">{c.cargo}</p>}
                          </div>
                          {c.email && <span className="text-[11px] text-black/30 truncate max-w-[130px]">{c.email}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-black/25 py-1">Nenhum contato adicionado ainda</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "rgba(13,13,13,.08)" }}>
            <button onClick={handleClose} className="px-4 py-2 text-[12px] font-medium text-black/35 hover:text-black/55 transition">
              {step === "form" || isEdit ? "Cancelar" : "Fechar"}
            </button>
            {(step === "form" || isEdit) && (
              <button
                onClick={handleSalvar}
                disabled={saving || !nome.trim()}
                className="rounded bg-[#2E8932] px-5 py-2 text-[12px] font-medium text-white transition hover:bg-[#26752A] disabled:opacity-35 disabled:cursor-not-allowed"
              >
                {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Cadastrar agência"}
              </button>
            )}
          </div>
        </div>
      </div>

      {showContatoModal && savedId && (
        <NovoContatoModal
          onClose={() => setShowContatoModal(false)}
          onSaved={() => { setShowContatoModal(false); fetchContatos(savedId); }}
          captadorPreId={savedId}
        />
      )}
    </>
  );
}
