"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useCallback } from "react";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { PastDueBanner } from "@/components/PastDueBanner";
import {
  BarChart2,
  CalendarDays,
  BriefcaseBusiness,
  ContactRound,
  FilePenLine,
  FileStack,
  FolderOpen,
  Building2,
  Handshake,
  Landmark,
  LayoutDashboard,
  Radar,
  UserRoundCheck,
  Settings,
  LogOut,
  ClipboardCheck,
  Lock,
  Shield,
  Sparkles,
  ArrowLeftRight,
  Menu,
  Store,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { OrganizationContext } from "@/contexts/OrganizationContext";
import { CreditosProvider } from "@/contexts/CreditosContext";
import { EtiquetasProvider } from "@/contexts/EtiquetasContext";
import { TaxonomiasComerciaisProvider } from "@/contexts/TaxonomiasComerciaisContext";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { DeleteConfirmProvider } from "@/contexts/DeleteConfirmContext";
import type { PlanTipo } from "@/lib/supabase/types";
import { correspondeRota, hrefAtivoDoMenu, itemAtivoDoMenu } from "@/lib/navigation/rotas";
import { destinoSemAcesso, moduloDaRota, modulosDisponiveis, normalizarModulos, podeUsarModulo, type ModuloId } from "@/lib/modulos";
import { useModalDismiss } from "@/hooks/useModalDismiss";

// ─── Definição dos módulos ──────────────────────────────────────────────────

const MODULOS: { id: ModuloId; label: string; descricao: string }[] = [
  { id: "captacao",  label: "Captação",  descricao: "Gestão de patrocinadores, editais e negociações" },
  { id: "prestacao", label: "Prestação", descricao: "Prestação de contas e relatórios de projetos"   },
];

const NAV_POR_MODULO: Record<ModuloId, { section: string; items: { label: string; href: string; icon: React.ElementType }[] }[]> = {
  captacao: [
    {
      section: "Gerenciamento",
      items: [
        { label: "Visão geral",  href: "/dashboard",    icon: BarChart2    },
        { label: "Atividades",   href: "/atividades",   icon: CalendarDays },
        { label: "Projetos",     href: "/projetos",     icon: FolderOpen   },
      ],
    },
    {
      section: "Oportunidades",
      items: [
        { label: "Patrocinadores", href: "/patrocinadores",  icon: Radar },
        { label: "Comparativo",    href: "/comparativo",     icon: ArrowLeftRight },
        { label: "Editais",        href: "/editais-abertos", icon: FileStack },
      ],
    },
    {
      section: "Prospecções",
      items: [
        { label: "Empresas",    href: "/empresas-crm",      icon: Building2         },
        { label: "Negociações", href: "/captacoes",         icon: BriefcaseBusiness },
        { label: "Inscrições",  href: "/editais-inscritos", icon: FilePenLine       },
      ],
    },
    {
      section: "Relacionamento",
      items: [
        { label: "Proponentes", href: "/proponentes",       icon: Landmark       },
        { label: "Captadores",  href: "/captadores",        icon: Handshake      },
        { label: "Contatos",    href: "/contatos",          icon: ContactRound   },
        { label: "Clientes",    href: "/contas-patrocinio", icon: UserRoundCheck },
      ],
    },
  ],
  prestacao: [
    {
      section: "Prestações",
      items: [
        { label: "Prestações",   href: "/prestacoes",              icon: ClipboardCheck },
        { label: "Fornecedores", href: "/prestacoes/fornecedores", icon: Store },
      ],
    },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAvatar(user: User | null): string | null {
  if (!user) return null;
  const avatar = user.user_metadata?.avatar_url;
  return typeof avatar === "string" && avatar ? avatar : null;
}

function getInitial(user: User | null): string {
  if (!user) return "?";
  const name = user.user_metadata?.full_name || user.user_metadata?.name;
  if (name) return String(name).charAt(0).toUpperCase();
  return user.email?.charAt(0).toUpperCase() ?? "?";
}

function getDisplayName(user: User | null): string {
  if (!user) return "—";
  const name = user.user_metadata?.full_name || user.user_metadata?.name;
  if (name) return name.split(" ")[0];
  return user.email?.split("@")[0] ?? "—";
}

// Em rem: acompanham a fonte base, como o recuo md:pl-14 (3.5rem) do conteúdo.
const COLLAPSED_W = "3.5rem";
const EXPANDED_W  = "14rem";

// ─── Layout ─────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path   = usePathname();
  const router = useRouter();

  const [user, setUser]                     = useState<User | null>(null);
  const [expanded, setExpanded]             = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [moduloAtivo, setModuloAtivo]       = useState<ModuloId>(() => moduloDaRota(path));
  const [modulosOrg, setModulosOrg]         = useState<ModuloId[]>(["captacao"]);
  const [modulosUser, setModulosUser]       = useState<ModuloId[]>(["captacao"]);
  // Só redireciona por módulo depois de saber os módulos reais da organização atual.
  const [modulosCarregados, setModulosCarregados] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin]     = useState(false);
  const [plan, setPlan]                     = useState<PlanTipo | null>(null);
  const [org, setOrg]                       = useState<{ nome: string; avatar_url: string | null }>({ nome: "", avatar_url: null });
  const [memberships, setMemberships]       = useState<{ organizationId: string; papel: string; modulosAcesso: ModuloId[]; nome: string; avatarUrl: string | null }[]>([]);
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  const [mobileOpen, setMobileOpen]         = useState(false);

  const carregarModulosOrg = useCallback(async (orgId: string) => {
    setModulosCarregados(false);
    const supabase = createClient();
    const { data: orgData } = await (supabase as any)
      .from("organizations")
      .select("modulos_ativos")
      .eq("id", orgId)
      .maybeSingle();
    setModulosOrg(normalizarModulos(orgData?.modulos_ativos));
    setModulosCarregados(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (!user) return;

      // EXPERIMENTAL (workspace de captador): busca todos os vínculos do
      // usuário, não só o primeiro — necessário pro "acesso duplo" (conta
      // própria + workspace limitado convidado em outra organização).
      const { data: memberRows } = await (supabase as any)
        .from("organization_members")
        .select("organization_id, papel, modulos_acesso, organizations(nome, avatar_url)")
        .eq("user_id", user.id);

      const memberList = ((memberRows ?? []) as any[]).map(m => ({
        organizationId: m.organization_id as string,
        papel: m.papel as string,
        modulosAcesso: normalizarModulos(m.modulos_acesso),
        nome: (m.organizations?.nome ?? "") as string,
        avatarUrl: (m.organizations?.avatar_url ?? null) as string | null,
      }));
      setMemberships(memberList);

      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("jards_super_admin, plano")
        .eq("id", user.id)
        .maybeSingle();

      setIsSuperAdmin(profile?.jards_super_admin === true);
      setPlan((profile?.plano ?? null) as PlanTipo | null);

      if (memberList.length > 0) {
        let escolhido = memberList[0];
        try {
          const salvo = localStorage.getItem("jards:org-atual");
          const combina = salvo ? memberList.find(m => m.organizationId === salvo) : null;
          const captador = memberList.find(m => m.papel === "captador");
          escolhido = path.startsWith("/workspace-captador") && captador
            ? (combina?.papel === "captador" ? combina : captador)
            : combina ?? memberList.find(m => m.papel !== "captador") ?? memberList[0];
        } catch { /* localStorage indisponível — usa o padrão (primeiro não-captador) */ }

        setOrganizationId(escolhido.organizationId);
        setModulosUser(escolhido.modulosAcesso);
        setOrg({ nome: escolhido.nome, avatar_url: escolhido.avatarUrl });

        await carregarModulosOrg(escolhido.organizationId);

        if (escolhido.papel === "captador" && !path.startsWith("/workspace-captador")) {
          router.replace("/workspace-captador");
        }
      }
    }

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setOrganizationId(null);
        setIsSuperAdmin(false);
        setPlan(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Sync módulo ativo quando a rota muda externamente (ex: link direto)
  useEffect(() => {
    const modulo = moduloDaRota(path);
    setModuloAtivo(modulo);
    setMobileOpen(false);
  }, [path]);

  // Quem não usa o módulo da rota vai para o módulo que usa (ex.: usuário só da
  // prestação abrindo /dashboard). A proteção dos dados continua no banco.
  const papelAtual = memberships.find(m => m.organizationId === organizationId)?.papel ?? null;
  useEffect(() => {
    if (!modulosCarregados || papelAtual === "captador") return;
    const destino = destinoSemAcesso(path, {
      superAdmin: isSuperAdmin,
      modulosOrganizacao: modulosOrg,
      modulosMembro: modulosUser,
    });
    if (destino && destino !== path) router.replace(destino);
  }, [path, modulosCarregados, papelAtual, isSuperAdmin, modulosOrg, modulosUser, router]);

  useModalDismiss(() => setMobileOpen(false), { enabled: mobileOpen });

  useEffect(() => {
    if (!orgSwitcherOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOrgSwitcherOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [orgSwitcherOpen]);

  // Busca nome/avatar da organização e reage a atualizações salvas em configurações
  const loadOrg = useCallback(async (orgId: string) => {
    const supabase = createClient();
    const { data: orgData } = await (supabase as any)
      .from("organizations")
      .select("nome, avatar_url")
      .eq("id", orgId)
      .maybeSingle();
    setOrg({ nome: orgData?.nome ?? "", avatar_url: orgData?.avatar_url ?? null });
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    const orgId = organizationId;
    void loadOrg(orgId);
    function onOrgUpdated() { void loadOrg(orgId); }
    window.addEventListener("jards:org-updated", onOrgUpdated);
    return () => window.removeEventListener("jards:org-updated", onOrgUpdated);
  }, [organizationId, loadOrg]);

  function trocarModulo(id: ModuloId) {
    if (!podeUsarModulo({ superAdmin: isSuperAdmin, modulosOrganizacao: modulosOrg, modulosMembro: modulosUser }, id)) return;
    setModuloAtivo(id);
    // Navega para a home do módulo
    const nav = NAV_POR_MODULO[id];
    if (nav.length > 0 && nav[0].items.length > 0) {
      router.push(nav[0].items[0].href);
    }
  }

  function trocarOrganizacao(alvo: typeof memberships[number]) {
    try { localStorage.setItem("jards:org-atual", alvo.organizationId); } catch { /* localStorage indisponível — troca só nesta sessão */ }
    setOrganizationId(alvo.organizationId);
    setModulosUser(alvo.modulosAcesso);
    setOrg({ nome: alvo.nome, avatar_url: alvo.avatarUrl });
    setOrgSwitcherOpen(false);
    // Os módulos ativos são da organização: relê para a nova, antes de redirecionar por módulo.
    void carregarModulosOrg(alvo.organizationId);
    router.push(alvo.papel === "captador" ? "/workspace-captador" : "/dashboard");
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initial     = getInitial(user);
  const userAvatar  = getAvatar(user);
  const displayName = getDisplayName(user);
  const acessoModulos = { superAdmin: isSuperAdmin, modulosOrganizacao: modulosOrg, modulosMembro: modulosUser };
  // Em rotas comuns (configurações, plano) o menu mostra o módulo que a pessoa usa.
  const moduloDoMenu = modulosCarregados && !podeUsarModulo(acessoModulos, moduloAtivo)
    ? (modulosDisponiveis(acessoModulos)[0] ?? moduloAtivo)
    : moduloAtivo;
  const navGroups   = NAV_POR_MODULO[moduloDoMenu];
  const usaCaptacao = podeUsarModulo(acessoModulos, "captacao");
  // No celular o menu lateral vira gaveta: sempre com rótulos quando aberto.
  const isExpanded  = expanded || mobileOpen;
  const menuPath    = itemAtivoDoMenu(path);
  const hrefAtivo   = hrefAtivoDoMenu(menuPath, navGroups.flatMap(grupo => grupo.items.map(item => item.href)));
  // EXPERIMENTAL: dentro de uma organização onde o papel é "captador", o
  // menu lateral vira um menu próprio e mínimo — sem as áreas internas da
  // organização que convidou (essas continuam existindo, só não fazem
  // sentido pra alguém com acesso limitado a um único workspace).
  const isWorkspaceCaptador = papelAtual === "captador";

  return (
    <OrganizationContext.Provider value={{ organizationId, organizationName: org.nome, papel: papelAtual }}>
      <DeleteConfirmProvider>
      <CreditosProvider>
      <EtiquetasProvider>
      <TaxonomiasComerciaisProvider>
      <div className="h-screen overflow-hidden" style={{ background: "#FFFFFF" }}>

      {user && (
        <OnboardingModal
          user={user}
          organizationId={organizationId}
          onComplete={(name) => setUser((current) => current ? ({ ...current, user_metadata: { ...current.user_metadata, full_name: name } } as User) : current)}
        />
      )}

      {/* Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 md:hidden" aria-hidden="true" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        id="menu-principal"
        aria-label="Menu principal"
        className={`fixed top-0 left-0 bottom-0 flex flex-col overflow-hidden z-30 motion-reduce:transition-none ${mobileOpen ? "" : "max-md:-translate-x-full"}`}
        style={{
          width: isExpanded ? EXPANDED_W : COLLAPSED_W,
          transition: "width 220ms cubic-bezier(0.4,0,0.2,1), transform 220ms cubic-bezier(0.4,0,0.2,1)",
          background: "#FFFFFF",
          borderRight: "1px solid rgba(13,13,13,.08)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.06)",
        }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false); }}
        onClick={event => { if ((event.target as HTMLElement).closest("a")) setMobileOpen(false); }}
      >
        {/* Logo */}
        <div
          className="flex items-center flex-shrink-0 border-b overflow-hidden"
          style={{
            height: "3.5rem",
            paddingLeft: isExpanded ? 20 : 0,
            justifyContent: isExpanded ? "flex-start" : "center",
            borderColor: "rgba(13,13,13,.07)",
            transition: "padding 220ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          {isExpanded ? (
            <img src="/jards-logo.svg" alt="Jards" className="h-5" />
          ) : (
            <img src="/jards-icon.svg" alt="Jards" className="h-7 w-7" />
          )}
        </div>

        {/* User pill */}
        <div className="px-2 py-2.5 border-b flex-shrink-0" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          {isWorkspaceCaptador ? (
            <div
              className="flex rounded overflow-hidden"
              style={{
                gap: isExpanded ? 10 : 0,
                padding: isExpanded ? "6px 8px" : "6px 0",
                justifyContent: isExpanded ? "flex-start" : "center",
              }}
            >
              {userAvatar ? (
                <img src={userAvatar} alt="" className="w-7 h-7 rounded object-cover bg-white flex-shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded bg-[#7259B5] flex items-center justify-center text-[0.6875rem] font-bold text-white flex-shrink-0">
                  {initial}
                </div>
              )}
              {isExpanded && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#0D0D0D] truncate whitespace-nowrap">{displayName}</p>
                  <p className="text-[0.625rem] text-black/35 truncate whitespace-nowrap">Captador externo</p>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/configuracoes"
              title={isExpanded ? "Configurações" : undefined}
              className="flex rounded overflow-hidden transition hover:bg-black/[0.05]"
              style={{
                gap: isExpanded ? 10 : 0,
                padding: isExpanded ? "6px 8px" : "6px 0",
                justifyContent: isExpanded ? "flex-start" : "center",
              }}
            >
              {userAvatar ? (
                <img src={userAvatar} alt="" className="w-7 h-7 rounded object-cover bg-white flex-shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded bg-[#7259B5] flex items-center justify-center text-[0.6875rem] font-bold text-white flex-shrink-0">
                  {initial}
                </div>
              )}
              {isExpanded && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#0D0D0D] truncate whitespace-nowrap">{displayName}</p>
                  <p className="text-[0.625rem] text-black/35 truncate whitespace-nowrap">
                    {plan === "gratuito" ? "Plano gratuito" : plan === "basico" ? "Plano Básico" : plan === "profissional" ? "Plano Profissional" : "Jards"}
                  </p>
                </div>
              )}
            </Link>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden">
          {isWorkspaceCaptador ? (
            <div>
              <p className="px-2 mb-1.5 text-[0.625rem] font-bold tracking-[.13em] uppercase text-black/30 whitespace-nowrap" style={{ height: isExpanded ? "auto" : 0, overflow: "hidden", opacity: isExpanded ? 1 : 0 }}>
                Workspace
              </p>
              <Link
                href="/workspace-captador"
                title={!isExpanded ? "Meu workspace" : undefined}
                aria-current={correspondeRota(path, "/workspace-captador") ? "page" : undefined}
                className={`flex items-center rounded text-[0.8125rem] font-medium transition-colors whitespace-nowrap overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5] ${
                  correspondeRota(path, "/workspace-captador") ? "bg-[#1a1a1a] text-white" : "text-black/40 hover:text-[#0D0D0D] hover:bg-black/[0.05]"
                }`}
                style={{
                  gap: isExpanded ? 10 : 0,
                  padding: isExpanded ? "8px 10px" : "8px 0",
                  justifyContent: isExpanded ? "flex-start" : "center",
                }}
              >
                <LayoutDashboard size={16} className="flex-shrink-0" aria-hidden="true" />
                {isExpanded && <span>Meu workspace</span>}
              </Link>
            </div>
          ) : navGroups.map(({ section, items }, gi) => (
            <div key={section} className={gi > 0 ? "mt-4" : ""}>
              <div
                style={{
                  height: isExpanded ? "auto" : 0,
                  overflow: "hidden",
                  opacity: isExpanded ? 1 : 0,
                  transition: "opacity 150ms",
                  marginBottom: isExpanded ? 6 : 0,
                }}
              >
                <p className="px-2 text-[0.625rem] font-bold tracking-[.13em] uppercase text-black/30 whitespace-nowrap">
                  {section}
                </p>
              </div>
              <div className="space-y-0.5">
                {items.map(({ label, href, icon: Icon }) => {
                  const active = href === hrefAtivo;
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={!isExpanded ? label : undefined}
                      aria-label={!isExpanded ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center rounded text-[0.8125rem] font-medium transition-colors whitespace-nowrap overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5] ${
                        active ? "bg-[#1a1a1a] text-white" : "text-black/40 hover:text-[#0D0D0D] hover:bg-black/[0.05]"
                      }`}
                      style={{
                        gap: isExpanded ? 10 : 0,
                        padding: isExpanded ? "8px 10px" : "8px 0",
                        justifyContent: isExpanded ? "flex-start" : "center",
                      }}
                    >
                      <Icon size={16} className="flex-shrink-0" aria-hidden="true" />
                      {isExpanded && <span>{label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {plan === "gratuito" && usaCaptacao && (
            <Link
              href="/meu-plano"
              title={!isExpanded ? "Fazer upgrade" : undefined}
              aria-label="Fazer upgrade"
              className="mt-4 flex items-center overflow-hidden whitespace-nowrap rounded bg-[#7259B5] text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[#5D489D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
              style={{
                gap: isExpanded ? 10 : 0,
                padding: isExpanded ? "9px 10px" : "9px 0",
                justifyContent: isExpanded ? "flex-start" : "center",
              }}
            >
              <Sparkles size={16} className="flex-shrink-0" aria-hidden="true" />
              {isExpanded && <span>Fazer upgrade</span>}
            </Link>
          )}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-2.5 border-t space-y-0.5 flex-shrink-0" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          {isSuperAdmin && !isWorkspaceCaptador && (
            <Link
              href="/admin"
              title={!isExpanded ? "Admin" : undefined}
              aria-label={!isExpanded ? "Admin" : undefined}
              className="flex items-center rounded text-[0.8125rem] font-medium transition whitespace-nowrap overflow-hidden hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]"
              style={{
                gap: isExpanded ? 10 : 0,
                padding: isExpanded ? "8px 10px" : "8px 0",
                justifyContent: isExpanded ? "flex-start" : "center",
                color: "rgba(114,89,181,.70)",
              }}
            >
              <Shield size={16} className="flex-shrink-0" />
              {isExpanded && <span>Admin</span>}
            </Link>
          )}
          {!isWorkspaceCaptador && (
          <Link
            href="/configuracoes"
            title={!isExpanded ? "Configurações" : undefined}
            aria-label={!isExpanded ? "Configurações" : undefined}
            aria-current={correspondeRota(path, "/configuracoes") ? "page" : undefined}
            className={`flex items-center rounded text-[0.8125rem] font-medium transition whitespace-nowrap overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5] ${
              correspondeRota(path, "/configuracoes") ? "bg-black/[0.05] text-[#0D0D0D]" : "text-black/35 hover:text-[#0D0D0D] hover:bg-black/[0.05]"
            }`}
            style={{
              gap: isExpanded ? 10 : 0,
              padding: isExpanded ? "8px 10px" : "8px 0",
              justifyContent: isExpanded ? "flex-start" : "center",
            }}
          >
            <Settings size={16} className="flex-shrink-0" />
            {isExpanded && <span>Configurações</span>}
          </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            title={!isExpanded ? "Sair" : undefined}
            aria-label={!isExpanded ? "Sair" : undefined}
            className="w-full flex items-center rounded text-[0.8125rem] font-medium text-black/35 hover:text-[#D94E4E] hover:bg-black/[0.05] transition whitespace-nowrap overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]"
            style={{
              gap: isExpanded ? 10 : 0,
              padding: isExpanded ? "8px 10px" : "8px 0",
              justifyContent: isExpanded ? "flex-start" : "center",
            }}
          >
            <LogOut size={16} className="flex-shrink-0" />
            {isExpanded && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col h-full overflow-hidden md:pl-14">

        {/* Top bar */}
        <header
          className="flex-shrink-0 flex items-center justify-end px-4 md:px-8 border-b"
          style={{ height: "3.5rem", background: "#FFFFFF", borderColor: "rgba(13,13,13,.08)" }}
        >
          <div className="mr-auto flex items-center gap-2 md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
              aria-controls="menu-principal"
              aria-expanded={mobileOpen}
              className="-ml-2 flex h-10 w-10 items-center justify-center rounded text-black/55 transition hover:bg-black/[.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
            >
              <Menu size={18} aria-hidden="true" />
            </button>
            <img src="/jards-icon.svg" alt="Jards" className="h-6 w-6" />
          </div>
          {/* Module switcher — até a liberação pública de Prestação, visível só para super admin */}
          {isSuperAdmin && !isWorkspaceCaptador && (
          <div className="mr-auto flex items-center gap-1 p-1 rounded" style={{ background: "rgba(13,13,13,.05)" }}>
            {MODULOS.map(({ id, label }) => {
              const orgTem    = isSuperAdmin || modulosOrg.includes(id);
              const userTem   = isSuperAdmin || modulosUser.includes(id);
              const acessivel = orgTem && userTem;
              const ativo     = moduloAtivo === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => trocarModulo(id)}
                  disabled={!acessivel}
                  aria-pressed={ativo}
                  title={
                    !orgTem
                      ? "Módulo não contratado — fale com o suporte"
                      : !userTem
                      ? "Você não tem acesso a este módulo"
                      : label
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[0.75rem] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7259B5]/40"
                  style={{
                    background: ativo ? "#FFFFFF" : "transparent",
                    color: ativo
                      ? "#0D0D0D"
                      : acessivel
                      ? "rgba(13,13,13,.45)"
                      : "rgba(13,13,13,.25)",
                    boxShadow: ativo ? "0 1px 3px rgba(0,0,0,.10)" : "none",
                    cursor: acessivel ? "pointer" : "not-allowed",
                  }}
                >
                  {!acessivel && <Lock size={10} style={{ color: "rgba(13,13,13,.25)" }} />}
                  {label}
                  {!orgTem && (
                    <span className="text-[0.5625rem] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "#fff", border: "1px solid #7259B547", color: "#7259B5" }}>
                      Pro
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {user && <NotificationBell userId={user.id} />}
            {memberships.length > 1 ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOrgSwitcherOpen(v => !v)}
                  title={`Trocar organização (atual: ${org.nome || "—"})`}
                  aria-label="Trocar organização"
                  aria-haspopup="menu"
                  aria-expanded={orgSwitcherOpen}
                  className="w-8 h-8 rounded-full bg-[#7259B5] flex items-center justify-center text-[0.6875rem] font-bold text-white overflow-hidden transition hover:brightness-95"
                >
                  {org.avatar_url ? (
                    <img src={org.avatar_url} alt="" className="w-full h-full object-cover bg-white" />
                  ) : (
                    <span>{org.nome ? org.nome.charAt(0).toUpperCase() : "?"}</span>
                  )}
                </button>
                {orgSwitcherOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOrgSwitcherOpen(false)} />
                    <div role="menu" aria-label="Organizações" className="absolute right-0 top-10 z-50 w-64 rounded border border-black/[.09] bg-white p-1.5 shadow-[0_16px_45px_rgba(13,13,13,.12)]">
                      <p className="px-2.5 pb-1.5 pt-1 text-[0.5625rem] font-bold uppercase tracking-widest text-black/30">Trocar organização</p>
                      {memberships.map(m => (
                        <button
                          key={m.organizationId}
                          type="button"
                          role="menuitemradio"
                          aria-checked={m.organizationId === organizationId}
                          onClick={() => trocarOrganizacao(m)}
                          className={`flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left transition hover:bg-black/[.04] ${m.organizationId === organizationId ? "bg-black/[.03]" : ""}`}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#7259B5] text-[0.625rem] font-bold text-white">
                            {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" /> : (m.nome ? m.nome.charAt(0).toUpperCase() : "?")}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.75rem] font-semibold text-black">{m.nome || "Sem nome"}</span>
                            {m.papel === "captador" && <span className="text-[0.625rem] font-medium text-black/40">Workspace de captador</span>}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/configuracoes"
                title={org.nome || "Configurações"}
                aria-label={org.nome ? `${org.nome} — configurações` : "Configurações"}
                className="w-8 h-8 rounded-full bg-[#7259B5] flex items-center justify-center text-[0.6875rem] font-bold text-white overflow-hidden transition hover:brightness-95"
              >
                {org.avatar_url ? (
                  <img src={org.avatar_url} alt="" className="w-full h-full object-cover bg-white" />
                ) : (
                  <span>{org.nome ? org.nome.charAt(0).toUpperCase() : "?"}</span>
                )}
              </Link>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={null}>
            <ImpersonationBanner />
          </Suspense>
          <PastDueBanner />
          {children}
        </main>
      </div>
      </div>
      </TaxonomiasComerciaisProvider>
      </EtiquetasProvider>
      </CreditosProvider>
      </DeleteConfirmProvider>
    </OrganizationContext.Provider>
  );
}
