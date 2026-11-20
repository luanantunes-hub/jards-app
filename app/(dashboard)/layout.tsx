"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useCallback } from "react";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { PastDueBanner } from "@/components/PastDueBanner";
import { EmailAutoSync } from "@/components/email/EmailAutoSync";
import {
  Accessibility,
  BarChart2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Globe,
  CalendarRange,
  UsersRound,
  ListChecks,
  MapPin,
  Boxes,
  Truck,
  Ticket,
  School,
  GraduationCap,
  Frame,
  History,
  Ruler,
  FileText,
  BriefcaseBusiness,
  Clapperboard,
  Wrench,
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
  HandCoins,
  Shield,
  Sparkles,
  ArrowLeft,
  ArrowLeftRight,
  Home,
  Menu,
  Store,
  DoorOpen,
  Drama,
  Video,
  ChevronDown,
  FileCheck,
  type LucideIcon,
  Mail,
  Megaphone,
  Receipt,
  ScanLine,
  Hourglass,
  Tag,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { OrganizationContext, useOrganizationRole } from "@/contexts/OrganizationContext";
import { CreditosProvider, useCreditos } from "@/contexts/CreditosContext";
import { EtiquetasProvider } from "@/contexts/EtiquetasContext";
import { TaxonomiasComerciaisProvider } from "@/contexts/TaxonomiasComerciaisContext";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AjudaFlutuante } from "@/components/suporte/AjudaFlutuante";
import { SeletorDeModulo, type OpcaoDeModulo } from "@/components/navegacao/SeletorDeModulo";
import { ConvitePrestacao } from "@/components/navegacao/ConvitePrestacao";
import { DeleteConfirmProvider } from "@/contexts/DeleteConfirmContext";
import { correspondeRota, hrefAtivoDoMenu, itemAtivoDoMenu } from "@/lib/navigation/rotas";
import { destinoSemAcesso, inicioDeOutroModulo, moduloDaRota, moduloVisivel, modulosDaOrganizacao, modulosDisponiveis, normalizarModulos, paginaDeEntrada, podeUsarModulo, situacaoNoSeletor, type ModuloId } from "@/lib/modulos";
import { TESTE_GRATIS_DIAS } from "@/lib/modulos-contrato";
import { useModalDismiss } from "@/hooks/useModalDismiss";

// ─── Definição dos módulos ──────────────────────────────────────────────────

const MODULOS: { id: ModuloId; label: string; descricao: string; icone: LucideIcon }[] = [
  { id: "captacao",  label: "Captação",  descricao: "Patrocinadores, editais e negociações",       icone: HandCoins      },
  { id: "prestacao", label: "Prestação", descricao: "Prestação de contas e relatórios do projeto", icone: ClipboardCheck },
  { id: "producao",  label: "Produção",  descricao: "Agenda, equipe, logística e o dia",            icone: Drama          },
  { id: "ticketeria", label: "Ticketeria", descricao: "Ingressos, vendas e a porta do evento",    icone: Ticket         },
];

// Telas que ainda não estão prontas para os clientes: só o super admin vê no menu.
// Conectar e-mail continua valendo a lista EMAIL_BETA_LIBERADO (lib/email/beta.ts).
const ROTAS_SO_SUPER_ADMIN: string[] = [];

// `icone`: o grupo aparece no menu como uma seção que abre e fecha para baixo (como no Apollo), com este ícone no título e as telas dele logo abaixo.
const NAV_POR_MODULO: Record<ModuloId, { section: string; icone?: React.ElementType; items: { label: string; href: string; icon: React.ElementType }[] }[]> = {
  captacao: [
    {
      section: "Gerenciamento",
      items: [
        { label: "Visão geral",  href: "/dashboard",    icon: BarChart2    },
        { label: "Conversas",    href: "/conversas",    icon: Mail         },
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
  // O primeiro item do primeiro grupo é a página inicial do módulo (trocarModulo abre ele). Cada grupo é uma seção do menu que abre e fecha para baixo.
  producao: [
    {
      section: "Produção",
      icone: Clapperboard,
      items: [
        { label: "Agenda", href: "/producoes", icon: CalendarDays },
        { label: "Temporadas", href: "/producoes/temporadas", icon: CalendarRange },
        { label: "Equipe", href: "/producoes/equipe", icon: UsersRound },
        { label: "Tarefas", href: "/producoes/tarefas", icon: ListChecks },
        { label: "Espaços", href: "/producoes/espacos", icon: Building2 },
        { label: "Documentos", href: "/producoes/documentos", icon: FileCheck },
      ],
    },
    {
      section: "Programação",
      icone: CalendarClock,
      items: [
        { label: "Pauta", href: "/producoes/pauta", icon: CalendarCheck },
        { label: "Programação", href: "/producoes/programacao", icon: CalendarClock },
      ],
    },
    {
      section: "Público",
      icone: UsersRound,
      items: [
        { label: "Acessibilidade", href: "/producoes/acessibilidade", icon: Accessibility },
        { label: "Visitação", href: "/producoes/visitacao", icon: School },
        { label: "Formação", href: "/producoes/formacao", icon: GraduationCap },
        { label: "Expografia", href: "/producoes/expografia", icon: Frame },
      ],
    },
    {
      section: "Técnica e logística",
      icone: Wrench,
      items: [
        { label: "Inventário", href: "/producoes/inventario", icon: Boxes },
        { label: "Plantas", href: "/producoes/plantas", icon: Ruler },
        { label: "Riders", href: "/producoes/riders", icon: FileText },
        { label: "Acertos", href: "/producoes/acertos", icon: Handshake },
        { label: "Veículos", href: "/producoes/veiculos", icon: Truck },
      ],
    },
    {
      section: "Acompanhar",
      icone: MapPin,
      items: [
        { label: "Mapa da turnê", href: "/producoes/mapa", icon: MapPin },
        { label: "Linha do tempo", href: "/producoes/linha-do-tempo", icon: History },
      ],
    },
  ],
  // Escondida dos clientes (MODULOS_EM_CONSTRUCAO em lib/modulos.ts): só o super admin e quem já tem o módulo a veem.
  // A rota é /ingressos: jards.com.br/ticketeria é a página pública do produto.
  ticketeria: [
    {
      section: "Ticketeria",
      items: [
        { label: "Página inicial", href: "/ingressos", icon: Home },
        { label: "Eventos", href: "/ingressos/eventos", icon: Ticket },
        { label: "Locais", href: "/ingressos/locais", icon: MapPin },
        { label: "Site", href: "/ingressos/site", icon: Globe },
        { label: "Vendas", href: "/ingressos/vendas", icon: Receipt },
        { label: "Divulgação", href: "/ingressos/divulgacao", icon: Megaphone },
        { label: "Cupons", href: "/ingressos/cupons", icon: Tag },
        { label: "Lista de espera", href: "/ingressos/espera", icon: Hourglass },
        { label: "Porta", href: "/ingressos/porta", icon: ScanLine },
        { label: "Recebimentos", href: "/ingressos/recebimentos", icon: Wallet },
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

// ─── Plano da organização ──────────────────────────────────────────────────
// O rótulo e o "Fazer upgrade" seguem a assinatura da organização aberta (useCreditos),
// não o perfil de quem está vendo. Ficam em componentes próprios porque o
// CreditosProvider é montado dentro deste layout.

const ROTULO_DO_PLANO: Record<string, string> = {
  gratuito: "Plano gratuito",
  basico: "Plano Starter",
  profissional: "Plano Pro",
};

function RotuloDoPlano() {
  const { assinatura } = useCreditos();
  return <>{(assinatura && ROTULO_DO_PLANO[assinatura.plano]) ?? "Jards"}</>;
}

function BotaoUpgrade({ expandido }: { expandido: boolean }) {
  const { assinatura, loading } = useCreditos();
  const papel = useOrganizationRole();
  // Só quem administra a organização assina: o checkout cobra a organização em que a pessoa é admin.
  if (loading || assinatura?.plano !== "gratuito" || papel !== "admin") return null;
  return (
    <Link
      href="/meu-plano"
      title={!expandido ? "Fazer upgrade" : undefined}
      aria-label="Fazer upgrade"
      className="mt-4 flex items-center overflow-hidden whitespace-nowrap rounded bg-[#7259B5] text-[0.8125rem] font-semibold text-white transition-colors hover:bg-[#5D489D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5]"
      style={{
        gap: expandido ? 10 : 0,
        padding: expandido ? "9px 10px" : "9px 0",
        justifyContent: expandido ? "flex-start" : "center",
      }}
    >
      <Sparkles size={16} className="flex-shrink-0" aria-hidden="true" />
      {expandido && <span>Fazer upgrade</span>}
    </Link>
  );
}

// ─── Layout ─────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path   = usePathname();
  const router = useRouter();

  const [user, setUser]                     = useState<User | null>(null);
  const [expanded, setExpanded]             = useState(false);
  // As seções do menu que a pessoa abriu ou fechou à mão. A seção da página aberta abre sozinha, a menos que a pessoa a feche.
  const [secoesAbertas, setSecoesAbertas] = useState<ReadonlySet<string>>(new Set());
  const [secoesFechadas, setSecoesFechadas] = useState<ReadonlySet<string>>(new Set());
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [moduloAtivo, setModuloAtivo]       = useState<ModuloId>(() => moduloDaRota(path));
  const [modulosOrg, setModulosOrg]         = useState<ModuloId[]>(["captacao"]);
  const [modulosUser, setModulosUser]       = useState<ModuloId[]>(["captacao"]);
  // Só redireciona por módulo depois de saber os módulos reais da organização atual.
  const [modulosCarregados, setModulosCarregados] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin]     = useState(false);
  // Prestações de outras organizações acompanhadas por convite (P5.3).
  const [temConvites, setTemConvites]       = useState(false);
  // Espaço do proponente (P5.4): a conta está ligada a um cadastro de proponente.
  const [ehProponente, setEhProponente]     = useState(false);
  const [org, setOrg]                       = useState<{ nome: string; avatar_url: string | null }>({ nome: "", avatar_url: null });
  const [memberships, setMemberships]       = useState<{ organizationId: string; papel: string; modulosAcesso: ModuloId[]; modulosOrganizacao: ModuloId[]; nome: string; avatarUrl: string | null }[]>([]);
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  const [mobileOpen, setMobileOpen]         = useState(false);
  // Com a lista de módulos aberta, o menu lateral fica aberto até a escolha.
  const [seletorAberto, setSeletorAberto]   = useState(false);
  // Convite da primeira versão gratuita da prestação de contas.
  const [conviteAberto, setConviteAberto]   = useState(false);

  const carregarModulosOrg = useCallback(async (orgId: string) => {
    setModulosCarregados(false);
    const supabase = createClient();
    const { data: orgData } = await (supabase as any)
      .from("organizations")
      .select("modulos_ativos, modulos_leitura")
      .eq("id", orgId)
      .maybeSingle();
    // Os módulos só para leitura (sem assinatura) continuam navegáveis.
    setModulosOrg(modulosDaOrganizacao(orgData?.modulos_ativos, orgData?.modulos_leitura));
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
      // As consultas são independentes e vão juntas: o menu só mostra os
      // módulos depois delas, e os módulos da organização vêm com o vínculo.
      const [{ data: memberRows }, { data: profile }, { count: convites }, { count: cadastros }] = await Promise.all([
        (supabase as any)
          .from("organization_members")
          .select("organization_id, papel, modulos_acesso, organizations(nome, avatar_url, modulos_ativos, modulos_leitura)")
          .eq("user_id", user.id),
        (supabase as any)
          .from("profiles")
          .select("jards_super_admin")
          .eq("id", user.id)
          .maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabela nova, ainda fora do tipo Database
        (supabase as any)
          .from("prestacao_convidados")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- coluna user_id ainda fora do tipo Database
        (supabase as any)
          .from("proponentes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      const memberList = ((memberRows ?? []) as any[]).map(m => ({
        organizationId: m.organization_id as string,
        papel: m.papel as string,
        modulosAcesso: normalizarModulos(m.modulos_acesso),
        modulosOrganizacao: modulosDaOrganizacao(m.organizations?.modulos_ativos, m.organizations?.modulos_leitura),
        nome: (m.organizations?.nome ?? "") as string,
        avatarUrl: (m.organizations?.avatar_url ?? null) as string | null,
      }));
      setMemberships(memberList);
      setIsSuperAdmin(profile?.jards_super_admin === true);
      setTemConvites((convites ?? 0) > 0);
      setEhProponente((cadastros ?? 0) > 0);

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
        setModulosOrg(escolhido.modulosOrganizacao);
        setModulosCarregados(true);

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
    if (opcoesDeModulo.find(o => o.id === id)?.promo) {
      setConviteAberto(true);
      return;
    }
    if (!podeUsarModulo({ superAdmin: isSuperAdmin, modulosOrganizacao: modulosOrg, modulosMembro: modulosUser }, id)) return;
    setModuloAtivo(id);
    setMobileOpen(false);
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
    // Abre a página inicial do módulo que a pessoa usa na nova organização (a da captação, se a usa).
    router.push(alvo.papel === "captador"
      ? "/workspace-captador"
      : paginaDeEntrada(isSuperAdmin, [{ modulosOrganizacao: alvo.modulosOrganizacao, modulosMembro: alvo.modulosAcesso }]));
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
  const navGroups   = NAV_POR_MODULO[moduloDoMenu].map(grupo => ({
    ...grupo,
    items: grupo.items.filter(item => isSuperAdmin || !ROTAS_SO_SUPER_ADMIN.includes(item.href)),
  }));
  const usaCaptacao = podeUsarModulo(acessoModulos, "captacao");
  // No celular o menu lateral vira gaveta: sempre com rótulos quando aberto.
  // Na Ticketeria o menu fica sempre aberto (com rótulos) e o conteúdo se afasta dele; nos outros módulos abre ao passar o mouse.
  const menuFixoAberto = moduloDoMenu === "ticketeria";
  const isExpanded  = expanded || mobileOpen || seletorAberto || menuFixoAberto;
  // Cantos de 12px em tudo na Ticketeria (menu, barra do topo, botões e os menus que abrem sobre a página, que saem do layout): a classe vai no body e a regra está em globals.css.
  useEffect(() => {
    document.body.classList.toggle("cantos-ticketeria", menuFixoAberto);
    return () => document.body.classList.remove("cantos-ticketeria");
  }, [menuFixoAberto]);
  const menuPath    = itemAtivoDoMenu(path);
  const hrefAtivo   = hrefAtivoDoMenu(menuPath, navGroups.flatMap(grupo => grupo.items.map(item => item.href)));
  // Os grupos com `icone` viram seções que abrem e fecham. Com o menu recolhido (só ícones) cada seção mostra apenas o ícone; o da página aberta fica aceso.
  const gruposFixos = navGroups.filter(grupo => !grupo.icone && grupo.items.length > 0);
  const gruposEmSecao = navGroups.filter(grupo => grupo.icone && grupo.items.length > 0);
  const secaoAberta = (grupo: (typeof navGroups)[number]) =>
    secoesAbertas.has(grupo.section) || (!secoesFechadas.has(grupo.section) && grupo.items.some(item => item.href === hrefAtivo));
  function alternarSecao(grupo: (typeof navGroups)[number]) {
    const abrir = !secaoAberta(grupo);
    const troca = (conjunto: ReadonlySet<string>, entrar: boolean) => { const novo = new Set(conjunto); if (entrar) novo.add(grupo.section); else novo.delete(grupo.section); return novo; };
    setSecoesAbertas(atual => troca(atual, abrir));
    setSecoesFechadas(atual => troca(atual, !abrir));
  }
  const desenharGrupo = ({ section, items }: (typeof navGroups)[number], gi: number) => (
    <div key={section} className={gi > 0 ? "mt-4" : ""}>
              {/* Na Ticketeria o menu não tem o título da seção ("TICKETERIA") */}
              {!menuFixoAberto && <div
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
              </div>}
              <div className="space-y-0.5">
                {items.map(({ label, href, icon: Icon }) => {
                  const active = href === hrefAtivo;
                  return (
                    <Link
                      key={href}
                      href={href}
                      // Sem antecipar a página: cada item do menu antecipado era uma página inteira pedida ao servidor (com a checagem de login), e dezenas delas disputavam a banda com a página que a pessoa abriu.
                      prefetch={false}
                      title={!isExpanded ? label : undefined}
                      aria-label={!isExpanded ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center rounded text-[0.8125rem] font-medium transition-colors whitespace-nowrap overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5] ${
                        active ? "bg-[#1C0E33] text-white" : "text-black/40 hover:text-[#282525] hover:bg-black/[0.05]"
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
  );

  // EXPERIMENTAL: dentro de uma organização onde o papel é "captador", o
  // menu lateral vira um menu próprio e mínimo — sem as áreas internas da
  // organização que convidou (essas continuam existindo, só não fazem
  // sentido pra alguém com acesso limitado a um único workspace).
  const isWorkspaceCaptador = papelAtual === "captador";
  // A prestação é oferecida em teste gratuito a quem nunca teve o módulo (nem só para leitura); quem
  // já teve entra nele, e o aviso da assinatura explica o fim do teste. Nunca aparece como não contratada.
  // A captação não tem teste: o plano gratuito tem as suas funções e nunca bloqueia.
  // Módulo em construção (a produção) fica fora do seletor até a organização tê-lo; o super admin
  // vê para testar. O módulo aberto continua na lista, para o seletor não mentir.
  const opcoesDeModulo: OpcaoDeModulo[] = MODULOS
    .filter(({ id }) => moduloVisivel(id, modulosOrg, isSuperAdmin) || id === moduloDoMenu)
    .map(({ id, label, descricao, icone }) => {
      const situacao = situacaoNoSeletor({ ...acessoModulos, carregado: modulosCarregados }, id);
      const promo = situacao.tipo === "teste";
      return {
        id, label, descricao, icone, promo,
        // Só no item da prestação, dentro da lista: embaixo da captação parecia que a captação tinha teste.
        chamada: promo ? `Teste gratuito de ${TESTE_GRATIS_DIAS} dias` : undefined,
        carregando: situacao.tipo === "carregando",
        bloqueio: situacao.tipo === "bloqueado" ? situacao.motivo : null,
      };
    });

  async function prestacaoAtivada() {
    setConviteAberto(false);
    if (!organizationId) return;
    // Quem aceitou passa a usar o módulo; os módulos da organização são relidos antes de abrir a prestação.
    setModulosUser(atual => (atual.includes("prestacao") ? atual : [...atual, "prestacao"]));
    setMemberships(atual => atual.map(m => m.organizationId === organizationId && !m.modulosAcesso.includes("prestacao")
      ? { ...m, modulosAcesso: [...m.modulosAcesso, "prestacao"] } : m));
    await carregarModulosOrg(organizationId);
    setModuloAtivo("prestacao");
    router.push("/prestacoes");
  }

  return (
    <OrganizationContext.Provider value={{ organizationId, organizationName: org.nome, papel: papelAtual, usaProducao: modulosCarregados && modulosOrg.includes("producao") && modulosUser.includes("producao") }}>
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

      {/* O "?" de ajuda: perguntar como usar o Jards ou falar com a equipe. */}
      {user && <AjudaFlutuante />}

      {conviteAberto && (
        <ConvitePrestacao
          organizationId={organizationId}
          podeAtivar={papelAtual === "admin"}
          onClose={() => setConviteAberto(false)}
          onAtivado={() => void prestacaoAtivada()}
        />
      )}

      {/* Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-20 veu md:hidden" aria-hidden="true" onClick={() => setMobileOpen(false)} />
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
          // Na Ticketeria o menu é fixo e não cobre o conteúdo: sem sombra, o fundo do menu e o do workspace ficam iguais (só o fio da borda separa).
          boxShadow: menuFixoAberto && !mobileOpen ? "none" : "4px 0 24px rgba(0,0,0,0.06)",
        }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExpanded(false); }}
        onClick={event => { if ((event.target as HTMLElement).closest("a")) setMobileOpen(false); }}
      >
        {/* Na Ticketeria não há logo: fica a faixa vazia, com a linha alinhada à da barra do topo, e a lista começa abaixo dela. */}
        {menuFixoAberto && <div className="flex-shrink-0 border-b" style={{ height: "3.5rem", borderColor: "rgba(13,13,13,.07)" }} aria-hidden="true" />}
        {/* Logo */}
        {!menuFixoAberto && <div
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
        </div>}

        {/* User pill (na Ticketeria o menu não mostra nome nem plano) */}
        {!menuFixoAberto && <div className="px-2 py-2.5 border-b flex-shrink-0" style={{ borderColor: "rgba(13,13,13,.07)" }}>
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
                  <p className="text-xs font-semibold text-[#282525] truncate whitespace-nowrap">{displayName}</p>
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
                  <p className="text-xs font-semibold text-[#282525] truncate whitespace-nowrap">{displayName}</p>
                  <p className="text-[0.625rem] text-black/35 truncate whitespace-nowrap">
                    <RotuloDoPlano />
                  </p>
                </div>
              )}
            </Link>
          )}
        </div>}

        {/* Módulo: captação (o CRM) e prestação de contas. Na Ticketeria o menu não mostra o seletor. */}
        {!isWorkspaceCaptador && !menuFixoAberto && (
          <SeletorDeModulo
            opcoes={opcoesDeModulo}
            ativo={moduloDoMenu}
            expandido={isExpanded}
            aberto={seletorAberto}
            onAbrir={setSeletorAberto}
            onTrocar={trocarModulo}
          />
        )}

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
                  correspondeRota(path, "/workspace-captador") ? "bg-[#1C0E33] text-white" : "text-black/40 hover:text-[#282525] hover:bg-black/[0.05]"
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
          ) : (
            <>
              {gruposFixos.map(desenharGrupo)}
              {gruposEmSecao.length > 0 && (
                <div className={`space-y-0.5 ${gruposFixos.length > 0 ? "mt-4" : ""}`}>
                  {gruposEmSecao.map(grupo => {
                    const Icone = grupo.icone as React.ElementType;
                    const comAtivo = grupo.items.some(item => item.href === hrefAtivo);
                    const aberta = secaoAberta(grupo);
                    const idDaLista = `menu-secao-${grupo.section.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}`;
                    return (
                      <div key={grupo.section}>
                        <button
                          type="button"
                          onClick={() => alternarSecao(grupo)}
                          aria-expanded={isExpanded ? aberta : undefined}
                          aria-controls={isExpanded ? idDaLista : undefined}
                          aria-current={comAtivo && !isExpanded ? "true" : undefined}
                          title={!isExpanded ? grupo.section : undefined}
                          aria-label={!isExpanded ? grupo.section : undefined}
                          className={`flex w-full items-center rounded text-[0.8125rem] font-medium transition-colors whitespace-nowrap overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5] ${
                            comAtivo && !isExpanded ? "bg-[#1C0E33] text-white" : comAtivo ? "text-[#282525] hover:bg-black/[0.05]" : "text-black/40 hover:text-[#282525] hover:bg-black/[0.05]"
                          }`}
                          style={{ gap: isExpanded ? 10 : 0, padding: isExpanded ? "8px 10px" : "8px 0", justifyContent: isExpanded ? "flex-start" : "center" }}
                        >
                          <Icone size={16} className="flex-shrink-0" aria-hidden="true" />
                          {isExpanded && <span className="flex-1 text-left">{grupo.section}</span>}
                          {isExpanded && <ChevronDown size={14} aria-hidden="true" className={`flex-shrink-0 text-black/35 transition-transform duration-200 motion-reduce:transition-none ${aberta ? "rotate-180" : ""}`} />}
                        </button>
                        {isExpanded && (
                          <div id={idDaLista} className="grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none" style={{ gridTemplateRows: aberta ? "1fr" : "0fr" }}>
                            <div className="min-h-0 overflow-hidden" style={{ visibility: aberta ? "visible" : "hidden", transition: aberta ? "visibility 0s" : "visibility 0s linear 200ms" }}>
                              <div className="space-y-0.5 pb-1 pt-0.5">
                                {grupo.items.map(({ label, href }) => {
                                  const ativo = href === hrefAtivo;
                                  return (
                                    <Link
                                      key={href}
                                      href={href}
                                      prefetch={false}
                                      aria-current={ativo ? "page" : undefined}
                                      className={`block truncate rounded py-2 pl-[2.25rem] pr-2.5 text-[0.8125rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5] ${
                                        ativo ? "bg-[#1C0E33] text-white" : "text-black/55 hover:text-[#282525] hover:bg-black/[0.05]"
                                      }`}
                                    >
                                      {label}
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {usaCaptacao && <BotaoUpgrade expandido={isExpanded} />}
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
          {ehProponente && !isWorkspaceCaptador && (
            <Link
              href="/workspace-proponente"
              title={!isExpanded ? "Espaço do proponente" : undefined}
              aria-label={!isExpanded ? "Espaço do proponente" : undefined}
              aria-current={correspondeRota(path, "/workspace-proponente") ? "page" : undefined}
              className={`flex items-center rounded text-[0.8125rem] font-medium transition whitespace-nowrap overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5] ${
                correspondeRota(path, "/workspace-proponente") ? "bg-black/[0.05] text-[#282525]" : "text-black/35 hover:text-[#282525] hover:bg-black/[0.05]"
              }`}
              style={{
                gap: isExpanded ? 10 : 0,
                padding: isExpanded ? "8px 10px" : "8px 0",
                justifyContent: isExpanded ? "flex-start" : "center",
              }}
            >
              <FolderOpen size={16} className="flex-shrink-0" aria-hidden="true" />
              {isExpanded && <span>Espaço do proponente</span>}
            </Link>
          )}
          {temConvites && !isWorkspaceCaptador && (
            <Link
              href="/convidado"
              title={!isExpanded ? "Acesso de convidado" : undefined}
              aria-label={!isExpanded ? "Acesso de convidado" : undefined}
              className="flex items-center rounded text-[0.8125rem] font-medium text-black/35 transition whitespace-nowrap overflow-hidden hover:text-[#282525] hover:bg-black/[0.05] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]"
              style={{
                gap: isExpanded ? 10 : 0,
                padding: isExpanded ? "8px 10px" : "8px 0",
                justifyContent: isExpanded ? "flex-start" : "center",
              }}
            >
              <DoorOpen size={16} className="flex-shrink-0" aria-hidden="true" />
              {isExpanded && <span>Acesso de convidado</span>}
            </Link>
          )}
          {/* Na Ticketeria o menu não tem o seletor de módulo: este link leva ao primeiro outro módulo que a pessoa usa. */}
          {menuFixoAberto && (
            <Link
              href={inicioDeOutroModulo(acessoModulos, "ticketeria")}
              prefetch={false}
              className="flex items-center rounded text-[0.8125rem] font-medium text-black/35 transition whitespace-nowrap overflow-hidden hover:text-[#282525] hover:bg-black/[0.05] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5]"
              style={{ gap: 10, padding: "8px 10px" }}
            >
              <ArrowLeft size={16} className="flex-shrink-0" aria-hidden="true" />
              <span>Sair da Ticketeria</span>
            </Link>
          )}
          {!isWorkspaceCaptador && (
          <Link
            href="/configuracoes"
            title={!isExpanded ? "Configurações" : undefined}
            aria-label={!isExpanded ? "Configurações" : undefined}
            aria-current={correspondeRota(path, "/configuracoes") ? "page" : undefined}
            className={`flex items-center rounded text-[0.8125rem] font-medium transition whitespace-nowrap overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7259B5] ${
              correspondeRota(path, "/configuracoes") ? "bg-black/[0.05] text-[#282525]" : "text-black/35 hover:text-[#282525] hover:bg-black/[0.05]"
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
      <div className={`flex flex-col h-full overflow-hidden transition-[padding] duration-200 motion-reduce:transition-none ${menuFixoAberto ? "md:pl-56" : "md:pl-14"}`}>

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
            {!menuFixoAberto && <img src="/jards-icon.svg" alt="Jards" className="h-6 w-6" />}
          </div>
          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* Na Ticketeria a barra do topo não tem o sino de notificações. */}
            {user && !menuFixoAberto && <NotificationBell userId={user.id} />}
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
                    <div role="menu" aria-label="Organizações" className="absolute right-0 top-10 z-50 w-64 rounded bg-white p-1.5 border elevacao-1">
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
                            <span className="block truncate text-[0.75rem] font-semibold text-[#282525]">{m.nome || "Sem nome"}</span>
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
          <EmailAutoSync />
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
