"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard, Users, Eye, EyeOff, Shield,
  Check, AlertCircle, Plus,
  MessageSquare, CheckCircle, XCircle,
  UserCircle, Plug, Tags, Handshake, FileCheck,
  Camera, Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useCreditos } from "@/contexts/CreditosContext";
import NovoMembroModal from "@/components/modals/NovoMembroModal";
import { CalendarConnections } from "@/components/CalendarConnections";
import { EtiquetasConfig } from "@/components/EtiquetasConfig";
import { TaxonomiasComerciaisConfig } from "@/components/TaxonomiasComerciaisConfig";
import { RenewalDecisionTreeConfig } from "@/components/customer-success/RenewalDecisionTreeConfig";
import { fetchOrganizationMembers } from "@/lib/organization/members";
import { Select } from "@/components/ui/Select";

/* -------------------------------------------------------------------------- */
/*                                  TYPES                                     */
/* -------------------------------------------------------------------------- */

interface MembroOrg {
  user_id: string;
  papel: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

type SettingsSection = "conta" | "ferramentas" | "equipe" | "funis";

const SETTINGS_SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "conta", label: "Minha conta", icon: UserCircle },
  { id: "ferramentas", label: "Minhas ferramentas", icon: Plug },
  { id: "equipe", label: "Minha equipe", icon: Users },
  { id: "funis", label: "Funis e etiquetas", icon: Tags },
];

/* -------------------------------------------------------------------------- */
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

const PLANO_LABEL: Record<string, string> = {
  gratuito: "Gratuito",
  basico: "Básico",
  profissional: "Profissional",
};

const PAPEL_LABEL: Record<string, string> = {
  admin: "Admin",
  colaborador: "Colaborador",
  leitor: "Leitor",
  captador: "Captador externo",
  visualizador: "Colaborador",
};

/* -------------------------------------------------------------------------- */
/*                                PAGE                                        */
/* -------------------------------------------------------------------------- */

export default function ConfiguracoesPage() {
  const router = useRouter();
  const organizationId = useOrganizationId();
  const { creditos, config, assinatura, loading: loadingCreditos, recarregar } = useCreditos();

  const [loading, setLoading] = useState(true);
  const [membros, setMembros] = useState<MembroOrg[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [showMembroModal, setShowMembroModal] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [contribuicoesPendentes, setContribuicoesPendentes] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<SettingsSection>("conta");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [orgNome, setOrgNome] = useState("");
  const [orgAvatarUrl, setOrgAvatarUrl] = useState<string | null>(null);
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    const requestedSection = new URLSearchParams(window.location.search).get("section");
    if (SETTINGS_SECTIONS.some(section => section.id === requestedSection)) {
      setActiveSection(requestedSection as SettingsSection);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    if (!organizationId) return;
    try {
      const orgMembros = await fetchOrganizationMembers(organizationId);
      setMembros(orgMembros);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar equipe");
    }
  }, [organizationId]);

  useEffect(() => {
    async function load() {
      if (!organizationId) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // Verificar se é admin
      const { data: membro } = await (supabase as any)
        .from("organization_members")
        .select("papel")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .single();

      setIsAdmin(membro?.papel === "admin");

const { data: perfilData } = await (supabase as any)
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (perfilData) {
        setNome(perfilData.full_name ?? "");
        setEmail(perfilData.email ?? user.email ?? "");
        setAvatarUrl(perfilData.avatar_url ?? null);
      }

      const { data: orgData } = await (supabase as any)
        .from("organizations")
        .select("nome, avatar_url")
        .eq("id", organizationId)
        .maybeSingle();
      if (orgData) {
        setOrgNome(orgData.nome ?? "");
        setOrgAvatarUrl(orgData.avatar_url ?? null);
      }

      await loadMembers();

      setLoading(false);
    }
    load();
  }, [organizationId, router, loadMembers]);

  // Fetch contributions pending review
  useEffect(() => {
    if (!organizationId || !isAdmin) return;
    async function fetchContribuicoes() {
      const supabase = createClient();
      const { data } = await (supabase as any)
        .from("contribuicoes")
        .select("*, profiles:autor_id(full_name, email)")
        .eq("organization_id", organizationId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });
      setContribuicoesPendentes(data ?? []);
    }
    fetchContribuicoes();
  }, [organizationId, isAdmin]);

  function showSuccess(msg: string) {
    setSucesso(msg);
    setTimeout(() => setSucesso(null), 3000);
  }

  async function handleSalvarPerfil(event: React.FormEvent) {
    event.preventDefault();
    const nomeFinal = nome.trim();
    if (nomeFinal.length < 2) { setErro("Informe seu nome completo"); return; }
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSalvando(false); return; }

    const [perfilResult, authResult] = await Promise.all([
      (supabase as any).from("profiles").update({
        full_name: nomeFinal,
      }).eq("id", user.id),
      supabase.auth.updateUser({ data: { ...user.user_metadata, full_name: nomeFinal } }),
    ]);

    if (perfilResult.error || authResult.error) {
      setErro("Não foi possível salvar seu perfil. Tente novamente.");
      setSalvando(false);
      return;
    }
    showSuccess("Perfil atualizado");
    setSalvando(false);
  }

  async function uploadUserAvatar(file: File) {
    if (!file.type.startsWith("image/")) { setErro("Selecione um arquivo de imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { setErro("Imagem muito grande (máximo 2MB)"); return; }
    setSavingAvatar(true);
    setErro(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingAvatar(false); return; }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `user/${user.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setErro(upErr.message); setSavingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const [p1, p2] = await Promise.all([
      (supabase as any).from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id),
      supabase.auth.updateUser({ data: { ...user.user_metadata, avatar_url: publicUrl } }),
    ]);
    if (p1.error || p2.error) { setErro("Foto enviada, mas não foi possível salvar no perfil"); setSavingAvatar(false); return; }
    setAvatarUrl(publicUrl);
    setSavingAvatar(false);
    showSuccess("Foto de perfil atualizada");
  }

  async function removeUserAvatar() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSavingAvatar(true);
    setErro(null);
    const [p1, p2] = await Promise.all([
      (supabase as any).from("profiles").update({ avatar_url: null }).eq("id", user.id),
      supabase.auth.updateUser({ data: { ...user.user_metadata, avatar_url: null } }),
    ]);
    if (p1.error || p2.error) { setErro("Não foi possível remover a foto"); setSavingAvatar(false); return; }
    setAvatarUrl(null);
    setSavingAvatar(false);
    showSuccess("Foto de perfil removida");
  }

  async function handleSalvarOrganizacao(event: React.FormEvent) {
    event.preventDefault();
    const nomeFinal = orgNome.trim();
    if (nomeFinal.length < 2) { setErro("Informe o nome da organização"); return; }
    setSavingOrg(true);
    setErro(null);
    const response = await fetch("/api/settings/organization/basic", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, nome: nomeFinal }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setErro(body.error ?? "Não foi possível salvar"); setSavingOrg(false); return; }
    setOrgNome(nomeFinal);
    window.dispatchEvent(new Event("jards:org-updated"));
    showSuccess("Organização atualizada");
    setSavingOrg(false);
  }

  async function uploadOrgAvatar(file: File) {
    if (!organizationId) return;
    if (!file.type.startsWith("image/")) { setErro("Selecione um arquivo de imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { setErro("Imagem muito grande (máximo 2MB)"); return; }
    setSavingOrg(true);
    setErro(null);
    const supabase = createClient();
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `org/${organizationId}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setErro(upErr.message); setSavingOrg(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const response = await fetch("/api/settings/organization/basic", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, avatar_url: publicUrl }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setErro(body.error ?? "Não foi possível salvar a logo"); setSavingOrg(false); return; }
    setOrgAvatarUrl(publicUrl);
    window.dispatchEvent(new Event("jards:org-updated"));
    setSavingOrg(false);
    showSuccess("Logo da organização atualizada");
  }

  async function handleUpdateVisibilidade(valor: "admin_only" | "team_shared") {
    if (!organizationId) return;
    setSalvando(true);
    setErro(null);
    const response = await fetch("/api/settings/organization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, visibilidade_captacoes: valor }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setErro(body.error ?? "Não foi possível atualizar a visibilidade"); }
    else { showSuccess("Visibilidade atualizada"); }
    await recarregar();
    setSalvando(false);
  }

  async function handleUpdateAcessoContatos(valor: "admin_only" | "team_with_credits") {
    if (!organizationId) return;
    setSalvando(true);
    setErro(null);
    const response = await fetch("/api/settings/organization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, acesso_contatos: valor }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setErro(body.error ?? "Não foi possível atualizar o acesso a contatos"); }
    else { showSuccess("Acesso a contatos atualizado"); }
    await recarregar();
    setSalvando(false);
  }

  async function handleRemoverMembro(userId: string) {
    if (!organizationId) return;
    if (!confirm("Remover este membro da organização?")) return;
    setSalvando(true);
    setErro(null);
    const response = await fetch(`/api/members/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setErro(body.error ?? "Não foi possível remover o membro"); }
    else { showSuccess("Membro removido"); }
    if (response.ok) await loadMembers();
    setSalvando(false);
  }

  async function handleAlterarPapel(userId: string, novoPapel: string) {
    if (!organizationId) return;
    setSalvando(true);
    setErro(null);
    const response = await fetch(`/api/members/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, role: novoPapel }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setErro(body.error ?? "Não foi possível alterar o papel"); }
    else { showSuccess("Papel alterado"); }
    if (response.ok) await loadMembers();
    setSalvando(false);
  }

  async function handleAprovarContribuicao(contribuicaoId: string) {
    if (!organizationId) return;
    setSalvando(true);
    setErro(null);
    const supabase = createClient();

    // 1. Update contribution status
    const { error } = await (supabase as any)
      .from("contribuicoes")
      .update({ status: "aprovada", revisado_em: new Date().toISOString() })
      .eq("id", contribuicaoId);

    if (error) { setErro(error.message); setSalvando(false); return; }

    // 2. Fetch contribution details for data application
    const { data: contrib } = await (supabase as any)
      .from("contribuicoes")
      .select("*")
      .eq("id", contribuicaoId)
      .single();

    if (contrib?.tabela_alvo === "responsaveis" && contrib?.tipo === "adicao" && contrib?.valor_proposto) {
      // Insert new responsavel
      const { data: lastOrdem } = await (supabase as any)
        .from("responsaveis")
        .select("ordem")
        .eq("empresa_id", contrib.registro_alvo_id)
        .order("ordem", { ascending: false })
        .limit(1)
        .maybeSingle();

      await (supabase as any)
        .from("responsaveis")
        .insert({
          empresa_id: contrib.registro_alvo_id,
          nome: contrib.valor_proposto?.nome ?? "Novo contato",
          cargo: contrib.valor_proposto?.cargo ?? null,
          email: contrib.valor_proposto?.email ?? null,
          linkedin_url: contrib.valor_proposto?.linkedin_url ?? null,
          ordem: (lastOrdem?.ordem ?? 0) + 1,
          fonte: "comunidade",
        });
    }

    // 3. Refresh list
    const { data: novas } = await (supabase as any)
      .from("contribuicoes")
      .select("*, profiles:autor_id(full_name, email)")
      .eq("organization_id", organizationId)
      .eq("status", "pendente")
      .order("created_at", { ascending: false });
    setContribuicoesPendentes(novas ?? []);
    showSuccess("Contribuição aprovada");
    setSalvando(false);
  }

  async function handleRejeitarContribuicao(contribuicaoId: string) {
    if (!organizationId) return;
    setSalvando(true);
    setErro(null);
    const supabase = createClient();
    const { error } = await (supabase as any)
      .from("contribuicoes")
      .update({ status: "rejeitada", revisado_em: new Date().toISOString() })
      .eq("id", contribuicaoId);
    if (error) { setErro(error.message); }
    else {
      const { data: novas } = await (supabase as any)
        .from("contribuicoes")
        .select("*, profiles:autor_id(full_name, email)")
        .eq("organization_id", organizationId)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });
      setContribuicoesPendentes(novas ?? []);
      showSuccess("Contribuição rejeitada");
    }
    setSalvando(false);
  }

  if (loading || loadingCreditos) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-black/15 border-t-black/60 rounded-full animate-spin" />
      </div>
    );
  }

  const currentSection = SETTINGS_SECTIONS.find((section) => section.id === activeSection) ?? SETTINGS_SECTIONS[0];

  return (
    <div className="w-full px-5 md:px-8 lg:px-10 py-8 md:py-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold text-black">Configurações</h1>
        <p className="text-[13px] text-black/40 mt-1">
          Gerencie sua conta, integrações, equipe e processos
        </p>
      </div>

      {/* Feedback */}
      {erro && (
        <div className="flex items-center gap-2 px-4 py-3 rounded text-[12px] font-medium mb-4" style={{ background: "#D94E4E14", color: "#D94E4E" }}>
          <AlertCircle size={14} />
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="flex items-center gap-2 px-4 py-3 rounded text-[12px] font-medium mb-4" style={{ background: "#2E893214", color: "#2E8932" }}>
          <Check size={14} />
          {sucesso}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[232px_minmax(0,1fr)] gap-6 md:gap-8 lg:gap-10 items-start">
        <aside className="md:sticky md:top-6 min-w-0" aria-label="Seções de configurações">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => {
              const active = activeSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-w-[178px] md:min-w-0 w-full items-center gap-3 rounded px-3 py-3 text-left transition-colors active:scale-[0.98] ${
                    active
                      ? "bg-[#0D0D0D] text-white"
                      : "text-black/50 hover:bg-black/[0.04] hover:text-black"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} className="flex-shrink-0" />
                  <span className="min-w-0 text-[12px] font-semibold whitespace-nowrap">{label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0" aria-live="polite">
          <div className="mb-5">
            <h2 className="text-[17px] font-bold text-black">{currentSection.label}</h2>
          </div>

          <div className="space-y-6">
      {activeSection === "ferramentas" && (
        <>
          <CalendarConnections />

        </>
      )}

      {/* Plano + Créditos */}
      {activeSection === "conta" && (
      <>
      {/* Meu perfil */}
      <form onSubmit={handleSalvarPerfil} className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
        <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <UserCircle size={14} className="text-black/30" />
          <span className="text-[12px] font-bold text-black">Meu perfil</span>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-[#7259B5] flex items-center justify-center text-lg font-bold text-white">
              {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover bg-white" /> : <span>{(nome || email || "?").charAt(0).toUpperCase()}</span>}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 rounded border border-[#7259B5]/30 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#7259B5] transition hover:bg-black/[.04]">
                    {savingAvatar ? "Enviando…" : <>Alterar foto<Camera size={12} /></>}
                  </span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadUserAvatar(f); e.target.value = ""; }} />
                </label>
                {avatarUrl && (
                  <button type="button" onClick={() => void removeUserAvatar()} disabled={savingAvatar} className="text-[11px] font-medium text-black/35 hover:text-[#D94E4E] transition disabled:opacity-40">
                    Remover
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-[10px] text-black/35">PNG, JPG ou WEBP · até 2MB</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block mb-1.5 text-[11px] font-bold uppercase tracking-widest text-black/30">Nome completo</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                placeholder="Como podemos chamar você?"
                className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[12px] text-black outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10"
              />
            </div>
            <div>
              <label className="block mb-1.5 text-[11px] font-bold uppercase tracking-widest text-black/30">E-mail</label>
              <input
                value={email}
                readOnly
                disabled
                className="w-full rounded border border-black/[.12] bg-black/[0.02] px-3 py-2.5 text-[12px] text-black/45 outline-none cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex justify-end border-t pt-5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            <button
              type="submit"
              disabled={salvando}
              className="rounded border border-[#7259B5]/30 bg-white px-4 py-2 text-[12px] font-semibold text-[#7259B5] transition hover:bg-black/[.04] active:scale-[.98] disabled:opacity-40"
            >
              {salvando ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </div>
      </form>

      <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
        <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <CreditCard size={14} className="text-black/30" />
          <span className="text-[12px] font-bold text-black">Plano & Créditos</span>
          <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: "#7259B515", color: "#7259B5" }}>
            {PLANO_LABEL[assinatura?.plano ?? "gratuito"] ?? assinatura?.plano ?? "Gratuito"}
          </span>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between p-4 rounded" style={{ background: "rgba(13,13,13,.03)" }}>
            <p className="text-[13px] font-semibold text-black">Plano {PLANO_LABEL[assinatura?.plano ?? "gratuito"] ?? "Gratuito"}</p>
            <button onClick={() => router.push("/meu-plano")} className="rounded border border-[#7259B5]/30 bg-white px-3 py-2 text-[11px] font-semibold text-[#7259B5] transition hover:bg-black/[.04]">
              Gerenciar plano
            </button>
          </div>

          {/* Saldo de créditos */}
          <div className="p-4 rounded border" style={{ borderColor: "rgba(13,13,13,.10)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[13px] font-semibold text-black">Saldo de créditos</p>
              <span className="text-[11px] text-black/40">
                {creditos?.creditos_usados ?? 0} / {creditos?.creditos_totais ?? 0} usados
              </span>
            </div>
            {/* Barra */}
            <div className="w-full h-2.5 rounded-full" style={{ background: "rgba(13,13,13,.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${creditos?.creditos_totais ? ((creditos.creditos_totais - creditos.creditos_disponiveis) / creditos.creditos_totais) * 100 : 0}%`,
                  background: (creditos?.creditos_disponiveis ?? 0) > 10 ? "#2E8932" : (creditos?.creditos_disponiveis ?? 0) > 0 ? "#B07A14" : "#D94E4E",
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-black/40">Disponível</span>
              <span className="text-[14px] font-bold" style={{ color: (creditos?.creditos_disponiveis ?? 0) > 10 ? "#2E8932" : (creditos?.creditos_disponiveis ?? 0) > 0 ? "#B07A14" : "#D94E4E" }}>
                {creditos?.creditos_disponiveis ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Organização (admin only) */}
      {activeSection === "equipe" && isAdmin && (
        <form onSubmit={handleSalvarOrganizacao} className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
          <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            <Building2 size={14} className="text-black/30" />
            <span className="text-[12px] font-bold text-black">Organização</span>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-[#7259B5] flex items-center justify-center text-lg font-bold text-white">
                {orgAvatarUrl ? <img src={orgAvatarUrl} alt="" className="w-full h-full object-cover bg-white" /> : <span>{(orgNome || "?").charAt(0).toUpperCase()}</span>}
              </div>
              <div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 rounded border border-[#7259B5]/30 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#7259B5] transition hover:bg-black/[.04]">
                    {savingOrg ? "Enviando…" : <>Alterar logo<Camera size={12} /></>}
                  </span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadOrgAvatar(f); e.target.value = ""; }} />
                </label>
                <p className="mt-1.5 text-[10px] text-black/35">PNG, JPG ou WEBP · até 2MB</p>
              </div>
            </div>
            <div>
              <label className="block mb-1.5 text-[11px] font-bold uppercase tracking-widest text-black/30">Nome da organização</label>
              <input
                value={orgNome}
                onChange={(e) => setOrgNome(e.target.value)}
                required
                placeholder="Nome da sua organização"
                className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[12px] text-black outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10"
              />
            </div>
            <div className="flex justify-end border-t pt-5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
              <button
                type="submit"
                disabled={savingOrg}
                className="rounded border border-[#7259B5]/30 bg-white px-4 py-2 text-[12px] font-semibold text-[#7259B5] transition hover:bg-black/[.04] active:scale-[.98] disabled:opacity-40"
              >
                {savingOrg ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Visibilidade (admin only) */}
      {activeSection === "equipe" && isAdmin && (
        <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
          <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            <Eye size={14} className="text-black/30" />
            <span className="text-[12px] font-bold text-black">Visibilidade da Equipe</span>
          </div>
          <div className="p-6 space-y-6">
            {/* Captações */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-black/30 mb-3">Quem vê as captações?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleUpdateVisibilidade("admin_only")}
                  disabled={salvando}
                  className="flex items-start gap-3 p-4 rounded border text-left transition"
                  style={{
                    borderColor: config?.visibilidade_captacoes === "admin_only" ? "#7259B5" : "rgba(13,13,13,.10)",
                    background: config?.visibilidade_captacoes === "admin_only" ? "rgba(114,89,181,0.04)" : "white",
                  }}
                >
                  <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: "rgba(220,38,38,0.08)" }}>
                    <EyeOff size={14} style={{ color: "#D94E4E" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold" style={{ color: config?.visibilidade_captacoes === "admin_only" ? "#7259B5" : "#0D0D0D" }}>
                      Só seus próprios
                    </p>
                    <p className="text-[10px] text-black/40 mt-0.5">Captador vê apenas suas captações</p>
                  </div>
                  {config?.visibilidade_captacoes === "admin_only" && <Check size={14} style={{ color: "#7259B5" }} className="flex-shrink-0 mt-1" />}
                </button>

                <button
                  onClick={() => handleUpdateVisibilidade("team_shared")}
                  disabled={salvando}
                  className="flex items-start gap-3 p-4 rounded border text-left transition"
                  style={{
                    borderColor: config?.visibilidade_captacoes === "team_shared" ? "#7259B5" : "rgba(13,13,13,.10)",
                    background: config?.visibilidade_captacoes === "team_shared" ? "rgba(114,89,181,0.04)" : "white",
                  }}
                >
                  <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: "rgba(16,185,129,0.08)" }}>
                    <Eye size={14} style={{ color: "#1A8B7A" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold" style={{ color: config?.visibilidade_captacoes === "team_shared" ? "#7259B5" : "#0D0D0D" }}>
                      Todos veem tudo
                    </p>
                    <p className="text-[10px] text-black/40 mt-0.5">Equipe inteira tem acesso completo</p>
                  </div>
                  {config?.visibilidade_captacoes === "team_shared" && <Check size={14} style={{ color: "#7259B5" }} className="flex-shrink-0 mt-1" />}
                </button>
              </div>
            </div>

            {/* Contatos */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-black/30 mb-3">Quem vê contatos de empresas?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleUpdateAcessoContatos("admin_only")}
                  disabled={salvando}
                  className="flex items-start gap-3 p-4 rounded border text-left transition"
                  style={{
                    borderColor: config?.acesso_contatos === "admin_only" ? "#7259B5" : "rgba(13,13,13,.10)",
                    background: config?.acesso_contatos === "admin_only" ? "rgba(114,89,181,0.04)" : "white",
                  }}
                >
                  <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: "rgba(220,38,38,0.08)" }}>
                    <Shield size={14} style={{ color: "#D94E4E" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold" style={{ color: config?.acesso_contatos === "admin_only" ? "#7259B5" : "#0D0D0D" }}>
                      Só admin
                    </p>
                    <p className="text-[10px] text-black/40 mt-0.5">Captadores não acessam contatos</p>
                  </div>
                  {config?.acesso_contatos === "admin_only" && <Check size={14} style={{ color: "#7259B5" }} className="flex-shrink-0 mt-1" />}
                </button>

                <button
                  onClick={() => handleUpdateAcessoContatos("team_with_credits")}
                  disabled={salvando}
                  className="flex items-start gap-3 p-4 rounded border text-left transition"
                  style={{
                    borderColor: config?.acesso_contatos === "team_with_credits" ? "#7259B5" : "rgba(13,13,13,.10)",
                    background: config?.acesso_contatos === "team_with_credits" ? "rgba(114,89,181,0.04)" : "white",
                  }}
                >
                  <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: "rgba(114,89,181,0.08)" }}>
                    <CreditCard size={14} style={{ color: "#7259B5" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold" style={{ color: config?.acesso_contatos === "team_with_credits" ? "#7259B5" : "#0D0D0D" }}>
                      Com créditos
                    </p>
                    <p className="text-[10px] text-black/40 mt-0.5">Cada visualização gasta 1 crédito</p>
                  </div>
                  {config?.acesso_contatos === "team_with_credits" && <Check size={14} style={{ color: "#7259B5" }} className="flex-shrink-0 mt-1" />}
                </button>
              </div>
            </div>
        </div>
      </div>
      )}

      {/* Contribuições Pendentes (admin only) */}
      {activeSection === "equipe" && isAdmin && contribuicoesPendentes.length > 0 && (
        <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
          <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            <MessageSquare size={14} className="text-black/30" />
            <span className="text-[12px] font-bold text-black">Contribuições Pendentes</span>
            <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#B07A14]/10 text-[#B07A14]">
              {contribuicoesPendentes.length}
            </span>
          </div>
          <div>
            {contribuicoesPendentes.map((c, idx) => (
              <div key={c.id} className="px-6 py-4 hover:bg-black/[0.02] transition"
                style={idx > 0 ? { borderTop: "1px solid rgba(13,13,13,.10)" } : undefined}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{
                        background: c.tipo === "adicao" ? "#1A8B7A14" : c.tipo === "correcao" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                        color: c.tipo === "adicao" ? "#1A8B7A" : c.tipo === "correcao" ? "#B07A14" : "#D94E4E",
                      }}>
                        {c.tipo === "adicao" ? "ADIÇÃO" : c.tipo === "correcao" ? "CORREÇÃO" : "SINALIZAÇÃO"}
                      </span>
                      <span className="text-[10px] text-black/30">{c.tabela_alvo}</span>
                      {c.campo && <span className="text-[10px] text-black/30">· {c.campo}</span>}
                    </div>
                    {c.valor_proposto && (
                      <p className="text-[12px] text-black/70 font-medium">
                        {typeof c.valor_proposto === "object" ? JSON.stringify(c.valor_proposto) : String(c.valor_proposto)}
                      </p>
                    )}
                    {c.justificativa && (
                      <p className="text-[11px] text-black/40 mt-1 italic">"{c.justificativa}"</p>
                    )}
                    <p className="text-[10px] text-black/25 mt-1">
                      {c.profiles?.full_name ?? c.profiles?.email ?? "Usuário"} · {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleAprovarContribuicao(c.id)}
                      disabled={salvando}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold rounded transition disabled:opacity-40"
                      style={{ background: "#1A8B7A14", color: "#1A8B7A" }}
                    >
                      <CheckCircle size={11} /> Aprovar
                    </button>
                    <button
                      onClick={() => handleRejeitarContribuicao(c.id)}
                      disabled={salvando}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold rounded transition disabled:opacity-40"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#D94E4E" }}
                    >
                      <XCircle size={11} /> Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Membros */}
      {activeSection === "equipe" && (
      <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-black/30" />
            <span className="text-[12px] font-bold text-black">Membros da Equipe</span>
            <span className="text-[10px] text-black/30 font-medium ml-1">({membros.length})</span>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowMembroModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 rounded hover:bg-black/[.04] transition"
            >
              <Plus size={12} /> Adicionar
            </button>
          )}
        </div>

        {membros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users size={24} className="text-black/15 mb-2" />
            <p className="text-[13px] text-black/40">Nenhum membro</p>
          </div>
        ) : (
          <div>
            {membros.map((m, idx) => (
              <div key={m.user_id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-black/[0.02] transition"
                style={idx > 0 ? { borderTop: "1px solid rgba(13,13,13,.10)" } : undefined}>
                <div className="w-9 h-9 rounded-full bg-[#7259B5] flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0">
                  {(m.full_name || m.email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-black">{m.full_name ?? "Sem nome"}</p>
                  <p className="text-[11px] text-black/40 truncate">{m.email}</p>
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={m.papel}
                      onChange={(e) => handleAlterarPapel(m.user_id, e.target.value)}
                      disabled={salvando}
                      className="px-2 py-1 text-[10px] font-bold rounded border appearance-none cursor-pointer"
                      style={{ borderColor: "rgba(13,13,13,.12)", background: "white" }}
                    >
                      <option value="admin">Admin</option>
                      <option value="colaborador">Colaborador</option>
                      <option value="leitor">Leitor</option>
                      {m.papel === "captador" && <option value="captador">Captador externo</option>}
                    </Select>
                    <button
                      onClick={() => handleRemoverMembro(m.user_id)}
                      disabled={salvando}
                      className="text-[10px] text-black/30 hover:text-[#D94E4E] transition"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                    style={{
                      background: m.papel === "admin" ? "rgba(107,33,168,0.1)" : "rgba(13,13,13,.07)",
                      color: m.papel === "admin" ? "#7259B5" : "rgba(13,13,13,.55)",
                    }}
                  >
                    {PAPEL_LABEL[m.papel] ?? m.papel}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Etiquetas de captação */}
      {activeSection === "funis" && (
      <div className="space-y-8">
        {organizationId && <div><div className="mb-4 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded bg-black/[.045]"><Handshake size={14} className="text-black/45"/></div><p className="text-[13px] font-bold text-black">Renovação de clientes</p></div><RenewalDecisionTreeConfig organizationId={organizationId}/></div>}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: "rgba(26,139,122,0.08)" }}>
              <MessageSquare size={14} style={{ color: "#1A8B7A" }} />
            </div>
            <p className="text-[13px] font-bold text-black">Canais e origem comercial</p>
          </div>
          <TaxonomiasComerciaisConfig />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: "rgba(114,89,181,0.08)" }}>
              <Handshake size={14} style={{ color: "#7259B5" }} />
            </div>
            <p className="text-[13px] font-bold text-black">Funil de negociações</p>
          </div>
          <EtiquetasConfig entidade="captacao" />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: "rgba(45,114,176,0.08)" }}>
              <FileCheck size={14} style={{ color: "#2D72B0" }} />
            </div>
            <p className="text-[13px] font-bold text-black">Funil de inscrições</p>
          </div>
          <EtiquetasConfig entidade="inscricao" />
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-black/[.045]">
              <Building2 size={14} className="text-black/45" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-black">Tipos de proponente</p>
              <p className="mt-0.5 text-[10px] text-black/30">Edite nome, cor e ícone ou crie suas próprias etiquetas.</p>
            </div>
          </div>
          <EtiquetasConfig entidade="proponente" />
        </div>
      </div>
      )}
          </div>
        </section>
      </div>

      {/* Modal de novo membro */}
      <NovoMembroModal
        open={showMembroModal}
        onClose={() => setShowMembroModal(false)}
        onSaved={loadMembers}
      />
    </div>
  );
}
