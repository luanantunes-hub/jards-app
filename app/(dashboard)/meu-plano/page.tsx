"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import {
  Check, Lock, ExternalLink, AlertCircle, CheckCircle2, Minus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrganizationId, useOrganizationRole } from "@/contexts/OrganizationContext";
import { useCreditos } from "@/contexts/CreditosContext";
import type { Profile, PlanTipo } from "@/lib/supabase/types";
import { AssinaturaDoModulo } from "@/components/prestacao/AssinaturaDoModulo";
import { useAssinaturaPrestacao } from "@/hooks/useAssinaturaPrestacao";
import { TESTE_GRATIS_DIAS } from "@/lib/modulos-contrato";
import { PRECO_MODULO_MENSAL, PRECO_VAGA_MENSAL } from "@/supabase/functions/_shared/cobranca-modulo";

// ─── Plan definitions ─────────────────────────────────────────────────────────

type UsageKey = "projetos" | "atividades" | "inscricoes" | "captadores" | "proponentes" | "clientes" | "desbloqueios";

const USAGE_LABEL: Record<UsageKey, string> = {
  projetos: "Projetos ativos",
  atividades: "Atividades em aberto",
  inscricoes: "Inscrições em andamento",
  captadores: "Captadores ativos",
  proponentes: "Proponentes",
  clientes: "Clientes ativos",
  desbloqueios: "Desbloqueios",
};

type PlanDef = {
  key: PlanTipo;
  label: string;
  preco: string;
  precoLegenda: string;
  /** Para quem é o plano, em uma frase. */
  para: string;
  destaque?: boolean;
  features: string[];
  limites: Partial<Record<UsageKey, number | null>>;
};

// Textos iguais aos de /precos: o plano só promete o que o app faz.
const PLANS: PlanDef[] = [
  {
    key: "gratuito",
    label: "Gratuito",
    preco: "R$ 0",
    precoLegenda: "para sempre",
    para: "Para começar a organizar a captação.",
    features: [
      "Negociações, empresas e contatos sem limite",
      "Incentivadores, editais abertos e histórico de aportes",
      "1 projeto ativo e 1 usuário",
      "Comparativo com até 15 empresas, no total",
    ],
    limites: { projetos: 1, atividades: 5, inscricoes: 5, captadores: 1, proponentes: 1, clientes: 5 },
  },
  {
    key: "basico",
    label: "Starter",
    preco: "R$ 62,90",
    precoLegenda: "por mês",
    para: "Para captar sem os limites do Gratuito.",
    features: [
      "Tudo do Gratuito, sem os limites",
      "100 créditos a cada mês pago",
      "Comparações de empresas sem limite",
      "Claude e ChatGPT conectados ao seu Jards",
      "1 usuário incluído; extras por R$ 19,90 por mês",
    ],
    limites: { desbloqueios: 100 },
  },
  {
    key: "profissional",
    label: "Pro",
    preco: "R$ 92,80",
    precoLegenda: "por mês",
    para: "Para equipes que abrem muitas empresas.",
    destaque: true,
    features: [
      "As mesmas funções do Starter",
      "200 créditos a cada mês pago",
      "1 usuário incluído; extras por R$ 19,90 por mês",
    ],
    limites: { desbloqueios: 200 },
  },
];

const SEM_LIMITE = "Sem limite";

// O que muda do Gratuito para os planos pagos. `uso` liga a linha ao contador da organização.
const COMPARATIVO: Array<{ rotulo: string; uso?: UsageKey; valores: [string | boolean, string | boolean, string | boolean] }> = [
  { rotulo: "Projetos ativos", uso: "projetos", valores: ["1", SEM_LIMITE, SEM_LIMITE] },
  { rotulo: "Atividades em aberto", uso: "atividades", valores: ["5", SEM_LIMITE, SEM_LIMITE] },
  { rotulo: "Inscrições em andamento", uso: "inscricoes", valores: ["5", SEM_LIMITE, SEM_LIMITE] },
  { rotulo: "Captadores ativos", uso: "captadores", valores: ["1", SEM_LIMITE, SEM_LIMITE] },
  { rotulo: "Proponentes", uso: "proponentes", valores: ["1", SEM_LIMITE, SEM_LIMITE] },
  { rotulo: "Clientes ativos", uso: "clientes", valores: ["5", SEM_LIMITE, SEM_LIMITE] },
  { rotulo: "Comparativo de empresas", valores: ["Até 15, no total", SEM_LIMITE, SEM_LIMITE] },
  { rotulo: "Créditos para liberar contatos", valores: [false, "100 por mês pago", "200 por mês pago"] },
  { rotulo: "Claude e ChatGPT conectados", valores: [false, true, true] },
  { rotulo: "Usuários", valores: ["1", "1 + extras", "1 + extras"] },
];

const CREDITOS = [
  { titulo: "1 crédito, 1 empresa", texto: "Libera os contatos de quem decide numa empresa, uma única vez, para toda a equipe." },
  { titulo: "O saldo se acumula", texto: "Cada mês pago soma créditos ao saldo. Se a assinatura for cancelada, o saldo zera." },
  { titulo: "O resto é livre", texto: "Gráficos e histórico de aportes de cada empresa ficam abertos em todos os planos." },
];

const DUVIDAS = [
  { pergunta: "Qual a diferença entre o Starter e o Pro?", resposta: "A quantidade de créditos: 100 ou 200 a cada mês pago. As funções são as mesmas." },
  { pergunta: "Os créditos vencem?", resposta: "Não enquanto a assinatura estiver ativa: cada mês pago soma créditos ao saldo. Se a assinatura for cancelada, o saldo zera." },
  { pergunta: "Como cancelo?", resposta: "Quem paga a assinatura cancela em Gerenciar assinatura, que abre o portal de pagamento. O cancelamento vale no fim do período já pago." },
  { pergunta: "O que acontece se eu cancelar?", resposta: "Nada é apagado. Você volta aos limites do Gratuito: o que já existe fica, e os contatos já liberados continuam visíveis." },
  { pergunta: "E se um pagamento atrasar?", resposta: "Você tem até 15 dias para regularizar sem perder os créditos nem a conexão com Claude e ChatGPT." },
  { pergunta: "Tem plano anual?", resposta: "Não. Hoje todas as assinaturas são mensais." },
];

// Status em que a assinatura ainda existe no Stripe: nunca abrir um checkout novo
// (geraria uma segunda assinatura). O portal do Stripe desta conta só cancela e troca
// o cartão, não troca de plano: a troca é pedida ao suporte.
const ASSINATURA_VIGENTE = ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"];

const reais = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ROTULO = "text-[0.6875rem] font-medium uppercase tracking-[.08em] text-black/45";

const SUPORTE = "mailto:luan.antunes@jards.com.br?subject=Trocar%20de%20plano%20no%20Jards";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tomDoUso(used: number, limit: number): "limite" | "perto" | "ok" {
  if (used >= limit) return "limite";
  if (limit > 1 && used >= limit - 1) return "perto";
  return "ok";
}

const COR_DO_USO = { limite: "#D94A4A", perto: "#B07A14", ok: "rgba(13,13,13,.75)" } as const;

function Medidor({ label, used, limit }: { label: string; used: number; limit: number }) {
  const tom = tomDoUso(used, limit);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[0.75rem]">
        <span className="text-black/55">{label}</span>
        <span className={`flex shrink-0 items-center gap-1 whitespace-nowrap font-semibold tabular-nums ${used ? "text-[#282525]" : "text-black/30"}`}>
          {tom === "limite" && <AlertCircle size={12} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[#D94A4A]" />}
          {used} de {limit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/[.06]">
        <div
          className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${Math.min((used / limit) * 100, 100)}%`, background: COR_DO_USO[tom] }}
        />
      </div>
    </div>
  );
}

function juntar(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

function Valor({ valor, escuro }: { valor: string | boolean; escuro?: boolean }) {
  if (valor === true) return <Check size={15} strokeWidth={2.5} aria-label="Incluído" className={escuro ? "text-[#282525]" : "text-[#7259B5]"} />;
  if (valor === false) return <Minus size={15} aria-label="Não incluído" className="text-black/25" />;
  return <span>{valor}</span>;
}

// ─── Prestação de contas ─────────────────────────────────────────────────────

const RECURSOS_PRESTACAO = [
  "O checklist do envio de cada lei, com a fonte de cada regra",
  "Extrato, despesas e pagamentos conferidos, com as pendências antes do envio",
  "Metas, evidências, relatórios e o pacote com os arquivos do envio ao órgão",
];

const ERROS_DO_TESTE: Record<string, string> = {
  sem_permissao: "Só quem administra a organização começa o teste.",
  ja_contratado: "A organização já teve a prestação de contas. Recarregue a página para ver a assinatura.",
};

/**
 * A prestação de contas em Meu plano: quem nunca teve o módulo vê o convite do
 * teste gratuito (o mesmo do seletor de módulos); quem já teve vê a assinatura.
 * Quem chega por ?assinar=prestacao (o cadastro da prestação manda para cá) vê
 * o mesmo, destacado; a volta do checkout (?modulo=prestacao) é sempre do cartão.
 */
function PrestacaoNoPlano({ destacar, retorno }: { destacar: boolean; retorno: "pago" | "cancelado" | null }) {
  const supabase = useMemo(() => createClient(), []);
  const organizationId = useOrganizationId();
  const { assinatura, carregando } = useAssinaturaPrestacao(organizationId);
  const [ativando, setAtivando] = useState(false);
  const [erro, setErro] = useState("");
  const convite = useRef<HTMLElement>(null);
  const mostraConvite = !retorno && !carregando && assinatura?.status === null;

  useEffect(() => {
    if (destacar && mostraConvite) convite.current?.scrollIntoView({ block: "start" });
  }, [destacar, mostraConvite]);

  async function comecarTeste() {
    if (!organizationId) return;
    setAtivando(true);
    setErro("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- função fora do tipo Database
    const { error } = await (supabase as any).rpc("fn_prestacao_aceitar_convite_gratuito", { p_organization_id: organizationId });
    if (error) {
      const codigo = Object.keys(ERROS_DO_TESTE).find(c => error.message?.includes(c));
      setErro(codigo ? ERROS_DO_TESTE[codigo] : "Não foi possível começar o teste agora. Tente de novo em instantes.");
      setAtivando(false);
      return;
    }
    // Navegação completa: o layout relê os módulos da organização e abre a prestação.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- o recarregamento é proposital
    window.location.assign("/prestacoes");
  }

  // Volta do checkout: o contrato pode ainda não existir enquanto o webhook confirma.
  if (retorno) return <AssinaturaDoModulo destacar={destacar} retorno={retorno} />;
  if (carregando) return <div className="h-64 animate-pulse rounded bg-black/[.04] motion-reduce:animate-none" />;
  // Já teve o módulo (teste, assinatura, cortesia ou só leitura): o cartão da assinatura.
  if (!assinatura || assinatura.status !== null) return <AssinaturaDoModulo destacar={destacar} retorno={null} />;

  return (
    <section ref={convite} id="prestacao-de-contas" aria-labelledby="titulo-prestacao"
      className="grid scroll-mt-6 overflow-hidden rounded border bg-white md:grid-cols-[1fr_minmax(16rem,24rem)]"
      style={{ borderColor: destacar ? "rgba(13,13,13,.28)" : "rgba(13,13,13,.08)" }}>
      <div className="p-6 sm:p-8">
        <p className={ROTULO}>Prestação de contas · módulo à parte</p>
        <h2 id="titulo-prestacao" className="mt-3 max-w-lg text-balance text-[1.5rem] font-bold leading-tight tracking-[-.02em] text-[#282525] sm:text-[1.75rem]">
          Teste a prestação de contas por {TESTE_GRATIS_DIAS} dias, sem cartão.
        </h2>
        <p className="mt-3 max-w-xl text-[0.875rem] leading-6 text-black/55">
          Rouanet, audiovisual, esporte e saúde no mesmo lugar onde você capta. A assinatura é própria, independente do plano da Captação.
        </p>
        <ul className="mt-5 space-y-2.5">
          {RECURSOS_PRESTACAO.map(item => (
            <li key={item} className="flex items-start gap-2.5 text-[0.8125rem] text-black/65">
              <Check size={13} strokeWidth={2.5} aria-hidden className="mt-1 shrink-0 text-[#2E8932]" />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          {assinatura.admin ? (
            <button
              type="button"
              onClick={comecarTeste}
              disabled={ativando || !organizationId}
              className="flex items-center gap-2 rounded acao-salvar px-5 py-3 text-[0.8125rem] font-semibold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E8932] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {ativando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden />}
              Começar teste gratuito de {TESTE_GRATIS_DIAS} dias
            </button>
          ) : (
            <p className="text-[0.8125rem] text-black/55">Peça a quem administra a organização para começar: o teste vale para a equipe toda.</p>
          )}
        </div>
        {erro && <p role="alert" className="mt-3 text-[0.75rem] text-[#B23B3B]">{erro}</p>}
        <p className="mt-4 max-w-xl text-[0.75rem] leading-5 text-black/40">
          Depois do teste, {reais(PRECO_MODULO_MENSAL)} por mês com 1 usuário, mais {reais(PRECO_VAGA_MENSAL)} por usuário extra. Sem assinatura, as prestações e os arquivos ficam guardados para consulta e exportação.
        </p>
      </div>
      <div className="flex items-end justify-center bg-[#FAFAF9] px-6 pt-6 md:px-4">
        <Image
          src="/illustrations/tamandua-contador.png"
          width={900}
          height={547}
          alt="Tamanduá do Jards fazendo as contas na mesa, com a calculadora e os papéis"
          className="h-auto w-full max-w-[22rem]"
        />
      </div>
    </section>
  );
}

// ─── Inner page (uses useSearchParams) ───────────────────────────────────────

function MeuPlanoInner() {
  const supabase    = createClient();
  const organizationId = useOrganizationId();
  const papel       = useOrganizationRole();
  // O plano é o da organização aberta (de quem paga), o mesmo que o banco usa para créditos e conector.
  const { assinatura, creditos, loading: carregandoAssinatura } = useCreditos();
  const params      = useSearchParams();
  // A volta do checkout da prestação de contas (P5.6) é tratada no cartão do módulo.
  const doModulo    = params.get("modulo") === "prestacao";
  const success     = !doModulo && params.get("success") === "1";
  const canceled    = !doModulo && params.get("canceled") === "1";
  const destacarModulo = doModulo || params.get("assinar") === "prestacao";
  const retornoModulo = !doModulo ? null : params.get("success") === "1" ? "pago" : params.get("canceled") === "1" ? "cancelado" : null;

  const [profile, setProfile]             = useState<Profile | null>(null);
  const [usage, setUsage] = useState<Record<UsageKey, number>>({
    projetos: 0,
    atividades: 0,
    inscricoes: 0,
    captadores: 0,
    proponentes: 0,
    clientes: 0,
    desbloqueios: 0,
  });
  const [loading, setLoading]             = useState(true);
  const [upgrading, setUpgrading]         = useState<PlanTipo | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [stripeAtivo, setStripeAtivo]     = useState(true);
  const [erro, setErro]                   = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!organizationId) return;
      setLoading(true);
      const hoje = new Date();
      const mesIni = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
      // Só o próprio perfil: a policy de equipe (e a de super admin) libera
      // outros perfis, e sem o filtro o .single() falhava e a tela caía em "Gratuito".
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [profileRes, projetosRes, atividadesRes, inscricoesRes, captadoresRes, proponentesRes, clientesRes, desbRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from("profiles").select("*").eq("id", user.id).maybeSingle() as Promise<{ data: Profile | null; error: unknown }>,
        supabase.from("projetos_crm").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).neq("status_operacional", "arquivado"),
        supabase.from("atividades").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("feita", false),
        supabase.from("editais_user").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["interesse", "inscrito", "em_analise"]),
        supabase.from("captadores").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("ativo", true),
        supabase.from("proponentes").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
        supabase.from("contas_patrocinio").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).neq("status", "encerrada"),
        supabase.from("desbloqueios").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).gte("created_at", mesIni),
      ]);

      if (profileRes.data) setProfile(profileRes.data as unknown as Profile);
      setUsage({
        projetos: projetosRes.count ?? 0,
        atividades: atividadesRes.count ?? 0,
        inscricoes: inscricoesRes.count ?? 0,
        captadores: captadoresRes.count ?? 0,
        proponentes: proponentesRes.count ?? 0,
        clientes: clientesRes.count ?? 0,
        desbloqueios: desbRes.count ?? 0,
      });

      // Check if Stripe is configured
      const stripeCheck = await fetch("/api/stripe/checkout", { method: "HEAD" }).catch(() => null);
      if (stripeCheck?.status === 503) setStripeAtivo(false);

      setLoading(false);
    }
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function handleUpgrade(plano: PlanTipo) {
    if (!stripeAtivo) return;
    setErro(null);
    setUpgrading(plano);
    try {
      const res  = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plano, organization_id: organizationId }),
      });
      const json = await res.json().catch(() => ({})) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setErro((res.status === 409 || res.status === 403) && json.error ? json.error : res.status === 401 ? "Sua sessão expirou. Entre de novo para assinar." : "Não foi possível abrir o pagamento. Tente de novo.");
        setUpgrading(null);
        return;
      }
      window.location.assign(json.url);
    } catch {
      setErro("Não foi possível abrir o pagamento. Tente de novo.");
      setUpgrading(null);
    }
  }

  async function handlePortal() {
    setErro(null);
    setPortalLoading(true);
    try {
      const res  = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json().catch(() => ({})) as { url?: string };
      if (!res.ok || !json.url) {
        setErro(res.status === 401 ? "Sua sessão expirou. Entre de novo para gerenciar a assinatura." : "Não foi possível abrir o gerenciamento da assinatura. Tente de novo.");
        setPortalLoading(false);
        return;
      }
      window.location.assign(json.url);
    } catch {
      setErro("Não foi possível abrir o gerenciamento da assinatura. Tente de novo.");
      setPortalLoading(false);
    }
  }

  // Plano, status e datas são os da organização (de quem paga); o perfil de quem vê só diz
  // se ele tem a própria assinatura no Stripe (trocar de plano é pelo portal).
  const planoAtual: PlanTipo = assinatura?.plano ?? "gratuito";
  const planDef    = PLANS.find((p) => p.key === planoAtual) ?? PLANS[0];
  const gratuito   = planoAtual === "gratuito";
  const limitesGratuito = Object.entries(PLANS[0].limites) as Array<[UsageKey, number]>;
  const noLimite   = limitesGratuito.filter(([key, limit]) => usage[key] >= limit).map(([key]) => USAGE_LABEL[key].toLowerCase());
  const temAssinatura = !!profile?.stripe_subscription_id && ASSINATURA_VIGENTE.includes(profile.stripe_subscription_status);
  const ehPagador  = assinatura?.ehPagador === true;
  const statusOrg  = assinatura?.status ?? "inactive";
  // Outra pessoa paga a organização: um segundo checkout criaria outra cobrança.
  const outroPaga  = !!assinatura?.temPagador && !ehPagador && ASSINATURA_VIGENTE.includes(statusOrg);
  // Assina quem administra a organização; quem paga troca de plano pelo portal.
  const podeAssinar = ehPagador || (papel === "admin" && !outroPaga);
  const carregando = loading || carregandoAssinatura;
  const situacao   = statusOrg === "active" ? "Ativa" : statusOrg === "trialing" ? "Período de teste" : statusOrg === "canceled" ? "Cancelada" : statusOrg === "inactive" ? null : "Pagamento pendente";
  // Quem paga sempre chega ao portal (pagar a fatura, trocar o cartão, cancelar), em qualquer plano.
  const mostraPortal = ehPagador && !!profile?.stripe_subscription_id;
  // past_due tem 15 dias de carência: nada fica suspenso nesse tempo.
  const emCarencia = statusOrg === "past_due" && assinatura?.diasRestantesCarencia != null;
  const suspensa   = !!assinatura && !emCarencia && ["past_due", "unpaid", "paused", "incomplete", "incomplete_expired"].includes(statusOrg);

  const botaoPortal = (
    <button
      type="button"
      onClick={handlePortal}
      disabled={portalLoading || !stripeAtivo}
      className="flex items-center gap-1.5 rounded border border-black/[.12] bg-white px-4 py-2.5 text-[0.8125rem] font-medium text-black/70 transition hover:bg-black/[.03] hover:text-[#282525] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-40 motion-reduce:transition-none"
    >
      <ExternalLink size={13} aria-hidden />
      {portalLoading ? "Abrindo…" : "Gerenciar assinatura"}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-[72rem] px-5 py-8 sm:px-8 sm:py-10">
      {/* Alerts */}
      {success && (
        <div className="flex items-center gap-3 bg-white border border-green-200 rounded px-5 py-4 mb-6">
          <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-900">Pagamento recebido pelo Stripe</p>
            <p className="text-xs text-green-700 mt-0.5">A ativação e os créditos aparecem assim que o webhook confirmar o pagamento.</p>
          </div>
        </div>
      )}
      {canceled && (
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded px-5 py-4 mb-6">
          <AlertCircle size={18} className="text-gray-500 flex-shrink-0" />
          <p className="text-sm text-gray-600">Checkout cancelado. Você pode tentar novamente quando quiser.</p>
        </div>
      )}
      {!stripeAtivo && (
        <div className="flex items-center gap-3 bg-white border border-amber-200 rounded px-5 py-4 mb-6">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-900">Pagamentos não configurados</p>
            <p className="text-xs text-amber-700 mt-0.5">Adicione as chaves Stripe ao <code className="rounded bg-black/[.05] px-1">.env.local</code> para ativar upgrades.</p>
          </div>
        </div>
      )}
      {emCarencia && (
        <div className="flex items-center gap-3 bg-white border border-amber-200 rounded px-5 py-4 mb-6">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-900">Pagamento em atraso</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {assinatura?.diasRestantesCarencia === 0 ? "O prazo para regularizar termina hoje" : `Faltam ${assinatura?.diasRestantesCarencia} ${assinatura?.diasRestantesCarencia === 1 ? "dia" : "dias"} para regularizar`} sem perder os créditos nem a conexão com Claude e ChatGPT.{" "}
              {ehPagador ? "Regularize em Gerenciar assinatura." : "Quem paga a assinatura regulariza o pagamento."}
            </p>
          </div>
        </div>
      )}
      {suspensa && (
        <div className="flex items-center gap-3 bg-white border border-[#D94E4E]/25 rounded px-5 py-4 mb-6">
          <AlertCircle size={18} className="text-[#B23A3A] flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-[#7A2626]">Assinatura temporariamente suspensa</p>
            <p className="text-xs text-[#B23A3A] mt-0.5">{ehPagador ? "Regularize o pagamento no portal para restaurar o plano e renovar os créditos automaticamente." : "Quem paga a assinatura regulariza o pagamento no portal."}</p>
          </div>
        </div>
      )}

      {erro && (
        <div role="alert" className="flex items-center gap-3 bg-white border border-[#D94E4E]/25 rounded px-5 py-4 mb-6">
          <AlertCircle size={18} className="text-[#B23A3A] flex-shrink-0" />
          <p className="text-sm text-[#B23A3A]">{erro}</p>
        </div>
      )}

      {destacarModulo && (
        <div className="mb-10">
          <PrestacaoNoPlano destacar retorno={retornoModulo} />
        </div>
      )}

      {/* Cabeçalho: onde a organização está e o que ganha assinando */}
      <section aria-labelledby="titulo-plano" aria-busy={carregando} className="grid items-center gap-x-10 gap-y-6 md:grid-cols-[1fr_minmax(13rem,19rem)]">
        <div className="min-w-0">
          <h1 id="titulo-plano" className={ROTULO} style={{ fontFamily: "var(--font-google-sans), system-ui, sans-serif" }}>Meu plano</h1>
          {carregando ? (
            <div className="mt-3 space-y-3 animate-pulse motion-reduce:animate-none" aria-hidden>
              <div className="h-10 w-72 max-w-full rounded bg-black/[.06]" />
              <div className="h-4 w-full max-w-lg rounded bg-black/[.06]" />
              <div className="h-4 w-2/3 max-w-md rounded bg-black/[.06]" />
            </div>
          ) : (
            <>
              <p data-display-title className="mt-2 text-[2.125rem] font-bold leading-[1.05] tracking-[-.03em] text-[#282525] sm:text-[2.75rem]">
                Você está no {planDef.label}.
              </p>
              {gratuito ? (
                <p className="mt-4 max-w-xl text-[0.9375rem] leading-7 text-black/55">
                  Assine para captar sem limites, liberar os contatos de quem decide nas empresas e conectar o Claude e o ChatGPT ao seu Jards.
                </p>
              ) : (
                <p className="mt-4 text-[0.9375rem] text-black/55">
                  {[situacao, assinatura?.periodoFim ? `período atual até ${new Date(assinatura.periodoFim).toLocaleDateString("pt-BR")}` : null].filter(Boolean).join(" · ")}
                </p>
              )}
              {outroPaga ? (
                <p className="mt-2 text-[0.8125rem] text-black/45">{assinatura?.pagadorNome ? `Paga por ${assinatura.pagadorNome}.` : "Paga por outra pessoa da equipe."}</p>
              ) : !podeAssinar ? (
                <p className="mt-2 text-[0.8125rem] text-black/45">Quem administra a organização assina o plano.</p>
              ) : null}

              {gratuito ? (
                <div className="mt-7 max-w-2xl">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                    {limitesGratuito.map(([key, limit]) => (
                      <Medidor key={key} label={USAGE_LABEL[key]} used={usage[key]} limit={limit} />
                    ))}
                  </div>
                  {noLimite.length > 0 && (
                    <p className="mt-4 flex items-start gap-2 text-[0.8125rem] text-[#B23A3A]">
                      <AlertCircle size={14} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
                      Você chegou ao limite de {juntar(noLimite)}. Nos planos pagos, {noLimite.length > 1 ? "esses limites não existem" : "esse limite não existe"}.
                    </p>
                  )}
                  {mostraPortal && <div className="mt-6">{botaoPortal}</div>}
                </div>
              ) : (
                <div className="mt-7 flex flex-wrap items-end gap-x-10 gap-y-4">
                  <div>
                    <p className="text-[0.75rem] text-black/50">Créditos disponíveis</p>
                    <p className="mt-1 text-[1.75rem] font-semibold tabular-nums leading-none text-[#282525]">{creditos?.creditos_disponiveis ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[0.75rem] text-black/50">Empresas liberadas este mês</p>
                    <p className="mt-1 text-[1.75rem] font-semibold tabular-nums leading-none text-[#282525]">{usage.desbloqueios}</p>
                  </div>
                  {mostraPortal && botaoPortal}
                  {assinatura && !assinatura.ativa && (
                    <p className="w-full text-[0.75rem] text-black/45">Os créditos voltam a liberar contatos quando o pagamento for regularizado.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <Image
          src={gratuito ? "/tamandua-assine-plano.png" : "/illustrations/tamandua-boas-vindas-plano.png"}
          width={1216}
          height={992}
          priority
          alt={gratuito ? "Tamanduá do Jards passando por uma porta aberta, de terno e celular na mão" : "Tamanduá do Jards brindando, com balões"}
          className="mx-auto hidden h-auto w-full max-w-[19rem] [clip-path:inset(3px)] md:block"
        />
      </section>

      {/* Planos */}
      <section id="planos" aria-labelledby="titulo-planos" className="mt-14 scroll-mt-6">
        <h2 id="titulo-planos" className="text-[1.375rem] font-bold tracking-[-.02em] text-[#282525]">
          {gratuito ? "Escolha como quer captar" : "Planos da Captação"}
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3 md:items-stretch">
          {PLANS.map((plan) => {
            // Enquanto carrega, nenhum cartão é o "seu plano" e nenhum oferece assinatura.
            const isAtual   = !carregando && plan.key === planoAtual;
            const isUpgrade = PLANS.findIndex((p) => p.key === plan.key) > PLANS.findIndex((p) => p.key === planoAtual);
            const isLoading = upgrading === plan.key;
            const dark      = !!plan.destaque;

            return (
              <div
                key={plan.key}
                className="relative flex flex-col rounded border p-6 sm:p-7"
                style={{
                  background: dark ? "#1C0E33" : "#fff",
                  borderColor: dark ? "#1C0E33" : isAtual ? "rgba(13,13,13,.32)" : "rgba(13,13,13,.08)",
                  boxShadow: dark ? "0 18px 40px -18px rgba(13,13,13,.45)" : undefined,
                }}
              >
                <div className="flex min-h-[1.375rem] items-center justify-between gap-3">
                  <p className="text-[0.75rem] font-semibold uppercase tracking-[.1em]" style={{ color: dark ? "rgba(255,255,255,.6)" : "rgba(13,13,13,.45)" }}>
                    {plan.label}
                  </p>
                  {isAtual ? (
                    <span className="rounded px-2 py-0.5 text-[0.6875rem] font-semibold" style={dark ? { background: "rgba(255,255,255,.14)", color: "#fff" } : { background: "rgba(13,13,13,.06)", color: "rgba(13,13,13,.6)" }}>
                      Seu plano
                    </span>
                  ) : plan.destaque ? (
                    <span className="rounded bg-[#B9A6E8] px-2 py-0.5 text-[0.6875rem] font-semibold text-[#282525]">Mais popular</span>
                  ) : null}
                </div>
                <p className="mt-2 min-h-[2.5rem] text-[0.8125rem] leading-5" style={{ color: dark ? "rgba(255,255,255,.55)" : "rgba(13,13,13,.5)" }}>
                  {plan.para}
                </p>

                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-[2.25rem] font-semibold tabular-nums leading-none tracking-tight" style={{ color: dark ? "#fff" : "#282525" }}>{plan.preco}</span>
                  <span className="text-[0.8125rem]" style={{ color: dark ? "rgba(255,255,255,.45)" : "rgba(13,13,13,.4)" }}>{plan.precoLegenda}</span>
                </p>

                <div className="my-5 h-px w-full" style={{ background: dark ? "rgba(255,255,255,.14)" : "rgba(13,13,13,.08)" }} />

                <ul className="mb-7 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[0.8125rem] leading-5" style={{ color: dark ? "rgba(255,255,255,.85)" : "rgba(13,13,13,.68)" }}>
                      <Check size={13} strokeWidth={2.5} aria-hidden className="mt-1 shrink-0" style={{ color: dark ? "#B9A6E8" : plan.key === "gratuito" ? "rgba(13,13,13,.4)" : "#7259B5" }} />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {carregando ? (
                  <div className="h-11 animate-pulse rounded motion-reduce:animate-none" style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(13,13,13,.05)" }} aria-hidden />
                ) : isAtual ? (
                  <p className="py-2.5 text-center text-[0.8125rem] font-medium" style={{ color: dark ? "rgba(255,255,255,.55)" : "rgba(13,13,13,.4)" }}>
                    Você está neste plano
                  </p>
                ) : !podeAssinar ? null : temAssinatura ? (
                  // Já existe assinatura no Stripe: um checkout novo seria uma segunda cobrança,
                  // e o portal não troca de plano. Voltar ao Gratuito é cancelar.
                  plan.key === "gratuito" ? (
                    ehPagador ? (
                      <p className="py-2.5 text-center text-[0.75rem]" style={{ color: "rgba(13,13,13,.4)" }}>
                        Para voltar a ele, cancele em Gerenciar assinatura
                      </p>
                    ) : null
                  ) : (
                    <p className="py-2.5 text-center text-[0.75rem]" style={{ color: dark ? "rgba(255,255,255,.55)" : "rgba(13,13,13,.45)" }}>
                      {ehPagador ? "Para trocar de plano, " : "Para assinar nesta organização, "}
                      <a href={SUPORTE} className="underline decoration-current/30 underline-offset-2 transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-[#7259B5]">fale com a gente</a>
                    </p>
                  )
                ) : isUpgrade ? (
                  <button
                    type="button"
                    onClick={() => handleUpgrade(plan.key)}
                    disabled={!!upgrading || portalLoading || !stripeAtivo}
                    className="w-full rounded py-3 text-[0.8125rem] font-semibold transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7259B5] active:scale-[.98] disabled:opacity-50 motion-reduce:transition-none"
                    style={dark
                      ? { background: stripeAtivo ? "#fff" : "rgba(255,255,255,.25)", color: "#282525" }
                      : { background: stripeAtivo ? "#1C0E33" : "rgba(28,14,51,.35)", color: "#fff" }}
                  >
                    {isLoading ? "Redirecionando…" : stripeAtivo ? `Assinar o ${plan.label}` : <span className="flex items-center justify-center gap-1"><Lock size={11} /> Stripe pendente</span>}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        {!carregando && podeAssinar && gratuito && !temAssinatura && (
          <p className="mt-4 text-[0.75rem] text-black/45">
            Assinatura mensal, paga pelo Stripe. Você cancela quando quiser, e o cancelamento vale no fim do período já pago.
          </p>
        )}

        {/* Créditos */}
        <div className="mt-10 grid gap-6 border-t border-black/[.08] pt-8 sm:grid-cols-3">
          {CREDITOS.map(item => (
            <div key={item.titulo}>
              <p className="text-[0.875rem] font-semibold text-[#282525]">{item.titulo}</p>
              <p className="mt-1.5 text-[0.8125rem] leading-5 text-black/55">{item.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparativo */}
      <section aria-labelledby="titulo-comparativo" className="mt-14">
        <h2 id="titulo-comparativo" className="text-[1.375rem] font-bold tracking-[-.02em] text-[#282525]">O que muda quando você assina</h2>
        <div className="mt-5 overflow-x-auto rounded border border-black/[.08]">
          <table className="w-full border-collapse text-left text-[0.75rem] sm:min-w-[38rem] sm:text-[0.8125rem]">
            <caption className="sr-only">Limites e recursos do Gratuito, do Starter e do Pro</caption>
            <tbody>
              <tr className="border-b border-black/[.08]">
                <th scope="col" className="w-[34%] px-3 py-3.5 font-normal text-black/40 sm:px-5"><span className="sr-only">Recurso</span></th>
                {PLANS.map(plan => (
                  <th key={plan.key} scope="col" className={`px-3 py-3.5 text-[0.8125rem] font-semibold sm:px-5 sm:text-[0.875rem] ${plan.destaque ? "bg-[#7259B5]/[.06] text-[#282525]" : "text-[#282525]"}`}>
                    {plan.label}
                    {!carregando && plan.key === planoAtual && <span className="ml-2 hidden text-[0.6875rem] font-medium text-black/40 sm:inline">seu plano</span>}
                  </th>
                ))}
              </tr>
              {COMPARATIVO.map(linha => {
                const emUso = gratuito && !carregando && linha.uso !== undefined ? usage[linha.uso] : null;
                const limite = linha.uso !== undefined ? PLANS[0].limites[linha.uso] ?? null : null;
                const estourou = emUso !== null && limite !== null && emUso >= limite;
                return (
                  <tr key={linha.rotulo} className="border-b border-black/[.06] last:border-b-0">
                    <th scope="row" className="px-3 py-3 font-normal text-black/65 sm:px-5">{linha.rotulo}</th>
                    {linha.valores.map((valor, i) => (
                      <td key={PLANS[i].key} className={`px-3 py-3 tabular-nums sm:px-5 ${PLANS[i].destaque ? "bg-[#7259B5]/[.06] text-[#282525]" : i === 0 ? "text-black/55" : "text-[#282525]"}`}>
                        <span className="inline-flex items-center gap-2">
                          <Valor valor={valor} escuro={!!PLANS[i].destaque} />
                          {i === 0 && emUso !== null && (
                            <span className={`hidden text-[0.6875rem] sm:inline ${estourou ? "font-semibold text-[#B23A3A]" : "text-black/35"}`}>você usa {emUso}</span>
                          )}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Prestação de contas */}
      {!destacarModulo && (
        <div className="mt-14">
          <PrestacaoNoPlano destacar={false} retorno={null} />
        </div>
      )}

      {/* Dúvidas */}
      <section aria-labelledby="titulo-duvidas" className="mt-14 border-t border-black/[.08] pt-10">
        <h2 id="titulo-duvidas" className="text-[1.375rem] font-bold tracking-[-.02em] text-[#282525]">Dúvidas</h2>
        <dl className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2">
          {DUVIDAS.map(item => (
            <div key={item.pergunta}>
              <dt className="text-[0.875rem] font-semibold text-[#282525]">{item.pergunta}</dt>
              <dd className="mt-1.5 text-[0.8125rem] leading-5 text-black/55">{item.resposta}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

// ─── Page wrapper (Suspense for useSearchParams) ──────────────────────────────

export default function MeuPlanoPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto w-full max-w-[72rem] px-5 py-8 sm:px-8 sm:py-10">
        <div className="h-10 w-72 bg-black/8 rounded animate-pulse mb-8" />
        <div className="grid md:grid-cols-3 gap-4">
          {[0,1,2].map(i => <div key={i} className="h-80 rounded bg-black/8 animate-pulse" />)}
        </div>
      </div>
    }>
      <MeuPlanoInner />
    </Suspense>
  );
}
