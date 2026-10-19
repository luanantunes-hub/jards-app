"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard, Users, Eye, EyeOff, Shield,
  Check, AlertCircle, Plus,
  MessageSquare, CheckCircle, XCircle,
  UserCircle, Plug, Tags, Handshake, FileCheck,
  Camera, Building2, Lock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatarTamanho, mensagemErroUpload, prepararImagem } from "@/lib/imagem-upload";
import { useOrganizationId } from "@/contexts/OrganizationContext";
import { useCreditos } from "@/contexts/CreditosContext";
import { useDeleteConfirm } from "@/contexts/DeleteConfirmContext";
import NovoMembroModal from "@/components/modals/NovoMembroModal";
import { CalendarConnections } from "@/components/CalendarConnections";
import { McpConnectionCard } from "@/components/McpConnectionCard";
import { EtiquetasConfig } from "@/components/EtiquetasConfig";
import { OpportunityLabelsConfig } from "@/components/captadores/OpportunityLabels";
import { TaxonomiasComerciaisConfig } from "@/components/TaxonomiasComerciaisConfig";
import { RenewalDecisionTreeConfig } from "@/components/customer-success/RenewalDecisionTreeConfig";
import { fetchOrganizationMembers } from "@/lib/organization/members";
import { Select } from "@/components/ui/Select";
import { FUNCOES_PRESTACAO, MODULO_LABEL, modulosDaEquipe, papelPodeUsarModulo } from "@/lib/equipe-modulos";
import { normalizarModulos, type ModuloId } from "@/lib/modulos";
import { PermissoesProducaoDoMembro } from "@/components/producao/PermissoesProducaoDoMembro";
import { useFuncoesProducao } from "@/hooks/useFuncoesProducao";

const MOSTRAR_VISIBILIDADE_EQUIPE = false;

type AvisoImagemEstado = { tipo: "ok" | "erro"; texto: string } | null;

// Aviso junto do botão de foto/logo: enviando, sucesso ou o motivo da falha
function AvisoImagem({ aviso, enviando }: { aviso: AvisoImagemEstado; enviando: boolean }) {
  if (enviando) return <p className="mt-1.5 text-[0.6875rem] text-black/45" role="status">Enviando imagem…</p>;
  if (aviso) {
    const erro = aviso.tipo === "erro";
    return (
      <p
        className={`mt-1.5 flex max-w-[22rem] items-start gap-1.5 text-[0.6875rem] font-medium leading-snug ${erro ? "text-[#D94E4E]" : "text-[#2E8932]"}`}
        role={erro ? "alert" : "status"}
      >
        {erro ? <AlertCircle size={12} className="mt-[1px] flex-shrink-0" /> : <Check size={12} className="mt-[1px] flex-shrink-0" />}
        {aviso.texto}
      </p>
    );
  }
  return <p className="mt-1.5 text-[0.625rem] text-black/35">PNG, JPG ou WEBP</p>;
}

/* -------------------------------------------------------------------------- */
/*                                  TYPES                                     */
/* -------------------------------------------------------------------------- */

interface MembroOrg {
  user_id: string;
  papel: string;
  modulos_acesso?: string[];
  prestacao_funcao?: string | null;
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
  basico: "Starter",
  profissional: "Pro",
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
  const { confirmDelete } = useDeleteConfirm();

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
  const [avisoFoto, setAvisoFoto] = useState<AvisoImagemEstado>(null);
  const [savingLogo, setSavingLogo] = useState(false);
  const [avisoLogo, setAvisoLogo] = useState<AvisoImagemEstado>(null);
  const [orgNome, setOrgNome] = useState("");
  const [orgAvatarUrl, setOrgAvatarUrl] = useState<string | null>(null);
  const [orgModulos, setOrgModulos] = useState<ModuloId[]>(["captacao"]);
  const [savingOrg, setSavingOrg] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  // Funções na produção (PD0.7b): só o administrador de uma organização com a produção as lê.
  const { funcoes: funcoesProducao, recarregar: recarregarFuncoesProducao, atualizar: atualizarFuncaoProducao } = useFuncoesProducao(organizationId, isAdmin && orgModulos.includes("producao"));

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
        .select("nome, avatar_url, modulos_ativos")
        .eq("id", organizationId)
        .maybeSingle();
      if (orgData) {
        setOrgNome(orgData.nome ?? "");
        setOrgAvatarUrl(orgData.avatar_url ?? null);
        setOrgModulos(normalizarModulos(orgData.modulos_ativos));
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

  // Aviso de sucesso some sozinho; erro fica até a próxima tentativa
  function avisarSucesso(definir: (valor: AvisoImagemEstado | ((atual: AvisoImagemEstado) => AvisoImagemEstado)) => void, texto: string) {
    definir({ tipo: "ok", texto });
    window.setTimeout(() => definir((atual) => (atual?.texto === texto ? null : atual)), 5000);
  }

  async function uploadUserAvatar(file: File) {
    setAvisoFoto(null);
    setSavingAvatar(true);
    const preparada = await prepararImagem(file);
    if (!preparada.ok) { setAvisoFoto({ tipo: "erro", texto: preparada.mensagem }); setSavingAvatar(false); return; }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAvisoFoto({ tipo: "erro", texto: "Sua sessão expirou. Entre de novo para trocar a foto." }); setSavingAvatar(false); return; }

    const path = `user/${user.id}/avatar.${preparada.extensao}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, preparada.arquivo, { upsert: true, contentType: preparada.tipo });
    if (upErr) { setAvisoFoto({ tipo: "erro", texto: mensagemErroUpload(upErr) }); setSavingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    // O arquivo é sempre o mesmo caminho: a versão no endereço evita o navegador mostrar a foto antiga em cache
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    const [p1, p2] = await Promise.all([
      (supabase as any).from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id),
      supabase.auth.updateUser({ data: { ...user.user_metadata, avatar_url: publicUrl } }),
    ]);
    if (p1.error || p2.error) { setAvisoFoto({ tipo: "erro", texto: "A foto foi enviada, mas não conseguimos salvá-la no perfil. Tente de novo." }); setSavingAvatar(false); return; }
    setAvatarUrl(publicUrl);
    setSavingAvatar(false);
    avisarSucesso(setAvisoFoto, preparada.reduzida
      ? `Foto atualizada. A imagem tinha ${formatarTamanho(preparada.tamanhoOriginal)} e foi reduzida automaticamente.`
      : "Foto atualizada.");
  }

  async function removeUserAvatar() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSavingAvatar(true);
    setAvisoFoto(null);
    const [p1, p2] = await Promise.all([
      (supabase as any).from("profiles").update({ avatar_url: null }).eq("id", user.id),
      supabase.auth.updateUser({ data: { ...user.user_metadata, avatar_url: null } }),
    ]);
    if (p1.error || p2.error) { setAvisoFoto({ tipo: "erro", texto: "Não foi possível remover a foto. Tente de novo." }); setSavingAvatar(false); return; }
    setAvatarUrl(null);
    setSavingAvatar(false);
    avisarSucesso(setAvisoFoto, "Foto removida.");
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

  async function handleCancelarAssinatura() {
    setCancelando(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.url) { setErro(body?.error ?? "Não foi possível abrir o portal de cancelamento."); setCancelando(false); return; }
      window.location.href = body.url;
    } catch {
      setErro("Não foi possível abrir o portal de cancelamento.");
      setCancelando(false);
    }
  }

  async function uploadOrgAvatar(file: File) {
    if (!organizationId) return;
    setAvisoLogo(null);
    setSavingLogo(true);
    const preparada = await prepararImagem(file);
    if (!preparada.ok) { setAvisoLogo({ tipo: "erro", texto: preparada.mensagem }); setSavingLogo(false); return; }
    const supabase = createClient();
    const path = `org/${organizationId}/avatar.${preparada.extensao}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, preparada.arquivo, { upsert: true, contentType: preparada.tipo });
    if (upErr) { setAvisoLogo({ tipo: "erro", texto: mensagemErroUpload(upErr) }); setSavingLogo(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    const response = await fetch("/api/settings/organization/basic", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, avatar_url: publicUrl }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setAvisoLogo({ tipo: "erro", texto: body.error ?? "A logo foi enviada, mas não conseguimos salvá-la. Tente de novo." }); setSavingLogo(false); return; }
    setOrgAvatarUrl(publicUrl);
    window.dispatchEvent(new Event("jards:org-updated"));
    setSavingLogo(false);
    avisarSucesso(setAvisoLogo, preparada.reduzida
      ? `Logo atualizada. A imagem tinha ${formatarTamanho(preparada.tamanhoOriginal)} e foi reduzida automaticamente.`
      : "Logo atualizada.");
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

  function handleRemoverMembro(userId: string) {
    if (!organizationId) return;
    confirmDelete({
      title: "Remover este membro da organização?",
      description: "A pessoa perde o acesso imediatamente. Os registros criados por ela continuam na organização.",
      confirmLabel: "Remover",
      pendingLabel: "Removendo…",
      illustration: false,
      onConfirm: async () => {
        setSalvando(true);
        setErro(null);
        try {
          const response = await fetch(`/api/members/${encodeURIComponent(userId)}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organization_id: organizationId }),
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error ?? "Não foi possível remover o membro");
          showSuccess("Membro removido");
          await loadMembers();
        } finally {
          setSalvando(false);
        }
      },
    });
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

  /** Módulos e função na prestação de um membro (P0.6); o servidor confere as vagas. */
  async function handleAlterarModulos(userId: string, modulos: string[], funcao: string | null) {
    if (!organizationId) return;
    setSalvando(true);
    setErro(null);
    const response = await fetch(`/api/members/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: organizationId, modulos, prestacao_funcao: funcao }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) setErro(body.error ?? "Não foi possível alterar os módulos");
    else { showSuccess("Acesso atualizado"); await loadMembers(); }
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
  // Saldo baixo ou zerado é alerta: colore a barra e o ícone, nunca o número.
  const creditosDisponiveis = creditos?.creditos_disponiveis ?? 0;
  const alertaCreditos = creditosDisponiveis > 10 ? null : creditosDisponiveis > 0 ? "#B07A14" : "#D94A4A";

  return (
    <div className="w-full px-5 md:px-8 lg:px-10 py-8 md:py-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[1.375rem] font-bold text-[#282525]">Configurações</h1>
        <p className="text-[0.8125rem] text-black/40 mt-1">
          Gerencie sua conta, integrações, equipe e processos
        </p>
      </div>

      {/* Feedback */}
      {erro && (
        <div className="flex items-center gap-2 px-4 py-3 rounded text-[0.75rem] font-medium mb-4" style={{ background: "#fff", border: "1px solid #D94E4E47", color: "#D94E4E" }}>
          <AlertCircle size={14} />
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="flex items-center gap-2 px-4 py-3 rounded text-[0.75rem] font-medium mb-4" style={{ background: "#fff", border: "1px solid #2E893247", color: "#2E8932" }}>
          <Check size={14} />
          {sucesso}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[14.5rem_minmax(0,1fr)] gap-6 md:gap-8 lg:gap-10 items-start">
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
                  className={`group flex min-w-[11.125rem] md:min-w-0 w-full items-center gap-3 rounded px-3 py-3 text-left transition-colors active:scale-[0.98] ${
                    active
                      ? "bg-[#282525] text-white"
                      : "text-black/50 hover:bg-black/[0.04] hover:text-[#282525]"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} className="flex-shrink-0" />
                  <span className="min-w-0 text-[0.75rem] font-semibold whitespace-nowrap">{label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0" aria-live="polite">
          <div className="mb-5">
            <h2 className="text-[1.0625rem] font-bold text-[#282525]">{currentSection.label}</h2>
          </div>

          <div className="space-y-6">
      {activeSection === "ferramentas" && (
        <>
          <CalendarConnections />
          <McpConnectionCard />
        </>
      )}

      {/* Plano + Créditos */}
      {activeSection === "conta" && (
      <>
      {/* Meu perfil */}
      <form onSubmit={handleSalvarPerfil} className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
        <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <UserCircle size={14} className="text-black/30" />
          <span className="text-[0.75rem] font-bold text-[#282525]">Meu perfil</span>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-[#7259B5] flex items-center justify-center text-lg font-bold text-white">
              {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover bg-white" /> : <span>{(nome || email || "?").charAt(0).toUpperCase()}</span>}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 rounded border border-[#7259B5]/30 bg-white px-3 py-1.5 text-[0.6875rem] font-semibold text-[#7259B5] transition hover:bg-black/[.04]">
                    {savingAvatar ? "Enviando…" : <>Alterar foto<Camera size={12} /></>}
                  </span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={savingAvatar} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadUserAvatar(f); e.target.value = ""; }} />
                </label>
                {avatarUrl && (
                  <button type="button" onClick={() => void removeUserAvatar()} disabled={savingAvatar} className="text-[0.6875rem] font-medium text-black/35 hover:text-[#D94E4E] transition disabled:opacity-40">
                    Remover
                  </button>
                )}
              </div>
              <AvisoImagem aviso={avisoFoto} enviando={savingAvatar} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block mb-1.5 text-[0.6875rem] font-bold uppercase tracking-widest text-black/30">Nome completo</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                placeholder="Como podemos chamar você?"
                className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.75rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10"
              />
            </div>
            <div>
              <label className="block mb-1.5 text-[0.6875rem] font-bold uppercase tracking-widest text-black/30">E-mail</label>
              <input
                value={email}
                readOnly
                disabled
                className="w-full rounded border border-black/[.12] bg-black/[0.02] px-3 py-2.5 text-[0.75rem] text-black/45 outline-none cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex justify-end border-t pt-5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            <button
              type="submit"
              disabled={salvando}
              className="rounded border border-[#7259B5]/30 bg-white px-4 py-2 text-[0.75rem] font-semibold text-[#7259B5] transition hover:bg-black/[.04] active:scale-[.98] disabled:opacity-40"
            >
              {salvando ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </div>
      </form>

      <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
        <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <Lock size={14} className="text-black/30" />
          <span className="text-[0.75rem] font-bold text-[#282525]">Senha</span>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[0.8125rem] font-semibold text-[#282525]">Sua senha de acesso</p>
              <p className="mt-0.5 text-[0.6875rem] text-black/40">Use uma senha que você não usa em outros serviços.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/alterar-senha")}
              className="rounded border border-[#7259B5]/30 bg-white px-3 py-2 text-[0.6875rem] font-semibold text-[#7259B5] transition hover:bg-black/[.04]"
            >
              Alterar senha
            </button>
          </div>
        </div>
      </div>

      <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
        <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
          <CreditCard size={14} className="text-black/30" />
          <span className="text-[0.75rem] font-bold text-[#282525]">Plano e créditos</span>
          <span className="ml-auto text-[0.6875rem] font-semibold px-2 py-0.5 rounded" style={{ background: "#fff", border: "1px solid #7259B547", color: "#7259B5" }}>
            {PLANO_LABEL[assinatura?.plano ?? "gratuito"] ?? assinatura?.plano ?? "Gratuito"}
          </span>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between p-4 rounded" style={{ background: "rgba(13,13,13,.03)" }}>
            <p className="text-[0.8125rem] font-semibold text-[#282525]">Plano {PLANO_LABEL[assinatura?.plano ?? "gratuito"] ?? "Gratuito"}</p>
            <button onClick={() => router.push("/meu-plano")} className="rounded border border-[#7259B5]/30 bg-white px-3 py-2 text-[0.6875rem] font-semibold text-[#7259B5] transition hover:bg-black/[.04]">
              Gerenciar plano
            </button>
          </div>

          {/* Saldo de créditos */}
          <div className="p-4 rounded border" style={{ borderColor: "rgba(13,13,13,.10)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[0.8125rem] font-semibold text-[#282525]">Saldo de créditos</p>
              <span className="text-[0.6875rem] tabular-nums text-black/40">
                {creditos?.creditos_usados ?? 0} / {creditos?.creditos_totais ?? 0} usados
              </span>
            </div>
            {/* Barra */}
            <div className="w-full h-2.5 rounded-full" style={{ background: "rgba(13,13,13,.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${creditos?.creditos_totais ? ((creditos.creditos_totais - creditos.creditos_disponiveis) / creditos.creditos_totais) * 100 : 0}%`,
                  background: alertaCreditos ?? "rgba(13,13,13,.75)",
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="flex items-center gap-1.5 text-[0.625rem] font-medium uppercase tracking-[.08em] text-black/45">
                {alertaCreditos && (
                  <AlertCircle size={12} strokeWidth={1.75} role="img" aria-label={creditosDisponiveis > 0 ? "Saldo baixo" : "Sem créditos"} className="shrink-0" style={{ color: alertaCreditos }} />
                )}
                Disponível
              </span>
              <span className={`text-[0.875rem] font-semibold tabular-nums ${creditosDisponiveis ? "text-[#282525]" : "text-black/30"}`}>
                {creditosDisponiveis}
              </span>
            </div>
          </div>

          {assinatura?.ehPagador && assinatura.plano !== "gratuito" && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCancelarAssinatura}
                disabled={cancelando}
                className="text-[0.6875rem] font-medium text-black/30 transition hover:text-black/50 disabled:opacity-50"
              >
                {cancelando ? "Abrindo…" : "Cancelar assinatura"}
              </button>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* Organização (admin only) */}
      {activeSection === "equipe" && isAdmin && (
        <form onSubmit={handleSalvarOrganizacao} className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
          <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            <Building2 size={14} className="text-black/30" />
            <span className="text-[0.75rem] font-bold text-[#282525]">Organização</span>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-[#7259B5] flex items-center justify-center text-lg font-bold text-white">
                {orgAvatarUrl ? <img src={orgAvatarUrl} alt="" className="w-full h-full object-cover bg-white" /> : <span>{(orgNome || "?").charAt(0).toUpperCase()}</span>}
              </div>
              <div>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 rounded border border-[#7259B5]/30 bg-white px-3 py-1.5 text-[0.6875rem] font-semibold text-[#7259B5] transition hover:bg-black/[.04]">
                    {savingLogo ? "Enviando…" : <>Alterar logo<Camera size={12} /></>}
                  </span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={savingLogo} onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadOrgAvatar(f); e.target.value = ""; }} />
                </label>
                <AvisoImagem aviso={avisoLogo} enviando={savingLogo} />
              </div>
            </div>
            <div>
              <label className="block mb-1.5 text-[0.6875rem] font-bold uppercase tracking-widest text-black/30">Nome da organização</label>
              <input
                value={orgNome}
                onChange={(e) => setOrgNome(e.target.value)}
                required
                placeholder="Nome da sua organização"
                className="w-full rounded border border-black/[.12] bg-white px-3 py-2.5 text-[0.75rem] text-[#282525] outline-none transition focus:border-[#7259B5]/40 focus:ring-2 focus:ring-[#7259B5]/10"
              />
            </div>
            <div className="flex justify-end border-t pt-5" style={{ borderColor: "rgba(13,13,13,.06)" }}>
              <button
                type="submit"
                disabled={savingOrg}
                className="rounded border border-[#7259B5]/30 bg-white px-4 py-2 text-[0.75rem] font-semibold text-[#7259B5] transition hover:bg-black/[.04] active:scale-[.98] disabled:opacity-40"
              >
                {savingOrg ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Visibilidade (admin only) — oculta por enquanto; os valores salvos continuam valendo */}
      {MOSTRAR_VISIBILIDADE_EQUIPE && activeSection === "equipe" && isAdmin && (
        <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
          <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            <Eye size={14} className="text-black/30" />
            <span className="text-[0.75rem] font-bold text-[#282525]">Visibilidade da equipe</span>
          </div>
          <div className="p-6 space-y-6">
            {/* Captações */}
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-black/30 mb-3">Quem vê as negociações?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleUpdateVisibilidade("admin_only")}
                  disabled={salvando}
                  className="flex items-start gap-3 p-4 rounded border text-left transition"
                  style={{
                    borderColor: config?.visibilidade_captacoes === "admin_only" ? "#7259B5" : "rgba(13,13,13,.10)",
                    background: "white",
                  }}
                >
                  <div className="w-8 h-8 rounded border bg-transparent flex items-center justify-center flex-shrink-0" style={{ borderColor: "#D94E4E66" }}>
                    <EyeOff size={14} style={{ color: "#D94E4E" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.75rem] font-semibold" style={{ color: config?.visibilidade_captacoes === "admin_only" ? "#7259B5" : "#282525" }}>
                      Só seus próprios
                    </p>
                    <p className="text-[0.625rem] text-black/40 mt-0.5">Captador vê apenas suas negociações</p>
                  </div>
                  {config?.visibilidade_captacoes === "admin_only" && <Check size={14} style={{ color: "#7259B5" }} className="flex-shrink-0 mt-1" />}
                </button>

                <button
                  onClick={() => handleUpdateVisibilidade("team_shared")}
                  disabled={salvando}
                  className="flex items-start gap-3 p-4 rounded border text-left transition"
                  style={{
                    borderColor: config?.visibilidade_captacoes === "team_shared" ? "#7259B5" : "rgba(13,13,13,.10)",
                    background: "white",
                  }}
                >
                  <div className="w-8 h-8 rounded border bg-transparent flex items-center justify-center flex-shrink-0" style={{ borderColor: "#1A8B7A66" }}>
                    <Eye size={14} style={{ color: "#1A8B7A" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.75rem] font-semibold" style={{ color: config?.visibilidade_captacoes === "team_shared" ? "#7259B5" : "#282525" }}>
                      Todos veem tudo
                    </p>
                    <p className="text-[0.625rem] text-black/40 mt-0.5">Equipe inteira tem acesso completo</p>
                  </div>
                  {config?.visibilidade_captacoes === "team_shared" && <Check size={14} style={{ color: "#7259B5" }} className="flex-shrink-0 mt-1" />}
                </button>
              </div>
            </div>

            {/* Contatos */}
            <div>
              <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-black/30 mb-3">Quem vê contatos de empresas?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleUpdateAcessoContatos("admin_only")}
                  disabled={salvando}
                  className="flex items-start gap-3 p-4 rounded border text-left transition"
                  style={{
                    borderColor: config?.acesso_contatos === "admin_only" ? "#7259B5" : "rgba(13,13,13,.10)",
                    background: "white",
                  }}
                >
                  <div className="w-8 h-8 rounded border bg-transparent flex items-center justify-center flex-shrink-0" style={{ borderColor: "#D94E4E66" }}>
                    <Shield size={14} style={{ color: "#D94E4E" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.75rem] font-semibold" style={{ color: config?.acesso_contatos === "admin_only" ? "#7259B5" : "#282525" }}>
                      Só admin
                    </p>
                    <p className="text-[0.625rem] text-black/40 mt-0.5">Captadores não acessam contatos</p>
                  </div>
                  {config?.acesso_contatos === "admin_only" && <Check size={14} style={{ color: "#7259B5" }} className="flex-shrink-0 mt-1" />}
                </button>

                <button
                  onClick={() => handleUpdateAcessoContatos("team_with_credits")}
                  disabled={salvando}
                  className="flex items-start gap-3 p-4 rounded border text-left transition"
                  style={{
                    borderColor: config?.acesso_contatos === "team_with_credits" ? "#7259B5" : "rgba(13,13,13,.10)",
                    background: "white",
                  }}
                >
                  <div className="w-8 h-8 rounded border bg-transparent flex items-center justify-center flex-shrink-0" style={{ borderColor: "#7259B566" }}>
                    <CreditCard size={14} style={{ color: "#7259B5" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.75rem] font-semibold" style={{ color: config?.acesso_contatos === "team_with_credits" ? "#7259B5" : "#282525" }}>
                      Com créditos
                    </p>
                    <p className="text-[0.625rem] text-black/40 mt-0.5">Cada visualização gasta 1 crédito</p>
                  </div>
                  {config?.acesso_contatos === "team_with_credits" && <Check size={14} style={{ color: "#7259B5" }} className="flex-shrink-0 mt-1" />}
                </button>
              </div>
            </div>
        </div>
      </div>
      )}

      {/* Contribuições pendentes (admin only) */}
      {activeSection === "equipe" && isAdmin && contribuicoesPendentes.length > 0 && (
        <div className="rounded border overflow-hidden" style={{ borderColor: "rgba(13,13,13,.06)", background: "white" }}>
          <div className="flex items-center gap-2 px-6 py-4 border-b" style={{ borderColor: "rgba(13,13,13,.06)" }}>
            <MessageSquare size={14} className="text-black/30" />
            <span className="text-[0.75rem] font-bold text-[#282525]">Contribuições pendentes</span>
            <span className="ml-2 rounded border border-black/[.10] bg-white px-2 py-0.5 text-[0.625rem] font-semibold tabular-nums text-[#282525]">
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
                      <span className="text-[0.625rem] font-bold px-1.5 py-0.5 rounded" style={{
                        background: "#fff",
                        border: `1px solid ${c.tipo === "adicao" ? "#1A8B7A47" : c.tipo === "correcao" ? "#B07A1447" : "#D94E4E47"}`,
                        color: c.tipo === "adicao" ? "#1A8B7A" : c.tipo === "correcao" ? "#B07A14" : "#D94E4E",
                      }}>
                        {c.tipo === "adicao" ? "ADIÇÃO" : c.tipo === "correcao" ? "CORREÇÃO" : "SINALIZAÇÃO"}
                      </span>
                      <span className="text-[0.625rem] text-black/30">{c.tabela_alvo}</span>
                      {c.campo && <span className="text-[0.625rem] text-black/30">· {c.campo}</span>}
                    </div>
                    {c.valor_proposto && (
                      <p className="text-[0.75rem] text-black/70 font-medium">
                        {typeof c.valor_proposto === "object" ? JSON.stringify(c.valor_proposto) : String(c.valor_proposto)}
                      </p>
                    )}
                    {c.justificativa && (
                      <p className="text-[0.6875rem] text-black/40 mt-1 italic">"{c.justificativa}"</p>
                    )}
                    <p className="text-[0.625rem] text-black/25 mt-1">
                      {c.profiles?.full_name ?? c.profiles?.email ?? "Usuário"} · {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleAprovarContribuicao(c.id)}
                      disabled={salvando}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[0.625rem] font-semibold rounded transition disabled:opacity-40"
                      style={{ background: "#fff", border: "1px solid #1A8B7A47", color: "#1A8B7A" }}
                    >
                      <CheckCircle size={11} /> Aprovar
                    </button>
                    <button
                      onClick={() => handleRejeitarContribuicao(c.id)}
                      disabled={salvando}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[0.625rem] font-semibold rounded transition disabled:opacity-40"
                      style={{ background: "#fff", border: "1px solid #D94E4E47", color: "#D94E4E" }}
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
            <span className="text-[0.75rem] font-bold text-[#282525]">Membros da equipe</span>
            <span className="text-[0.625rem] text-black/30 font-medium ml-1">({membros.length})</span>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowMembroModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[0.6875rem] font-medium bg-white text-[#7259B5] border border-[#7259B5]/25 rounded hover:bg-black/[.04] transition"
            >
              <Plus size={12} /> Adicionar
            </button>
          )}
        </div>

        {membros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users size={24} className="text-black/15 mb-2" />
            <p className="text-[0.8125rem] text-black/40">Nenhum membro</p>
          </div>
        ) : (
          <div>
            {membros.map((m, idx) => (
              <div key={m.user_id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-black/[0.02] transition"
                style={idx > 0 ? { borderTop: "1px solid rgba(13,13,13,.10)" } : undefined}>
                <div className="w-9 h-9 rounded-full bg-[#7259B5] flex items-center justify-center text-[0.75rem] font-bold text-white flex-shrink-0">
                  {(m.full_name || m.email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.8125rem] font-semibold text-[#282525]">{m.full_name ?? "Sem nome"}</p>
                  <p className="text-[0.6875rem] text-black/40 truncate">{m.email}</p>
                  <ModulosDoMembro
                    membro={m}
                    modulosDaOrganizacao={orgModulos}
                    editavel={isAdmin}
                    ocupado={salvando}
                    onChange={(modulos, funcao) => handleAlterarModulos(m.user_id, modulos, funcao)}
                  />
                  <PermissoesProducaoDoMembro
                    organizationId={organizationId}
                    membro={m}
                    souAdmin={isAdmin}
                    modulosDaOrganizacao={orgModulos}
                    funcao={funcoesProducao?.[m.user_id] ?? null}
                    recarregar={recarregarFuncoesProducao}
                    onSaved={funcao => { atualizarFuncaoProducao(m.user_id, funcao); showSuccess("Permissões da produção atualizadas"); }}
                  />
                </div>
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <Select
                      value={m.papel}
                      onChange={(e) => handleAlterarPapel(m.user_id, e.target.value)}
                      disabled={salvando}
                      className="px-2 py-1 text-[0.625rem] font-bold rounded border appearance-none cursor-pointer"
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
                      className="text-[0.625rem] text-black/30 hover:text-[#D94E4E] transition"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <span
                    className="text-[0.625rem] font-bold px-2 py-0.5 rounded uppercase"
                    style={{
                      background: m.papel === "admin" ? "#fff" : "rgba(13,13,13,.07)",
                      border: `1px solid ${m.papel === "admin" ? "#7259B547" : "transparent"}`,
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
        <div>
          <h2 className="mb-1 text-[0.8125rem] font-bold text-[#282525]">Tipos de oportunidade do captador</h2>
          <p className="mb-4 text-[0.6875rem] text-black/45">Essas etiquetas são os tipos exibidos no workspace. Você pode renomear, excluir ou criar outros.</p>
          <OpportunityLabelsConfig />
        </div>
        {organizationId && <div><div className="mb-4 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded border border-black/20 bg-transparent"><Handshake size={14} className="text-black/55"/></div><p className="text-[0.8125rem] font-bold text-[#282525]">Renovação de clientes</p></div><RenewalDecisionTreeConfig organizationId={organizationId}/></div>}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded border bg-transparent flex items-center justify-center flex-shrink-0" style={{ borderColor: "#1A8B7A66" }}>
              <MessageSquare size={14} style={{ color: "#1A8B7A" }} />
            </div>
            <p className="text-[0.8125rem] font-bold text-[#282525]">Canais e origem comercial</p>
          </div>
          <TaxonomiasComerciaisConfig />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded border bg-transparent flex items-center justify-center flex-shrink-0" style={{ borderColor: "#7259B566" }}>
              <Handshake size={14} style={{ color: "#7259B5" }} />
            </div>
            <p className="text-[0.8125rem] font-bold text-[#282525]">Funil de negociações</p>
          </div>
          <EtiquetasConfig entidade="captacao" />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded border bg-transparent flex items-center justify-center flex-shrink-0" style={{ borderColor: "#2D72B066" }}>
              <FileCheck size={14} style={{ color: "#2D72B0" }} />
            </div>
            <p className="text-[0.8125rem] font-bold text-[#282525]">Funil de inscrições</p>
          </div>
          <EtiquetasConfig entidade="inscricao" />
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded border border-[#7259B5]/40 text-[#7259B5]"><Building2 size={14} /></div>
            <div>
              <p className="text-[0.8125rem] font-bold text-[#282525]">Maturidade do proponente</p>
              <p className="mt-0.5 text-[0.625rem] text-black/30">Edite, exclua ou acrescente etiquetas para classificar a estrutura da instituição.</p>
            </div>
          </div>
          <EtiquetasConfig entidade="proponente_maturidade" />
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border border-black/20 bg-transparent">
              <Building2 size={14} className="text-black/55" />
            </div>
            <div>
              <p className="text-[0.8125rem] font-bold text-[#282525]">Tipos de proponente</p>
              <p className="mt-0.5 text-[0.625rem] text-black/30">Edite nome, cor e ícone ou crie suas próprias etiquetas.</p>
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
        organizationId={organizationId}
        modulosAtivos={orgModulos}
        onClose={() => setShowMembroModal(false)}
        onSaved={loadMembers}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         MÓDULOS DE CADA MEMBRO                             */
/* -------------------------------------------------------------------------- */

/**
 * Módulos que a pessoa usa e a função dela na prestação (P0.6). Admin liga e
 * desliga cada módulo que a organização tem ativo (ou que a pessoa já usa); o
 * servidor confere as vagas e recusa deixar alguém sem nenhum. Captador e
 * proponente externos usam só a captação. Sem módulo além da captação, não
 * aparece nada.
 */
function ModulosDoMembro({ membro, modulosDaOrganizacao, editavel, ocupado, onChange }: {
  membro: MembroOrg;
  modulosDaOrganizacao: ModuloId[];
  editavel: boolean;
  ocupado: boolean;
  onChange: (modulos: string[], funcao: string | null) => void;
}) {
  const modulos = membro.modulos_acesso?.length ? membro.modulos_acesso : ["captacao"];
  const oferecidos = modulosDaEquipe(modulosDaOrganizacao, membro.modulos_acesso ?? []);
  const funcao = membro.prestacao_funcao ?? "";

  function alternar(modulo: ModuloId) {
    const novos = modulos.includes(modulo) ? modulos.filter(m => m !== modulo) : [...modulos, modulo];
    if (novos.length === 0) return;
    onChange(novos, novos.includes("prestacao") ? funcao || null : null);
  }

  if (oferecidos.length < 2) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {oferecidos.map(modulo => {
        const ativo = modulos.includes(modulo);
        const bloqueado = !editavel || ocupado || !papelPodeUsarModulo(membro.papel, modulo) || (ativo && modulos.length === 1);
        if (!editavel && !ativo) return null;
        return (
          <button
            key={modulo}
            type="button"
            aria-pressed={ativo}
            disabled={bloqueado}
            onClick={() => alternar(modulo)}
            title={ativo && modulos.length === 1 && editavel ? "A pessoa precisa de ao menos um módulo" : undefined}
            className={`rounded border px-2 py-0.5 text-[0.625rem] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7259B5] disabled:cursor-default ${
              ativo ? "border-[#7259B5]/40 bg-white text-[#684DB0]" : "border-black/10 bg-white text-black/35 hover:text-black/60"
            } ${bloqueado && !ativo ? "opacity-50" : ""}`}
          >
            {MODULO_LABEL[modulo]}
          </button>
        );
      })}
      {modulos.includes("prestacao") && (editavel ? (
        <Select
          block={false}
          value={funcao}
          disabled={ocupado}
          onChange={event => onChange(modulos, event.target.value || null)}
          aria-label="Função na prestação"
          className="py-0.5 pl-2 text-[0.625rem]"
        >
          <option value="">Função na prestação</option>
          {FUNCOES_PRESTACAO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </Select>
      ) : funcao && (
        <span className="text-[0.625rem] text-black/45">
          {FUNCOES_PRESTACAO.find(f => f.value === funcao)?.label}
        </span>
      ))}
    </div>
  );
}
