"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useCallback } from "react";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { PastDueBanner } from "@/components/PastDueBanner";
import {
  BarChart2,
  CalendarDays,
  Briefcase,
  UsersRound,
  PhoneCall,
  Globe,
  FileStack,
  FolderOpen,
  Building2,
  UserCheck,
  Settings,
  LogOut,
  ClipboardCheck,
  Lock,
  Shield,
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

// ─── Definição dos módulos ──────────────────────────────────────────────────

type ModuloId = "captacao" | "prestacao";

const MODULOS: { id: ModuloId; label: string; descricao: string }[] = [
  { id: "captacao",  label: "Captação",  descricao: "Gestão de patrocinadores, editais e negociações" },
  { id: "prestacao", label: "Prestação", descricao: "Prestação de contas e relatórios de projetos"   },
];

const NAV_POR_MODULO: Record<ModuloId, { section: string; items: { label: string; href: string; icon: React.ElementType }[] }[]> = {
  captacao: [
    {
      section: "Gerenciamento",
      items: [
        { label: "Visão Geral",  href: "/dashboard",    icon: BarChart2    },
        { label: "Atividades",   href: "/atividades",   icon: CalendarDays },
        { label: "Projetos",     href: "/projetos",     icon: FolderOpen   },
      ],
    },
    {
      section: "Oportunidades",
      items: [
        { label: "Patrocinadores", href: "/patrocinadores",  icon: Briefcase },
        { label: "Editais",        href: "/editais-abertos", icon: FileStack },
      ],
    },
    {
      section: "Prospecções",
      items: [
        { label: "Empresas",    href: "/empresas-crm",      icon: Briefcase  },
        { label: "Negociações", href: "/captacoes",         icon: UsersRound },
        { label: "Inscrições",  href: "/editais-inscritos", icon: Globe      },
      ],
    },
    {
      section: "Relacionamento",
      items: [
        { label: "Proponentes", href: "/proponentes",       icon: Building2 },
        { label: "Captadores",  href: "/captadores",        icon: UserCheck },
        { label: "Contatos",    href: "/contatos",          icon: PhoneCall },
        { label: "Clientes",     href: "/contas-patrocinio", icon: Briefcase },
      ],
    },
  ],
  prestacao: [
    {
      section: "Prestações",
      items: [
        { label: "Prestações",  href: "/prestacoes", icon: ClipboardCheck },
      ],
    },
  ],
};

// Mapa de rota → módulo (para detectar módulo ativo pela URL)
const ROTA_MODULO: Record<string, ModuloId> = {
  "/prestacoes": "prestacao",
};

function detectarModulo(path: string): ModuloId {
  for (const [prefix, modulo] of Object.entries(ROTA_MODULO)) {
    if (path === prefix || path.startsWith(prefix + "/")) return modulo;
  }
  return "captacao";
}

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

const COLLAPSED_W = 56;
const EXPANDED_W  = 224;

// ─── Layout ─────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path   = usePathname();
  const router = useRouter();

  const [user, setUser]                     = useState<User | null>(null);
  const [expanded, setExpanded]             = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [moduloAtivo, setModuloAtivo]       = useState<ModuloId>(() => detectarModulo(path));
  const [modulosOrg, setModulosOrg]         = useState<ModuloId[]>(["captacao"]);
  const [modulosUser, setModulosUser]       = useState<ModuloId[]>(["captacao"]);
  const [isSuperAdmin, setIsSuperAdmin]     = useState(false);
  const [org, setOrg]                       = useState<{ nome: string; avatar_url: string | null }>({ nome: "", avatar_url: null });

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (!user) return;

      const { data: member } = await (supabase as any)
        .from("organization_members")
        .select("organization_id, modulos_acesso")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("jards_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      setIsSuperAdmin(profile?.jards_super_admin === true);

      if (member) {
        setOrganizationId(member.organization_id);
        setModulosUser((member.modulos_acesso ?? ["captacao"]) as ModuloId[]);

        const { data: org } = await (supabase as any)
          .from("organizations")
          .select("modulos_ativos")
          .eq("id", member.organization_id)
          .single();
        if (org) setModulosOrg((org.modulos_ativos ?? ["captacao"]) as ModuloId[]);
      }

    }

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setOrganizationId(null);
        setIsSuperAdmin(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Sync módulo ativo quando a rota muda externamente (ex: link direto)
  useEffect(() => {
    const modulo = detectarModulo(path);
    setModuloAtivo(modulo);
  }, [path]);

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
    if (!modulosOrg.includes(id)) return; // org não tem o módulo
    if (!modulosUser.includes(id)) return; // user não tem acesso
    setModuloAtivo(id);
    // Navega para a home do módulo
    const nav = NAV_POR_MODULO[id];
    if (nav.length > 0 && nav[0].items.length > 0) {
      router.push(nav[0].items[0].href);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initial     = getInitial(user);
  const userAvatar  = getAvatar(user);
  const displayName = getDisplayName(user);
  const navGroups   = NAV_POR_MODULO[moduloAtivo];

  return (
    <OrganizationContext.Provider value={{ organizationId }}>
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
      <aside
        className="fixed top-0 left-0 bottom-0 flex flex-col overflow-hidden z-30"
        style={{
          width: expanded ? EXPANDED_W : COLLAPSED_W,
          transition: "width 220ms cubic-bezier(0.4,0,0.2,1)",
          background: "#FFFFFF",
          borderRight: "1px solid rgba(13,13,13,.08)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.06)",
        }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        {/* Logo */}
        <div
          className="flex items-center flex-shrink-0 border-b overflow-hidden"
          style={{
            height: 56,
            paddingLeft: expanded ? 20 : 0,
            justifyContent: expanded ? "flex-start" : "center",
            borderColor: "rgba(13,13,13,.07)",
            transition: "padding 220ms cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          {expanded ? (
            <img src="/jards-logo.svg" alt="Jards" className="h-5" />
          ) : (
            <img src="/jards-icon.svg" alt="Jards" className="h-7 w-7" />
          )}
        </div>

        {/* User pill */}
        <div className="px-2 py-2.5 border-b flex-shrink-0" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          <Link
            href="/configuracoes"
            title={expanded ? "Configurações" : undefined}
            className="flex rounded overflow-hidden transition hover:bg-black/[0.05]"
            style={{
              gap: expanded ? 10 : 0,
              padding: expanded ? "6px 8px" : "6px 0",
              justifyContent: expanded ? "flex-start" : "center",
            }}
          >
            {userAvatar ? (
              <img src={userAvatar} alt="" className="w-7 h-7 rounded object-cover bg-white flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded bg-[#7259B5] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
                {initial}
              </div>
            )}
            {expanded && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#0D0D0D] truncate whitespace-nowrap">{displayName}</p>
                <p className="text-[10px] text-black/35 truncate whitespace-nowrap">Plano Pro</p>
              </div>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden">
          {navGroups.map(({ section, items }, gi) => (
            <div key={section} className={gi > 0 ? "mt-4" : ""}>
              <div
                style={{
                  height: expanded ? "auto" : 0,
                  overflow: "hidden",
                  opacity: expanded ? 1 : 0,
                  transition: "opacity 150ms",
                  marginBottom: expanded ? 6 : 0,
                }}
              >
                <p className="px-2 text-[10px] font-bold tracking-[.13em] uppercase text-black/30 whitespace-nowrap">
                  {section}
                </p>
              </div>
              <div className="space-y-0.5">
                {items.map(({ label, href, icon: Icon }) => {
                  const active = path === href || path.startsWith(href + "/");
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={!expanded ? label : undefined}
                      className={`flex items-center rounded text-[13px] font-medium transition-colors whitespace-nowrap overflow-hidden ${
                        active ? "bg-[#1a1a1a] text-white" : "text-black/40 hover:text-[#0D0D0D] hover:bg-black/[0.05]"
                      }`}
                      style={{
                        gap: expanded ? 10 : 0,
                        padding: expanded ? "8px 10px" : "8px 0",
                        justifyContent: expanded ? "flex-start" : "center",
                      }}
                    >
                      <Icon size={16} className="flex-shrink-0" />
                      {expanded && <span>{label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-2.5 border-t space-y-0.5 flex-shrink-0" style={{ borderColor: "rgba(13,13,13,.07)" }}>
          {isSuperAdmin && (
            <Link
              href="/admin"
              title={!expanded ? "Admin" : undefined}
              className="flex items-center rounded text-[13px] font-medium transition whitespace-nowrap overflow-hidden"
              style={{
                gap: expanded ? 10 : 0,
                padding: expanded ? "8px 10px" : "8px 0",
                justifyContent: expanded ? "flex-start" : "center",
                color: "rgba(114,89,181,.70)",
              }}
            >
              <Shield size={16} className="flex-shrink-0" />
              {expanded && <span>Admin</span>}
            </Link>
          )}
          <Link
            href="/configuracoes"
            title={!expanded ? "Configurações" : undefined}
            className="flex items-center rounded text-[13px] font-medium text-black/35 hover:text-[#0D0D0D] hover:bg-black/[0.05] transition whitespace-nowrap overflow-hidden"
            style={{
              gap: expanded ? 10 : 0,
              padding: expanded ? "8px 10px" : "8px 0",
              justifyContent: expanded ? "flex-start" : "center",
            }}
          >
            <Settings size={16} className="flex-shrink-0" />
            {expanded && <span>Configurações</span>}
          </Link>
          <button
            onClick={handleLogout}
            title={!expanded ? "Sair" : undefined}
            className="w-full flex items-center rounded text-[13px] font-medium text-black/35 hover:text-red-500 hover:bg-black/[0.05] transition whitespace-nowrap overflow-hidden"
            style={{
              gap: expanded ? 10 : 0,
              padding: expanded ? "8px 10px" : "8px 0",
              justifyContent: expanded ? "flex-start" : "center",
            }}
          >
            <LogOut size={16} className="flex-shrink-0" />
            {expanded && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col h-full overflow-hidden" style={{ paddingLeft: COLLAPSED_W }}>

        {/* Top bar */}
        <header
          className="flex-shrink-0 flex items-center justify-end px-8 border-b"
          style={{ height: 56, background: "#FFFFFF", borderColor: "rgba(13,13,13,.08)" }}
        >
          {/* Module switcher — oculto temporariamente até a liberação pública de Prestação */}
          <div className="hidden items-center gap-1 p-1 rounded" aria-hidden="true" style={{ background: "rgba(13,13,13,.05)" }}>
            {MODULOS.map(({ id, label }) => {
              const orgTem    = modulosOrg.includes(id);
              const userTem   = modulosUser.includes(id);
              const acessivel = orgTem && userTem;
              const ativo     = moduloAtivo === id;

              return (
                <button
                  key={id}
                  onClick={() => trocarModulo(id)}
                  disabled={!acessivel}
                  title={
                    !orgTem
                      ? "Módulo não contratado — fale com o suporte"
                      : !userTem
                      ? "Você não tem acesso a este módulo"
                      : label
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold transition-all"
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
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: "#7259B514", color: "#7259B5" }}>
                      Pro
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {user && <NotificationBell userId={user.id} />}
            <Link
              href="/configuracoes"
              title={org.nome || "Configurações"}
              className="w-8 h-8 rounded-full bg-[#7259B5] flex items-center justify-center text-[11px] font-bold text-white overflow-hidden transition hover:brightness-95"
            >
              {org.avatar_url ? (
                <img src={org.avatar_url} alt="" className="w-full h-full object-cover bg-white" />
              ) : (
                <span>{org.nome ? org.nome.charAt(0).toUpperCase() : "?"}</span>
              )}
            </Link>
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
